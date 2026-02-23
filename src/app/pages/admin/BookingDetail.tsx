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

        // Ne pas réinitialiser la méthode ici — l'état initial (cash) est correct.
        // La méthode choisie par l'utilisateur ne doit pas être écrasée par fetchBooking.
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

  // Update default payment amount when payments change (show remaining balance)
  useEffect(() => {
    if (booking && payments.length >= 0) {
      const totalPaid = payments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);
      const totalPrice = Number(booking.total_price) || 0;
      const promoDiscount = Number(booking.promo_discount) || 0;
      const finalTotal = Math.max(0, totalPrice - promoDiscount);
      const balance = finalTotal - totalPaid;
      
      if (balance > 0) {
        setNewPayment(prev => ({
          ...prev,
          amount: balance.toFixed(2)
        }));
      }
    }
  }, [payments, booking]);

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
  const totalPrice = Number(booking.total_price) || 0;
  const promoDiscount = Number(booking.promo_discount) || 0;
  const finalTotal = Math.max(0, totalPrice - promoDiscount);
  const balance = finalTotal - totalPaid;

  const methodLabels: Record<string, string> = {
    card: "Carte bancaire",
    cash: "Espèces",
    check: "Chèque",
    cheque: "Chèque",
    transfer: "Virement",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a 
            href="/admin/bookings" 
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{booking.booking_ref}</h1>
            <p className="text-sm text-zinc-400 mt-0.5">{formatDate(booking.date)}</p>
          </div>
        </div>
        <Badge className={`${STATUS_CLASSES[booking.status]} px-4 py-1.5 text-sm font-medium`}>
          {STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Colonne principale */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Section Session */}
          <section className="bg-zinc-900 rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-800/20">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Music className="h-5 w-5 text-primary" />
                Session
              </h2>
            </div>
            <div className="p-6">
              {/* Infos principales */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Studio</p>
                  <p className="text-lg font-semibold">{studio?.name || booking.studio_id}</p>
                  {studio && <p className="text-sm text-zinc-400">{studio.size}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Horaire</p>
                  <p className="text-lg font-semibold">{booking.start_time} - {booking.end_time}</p>
                  <p className="text-sm text-zinc-400">{formatDuration(booking.start_time, booking.end_time)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</p>
                  <p className="text-lg font-semibold">{booking.group_type === "solo" ? "Solo" : booking.group_type === "duo" ? "Duo" : "Groupe"}</p>
                </div>
              </div>

              {/* Équipements */}
              {equipment.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Équipements</p>
                  <div className="flex flex-wrap gap-2">
                    {equipment.map((eq) => (
                      <span 
                        key={eq.id} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-sm"
                      >
                        <span className="text-zinc-300">{eq.name}</span>
                        <span className="text-zinc-500">×{eq.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Informations supplémentaires</p>
                {booking.notes ? (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{booking.notes}</p>
                ) : (
                  <p className="text-sm text-zinc-500 italic">Aucune information supplémentaire</p>
                )}
              </div>
            </div>
          </section>

          {/* Section Paiement */}
          <section className="bg-zinc-900 rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-800/20 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Paiement
              </h2>
              {balance <= 0 ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Soldé
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                  Reste: {formatPrice(balance)}
                </Badge>
              )}
            </div>
            <div className="p-6">
              {/* Récapitulatif panier */}
              <div className="bg-zinc-800/30 rounded-xl p-5 mb-6">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Récapitulatif</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Studio ({formatDuration(booking.start_time, booking.end_time)})</span>
                    <span className="font-medium">{formatPrice(booking.base_price)}</span>
                  </div>
                  {booking.equipment_price > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Équipements</span>
                      <span className="font-medium">{formatPrice(booking.equipment_price)}</span>
                    </div>
                  )}
                  {booking.promo_discount > 0 && (
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-sm flex items-center gap-2">
                        Réduction
                        {booking.promo_code && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-xs">{booking.promo_code}</span>
                        )}
                      </span>
                      <span className="font-medium">-{formatPrice(booking.promo_discount)}</span>
                    </div>
                  )}
                  {booking.promo_code && booking.promo_discount === 0 && (
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-sm flex items-center gap-2">
                        Code promo
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-xs">{booking.promo_code}</span>
                      </span>
                      <span className="font-medium text-zinc-500">-</span>
                    </div>
                  )}
                  <div className="border-t border-zinc-700 pt-3 flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</span>
                  </div>
                  {totalPaid > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 text-sm">
                      <span>Déjà payé</span>
                      <span className="font-medium">{formatPrice(totalPaid)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Historique des paiements */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Historique</p>
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">Aucun paiement enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                            {p.method === "card" ? <CreditCard className="h-5 w-5" /> : p.method === "cash" ? <Banknote className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold">{formatPrice(p.amount)}</p>
                            <p className="text-xs text-zinc-500">
                              {methodLabels[p.method] || p.method} · {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <Badge className={p.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>
                          {p.status === "paid" ? "Payé" : "En attente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nouvel encaissement */}
              {balance > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Nouvel encaissement</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1.5 block">Montant (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 h-11"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1.5 block">Mode</Label>
                      <Select
                        value={newPayment.method}
                        onValueChange={(v) => setNewPayment({ ...newPayment, method: v as "cash" | "card" | "transfer" | "check" })}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 h-11">
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
                    disabled={addingPayment}
                    className="w-full h-11"
                  >
                    {addingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Valider l&apos;encaissement
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Colonne latérale */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Client */}
          <section className="bg-zinc-900 rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-800/20">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Client
              </h2>
            </div>
            <div className="p-6">
              {user ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{user.name}</p>
                      {user.band_name && <p className="text-sm text-zinc-400">{user.band_name}</p>}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Email</p>
                      <p className="text-zinc-200">{user.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Téléphone</p>
                      <p className="text-zinc-200">{user.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Adresse</p>
                      <div className="text-zinc-200">
                        {user.address_line1 ? (
                          <>
                            <p>{user.address_line1}</p>
                            <p>{user.postal_code} {user.city}</p>
                          </>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {user.notes && (
                    <div className="bg-zinc-800/30 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Notes</p>
                      <p className="text-sm text-zinc-300">{user.notes}</p>
                    </div>
                  )}

                  <a
                    href={`/admin/users/${user.id}`}
                    className="inline-flex items-center text-sm text-primary hover:underline"
                  >
                    Voir le profil
                    <ChevronLeft className="h-4 w-4 ml-1 rotate-180" />
                  </a>
                </div>
              ) : (
                <p className="text-zinc-400 text-center py-4">Client inconnu</p>
              )}
            </div>
          </section>

          {/* Actions */}
          <section className="bg-zinc-900 rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-800/20">
              <h2 className="font-semibold text-lg">Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start h-11 border-zinc-700 hover:bg-zinc-800"
                onClick={() => generateInvoicePDF(booking, payments[0] || null, user || ({} as DbUser))}
                disabled={!user}
              >
                <FileText className="mr-3 h-4 w-4 text-zinc-400" />
                Générer la facture PDF
              </Button>
              
              {booking.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11 border-zinc-700 hover:bg-zinc-800"
                    onClick={() => setRescheduleOpen(true)}
                  >
                    <RefreshCw className="mr-3 h-4 w-4 text-zinc-400" />
                    Déplacer la session
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                    onClick={() => setNoShowOpen(true)}
                  >
                    <AlertTriangle className="mr-3 h-4 w-4" />
                    Marquer absent
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-11 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-3 h-4 w-4" />
                    Annuler la réservation
                  </Button>
                </>
              )}
            </div>
          </section>

          {/* Raison d'annulation si applicable */}
          {booking.status === "cancelled" && booking.cancel_reason && (
            <section className="bg-red-500/5 rounded-2xl border border-red-500/20 p-4">
              <p className="text-xs text-red-400 font-medium mb-1">Raison de l&apos;annulation</p>
              <p className="text-sm text-red-300">{booking.cancel_reason}</p>
            </section>
          )}
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
