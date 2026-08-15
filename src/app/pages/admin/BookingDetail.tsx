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
  Minus,
  CheckCircle2,
  Loader2,
  Banknote,
  Wallet,
  Pencil,
  Trash2,
  Undo2,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDIOS, formatPrice, TIME_SLOTS, type StudioId, calculateEquipmentPrice, parseBookingEquipmentLines, resolveEquipmentDisplay, type EquipmentSelection } from "@/lib/booking";
import { type DbBooking, type DbUser, type BookingStatus, type DbPayment } from "@/lib/db-types";
import { formatDbTimestamp } from "@/lib/utils";
import { getBookingAmountDue, getBookingBalance, getBookingOverpayment, getManualDiscountEligibility, getManualDiscountBlockMessage, parseAmountInput, getDisplayPaymentStatus, PAYMENT_STATUS_LABELS } from "@/lib/booking-totals";
import { formatSiret, resolveBookingClientIdentity } from "@/lib/client-identity";
import {
  CancelBookingDialog,
  RefundPaymentDialog,
  isStripeRefundable,
  refundableCap,
  hasStripeReference,
  type PaymentRefundInfo,
} from "@/components/admin/refund";

interface BookingWithPromo extends DbBooking {
  promo_code_type?: string | null;
  promo_code_value?: number | null;
}
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
  "no-show": "Absent",
};

/**
 * Libellé secondaire d'état de remboursement d'une ligne carte — trois états
 * distincts, sans formulation douteuse :
 *  - refund_pending_cents > 0  → accepté par Stripe, règlement encore en cours
 *  - aucun pending + refund    → réglé, état final
 *  - reserved > grand livre    → requires_action, à traiter dans le Dashboard
 * Les deux derniers peuvent coexister : une seule ligne, ambre, qui fusionne.
 */
function refundStateLine(p: PaymentRefundInfo): { text: string; tone: "amber" | "zinc" } | null {
  if (p.method !== "card") return null;
  const refundedCents = Math.round(p.refunded_amount * 100);
  const awaitingActionCents = Math.max(0, (p.refund_reserved_cents ?? 0) - refundedCents);
  const pendingCents = Math.min(Math.max(0, p.refund_pending_cents ?? 0), refundedCents);
  if (awaitingActionCents > 0) {
    const action = `${refundedCents > 0 ? "dont " : ""}${formatPrice(awaitingActionCents / 100)} en attente d'action dans le Dashboard Stripe`;
    return {
      tone: "amber",
      text: pendingCents > 0 ? `${action} · ${formatPrice(pendingCents / 100)} en cours de règlement` : action,
    };
  }
  if (refundedCents <= 0) return null;
  if (pendingCents > 0) {
    return {
      tone: "zinc",
      text: pendingCents < refundedCents
        ? `dont ${formatPrice(pendingCents / 100)} en cours de règlement par la banque`
        : "Remboursement accepté par Stripe — règlement en cours",
    };
  }
  return { tone: "zinc", text: "Remboursement effectué" };
}

interface BookingDetailProps {
  bookingId: string;
}

interface EquipmentInfo {
  id: string;
  name: string;
  quantity: number;
  price?: number;
}

export function AdminBookingDetail({ bookingId }: BookingDetailProps) {
  const [booking, setBooking] = useState<BookingWithPromo | null>(null);
  const [user, setUser] = useState<DbUser | null>(null);
  const [payments, setPayments] = useState<PaymentRefundInfo[]>([]);
  const [equipment, setEquipment] = useState<EquipmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: string;
    method: "cash" | "card" | "transfer" | "check";
  }>({ amount: "", method: "cash" });
  const [addingPayment, setAddingPayment] = useState(false);

  // Edit payment dialog
  const [editPayment, setEditPayment] = useState<DbPayment | null>(null);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<"cash" | "card" | "transfer" | "check">("cash");
  const [editingPayment, setEditingPayment] = useState(false);

  // Delete payment dialog
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<DbPayment | null>(null);
  const [deletePaymentOpen, setDeletePaymentOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // Reschedule dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);

  // Post-hoc refund dialog
  const [refundTarget, setRefundTarget] = useState<PaymentRefundInfo | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  // No-show dialog
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowLoading, setNoShowLoading] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Discount editing
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Equipment editing
  const [equipmentCatalogue, setEquipmentCatalogue] = useState<Array<{
    id: string;
    name: string;
    maxPerSession: number;
    pricingType: "session" | "per_hour";
    sessionPricing: number[] | null;
    pricePerHour: number;
  }>>([]);
  const [durationHours, setDurationHours] = useState(0);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [equipmentDraft, setEquipmentDraft] = useState<EquipmentSelection[]>([]);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentAvailability, setEquipmentAvailability] = useState<Record<string, { available: number; reserved: number }>>({});

  useEffect(() => {
    if (!booking) return;
    const date = newDate || booking.date;
    const start = newStartTime || booking.start_time;
    const end = newEndTime || booking.end_time;
    fetch(`/api/equipment-availability?${new URLSearchParams({ date, start, end, studioId: booking.studio_id, excludeBookingId: booking.id })}`)
      .then((r) => r.json() as Promise<{ success: boolean; data?: { items: Array<{ id: string; available: number; reserved: number }> } }>)
      .then((json) => { if (json.success && json.data) setEquipmentAvailability(Object.fromEntries(json.data.items.map((i) => [i.id, i]))); })
      .catch(() => {});
  }, [booking, newDate, newStartTime, newEndTime]);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`);
      const json = (await res.json()) as { success: boolean; data?: DbBooking; error?: string };
      if (json.success && json.data) {
        setBooking(json.data as BookingWithPromo);
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
        const equipmentRes = await fetch("/api/equipment");
        const equipmentJson = await equipmentRes.json() as { success: boolean; equipment?: Array<{ id: string; name: string; maxPerSession: number; pricingType: "session" | "per_hour"; sessionPricing: number[] | null; pricePerHour: number }> };
        if (equipmentJson.success && equipmentJson.equipment) {
          setEquipmentCatalogue(equipmentJson.equipment);
          const startIdx = TIME_SLOTS.indexOf(json.data.start_time);
          let endIdx = TIME_SLOTS.indexOf(json.data.end_time);
          if (endIdx === -1) endIdx = TIME_SLOTS.length;
          const durHours = (endIdx - startIdx) * 0.5;
          setDurationHours(durHours);

          if (json.data.equipment) {
            const bookingEquipment = parseBookingEquipmentLines(json.data.equipment);
            const matchedEquipment = bookingEquipment.map((eq) => {
              const eqData = equipmentJson.equipment!.find((e) => e.id === eq.id);
              const price = typeof eq.lineTotal === "number" && Number.isFinite(eq.lineTotal) ? eq.lineTotal : undefined;
              return { id: eq.id, name: eq.name || eqData?.name || eq.id, quantity: eq.quantity, price };
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

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const paymentRes = await fetch(`/api/admin/bookings/${bookingId}/payments`);
      const paymentJson = (await paymentRes.json()) as { success: boolean; data?: DbPayment[] };
      if (paymentJson.success && paymentJson.data) {
        setPayments(paymentJson.data);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoadingPayments(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Update default payment amount when payments change (show remaining balance)
  useEffect(() => {
    if (booking && payments.length >= 0) {
      const totalPaid = payments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);
      const finalTotal = getBookingAmountDue(booking);
      const balance = finalTotal - totalPaid;
      
      if (balance > 0) {
        setNewPayment(prev => ({
          ...prev,
          amount: balance.toFixed(2)
        }));
      }
    }
  }, [payments, booking]);

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
        toast.success("Marqué absent");
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

  const handleSaveNotes = async () => {
    if (!booking) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue.trim() || null }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Notes sauvegardées");
        setEditingNotes(false);
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingNotes(false); }
  };

  const handleSaveDiscount = async () => {
    if (!booking) return;
    const eligibility = getManualDiscountEligibility(booking);
    if (!eligibility.allowed) { toast.error(getManualDiscountBlockMessage(eligibility.reason)); return; }
    const discount = parseAmountInput(discountValue);
    if (isNaN(discount) || discount < 0) { toast.error("Montant invalide"); return; }
    if (discount > booking.total_price) { toast.error("La remise ne peut pas dépasser le prix total"); return; }
    setSavingDiscount(true);
    try {
      // Convention : total_price reste le brut (base + équipement), seul
      // promo_discount change. Le serveur recalcule/plafonne l'invariant.
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promo_discount: discount }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Remise appliquée");
        setEditingDiscount(false);
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingDiscount(false); }
  };

  const handleSaveEquipment = async () => {
    if (!booking) return;
    setSavingEquipment(true);
    try {
      const newEquipmentPrice = calculateEquipmentPrice(equipmentDraft, durationHours, equipmentCatalogue);
      const enrichedEquipment = equipmentDraft.filter(e => e.quantity > 0).map((e) => ({
        id: e.id,
        name: equipmentCatalogue.find((cat) => cat.id === e.id)?.name || e.id,
        quantity: e.quantity,
        lineTotal: calculateEquipmentPrice([e], durationHours, equipmentCatalogue),
      }));
      // Convention : le brut (total_price) est recalculé par le serveur à partir
      // de base_price + equipment_price — le client n'envoie jamais total_price.
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment: JSON.stringify(enrichedEquipment),
          equipment_price: newEquipmentPrice,
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Équipements mis à jour");
        setEditingEquipment(false);
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingEquipment(false); }
  };

  const handleAddPayment = async () => {
    if (!booking || !newPayment.amount) return;
    if (booking.status === "cancelled") {
      toast.error("Impossible d'encaisser une réservation annulée");
      return;
    }
    const amount = parseAmountInput(newPayment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    if (amount > balance) {
      toast.error(`Le montant ne peut pas dépasser le reste à payer (${formatPrice(balance)})`);
      return;
    }

    setAddingPayment(true);
    try {
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

  const handleEditPayment = async () => {
    if (!editPayment) return;
    const amount = parseAmountInput(editPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    // max = reste à payer + montant actuel de ce paiement (puisqu'on le remplace)
    const maxAmount = booking ? balance + (editPayment?.amount ?? 0) : undefined;
    if (maxAmount !== undefined && amount > maxAmount) {
      toast.error(`Le montant ne peut pas dépasser le reste à payer (${formatPrice(maxAmount)})`);
      return;
    }
    setEditingPayment(true);
    try {
      const res = await fetch(`/api/admin/payments/${editPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: editPaymentMethod }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement modifié");
        setEditPaymentOpen(false);
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur lors de la modification");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setEditingPayment(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return;
    setDeletingPayment(true);
    try {
      const res = await fetch(`/api/admin/payments/${deletePaymentTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement supprimé");
        setDeletePaymentOpen(false);
        setDeletePaymentTarget(null);
        fetchPayments();
        fetchBooking();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setDeletingPayment(false);
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
  const finalTotal = getBookingAmountDue(booking);
  const balance = getBookingBalance(booking, payments);
  const discountEligibility = getManualDiscountEligibility(booking);
  const overpayment = getBookingOverpayment(booking, payments);

  // Présentation du paiement : une réservation annulée ne présente jamais de
  // montant dû — on dérive le libellé du grand livre (Annulée / Payée avant
  // annulation / Remboursé) sans persister de nouvel état.
  const isCancelled = booking.status === "cancelled";
  const displayPaymentStatus = getDisplayPaymentStatus(booking, payments);

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
              {equipmentCatalogue.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Équipements</p>
                    {!editingEquipment && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-400" onClick={() => { setEquipmentDraft(equipment.map(e => ({ id: e.id, quantity: e.quantity }))); setEditingEquipment(true); }}>
                        <Pencil className="h-3 w-3 mr-1" />{equipment.length === 0 ? "Ajouter" : "Modifier"}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(editingEquipment ? equipmentCatalogue : [...equipmentCatalogue.filter((eq) => equipment.some((e) => e.id === eq.id)), ...equipment.filter((e) => !equipmentCatalogue.some((eq) => eq.id === e.id)).map(e => ({ id: e.id, name: e.name, maxPerSession: e.quantity, pricingType: "session" as const, sessionPricing: null, pricePerHour: 0 }))]).map((eq) => {
                      const draftQty = editingEquipment
                        ? (equipmentDraft.find((d) => d.id === eq.id)?.quantity ?? 0)
                        : (equipment.find((e) => e.id === eq.id)?.quantity ?? 0);

                      let itemPrice = 0;
                      if (draftQty > 0) {
                        if (eq.pricingType === "session" && Array.isArray(eq.sessionPricing)) {
                          itemPrice = eq.sessionPricing[draftQty - 1] ?? 0;
                        } else {
                          itemPrice = eq.pricePerHour * draftQty * durationHours;
                        }
                      }

                      return (
                        <div key={eq.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${draftQty > 0 ? "bg-zinc-800/50" : "bg-zinc-800/20"}`}>
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${draftQty > 0 ? "text-zinc-200" : "text-zinc-500"}`}>{eq.name}</span>
                            <span className="text-xs text-zinc-500">
                              {eq.pricingType === "session" && eq.sessionPricing
                                ? `à partir de ${eq.sessionPricing[0]}€/séance`
                                : `+${eq.pricePerHour}€/h`}
                            </span>
                            {editingEquipment && equipmentAvailability[eq.id] && draftQty > equipmentAvailability[eq.id].available && (
                              <span className="text-xs text-amber-400">Stock restant {equipmentAvailability[eq.id].available}. Vous pouvez forcer.</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {itemPrice > 0 && (
                              <span className="text-xs font-medium text-zinc-300">{formatPrice(itemPrice)}</span>
                            )}
                            {editingEquipment ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = equipmentDraft.find((d) => d.id === eq.id)?.quantity ?? 0;
                                    if (current > 0) {
                                      setEquipmentDraft(prev => {
                                        const existing = prev.filter((e) => e.id !== eq.id);
                                        if (current - 1 > 0) {
                                          return [...existing, { id: eq.id, quantity: current - 1 }];
                                        }
                                        return existing;
                                      });
                                    }
                                  }}
                                  disabled={draftQty === 0}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-700 transition-colors hover:bg-zinc-600 disabled:opacity-30 disabled:hover:bg-zinc-700"
                                  aria-label={`Retirer ${eq.name}`}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-medium tabular-nums text-zinc-200">
                                  {draftQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = equipmentDraft.find((d) => d.id === eq.id)?.quantity ?? 0;
                                    if (current < eq.maxPerSession) {
                                      setEquipmentDraft(prev => {
                                        const existing = prev.filter((e) => e.id !== eq.id);
                                        return [...existing, { id: eq.id, quantity: current + 1 }];
                                      });
                                    }
                                  }}
                                  disabled={draftQty >= eq.maxPerSession}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-700 transition-colors hover:bg-zinc-600 disabled:opacity-30 disabled:hover:bg-zinc-700"
                                  aria-label={`Ajouter ${eq.name}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className={`text-sm ${draftQty > 0 ? "text-zinc-300" : "text-zinc-600"}`}>
                                {draftQty > 0 ? `×${draftQty}` : "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {editingEquipment && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleSaveEquipment} disabled={savingEquipment} className="h-7 text-xs">
                        {savingEquipment && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Sauvegarder
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingEquipment(false)} className="h-7 text-xs border-zinc-700">Annuler</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes internes</p>
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-400" onClick={() => { setNotesValue(booking?.notes || ""); setEditingNotes(true); }}>
                      <Pencil className="h-3 w-3 mr-1" />Modifier
                    </Button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={e => setNotesValue(e.target.value)}
                      placeholder="Notes internes..."
                      className="bg-zinc-800 border-zinc-700 text-sm min-h-[80px]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="h-7 text-xs">
                        {savingNotes && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Sauvegarder
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)} className="h-7 text-xs border-zinc-700">Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap">{booking?.notes || <span className="italic text-zinc-600">Aucune note</span>}</p>
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
              {isCancelled ? (
                <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30">
                  {PAYMENT_STATUS_LABELS[displayPaymentStatus]}
                </Badge>
              ) : balance <= 0 ? (
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
                    <div className="space-y-1.5">
                      {resolveEquipmentDisplay(booking.equipment, booking.equipment_price, id => equipmentCatalogue.find(e => e.id === id)?.name).lines.length > 0 ? (
                        <>
                          {resolveEquipmentDisplay(booking.equipment, booking.equipment_price, id => equipmentCatalogue.find(e => e.id === id)?.name).lines.map((eq) => {
                            const linePrice = eq.lineTotal;
                            return (
                            <div key={eq.id} className="flex justify-between items-center">
                              <span className="text-sm text-zinc-400">
                                {eq.name}{eq.quantity > 1 ? ` ×${eq.quantity}` : ""}
                              </span>
                              {resolveEquipmentDisplay(booking.equipment, booking.equipment_price, id => equipmentCatalogue.find(e => e.id === id)?.name).showLinePrices && typeof linePrice === "number" ? (
                                <span className="text-sm font-medium">{formatPrice(linePrice)}</span>
                              ) : null}
                            </div>
                            );
                          })}
                          <div className="flex justify-between items-center pt-1 border-t border-zinc-700/50">
                            <span className="text-sm text-zinc-500">Total équipements</span>
                            <span className="font-medium">{formatPrice(booking.equipment_price)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-400">Équipements</span>
                          <span className="font-medium">{formatPrice(booking.equipment_price)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {booking.promo_code && !editingDiscount && (
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-sm flex items-center gap-2">
                        {booking.promo_code ? "Réduction" : "Remise manuelle"}
                        {booking.promo_code && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-xs">{booking.promo_code}</span>
                        )}
                        {booking.promo_code_type && booking.promo_code_value != null && (
                          <span className="text-xs text-zinc-400">
                            ({booking.promo_code_type === "percentage" ? `-${booking.promo_code_value}%` : `-${formatPrice(booking.promo_code_value || 0)}`})
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">-{formatPrice(booking.promo_discount)}</span>
                      </span>
                    </div>
                  )}
                  {booking.promo_code && !editingDiscount && <p className="text-xs text-zinc-500">{getManualDiscountBlockMessage("promo_code")}</p>}
                  {!booking.promo_code && booking.status === "cancelled" && booking.promo_discount > 0 && !editingDiscount && (
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-sm">Remise manuelle</span>
                      <span className="font-medium">-{formatPrice(booking.promo_discount)}</span>
                    </div>
                  )}
                  {!booking.promo_code && booking.status !== "cancelled" && !editingDiscount && (
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-sm">Remise manuelle</span>
                      <span className="flex items-center gap-2"><span className="font-medium">{booking.promo_discount > 0 ? `-${formatPrice(booking.promo_discount)}` : "—"}</span><Button variant="ghost" size="sm" className="h-6 px-1 text-xs text-zinc-500" onClick={() => { setDiscountValue(String(booking?.promo_discount || 0)); setEditingDiscount(true); }}><Pencil className="h-3 w-3" /></Button></span>
                    </div>
                  )}
                  {/* Remise manuelle (édition directe de promo_discount — une seule
                      ligne de réduction, pas de double affichage ni double déduction) */}
                  {editingDiscount && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Remise manuelle</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" step="0.01" min="0"
                          value={discountValue}
                          onChange={e => setDiscountValue(e.target.value)}
                          className="h-7 w-24 text-xs bg-zinc-800 border-zinc-700"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSaveDiscount} disabled={savingDiscount} className="h-7 text-xs px-2">
                          {savingDiscount ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDiscount(false)} className="h-7 text-xs px-2">✕</Button>
                      </div>
                    </div>
                  )}
                  {!isCancelled && overpayment > 0 && <p className="text-xs text-amber-400">Trop-perçu : {formatPrice(overpayment)} — utiliser le remboursement ci-dessous.</p>}
                  <div className="border-t border-zinc-700 pt-3 flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">{isCancelled ? "—" : formatPrice(finalTotal)}</span>
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
                              {methodLabels[p.method] || p.method} · {formatDbTimestamp(p.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              {p.refunded_amount > 0 && ` · -${formatPrice(p.refunded_amount)} remboursés`}
                            </p>
                            {(() => {
                              const line = refundStateLine(p);
                              if (!line) return null;
                              return (
                                <p className={`mt-0.5 text-[11px] ${line.tone === "amber" ? "text-amber-400/90" : "text-zinc-600"}`}>
                                  {line.text}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={p.status === "paid" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : p.status === "refunded" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : p.status === "partial-refund" ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>
                            {p.status === "paid" ? "Payé" : p.status === "refunded" ? "Remboursé" : p.status === "partial-refund" ? "Remboursé partiel" : "En attente"}
                          </Badge>
                          {(p.status === "paid" || p.status === "partial-refund") &&
                            (isStripeRefundable(p) || (p.method !== "card" && refundableCap(p) > 0.004)) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300"
                              onClick={() => {
                                setRefundTarget(p);
                                setRefundOpen(true);
                              }}
                            >
                              <Undo2 className="h-3 w-3 mr-1" />
                              Rembourser
                            </Button>
                          )}
                          {(p.status === "paid" || p.status === "partial-refund") &&
                            p.method === "card" && !hasStripeReference(p) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled
                              className="h-7 px-2 text-xs text-zinc-600"
                              title="Remboursement impossible depuis l'application : aucune référence Stripe exploitable"
                            >
                              <Undo2 className="h-3 w-3 mr-1" />
                              Rembourser
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
                            onClick={() => {
                              setEditPayment(p);
                              setEditPaymentAmount(p.amount.toFixed(2).replace(".", ","));
                              setEditPaymentMethod((p.method as "cash" | "card" | "transfer" | "check") || "cash");
                              setEditPaymentOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                            onClick={() => {
                              setDeletePaymentTarget(p);
                              setDeletePaymentOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nouvel encaissement */}
              {!isCancelled && balance > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Nouvel encaissement</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1.5 block">Montant (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        max={balance}
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="bg-zinc-800 border-zinc-700 h-11"
                      />
                      {newPayment.amount && parseAmountInput(newPayment.amount) > balance && (
                        <p className="text-xs text-destructive mt-1">Maximum : {formatPrice(balance)} (reste à payer)</p>
                      )}
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
                  {(() => {
                    const clientIdentity = resolveBookingClientIdentity(booking, user);
                    return (
                      <>
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
                      <p className="text-zinc-500 text-xs mb-1">Type de client</p>
                      <p className="text-zinc-200">{clientIdentity.clientTypeLabel}</p>
                    </div>
                    {clientIdentity.isBusiness && (
                      <>
                        <div>
                          <p className="text-zinc-500 text-xs mb-1">Raison sociale / nom de l&apos;association</p>
                          <p className="text-zinc-200">{clientIdentity.legalName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs mb-1">SIRET</p>
                          <p className="text-zinc-200">{clientIdentity.siret ? formatSiret(clientIdentity.siret) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs mb-1">RNA</p>
                          <p className="text-zinc-200">{clientIdentity.rna || "—"}</p>
                        </div>
                      </>
                    )}
                    {clientIdentity.instagramAccounts && (
                      <div>
                        <p className="text-zinc-500 text-xs mb-1">Compte(s) Instagram</p>
                        <p className="text-zinc-200">{clientIdentity.instagramAccounts}</p>
                      </div>
                    )}
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
                      </>
                    );
                  })()}
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
                onClick={async () => { await generateInvoicePDF(booking, payments[0] || null, user || ({} as DbUser)); }}
                disabled={!user || isCancelled}
                title={isCancelled ? "Aucune facture pour une réservation annulée" : undefined}
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
          <div className="grid gap-4 lg:grid-cols-3">
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

      <CancelBookingDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        bookingId={booking.id}
        bookingRef={booking.booking_ref}
        onSettled={fetchBooking}
      />

      <Dialog open={noShowOpen} onOpenChange={(open) => { if (!open) setNoShowOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Marquer comme absent</DialogTitle>
            <DialogDescription>
              Confirmez le marquage absent pour <strong>{booking.booking_ref}</strong>.
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
              {noShowLoading ? "En cours..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Modifier le paiement</DialogTitle>
            <DialogDescription>Modifiez le montant ou le mode de paiement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-payment-amount">Montant (&euro;)</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={booking ? balance + (editPayment?.amount ?? 0) : undefined}
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                className="border-zinc-700 bg-zinc-800"
                autoFocus
              />
              {booking && parseAmountInput(editPaymentAmount) > balance + (editPayment?.amount ?? 0) && (
                <p className="text-xs text-destructive">
                  Maximum : {formatPrice(balance + (editPayment?.amount ?? 0))} (reste à payer)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-method">Mode de paiement</Label>
              <Select value={editPaymentMethod} onValueChange={(v) => setEditPaymentMethod(v as "cash" | "card" | "transfer" | "check")}>
                <SelectTrigger id="edit-payment-method" className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="card">Carte Bancaire</SelectItem>
                  <SelectItem value="cash">Esp&egrave;ces</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="check">Ch&egrave;que</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaymentOpen(false)} className="border-zinc-700">
              Annuler
            </Button>
            <Button onClick={handleEditPayment} disabled={editingPayment || (booking !== null && parseAmountInput(editPaymentAmount) > balance + (editPayment?.amount ?? 0))}>
              {editingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RefundPaymentDialog
        payment={refundTarget}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSettled={() => {
          fetchPayments();
          fetchBooking();
        }}
      />

      {/* Delete Payment Dialog */}
      <Dialog open={deletePaymentOpen} onOpenChange={setDeletePaymentOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Supprimer le paiement</DialogTitle>
            <DialogDescription>
              {deletePaymentTarget && (
                <>Êtes-vous sûr de vouloir supprimer le paiement de <span className="font-semibold text-foreground">{formatPrice(deletePaymentTarget.amount)}</span> ({methodLabels[deletePaymentTarget.method] || deletePaymentTarget.method}) ? Cette action est irréversible.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentOpen(false)} className="border-zinc-700">
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={deletingPayment}>
              {deletingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
