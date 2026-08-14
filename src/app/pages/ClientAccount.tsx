"use client";

import { useState, useEffect } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, MapPin, Users, Music, ArrowRight, History, Plus, User } from "lucide-react";
import { getParisDateISO } from "@/lib/utils";
import { getBookingAmountDue, getDisplayPaymentStatusFromSummary, type DisplayPaymentStatus } from "@/lib/booking-totals";
import { logout, useClientAuth } from "@/lib/client-auth-store";

interface BookingRow {
  id: string;
  booking_ref: string;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_type: string;
  total_price: number;
  promo_discount: number;
  status: string;
  payment_status: string | null;
  band_name: string | null;
  total_paid?: number;
  total_collected?: number;
  total_refunded?: number;
}

const STUDIO_LABELS: Record<string, string> = {
  "la-scene": "La Scène",
  "le-podium": "Le Podium",
};

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon?: React.ElementType }> = {
  confirmed: { label: "Confirmée", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cancelled: { label: "Annulée", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  completed: { label: "Terminée", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  "no-show": { label: "Absent", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

const PAYMENT_CONFIG: Record<DisplayPaymentStatus, { label: string; bg: string; text: string; border: string }> = {
  paid: { label: "Payé", bg: "bg-emerald-600/10", text: "text-emerald-400", border: "border-emerald-600/20" },
  "pay-on-site": { label: "À payer sur place", bg: "bg-orange-600/10", text: "text-orange-400", border: "border-orange-600/20" },
  pending: { label: "En attente", bg: "bg-amber-600/10", text: "text-amber-400", border: "border-amber-600/20" },
  cancelled: { label: "Annulée", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
  "paid-before-cancel": { label: "Payée avant annulation", bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-600/20" },
  refunded: { label: "Remboursé", bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-600/20" },
};

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short" });
}

export function ClientAccount() {
  const { user, status } = useClientAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      window.location.href = "/mon-compte/connexion";
      return;
    }
    fetch("/api/client/bookings").then((r) => r.ok ? r.json() : []).then((bookingsData) => {
      const bk = bookingsData as { data: BookingRow[] } | BookingRow[];
      setBookings(Array.isArray((bk as { data: BookingRow[] }).data) ? (bk as { data: BookingRow[] }).data : Array.isArray(bk) ? bk : []);
      setLoading(false);
    }).catch(() => {
      window.location.href = "/mon-compte/connexion";
    });
  }, [status, user?.id]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.href = "/mon-compte/connexion";
    } catch {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    );
  }

  const today = getParisDateISO();
  const upcoming = bookings.filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed" && b.status !== "no-show");
  const past = bookings.filter((b) => b.date < today || b.status === "cancelled" || b.status === "completed" || b.status === "no-show");

  // first_name/last_name are the source of truth; fall back to `name` for
  // guest-created accounts (auto-created at booking time, no split name).
  const fullName = [user.first_name, user.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const displayName = fullName || user.name.trim();

  return (
    <div className="min-h-[80vh] bg-black px-2 lg:px-4 pt-32 pb-16">
      <div className="container max-w-4xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-4xl lg:text-6xl">Mes reservations</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          {displayName && (
            <p className="mt-4 text-sm text-zinc-400 lg:text-base">
              Bonjour <span className="font-medium text-zinc-100">{displayName}</span>
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              onClick={() => navigate("/mon-compte/profil")}
            >
              <User className="h-4 w-4 mr-2" />
              Mon profil
            </Button>
            <Button
              className="bg-primary text-black hover:bg-primary/90"
              size="sm"
              onClick={() => navigate("/reservation")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle réservation
            </Button>
          </div>
        </div>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-white">Réservations à venir</h2>
            <span className="ml-auto text-sm text-zinc-500">{upcoming.length} réservation{upcoming.length !== 1 ? "s" : ""}</span>
          </div>
          {upcoming.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 text-center">
              <CalendarDays className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">Aucune réservation à venir</p>
              <Button
                className="mt-4 bg-primary text-black hover:bg-primary/90"
                size="sm"
                onClick={() => navigate("/reservation")}
              >
                Réserver un studio
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <History className="h-4 w-4 text-zinc-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Réservations passées</h2>
            <span className="ml-auto text-sm text-zinc-500">{past.length} réservation{past.length !== 1 ? "s" : ""}</span>
          </div>
          {past.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 text-center">
              <History className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">Aucune réservation passée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon: Icon }: { value: string | number; label: string; icon: React.ElementType }) {
  return (
    <div className="bg-black/30 border border-zinc-800/50 rounded-xl p-4 text-center">
      <Icon className="h-5 w-5 text-primary/60 mx-auto mb-2" />
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function BookingCard({ booking }: { booking: BookingRow }) {
  const status = STATUS_CONFIG[booking.status] ?? { label: booking.status, bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" };
  const displayPaymentStatus = getDisplayPaymentStatusFromSummary(
    booking.status,
    booking.payment_status,
    booking.total_collected ?? booking.total_paid ?? 0,
    booking.total_refunded ?? 0,
  );
  const payment = PAYMENT_CONFIG[displayPaymentStatus] ?? { label: displayPaymentStatus, bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" };
  const studio = STUDIO_LABELS[booking.studio_id] ?? booking.studio_id;
  const group = GROUP_LABELS[booking.group_type] ?? booking.group_type;
  const isPast = booking.date < getParisDateISO() || ["cancelled", "completed", "no-show"].includes(booking.status);
  // Une réservation annulée ne présente jamais de montant dû.
  const amount = booking.status === "cancelled"
    ? null
    : getBookingAmountDue({ base_price: 0, equipment_price: 0, total_price: booking.total_price, promo_discount: booking.promo_discount ?? 0 });

  return (
    <div className={`group bg-zinc-900/50 border rounded-2xl p-5 transition-all duration-200 hover:bg-zinc-900/70 ${isPast ? "border-zinc-800/50" : "border-zinc-800 hover:border-zinc-700"}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <div className={`h-14 w-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPast ? "bg-zinc-800/50" : "bg-primary/10"}`}>
            <span className={`text-xs font-medium ${isPast ? "text-zinc-500" : "text-primary/70"}`}>{getDayName(booking.date)}</span>
            <span className={`text-lg font-bold leading-tight ${isPast ? "text-zinc-400" : "text-white"}`}>{formatShortDate(booking.date).split(" ")[0]}</span>
          </div>
          <div className="hidden lg:block h-10 w-px bg-zinc-800" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">{formatDateFR(booking.date)}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {booking.start_time} — {booking.end_time}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-400 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              {studio}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              {group}
            </span>
            {booking.band_name && (
              <span className="flex items-center gap-1">
                <Music className="h-3.5 w-3.5 text-zinc-500" />
                {booking.band_name}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-600 mt-1.5 font-mono">{booking.booking_ref}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${payment.bg} ${payment.text} ${payment.border}`}>
            {payment.label}
          </span>
          <span className="text-white font-bold text-sm ml-1">
            {amount === null ? "—" : `${amount.toFixed(2).replace(".", ",")} €`}
          </span>
        </div>
      </div>
    </div>
  );
}
