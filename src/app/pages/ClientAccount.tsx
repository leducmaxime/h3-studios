"use client";

import { useState, useEffect } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";

interface ClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
}

interface BookingRow {
  id: string;
  booking_ref: string;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_type: string;
  total_price: number;
  status: string;
  payment_status: string | null;
  band_name: string | null;
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmée", color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Annulée", color: "bg-red-500/20 text-red-400" },
  completed: { label: "Terminée", color: "bg-blue-500/20 text-blue-400" },
  "no-show": { label: "Absent", color: "bg-yellow-500/20 text-yellow-400" },
};

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function ClientAccount() {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/client/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/client/bookings").then((r) => r.ok ? r.json() : []),
    ]).then(([userData, bookingsData]) => {
      if (!userData?.data) {
        window.location.href = "/mon-compte/connexion";
        return;
      }
      setUser(userData.data);
      setBookings(Array.isArray(bookingsData?.data) ? bookingsData.data : Array.isArray(bookingsData) ? bookingsData : []);
      setLoading(false);
    }).catch(() => {
      window.location.href = "/mon-compte/connexion";
    });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/client/logout", { method: "POST" });
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

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed" && b.status !== "no-show");
  const past = bookings.filter((b) => b.date < today || b.status === "cancelled" || b.status === "completed" || b.status === "no-show");

  return (
    <div className="min-h-[80vh] bg-black px-4 py-16">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-blanka text-3xl md:text-4xl text-primary tracking-wider">MON COMPTE</h1>
            <p className="mt-1 text-zinc-400 text-sm">Bonjour, {user.name}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate("/mon-compte/profil")}
            >
              Modifier mon profil
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-800/50 text-red-400 hover:bg-red-950/50"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "..." : "Déconnexion"}
            </Button>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Réservations à venir</h2>
          {upcoming.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center text-zinc-500">
              Aucune réservation à venir
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
          <h2 className="text-lg font-semibold text-white mb-4">Réservations passées</h2>
          {past.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center text-zinc-500">
              Aucune réservation passée
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

function BookingCard({ booking }: { booking: BookingRow }) {
  const status = STATUS_LABELS[booking.status] ?? { label: booking.status, color: "bg-zinc-500/20 text-zinc-400" };
  const studio = STUDIO_LABELS[booking.studio_id] ?? booking.studio_id;
  const group = GROUP_LABELS[booking.group_type] ?? booking.group_type;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-medium">{formatDateFR(booking.date)}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300">{booking.start_time} — {booking.end_time}</span>
        </div>
        <div className="text-sm text-zinc-400">
          {studio} — {group}{booking.band_name ? ` — ${booking.band_name}` : ""}
        </div>
        <div className="text-xs text-zinc-500 mt-1">Réf : {booking.booking_ref}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
          {status.label}
        </span>
        <span className="text-white font-semibold">{(booking.total_price / 100).toFixed(2)} €</span>
      </div>
    </div>
  );
}