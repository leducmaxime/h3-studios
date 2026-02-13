"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Calendar,
  Clock,
  User,
  CreditCard,
  MapPin,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Music,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STUDIOS, formatPrice, TIME_SLOTS, type StudioId } from "@/lib/booking";
import { type DbBooking, type DbUser, type BookingStatus } from "@/lib/db-types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
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

const STATUS_CLASSES: Record<BookingStatus, string> = {
  confirmed: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  "no-show": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
  "no-show": "No-show",
};

interface BookingDetailProps {
  bookingId: string;
}

export function AdminBookingDetail({ bookingId }: BookingDetailProps) {
  const [booking, setBooking] = useState<DbBooking | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Reschedule dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // No-show dialog
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowLoading, setNoShowLoading] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`);
      const json = (await res.json()) as { success: boolean; data?: DbBooking; error?: string };
      if (json.success && json.data) {
        setBooking(json.data);
        setNewDate(json.data.date);
        setNewStartTime(json.data.start_time);
        setNewEndTime(json.data.end_time);

        // Fetch user
        const userRes = await fetch(`/api/admin/users/${json.data.user_id}`);
        const userJson = (await userRes.json()) as { success: boolean; data?: DbUser };
        if (userJson.success && userJson.data) {
          setUser(userJson.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch booking:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  if (loading || !booking) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const studio = STUDIOS[booking.studio_id as StudioId];
  const equipmentList: Array<{ id: string; quantity: number; name?: string }> = booking.equipment
    ? (() => { try { return JSON.parse(booking.equipment); } catch { return []; } })()
    : [];

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Annulée par l'admin" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Réservation annulée");
        setCancelOpen(false);
        setCancelReason("");
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur lors de l'annulation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleNoShow = async () => {
    setNoShowLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/no-show`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Marqué no-show");
        setNoShowOpen(false);
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setNoShowLoading(false);
    }
  };

  const handleReschedule = async () => {
    setRescheduleLoading(true);
    setRescheduleError("");
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, start_time: newStartTime, end_time: newEndTime }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Réservation déplacée");
        setRescheduleOpen(false);
        fetchBooking();
      } else {
        setRescheduleError(json.error || "Conflit détecté");
      }
    } catch {
      setRescheduleError("Erreur réseau");
    } finally {
      setRescheduleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/admin/bookings" className="rounded-lg p-2 hover:bg-zinc-800">
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{booking.booking_ref}</h1>
          <p className="text-zinc-400">Détails de la réservation</p>
        </div>
        <Badge variant="outline" className={STATUS_CLASSES[booking.status]}>
          {STATUS_LABELS[booking.status]}
        </Badge>
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
                    {booking.start_time} - {booking.end_time}
                    <span className="ml-2 text-zinc-400">({formatDuration(booking.start_time, booking.end_time)})</span>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Studio</p>
                  <p className="font-medium">{studio?.name || booking.studio_id}</p>
                  {studio && <p className="text-sm text-zinc-400">{studio.size}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Type</p>
                  <p className="font-medium capitalize">{booking.group_type}</p>
                </div>
              </div>
            </div>

            {equipmentList.length > 0 && (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-sm text-zinc-400">Équipements</p>
                <div className="flex flex-wrap gap-2">
                  {equipmentList.map((eq: { id: string; quantity: number; name?: string }) => (
                    <span key={eq.id} className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                      {eq.name || eq.id} ×{eq.quantity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {booking.status === "confirmed" && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Déplacer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNoShowOpen(true)}
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  No-show
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(true)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
              </div>
            )}

            {booking.status === "cancelled" && booking.cancel_reason && (
              <div className="mt-6 rounded-lg bg-red-500/10 p-4 border-t border-zinc-800">
                <p className="text-sm text-red-400">
                  <strong>Raison :</strong> {booking.cancel_reason}
                </p>
              </div>
            )}
          </div>
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
                    {user.band_name && <p className="text-sm text-zinc-400">{user.band_name}</p>}
                  </div>
                </div>
                <div className="text-sm text-zinc-400">
                  <p>{user.email || "—"}</p>
                  <p>{user.phone || "—"}</p>
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
                <span>{formatPrice(booking.base_price)}</span>
              </div>
              {booking.equipment_price > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Options suppl.</span>
                  <span>{formatPrice(booking.equipment_price)}</span>
                </div>
              )}
              <div className="border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(booking.total_price)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-zinc-400">Méthode</span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  {booking.payment_method === "card" ? "Carte" : "Espèces"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Statut</span>
                <span className={booking.payment_status === "paid" ? "text-green-500" : "text-yellow-500"}>
                  {booking.payment_status === "paid" ? "Payé" : "En attente"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={(open) => { if (!open) { setRescheduleOpen(false); setRescheduleError(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déplacer la réservation</DialogTitle>
            <DialogDescription>Choisissez une nouvelle date et un nouveau créneau.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Date</label>
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
          {rescheduleError && <p className="text-sm text-red-400">{rescheduleError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleOpen(false); setRescheduleError(""); }} disabled={rescheduleLoading}>
              Annuler
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduleLoading}>
              {rescheduleLoading ? "Déplacement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={(open) => { if (!open) { setCancelOpen(false); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la réservation</DialogTitle>
            <DialogDescription>
              Confirmez l&apos;annulation de <strong>{booking.booking_ref}</strong>. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">Raison (optionnel)</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Raison de l'annulation..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason(""); }} disabled={cancelLoading}>
              Retour
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show Dialog */}
      <Dialog open={noShowOpen} onOpenChange={(open) => { if (!open) setNoShowOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme no-show</DialogTitle>
            <DialogDescription>
              Confirmez le no-show pour <strong>{booking.booking_ref}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoShowOpen(false)} disabled={noShowLoading}>
              Retour
            </Button>
            <Button
              onClick={handleNoShow}
              disabled={noShowLoading}
              className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30"
            >
              {noShowLoading ? "En cours..." : "Confirmer no-show"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
