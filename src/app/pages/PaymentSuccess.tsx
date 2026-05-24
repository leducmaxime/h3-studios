"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Calendar, Home, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/booking";

interface PaymentSuccessProps {
  paymentId?: string;
}

export function PaymentSuccess({ paymentId }: PaymentSuccessProps) {
  const [bookingData, setBookingData] = useState<{
    refs: string[];
    email: string;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Try query params first (more reliable than localStorage across tabs/browsers)
    const params = new URLSearchParams(window.location.search);
    const refsParam = params.get("refs");
    const totalParam = params.get("total");
    const emailParam = params.get("email");

    if (refsParam && totalParam && emailParam) {
      setBookingData({
        refs: refsParam.split(",").filter(Boolean),
        email: decodeURIComponent(emailParam),
        total: parseInt(totalParam, 10) / 100,
      });
    } else {
      // Fallback: localStorage (same browser, same tab flow)
      const storedData = localStorage.getItem("h3-pending-payment");
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setBookingData(data);
        } catch {
          console.error("Failed to parse booking data");
        }
      }
    }

    // Always clear localStorage
    localStorage.removeItem("h3-pending-payment");
    localStorage.removeItem("h3-booking-state");

    setLoading(false);
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-16 pt-32">
      <div className={`w-full max-w-[600px] px-2 sm:px-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/90 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />

          <div className="relative p-6 sm:p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
            </div>

            <h1 className="mb-2 font-blanka text-2xl sm:text-3xl text-green-400">
              PAIEMENT CONFIRMÉ
            </h1>
            
            <p className="mb-6 text-white/70">
              Merci ! Votre réservation est confirmée.
            </p>

            {bookingData && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/15 p-4 text-left">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Référence(s)</span>
                  <span className="font-mono font-medium text-primary">
                    {bookingData.refs.join(", ")}
                  </span>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Total payé</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(bookingData.total)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/60">Confirmation envoyée à</span>
                  <span className="break-all text-sm text-white/80">{bookingData.email}</span>
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
