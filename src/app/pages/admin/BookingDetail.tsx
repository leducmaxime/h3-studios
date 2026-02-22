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
  FileText,
  Plus,
  CheckCircle2,
  Loader2,
  Banknote,
  Wallet,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDIOS, formatPrice, TIME_SLOTS, type StudioId } from "@/lib/booking";
import { type DbBooking, type DbUser, type BookingStatus, type DbPayment } from "@/lib/db-types";
import { generateInvoicePDF } from "@/lib/export";

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

interface EquipmentInfo {
  id: string;
  name: string;
  quantity: number;
}

export function AdminBookingDetail({ bookingId }: BookingDetailProps) {
  const [booking, setBooking] = useState<DbBooking | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [equipment, setEquipment] = useState<EquipmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: string;
    method: "cash" | "card" | "transfer" | "check";
  }>({ amount: "", method: "cash" });
  const [addingPayment, setAddingPayment] = useState(false);

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

        // Fetch payments for this booking
        setLoadingPayments(true);
        const paymentRes = await fetch(`/api/admin/bookings/${bookingId}/payments`);
        const paymentJson = (await paymentRes.json()) as { success: boolean; data?: DbPayment[] };
        if (paymentJson.success && paymentJson.data) {
          setPayments(paymentJson.data);
        }
        setLoadingPayments(false);

        // Fetch equipment and match with booking equipment
        if (json.data.equipment) {
          const equipmentRes = await fetch("/api/equipment");
          const equipmentJson = await equipmentRes.json() as { success: boolean; equipment?: Array<{ id: string; name: string }> };
          if (equipmentJson.success && equipmentJson.equipment) {
            const bookingEquipment = JSON.parse(json.data.equipment) as Array<{ id: string; quantity: number }>;
            const matchedEquipment = bookingEquipment.map((eq) => {
              const eqData = equipmentJson.equipment!.find((e) => e.id === eq.id);
              return { id: eq.id, name: eqData?.name || eq.id, quantity: eq.quantity };
            });
            setEquipment(matchedEquipment);
          }
        }

        setNewPayment({
          amount: String(json.data.total_price),
          method: json.data.payment_method === "card" ? "card" : "cash",
        });
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

  const handleCancel = async () => {
    if (!booking) return;
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
    if (!booking) return;
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
    if (!booking) return;
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

  const handleAddPayment = async () => {
    if (!booking || !newPayment.amount) return;
    const n = parseFloat(newPayment.amount.replace(/\s/g, "").replace(",", "."));
    const amount = Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    setAddingPayment(true);
    try {
      if (booking.payment_method === "card" && newPayment.method !== "card") {
        toast.error("En ligne, les paiements sont uniquement par CB");
        return;
      }

        const res = await fetch(`/api/admin/bookings/${booking.id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            method: newPayment.method,
            status: "paid",
          }),
        });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement enregistré");
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setAddingPayment(false);
    }
  };

  if (loading || !booking) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const studio = STUDIOS[booking.studio_id as StudioId];

  const totalPaid = payments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);
  const balance = booking.total_price - totalPaid;

  const methodLabels: Record<string, string> = {
    card: "Carte bancaire",
    cash: "Espèces",
    check: "Chèque",
    cheque: "Chèque",
    transfer: "Virement",
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
                  <p className="font-medium">{booking.group_type === "solo" ? "Solo" : booking.group_type === "duo" ? "Duo" : "Groupe"}</p>
                </div>
              </div>
            </div>

            {/* Récap du panier */}
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <p className="mb-3 text-sm text-zinc-400">Récapitulatif</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Studio ({formatDuration(booking.start_time, booking.end_time)})</span>
                  <span>{formatPrice(booking.base_price)}</span>
                </div>
                {booking.equipment_price > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Équipements</span>
                    <span>{formatPrice(booking.equipment_price)}</span>
                  </div>
                )}
                {booking.promo_discount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Réduction {booking.promo_code && <span className="text-zinc-500">({booking.promo_code})</span>}</span>
                    <span>-{formatPrice(booking.promo_discount)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(booking.total_price)}</span>
                </div>
              </div>
            </div>

            {equipment.length > 0 && (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-sm text-zinc-400">Équipements</p>
                <div className="flex flex-wrap gap-2">
                  {equipment.map((eq) => (
                    <span key={eq.id} className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                      {eq.name} ×{eq.quantity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {booking.promo_code && (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-sm text-zinc-400">Code promo utilisé</p>
                <p className="text-sm font-medium text-primary">{booking.promo_code}</p>
                {booking.promo_type && (
                  <p className="text-sm text-zinc-500 mt-1">
                    {booking.promo_type === "percentage" 
                      ? `-${booking.promo_discount}%` 
                      : `-${formatPrice(booking.promo_discount)}`}
                  </p>
                )}
              </div>
            )}

            {booking.notes && (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-sm text-zinc-400">Informations supplémentaires</p>
                <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
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

            {booking.status !== "cancelled" && user && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInvoicePDF(booking, payments[0] || null, user)}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Facture PDF
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

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Historique des paiements</h2>
              {balance <= 0 ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 px-3 py-1">Soldé</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 text-amber-500 font-bold">Reste: {formatPrice(balance)}</Badge>
              )}
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-zinc-800/20 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Studio</span>
                  <span className="text-sm font-medium">{formatPrice(booking.base_price)}</span>
                </div>
                {booking.equipment_price > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Équipements</span>
                    <span className="text-sm font-medium">{formatPrice(booking.equipment_price)}</span>
                  </div>
                )}
                {booking.promo_discount > 0 && (
                  <div className="flex items-center justify-between text-primary">
                    <span className="text-sm">
                      Réduction ({booking.promo_code})
                      {booking.promo_type && (
                        <span className="text-zinc-500 ml-1">
                          {booking.promo_type === "percentage" 
                            ? `-${booking.promo_discount}%` 
                            : `-${formatPrice(booking.promo_discount)}`}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium">-{formatPrice(booking.promo_discount)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Total</span>
                  <span className="font-bold text-xl text-primary">{formatPrice(booking.total_price)}</span>
                </div>
                {totalPaid > 0 && totalPaid < booking.total_price && (
                  <div className="flex items-center justify-between text-emerald-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Payé</span>
                    <span className="text-sm font-bold">{formatPrice(totalPaid)}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-lg border border-dashed border-zinc-800">
                    <p className="text-sm text-zinc-500 italic">Aucun paiement enregistré pour le moment.</p>
                  </div>
                ) : (
                  payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 transition-colors hover:bg-zinc-800/60">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                          {p.method === "card" ? <CreditCard className="h-5 w-5" /> : p.method === "cash" ? <Banknote className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-100">{formatPrice(p.amount)}</p>
                          <p className="text-xs text-zinc-500 font-medium">
                            {methodLabels[p.method] || p.method} · {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"} className={`text-[10px] uppercase font-bold tracking-tight ${p.status === "paid" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}`}>
                        {p.status === "paid" ? "Validé" : "En attente"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              {balance > 0 && (
                <div className="mt-8 pt-6 border-t border-zinc-800">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-5">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Nouvel encaissement</h3>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Montant à ajouter (€)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={newPayment.amount}
                          onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                          className="bg-zinc-900 border-zinc-700 h-11 text-base font-semibold focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="method" className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Mode de règlement</Label>
                        <Select
                          value={newPayment.method}
                          onValueChange={(v) => setNewPayment({ ...newPayment, method: v as "cash" | "card" | "transfer" | "check" })}
                        >
                          <SelectTrigger className="bg-zinc-900 border-zinc-700 h-11 text-sm focus:ring-primary">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="card">Carte Bancaire</SelectItem>
                            <SelectItem value="cash">Espèces</SelectItem>
                            <SelectItem value="transfer">Virement</SelectItem>
                            <SelectItem value="check">Chèque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleAddPayment}
                      className="w-full h-12 font-bold text-sm gap-2 shadow-lg shadow-primary/10"
                      disabled={addingPayment}
                    >
                      {addingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                      Valider l&apos;encaissement
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Coordonnées du client</h2>
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    {user.band_name && (
                      <p className="text-sm text-zinc-400">{user.band_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-zinc-500">Email</p>
                    <p className="text-zinc-300">{user.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Téléphone</p>
                    <p className="text-zinc-300">{user.phone || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-zinc-500">Adresse</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-zinc-500">Nom et numéro de rue</span>
                    <span className="text-zinc-300">{user.address_line1 || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-zinc-500">Code postal</span>
                    <span className="text-zinc-300">{user.postal_code || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-zinc-500">Ville</span>
                    <span className="text-zinc-300">{user.city || "—"}</span>
                  </div>
                </div>

                {user.notes && (
                  <div className="space-y-1 text-sm">
                    <p className="text-zinc-500">Notes client</p>
                    <p className="text-zinc-300 whitespace-pre-wrap">{user.notes}</p>
                  </div>
                )}

                <a
                  href={`/admin/users/${user.id}`}
                  className="inline-block text-sm text-primary hover:underline pt-2"
                >
                  Voir le profil →
                </a>
              </div>
            ) : (
              <p className="text-zinc-400">Client inconnu</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Actions globales</h2>
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start border-primary/30 text-primary hover:bg-primary/10 h-12"
                onClick={() => generateInvoicePDF(booking, payments[0] || null, user || ({} as DbUser))}
                disabled={!user}
              >
                <FileText className="mr-3 h-5 w-5" />
                Générer la facture PDF
              </Button>
              {booking.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    className="justify-start h-12 transition-all hover:bg-zinc-800"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    <RefreshCw className="mr-3 h-5 w-5 text-zinc-400" />
                    Déplacer la session
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 h-12"
                    onClick={() => setNoShowOpen(true)}
                  >
                    <AlertTriangle className="mr-3 h-5 w-5" />
                    Marquer absent (No-show)
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start border-red-500/30 text-red-400 hover:bg-red-500/10 h-12"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-3 h-5 w-5" />
                    Annuler la réservation
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={(open) => { if (!open) { setRescheduleOpen(false); setRescheduleError(""); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Déplacer la réservation</DialogTitle>
            <DialogDescription>Choisissez une nouvelle date et un nouveau créneau.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-zinc-400">Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label className="mb-1 block text-zinc-400">Début</Label>
              <Select value={newStartTime} onValueChange={setNewStartTime}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-zinc-400">Fin</Label>
              <Select value={newEndTime} onValueChange={setNewEndTime}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {[...TIME_SLOTS.slice(1), "00:00"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <Dialog open={cancelOpen} onOpenChange={(open) => { if (!open) { setCancelOpen(false); setCancelReason(""); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Annuler la réservation</DialogTitle>
            <DialogDescription>
              Confirmez l&apos;annulation de <strong>{booking.booking_ref}</strong>. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-zinc-400">Raison (optionnel)</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Raison de l'annulation..."
              className="bg-zinc-800 border-zinc-700"
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

      <Dialog open={noShowOpen} onOpenChange={(open) => { if (!open) setNoShowOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
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
