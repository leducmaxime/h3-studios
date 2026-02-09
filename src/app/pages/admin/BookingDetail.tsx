"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  ChevronLeft,
  Calendar,
  Clock,
  User,
  CreditCard,
  MapPin,
  Edit,
  XCircle,
  RefreshCw,
  Check,
  AlertTriangle,
  Music,
} from "lucide-react";
import {
  loadAdminStore,
  cancelBooking,
  markNoShow,
  markPaymentPaid,
  rescheduleBooking,
  type AdminStore,
  type AdminBooking,
} from "@/lib/admin-store";
import { STUDIOS, EQUIPMENT, formatPrice, TIME_SLOTS } from "@/lib/booking";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDuration(startTime: string, endTime: string): string {
  const startIdx = TIME_SLOTS.indexOf(startTime);
  let endIdx = TIME_SLOTS.indexOf(endTime);
  if (endIdx === -1) endIdx = TIME_SLOTS.length;
  const slots = endIdx - startIdx;
  const hours = slots * 0.5;
  if (hours === 1) return "1 heure";
  return `${hours} heures`;
}

interface BookingDetailProps {
  bookingId: string;
}

export function AdminBookingDetail({ bookingId }: BookingDetailProps) {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [booking, setBooking] = useState<AdminBooking | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");

  useEffect(() => {
    const adminStore = loadAdminStore();
    setStore(adminStore);
    const found = adminStore.bookings.find(b => b.id === bookingId);
    if (found) {
      setBooking(found);
      setNewDate(found.date);
      setNewStartTime(found.startTime);
      setNewEndTime(found.endTime);
    }
  }, [bookingId]);

  if (!store || !booking) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const user = store.users.find(u => u.id === booking.userId);
  const payment = store.payments.find(p => p.bookingId === booking.id);
  const studio = STUDIOS[booking.studioId];

  const handleCancel = () => {
    const reason = prompt("Raison de l'annulation :");
    if (reason === null) return;
    
    cancelBooking(store, booking.id, reason || "Non spécifié");
    setBooking({ ...booking, status: "cancelled", cancelReason: reason || "Non spécifié" });
  };

  const handleNoShow = () => {
    if (!confirm("Marquer comme no-show ?")) return;
    markNoShow(store, booking.id);
    setBooking({ ...booking, status: "no-show" });
  };

  const handleMarkPaid = () => {
    if (!payment) return;
    if (!confirm("Confirmer le paiement reçu ?")) return;
    markPaymentPaid(store, payment.id);
    setBooking({ ...booking, paymentStatus: "paid" });
  };

  const handleReschedule = () => {
    setRescheduleError("");
    const result = rescheduleBooking(store, booking.id, newDate, newStartTime, newEndTime);
    
    if (!result.success) {
      setRescheduleError(result.error || "Erreur lors du déplacement");
      return;
    }
    
    const updatedBooking = store.bookings.find(b => b.id === booking.id);
    if (updatedBooking) {
      setBooking(updatedBooking);
    }
    setShowReschedule(false);
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-500/10 text-green-500 border-green-500/30",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/30",
    "no-show": "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  };

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmé",
    completed: "Terminé",
    cancelled: "Annulé",
    "no-show": "No-show",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <a
            href="/admin/bookings"
            className="rounded-lg p-2 hover:bg-zinc-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{booking.bookingRef}</h1>
            <p className="text-zinc-400">Détails de la réservation</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusColors[booking.status]}`}>
            {statusLabels[booking.status]}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Informations de réservation</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Date</p>
                    <p className="font-medium">{formatDate(booking.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Horaire</p>
                    <p className="font-medium">
                      {booking.startTime} - {booking.endTime}
                      <span className="ml-2 text-zinc-400">({formatDuration(booking.startTime, booking.endTime)})</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Studio</p>
                    <p className="font-medium">{studio.name}</p>
                    <p className="text-sm text-zinc-400">{studio.size}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Type</p>
                    <p className="font-medium capitalize">{booking.groupType}</p>
                  </div>
                </div>
              </div>

              {booking.equipment.length > 0 && (
                <div className="mt-6 border-t border-zinc-800 pt-4">
                  <p className="mb-2 text-sm text-zinc-400">Équipements</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.equipment.map((eq) => (
                      <span key={eq.id} className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                        {EQUIPMENT[eq.id].name} ×{eq.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {booking.status === "confirmed" && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Déplacer
                  </button>
                  <button
                    onClick={handleNoShow}
                    className="flex items-center gap-2 rounded-lg border border-yellow-500/30 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    No-show
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="h-4 w-4" />
                    Annuler
                  </button>
                </div>
              )}

              {booking.status === "cancelled" && booking.cancelReason && (
                <div className="mt-6 rounded-lg bg-red-500/10 p-4 border-t border-zinc-800">
                  <p className="text-sm text-red-400">
                    <strong>Raison de l'annulation :</strong> {booking.cancelReason}
                  </p>
                </div>
              )}
            </div>

            {showReschedule && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                <h3 className="mb-4 font-semibold">Déplacer la réservation</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Nouvelle date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Début</label>
                    <select
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    >
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Fin</label>
                    <select
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    >
                      {[...TIME_SLOTS.slice(1), "00:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {rescheduleError && (
                  <p className="mt-2 text-sm text-red-400">{rescheduleError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleReschedule}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary/90"
                  >
                    Confirmer le déplacement
                  </button>
                  <button
                    onClick={() => setShowReschedule(false)}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Client</h2>
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      {user.bandName && <p className="text-sm text-zinc-400">{user.bandName}</p>}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-400">
                    <p>{user.email}</p>
                    <p>{user.phone}</p>
                  </div>
                  <a
                    href={`/admin/users/${user.id}`}
                    className="inline-block text-sm text-primary hover:underline"
                  >
                    Voir le profil →
                  </a>
                </div>
              ) : (
                <p className="text-zinc-400">Client inconnu</p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Paiement</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Répétition</span>
                  <span>{formatPrice(booking.basePrice)}</span>
                </div>
                {booking.equipmentPrice > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Équipements</span>
                    <span>{formatPrice(booking.equipmentPrice)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-3">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(booking.totalPrice)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-zinc-400">Méthode</span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4" />
                    {booking.paymentMethod === "card" ? "Carte" : "Espèces"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Statut</span>
                  <span className={
                    booking.paymentStatus === "paid"
                      ? "text-green-500"
                      : "text-yellow-500"
                  }>
                    {booking.paymentStatus === "paid" ? "Payé" : "En attente"}
                  </span>
                </div>
                {booking.paymentStatus === "pending" && payment && (
                  <button
                    onClick={handleMarkPaid}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-500/30"
                  >
                    <Check className="h-4 w-4" />
                    Marquer comme payé
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
