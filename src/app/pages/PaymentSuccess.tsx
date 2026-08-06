"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Calendar, Clock, Home, Loader2, PackageCheck } from "lucide-react";
import { STUDIOS, formatDate, formatDuration, formatPrice, type GroupType, type StudioId } from "@/lib/booking";

interface PaymentSuccessProps {
  paymentId?: string;
}

interface SessionBooking {
  ref: string;
  studioId: StudioId;
  date: string;
  startTime: string;
  endTime: string;
  groupType: GroupType;
  equipment: unknown[];
  equipmentPrice: number;
  totalPrice: number;
  promoCode: string | null;
  promoDiscount: number;
}

interface SessionData {
  paymentStatus: string;
  amountTotal: number; // cents (Stripe)
  email?: string;
  bookings: SessionBooking[];
}

/** Generic non-sensitive fallback stored by the same-browser payment flow. */
interface FallbackData {
  refs: string[];
  email: string;
  total: number;
}

const GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo / Prof particulier",
  duo: "Duo",
  group: "Groupe (3+)",
};

export function PaymentSuccess({ paymentId }: PaymentSuccessProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [fallback, setFallback] = useState<FallbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    // Generic same-browser fallback (never URL query params — no URL PII).
    let stored: FallbackData | null = null;
    const storedRaw = localStorage.getItem("h3-pending-payment");
    localStorage.removeItem("h3-pending-payment");
    if (storedRaw) {
      try {
        stored = JSON.parse(storedRaw) as FallbackData;
      } catch {
        stored = null;
      }
    }

    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    const finish = () => {
      if (controller.signal.aborted) return;
      setLoading(false);
      setTimeout(() => setIsVisible(true), 50);
    };

    if (!sessionId) {
      setFallback(stored);
      finish();
      return () => controller.abort();
    }

    fetch(`/api/payment/session?session_id=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`session lookup failed: ${res.status}`);
        return res.json() as Promise<SessionData>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSession(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setFallback(stored);
      })
      .finally(finish);

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Payment wording derives from the API paymentStatus, never from the URL.
  // In fallback mode (no session lookup possible) we keep the historical
  // generic heading — the localStorage snapshot only exists right after a
  // Stripe redirect in the same browser.
  const isPaid = session ? session.paymentStatus === "paid" : true;
  const sortedBookings = session
    ? [...session.bookings].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    : [];

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-16 pt-32">
      <div className={`w-full max-w-[600px] px-2 sm:px-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/90 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />

          <div className="relative p-6 sm:p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full ${isPaid ? "bg-primary/20" : "bg-amber-400/15"}`}>
                {isPaid ? (
                  <CheckCircle className="h-12 w-12 text-primary" />
                ) : (
                  <Clock className="h-12 w-12 text-amber-400" />
                )}
              </div>
            </div>

            <h1 className={`mb-2 font-blanka text-2xl sm:text-3xl ${isPaid ? "text-green-400" : "text-amber-400"}`}>
              {isPaid ? "PAIEMENT CONFIRME" : "PAIEMENT EN COURS"}
            </h1>

            {session && !isPaid && (
              <p className="mb-6 text-white/70">
                Votre paiement est en cours de traitement. Vous recevrez une confirmation par e-mail.
              </p>
            )}

            {/* Détails des réservations — une carte par réservation */}
            {session && sortedBookings.length > 0 && (
              <div className="mb-6 text-left">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <PackageCheck className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold text-white/80">
                    Détails de {sortedBookings.length > 1 ? "vos réservations" : "votre réservation"}
                  </h2>
                </div>
                <div className="space-y-3">
                  {sortedBookings.map((booking) => (
                    <div
                      key={booking.ref}
                      className="rounded-xl border border-white/20 bg-black/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {STUDIOS[booking.studioId]?.name ?? booking.studioId}
                          </h3>
                          <p className="text-xs text-primary">
                            Réf : <span className="font-mono font-medium">{booking.ref}</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-bold text-primary">
                          {formatPrice(booking.totalPrice)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/60 capitalize">
                        {formatDate(new Date(booking.date), "long")} • {booking.startTime} - {booking.endTime} ({formatDuration(booking.startTime, booking.endTime)})
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {GROUP_LABELS[booking.groupType] ?? booking.groupType}
                      </p>
                      {booking.equipment.length > 0 && booking.equipmentPrice > 0 && (
                        <p className="mt-1 text-xs text-white/40">
                          Équipements supplémentaires : {formatPrice(booking.equipmentPrice)}
                        </p>
                      )}
                      {booking.promoDiscount > 0 && (
                        <p className="mt-1 text-xs text-green-400">
                          Réduction{booking.promoCode ? ` (${booking.promoCode})` : ""} : -{formatPrice(booking.promoDiscount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total + e-mail — issus uniquement de la réponse API sécurisée */}
            {session && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/15 p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">{isPaid ? "Total payé" : "Montant total"}</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(session.amountTotal / 100)}
                  </span>
                </div>
                {session.email && (
                  <div className="mt-3 flex flex-col gap-0.5 border-t border-white/10 pt-3">
                    <span className="text-white/60">Une confirmation sera envoyée à</span>
                    <span className="break-all text-sm text-white/80">{session.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fallback générique (pas de session_id ou lookup impossible) */}
            {!session && fallback && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/15 p-4 text-left">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Référence(s)</span>
                  <span className="font-mono font-medium text-primary">
                    {fallback.refs.join(", ")}
                  </span>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Total payé</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(fallback.total)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/60">Une confirmation sera envoyée à</span>
                  <span className="break-all text-sm text-white/80">{fallback.email}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <a
                href="/"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
              >
                <Home className="h-5 w-5" />
                Retour à l'accueil
              </a>

              <a
                href="/reservation"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 font-medium text-white transition-colors hover:bg-white/15"
              >
                <Calendar className="h-5 w-5" />
                Nouvelle réservation
              </a>
            </div>
          </div>
        </div>
      </div>

      <p className={`text-center text-sm text-white/40 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
        Des questions,{" "}
        <a href="/a-propos#contact" className="text-primary hover:underline">
          contactez-nous
        </a>
      </p>
    </div>
  );
}
