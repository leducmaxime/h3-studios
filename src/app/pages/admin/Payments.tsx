"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
  CreditCard,
  Banknote,
  Landmark,
  FileText,
  RefreshCw,
  MoreHorizontal,
  Loader2,
  Search,
  Trash2,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/booking";
import { bookingAllowsCollection, getBookingAmountDue, getManualDiscountEligibility, getManualDiscountBlockMessage, parseAmountInput } from "@/lib/booking-totals";
import { formatTaxBreakdown } from "@/lib/tax";
import { exportAllocationsCSV, exportCollectionsCSV, type AllocationExportRow } from "@/lib/export";
import { RefundPaymentDialog } from "@/components/admin/refund";
import { paymentRecordStatusLabel, paymentMethodLabelShort, paymentTypeLabel } from "@/lib/labels";
import type { DbPayment } from "@/lib/db-types";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ApiPayment extends DbPayment {
  id: string;
  amount: number;
  method: "card" | "cash" | "transfer" | "check";
  payment_type: "on-site" | "online";
  status: "pending" | "settled" | "failed";
  paid_at: string | null;
  created_at: string;
  external_ref: string | null;
  booking_refs: string;
  allocation_count: number;
  allocated_amount: number;
  unallocated_amount: number;
  refundable_amount: number;
  user_name: string | null;
  user_band_name: string | null;
  user_id: string | null;
  booking_date: string | null;
}

interface PaymentsResponse {
  success: boolean;
  data: {
    data: ApiPayment[];
    total: number;
    page: number;
    limit: number;
    stats?: {
      paidCount: number;
      paidAmount: number;
      refundedCount: number;
      refundedAmount: number;
    };
  };
}

type BookingPaymentMethod = "card" | "cash" | null;

interface CollectBooking {
  booking_ref: string;
  status?: string;
  keep_balance_due?: number | boolean | null;
  base_price: number;
  equipment_price: number;
  total_price: number;
  promo_discount: number;
  promo_code?: string | null;
  promo_code_type?: string | null;
  promo_code_value?: number | null;
  payment_method: BookingPaymentMethod;
  band_name?: string | null;
  user_name?: string | null;
  user_band_name?: string | null;
}

interface CollectContext {
  bookingId: string;
  bookingRef: string | null;
  userName: string | null;
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  bookingPaymentMethod: BookingPaymentMethod;
  promoCode: string | null;
  promoCodeType: string | null;
  promoCodeValue: number | null;
  promoDiscount: number;
  booking: CollectBooking;
  overpayment: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = dateStr.length === 10 ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDateFilterParams(filter: string): { dateFrom?: string; dateTo?: string } {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA");

  switch (filter) {
    case "today":
      return { dateFrom: todayStr, dateTo: todayStr };
    case "week": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);
      return { dateFrom: weekStart.toLocaleDateString("en-CA") };
    }
    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: monthStart.toLocaleDateString("en-CA") };
    }
    default:
      return {};
  }
}

interface CollectEntry {
  id: string;
  amount: string;
  method: "cash" | "card" | "transfer" | "check";
}

interface BookingExportLookup {
  id: string;
  booking_ref: string;
  user_name?: string | null;
}

interface BookingExportDetail {
  date: string;
  user_id?: string | null;
  user_name?: string | null;
}

interface LedgerExportMovement extends DbPayment {
  allocated?: number | null;
}

interface BookingLedgerExportResponse {
  success: boolean;
  data?: { movements?: LedgerExportMovement[] } | LedgerExportMovement[];
}

function statusConfig(payment: ApiPayment): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (payment.status === "settled" && payment.amount < -0.005) {
    return { label: paymentRecordStatusLabel(payment.status, { amount: payment.amount }), variant: "destructive" };
  }
  if (payment.status === "settled") {
    const partial = payment.refundable_amount > 0.005 && payment.refundable_amount < payment.amount - 0.005;
    return {
      label: paymentRecordStatusLabel(payment.status, { amount: payment.amount, refundableAmount: payment.refundable_amount }),
      variant: partial ? "secondary" : "default",
    };
  }
  return { label: paymentRecordStatusLabel(payment.status), variant: "outline" };
}

const PAYMENT_METHOD_ICONS: Record<string, typeof CreditCard> = {
  card: CreditCard,
  cash: Banknote,
  transfer: Landmark,
  check: FileText,
};

async function buildAllocationExportRows(payments: ApiPayment[]): Promise<{
  rows: AllocationExportRow[];
  missing: string[];
}> {
  const missing: string[] = [];
  const refs = [...new Set(
    payments.flatMap((payment) => payment.booking_refs.split(",").map((ref) => ref.trim()).filter(Boolean)),
  )];
  const bookings = new Map<string, BookingExportLookup>();

  await Promise.all(refs.map(async (ref) => {
    try {
      const response = await fetch(`/api/admin/bookings?search=${encodeURIComponent(ref)}&all=true`);
      const json = await response.json() as {
        success?: boolean;
        data?: { data?: BookingExportLookup[] };
      };
      const match = json.data?.data?.find((booking) => booking.booking_ref === ref);
      if (json.success && match) bookings.set(ref, match);
      else missing.push(`réservation ${ref} introuvable`);
    } catch {
      missing.push(`réservation ${ref} non accessible`);
    }
  }));

  const details = new Map<string, { detail: BookingExportDetail; movements: LedgerExportMovement[]; userName: string | null }>();
  await Promise.all([...bookings.values()].map(async (lookup) => {
    try {
      const [bookingResponse, ledgerResponse] = await Promise.all([
        fetch(`/api/admin/bookings/${lookup.id}`),
        fetch(`/api/admin/bookings/${lookup.id}/payments`),
      ]);
      const bookingJson = await bookingResponse.json() as { success?: boolean; data?: BookingExportDetail };
      const ledgerJson = await ledgerResponse.json() as BookingLedgerExportResponse;
      const movements = ledgerJson.success
        ? Array.isArray(ledgerJson.data) ? ledgerJson.data : ledgerJson.data?.movements
        : undefined;
      if (!bookingJson.success || !bookingJson.data || !movements) {
        missing.push(`ventilation de la réservation ${lookup.booking_ref} indisponible`);
        return;
      }

      let userName = bookingJson.data.user_name ?? lookup.user_name ?? null;
      if (!userName && bookingJson.data.user_id) {
        try {
          const userResponse = await fetch(`/api/admin/users/${bookingJson.data.user_id}`);
          const userJson = await userResponse.json() as { success?: boolean; data?: { name?: string | null } };
          userName = userJson.success ? userJson.data?.name ?? null : null;
        } catch {
          // Le nom client est facultatif pour le rapprochement comptable.
        }
      }
      details.set(lookup.id, { detail: bookingJson.data, movements, userName });
    } catch {
      missing.push(`ventilation de la réservation ${lookup.booking_ref} non accessible`);
    }
  }));

  const rows: AllocationExportRow[] = [];
  const allocatedByPayment = new Map<string, number>();
  for (const payment of payments) {
    const paymentRefs = [...new Set(payment.booking_refs.split(",").map((ref) => ref.trim()).filter(Boolean))];
    for (const ref of paymentRefs) {
      const lookup = bookings.get(ref);
      const data = lookup ? details.get(lookup.id) : undefined;
      const movement = data?.movements.find((candidate) => candidate.id === payment.id);
      if (!lookup || !data || !movement || typeof movement.allocated !== "number") {
        if (payment.allocated_amount > 0.005) {
          missing.push(`allocation du mouvement ${payment.id} vers ${ref || "sans réservation"}`);
        }
        continue;
      }
      if (Math.abs(movement.allocated) <= 0.005) continue;
      rows.push({
        payment_id: payment.id,
        booking_id: lookup.id,
        amount: movement.allocated,
        booking_ref: ref,
        booking_date: data.detail.date,
        user_name: data.userName,
        method: movement.method,
        paid_at: movement.paid_at,
      });
      allocatedByPayment.set(payment.id, (allocatedByPayment.get(payment.id) ?? 0) + movement.allocated);
    }
  }

  for (const payment of payments) {
    const actual = allocatedByPayment.get(payment.id) ?? 0;
    if (Math.abs(actual - payment.allocated_amount) > 0.005) {
      missing.push(
        `mouvement ${payment.id}: allocations ${actual.toFixed(2)} € au lieu de ${payment.allocated_amount.toFixed(2)} €`,
      );
    }
  }

  const collectionTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const unallocatedTotal = payments.reduce((sum, payment) => sum + (payment.unallocated_amount ?? 0), 0);
  const allocationTotal = rows.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (Math.abs(allocationTotal + unallocatedTotal - collectionTotal) > 0.005) {
    missing.push(
      `contrôle croisé: ventilation ${allocationTotal.toFixed(2)} € + non affecté ${unallocatedTotal.toFixed(2)} € ≠ encaissements ${collectionTotal.toFixed(2)} €`,
    );
  }

  return { rows, missing: [...new Set(missing)] };
}

// ─── Delete Payment Dialog ──────────────────────────────────────────────────────

function DeletePaymentDialog({
  payment,
  open,
  onOpenChange,
  onConfirm,
}: {
  payment: ApiPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSubmitting(false);
  }, [open]);

  function handleConfirm() {
    if (!payment) return;
    setSubmitting(true);
    onConfirm(payment.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Contre-passer le paiement</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                Êtes-vous sûr de vouloir contre-passer le paiement de{" "}
                <span className="font-semibold text-foreground">{formatPrice(payment.amount)}</span>{" "}
                ({payment.method}) pour la réservation{" "}
                <span className="font-semibold text-foreground">{payment.booking_refs || "—"}</span> ?{" "}
                Cette action est irréversible.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-700">
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Contre-passer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Row Actions ────────────────────────────────────────────────────────

function PaymentActions({
  payment,
  onMarkPaid,
  onRefund,
  onDelete,
}: {
  payment: ApiPayment;
  onMarkPaid: (id: string) => void;
  onRefund: (payment: ApiPayment) => void;
  onDelete: (payment: ApiPayment) => void;
}) {
  const canPay = payment.status === "pending";
  const canRefund =
    payment.status === "settled" && payment.amount > 0.005 &&
    payment.refundable_amount > 0.004 &&
    (payment.method !== "card" || !!payment.external_ref?.startsWith("cs_"));
  const canDelete = payment.payment_type === "on-site";
  if (!canPay && !canRefund && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(payment)}>
            <Trash2 className="h-4 w-4" />
            <span>Contre-passer</span>
          </DropdownMenuItem>
        )}
        {canDelete && (canPay || canRefund) && <DropdownMenuSeparator />}
        {canPay && (
          <DropdownMenuItem onClick={() => onMarkPaid(payment.id)}>
            <Check className="h-4 w-4 text-green-400" />
            <span>Marquer payé</span>
          </DropdownMenuItem>
        )}
        {canPay && canRefund && <DropdownMenuSeparator />}
        {canRefund && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onRefund(payment)}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Rembourser</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AdminPayments() {
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "settled" | "failed"
  >("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "on-site" | "online">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "card" | "cash" | "transfer" | "check">(
    "all",
  );
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "booking_date" | "amount" | "status" | "method" | "payment_type">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<ApiPayment | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<ApiPayment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundBookingOptions, setRefundBookingOptions] = useState<Array<{ id: string; ref: string }>>([]);

  const [collectOpen, setCollectOpen] = useState(false);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectContext, setCollectContext] = useState<CollectContext | null>(null);
  const [collectEntries, setCollectEntries] = useState<CollectEntry[]>([
    { id: crypto.randomUUID(), amount: "", method: "cash" },
  ]);
  const [discountInput, setDiscountInput] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);

  const [serverStats, setServerStats] = useState<{ paidCount: number; paidAmount: number; refundedCount: number; refundedAmount: number } | null>(null);

  const collectTotals = useMemo(() => {
    const entries = collectEntries.map((e) => {
      const n = parseFloat(e.amount.replace(/\s/g, "").replace(",", "."));
      const amount = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
      return { amount, method: e.method };
    });

    const totalAmount = entries.reduce((acc, e) => acc + (e.amount > 0 ? e.amount : 0), 0);
    const cashAmount = entries.reduce((acc, e) => acc + (e.amount > 0 && e.method === "cash" ? e.amount : 0), 0);
    const cardAmount = entries.reduce((acc, e) => acc + (e.amount > 0 && e.method === "card" ? e.amount : 0), 0);
    const transferAmount = entries.reduce((acc, e) => acc + (e.amount > 0 && e.method === "transfer" ? e.amount : 0), 0);
    const checkAmount = entries.reduce((acc, e) => acc + (e.amount > 0 && e.method === "check" ? e.amount : 0), 0);

    const remainingStart = collectContext?.remaining ?? 0;
    const remainingAfter = remainingStart - totalAmount;
    const overpayAmount = totalAmount > remainingStart ? totalAmount - remainingStart : 0;

    return {
      totalAmount,
      cashAmount,
      cardAmount,
      transferAmount,
      checkAmount,
      remainingStart,
      remainingAfter,
      overpayAmount,
    };
  }, [collectEntries, collectContext]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentTypeFilter !== "all") params.set("paymentType", paymentTypeFilter);
      if (methodFilter !== "all") params.set("method", methodFilter);
      if (search) params.set("search", search);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const dateParams = dateFilter === "custom"
        ? { dateFrom: customDateFrom || undefined, dateTo: customDateTo || undefined }
        : getDateFilterParams(dateFilter);
      if (dateParams.dateFrom) params.set("dateFrom", dateParams.dateFrom);
      if (dateParams.dateTo) params.set("dateTo", dateParams.dateTo);

      const res = await fetch(`/api/admin/payments?${params}`);
      const json = (await res.json()) as PaymentsResponse;
      if (json.success) {
        setPayments(json.data.data);
        setTotal(json.data.total);
        if (json.data.stats) setServerStats(json.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      toast.error("Erreur lors du chargement des paiements");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentTypeFilter, methodFilter, dateFilter, customDateFrom, customDateTo, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / perPage);

  const stats = useMemo(() => {
    return serverStats ?? { paidCount: 0, paidAmount: 0, refundedCount: 0, refundedAmount: 0 };
  }, [serverStats]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function handleMarkPaid(paymentId: string) {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/pay`, {
        method: "PUT",
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement marqué comme payé");
        fetchPayments();
      } else {
        toast.error(json.error || "Échec du marquage");
      }
    } catch (error) {
      console.error("Mark paid error:", error);
      toast.error("Erreur réseau");
    }
  }

  async function openCollectDialog(bookingId: string) {
    setCollectLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        fetch(`/api/admin/bookings/${bookingId}`),
        fetch(`/api/admin/bookings/${bookingId}/payments`),
      ]);
      if (!bRes.ok) throw new Error("Failed to fetch booking");
      if (!pRes.ok) throw new Error("Failed to fetch booking payments");

      const bJson = (await bRes.json()) as { success: boolean; data: any; error?: string };
      const pJson = (await pRes.json()) as { success: boolean; data: any; error?: string };
      if (!bJson.success) throw new Error(bJson.error || "Booking fetch failed");
      if (!pJson.success) throw new Error(pJson.error || "Payments fetch failed");

      const booking = bJson.data as CollectBooking;
      // Une réservation annulée ne peut être encaissée que si son solde a été conservé.
      if (!bookingAllowsCollection(booking)) {
        toast.error("Cette réservation est annulée — aucun encaissement possible");
        return;
      }
      const ledger = pJson.data as { balance?: number; settled?: number };
      const totalPaid = ledger.settled ?? 0;
      const finalTotal = getBookingAmountDue(booking);
      const remaining = ledger.balance ?? Math.max(finalTotal - totalPaid, 0);

      if (remaining <= 0 && !getManualDiscountEligibility(booking).allowed) {
        toast.success("La réservation est déjà soldée");
        return;
      }

      setCollectContext({
        bookingId,
        bookingRef: booking.booking_ref,
        userName: booking.band_name || booking.user_name || null,
        totalPrice: finalTotal,
        totalPaid,
        remaining,
        bookingPaymentMethod: booking.payment_method || null,
        promoCode: booking.promo_code || null,
        promoCodeType: booking.promo_code_type || null,
        promoCodeValue: booking.promo_code_value ?? null,
        promoDiscount: booking.promo_discount || 0,
        booking,
        overpayment: Math.max(0, -remaining),
      });
      setDiscountInput(String(booking.promo_discount || 0));

      setCollectEntries([
        {
          id: crypto.randomUUID(),
          amount: remaining > 0 ? remaining.toFixed(2).replace(".", ",") : "",
          method: booking.payment_method === "card" ? "card" : "cash",
        },
      ]);
      setCollectOpen(true);
    } catch (error) {
      console.error("Open collect dialog error:", error);
      toast.error("Impossible de charger la réservation");
    } finally {
      setCollectLoading(false);
    }
  }

  async function applyCollectDiscount() {
    if (!collectContext) return;
    const eligibility = getManualDiscountEligibility(collectContext.booking);
    if (!eligibility.allowed) { toast.error(getManualDiscountBlockMessage(eligibility.reason)); return; }
    const amount = parseAmountInput(discountInput);
    if (!Number.isFinite(amount) || amount < 0 || amount > collectContext.booking.total_price) { toast.error("Montant invalide"); return; }
    setDiscountSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${collectContext.bookingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promo_discount: amount }) });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) { toast.error(json.error || "Erreur"); return; }
      await openCollectDialog(collectContext.bookingId);
      fetchPayments();
      toast.success("Remise appliquée");
    } catch { toast.error("Erreur réseau"); } finally { setDiscountSaving(false); }
  }

  function addCollectEntry() {
    setCollectEntries((prev) => [...prev, { id: crypto.randomUUID(), amount: "", method: "cash" }]);
  }

  function removeCollectEntry(idx: number) {
    setCollectEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitCollectPayments() {
    if (!collectContext) return;

    if (collectContext.bookingPaymentMethod === "card") {
      const hasNonCard = collectEntries.some((e) => e.method !== "card" && e.amount.trim() !== "");
      if (hasNonCard) {
        toast.error("En ligne, les paiements sont uniquement par CB");
        return;
      }
    }

    const parsed = collectEntries
      .map((e) => {
        const n = parseFloat(e.amount.replace(/\s/g, "").replace(",", "."));
        const amount = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
        return { method: e.method, amount };
      })
      .filter((e) => e.amount > 0);

    if (parsed.length === 0) {
      toast.error("Ajoutez au moins un paiement");
      return;
    }

    const totalToAdd = parsed.reduce((acc, p) => acc + p.amount, 0);
    if (totalToAdd > collectContext.remaining) {
      toast.error(`Le total dépasse le reste à payer (${formatPrice(collectContext.remaining)})`);
      return;
    }

    setCollectLoading(true);
    try {
      for (const p of parsed) {
        const res = await fetch(`/api/admin/bookings/${collectContext.bookingId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: p.amount,
            method: p.method,
          }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          toast.error(json.error || "Erreur lors de l'ajout d'un paiement");
          return;
        }
      }

      toast.success("Paiement(s) enregistré(s)");
      setCollectOpen(false);
      setCollectContext(null);
      setCollectEntries([{ id: crypto.randomUUID(), amount: "", method: "cash" }]);
      fetchPayments();
    } catch (error) {
      console.error("Submit collect payments error:", error);
      toast.error("Erreur réseau");
    } finally {
      setCollectLoading(false);
    }
  }

  async function openRefundDialog(payment: ApiPayment) {
    const refs = payment.booking_refs.split(",").map((ref) => ref.trim()).filter(Boolean);
    const options: Array<{ id: string; ref: string }> = [];
    await Promise.all(refs.map(async (ref) => {
      try {
        const response = await fetch(`/api/admin/bookings?search=${encodeURIComponent(ref)}&all=true`);
        const json = await response.json() as { success?: boolean; data?: { data?: Array<{ id: string; booking_ref: string }> } };
        const match = json.data?.data?.find((booking) => booking.booking_ref === ref);
        if (match) options.push({ id: match.id, ref: match.booking_ref });
      } catch { /* the dialog remains unavailable until a reservation is selected */ }
    }));
    setRefundTarget(payment);
    setRefundBookingOptions(options);
    setRefundOpen(true);
  }

  const openDeleteDialog = (payment: ApiPayment) => {
    setDeletingPayment(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "DELETE",
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement contre-passé");
        setDeleteDialogOpen(false);
        fetchPayments();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  async function handleExportCollections() {
    const params = new URLSearchParams();
    params.set("all", "true");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (paymentTypeFilter !== "all") params.set("paymentType", paymentTypeFilter);
    if (methodFilter !== "all") params.set("method", methodFilter);
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    const dateParams = dateFilter === "custom"
      ? { dateFrom: customDateFrom || undefined, dateTo: customDateTo || undefined }
      : getDateFilterParams(dateFilter);
    if (dateParams.dateFrom) params.set("dateFrom", dateParams.dateFrom);
    if (dateParams.dateTo) params.set("dateTo", dateParams.dateTo);

    try {
      const res = await fetch(`/api/admin/payments?${params}`);
      const json = (await res.json()) as PaymentsResponse;
      if (json.success) {
        exportCollectionsCSV(json.data.data);
        toast.success(`${json.data.data.length} paiement(s) exporté(s)`);
      } else {
        toast.error("Erreur lors de l'export");
      }
    } catch {
      toast.error("Erreur réseau lors de l'export");
    }
  }

  async function handleExportAllocations() {
    const params = new URLSearchParams();
    params.set("all", "true");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (paymentTypeFilter !== "all") params.set("paymentType", paymentTypeFilter);
    if (methodFilter !== "all") params.set("method", methodFilter);
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    const dateParams = dateFilter === "custom"
      ? { dateFrom: customDateFrom || undefined, dateTo: customDateTo || undefined }
      : getDateFilterParams(dateFilter);
    if (dateParams.dateFrom) params.set("dateFrom", dateParams.dateFrom);
    if (dateParams.dateTo) params.set("dateTo", dateParams.dateTo);

    try {
      const res = await fetch(`/api/admin/payments?${params}`);
      const json = (await res.json()) as PaymentsResponse;
      if (!json.success) {
        toast.error("Erreur lors du chargement de la ventilation");
        return;
      }
      const result = await buildAllocationExportRows(json.data.data);
      if (result.missing.length > 0) {
        const details = result.missing.slice(0, 3).join(" ; ");
        console.error("Allocation export incomplete:", result.missing);
        toast.error(
          `Ventilation incomplète — aucun fichier généré. ${details}. Les allocations détaillées doivent être fournies par /api/admin/bookings/:id/payments.`,
        );
        return;
      }
      exportAllocationsCSV(result.rows);
      toast.success(`${result.rows.length} allocation(s) exportée(s)`);
    } catch (error) {
      console.error("Allocation export error:", error);
      toast.error("Erreur réseau lors de l'export de la ventilation");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && payments.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="text-zinc-400">
            {total} paiement(s) au total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCollections}>
            <Download className="mr-2 h-4 w-4" />
            Exporter les encaissements
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAllocations}>
            <Download className="mr-2 h-4 w-4" />
            Exporter la ventilation
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={statusFilter === "settled"}
          onClick={() => {
            setStatusFilter((current) => (current === "settled" ? "all" : "settled"));
            setPage(1);
          }}
          className={`rounded-xl border bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-600 ${
            statusFilter === "settled" ? "border-green-400/50" : "border-zinc-800"
          }`}
        >
          <p className="text-sm text-zinc-400">Payés</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {stats.paidCount}
          </p>
          <p className="text-sm text-zinc-500">
            {formatPrice(stats.paidAmount)}
          </p>
        </button>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left">
          <p className="text-sm text-zinc-400">Remboursés</p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            {stats.refundedCount}
          </p>
          <p className="text-sm text-zinc-500">
            {formatPrice(Math.abs(stats.refundedAmount))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value as typeof dateFilter); setPage(1); }}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Date</option>
            <option value="today">Auj.</option>
            <option value="week">Sem.</option>
            <option value="month">Mois</option>
            <option value="custom">Perso.</option>
          </select>
          {dateFilter === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customDateFrom}
                onChange={e => { setCustomDateFrom(e.target.value); setPage(1); }}
                className="h-8 text-xs bg-zinc-900 border-zinc-700 w-36"
              />
              <span className="text-zinc-500 text-xs">→</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={e => { setCustomDateTo(e.target.value); setPage(1); }}
                className="h-8 text-xs bg-zinc-900 border-zinc-700 w-36"
              />
            </div>
          )}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Statut</option>
            <option value="pending">En attente</option>
            <option value="settled">Payé</option>
            <option value="failed">Échec</option>
          </select>
          <select
            value={paymentTypeFilter}
            onChange={(e) => { setPaymentTypeFilter(e.target.value as typeof paymentTypeFilter); setPage(1); }}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Type</option>
            <option value="on-site">Sur place</option>
            <option value="online">En ligne</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value as typeof methodFilter); setPage(1); }}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Méthode</option>
            <option value="cash">Espèces</option>
            <option value="card">CB</option>
            <option value="transfer">Virement</option>
            <option value="check">Chèque</option>
          </select>

          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-zinc-500">Tri</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
            >
              <option value="booking_date">Date</option>
              <option value="amount">€</option>
              <option value="status">Statut</option>
              <option value="method">Méthode</option>
              <option value="payment_type">Type</option>
              <option value="created_at">Créé</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
            >
              <option value="desc">↓</option>
              <option value="asc">↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Réservation
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Nom du groupe
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Type paiement
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Méthode
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-200"
                    onClick={() => {
                      if (sortBy === "amount") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("amount");
                        setPage(1);
                      }
                    }}
                  >
                    Montant
                    {sortBy === "amount" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-200"
                    onClick={() => {
                      if (sortBy === "booking_date") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("booking_date");
                        setPage(1);
                      }
                    }}
                  >
                    Date
                    {sortBy === "booking_date" && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Non affecté</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {payments.map((payment: ApiPayment) => {
                const statusCfg = statusConfig(payment);

                return (
                  <tr
                    key={payment.id}
                    className="bg-zinc-900/50 hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      {payment.booking_refs ? (
                        <span className="font-mono text-sm text-primary">{payment.booking_refs}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.user_name && payment.user_id ? (
                        <a href={`/admin/users/${payment.user_id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          {payment.user_name}
                        </a>
                      ) : payment.booking_refs ? (
                        <span className="text-zinc-500">Compte supprimé</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.user_band_name && payment.user_id ? (
                        <a href={`/admin/users/${payment.user_id}`} className="text-sm text-zinc-200 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {payment.user_band_name}
                        </a>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                        {paymentTypeLabel(payment.payment_type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm">
                        {(() => {
                          const Icon = PAYMENT_METHOD_ICONS[payment.method];
                          return Icon ? <><Icon className="h-4 w-4" /> {paymentMethodLabelShort(payment.method)}</> : paymentMethodLabelShort(payment.method);
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium">
                        {formatPrice(payment.amount)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {payment.paid_at
                        ? formatDate(payment.paid_at)
                        : payment.booking_date
                          ? formatDate(payment.booking_date)
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {Math.abs(payment.unallocated_amount) > 0.005 ? formatPrice(payment.unallocated_amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentActions
                        payment={payment}
                        onMarkPaid={handleMarkPaid}
                        onRefund={openRefundDialog}
                        onDelete={openDeleteDialog}
                      />
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    Aucun paiement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Refund Dialog */}
      <RefundPaymentDialog
        payment={refundTarget}
        bookingId={refundBookingOptions.length === 1 ? refundBookingOptions[0].id : null}
        bookingOptions={refundBookingOptions}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSettled={fetchPayments}
      />

      <DeletePaymentDialog
        payment={deletingPayment}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeletePayment}
      />

      <Dialog
        open={collectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCollectOpen(false);
            setCollectContext(null);
            setCollectEntries([{ id: crypto.randomUUID(), amount: "", method: "cash" }]);
          }
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Ajouter un ou plusieurs paiements</DialogTitle>
            <DialogDescription>
              {collectContext ? (
                <>
                  {collectContext.userName || collectContext.bookingRef} · Reste à payer :{" "}
                  <span className="font-semibold text-foreground">{formatPrice(collectTotals.remainingStart)}</span>
                  {(() => {
                    const tax = formatTaxBreakdown(collectTotals.remainingStart);
                    return (
                      <span className="ml-2 text-xs text-zinc-500">
                        (HT {tax.ht} · TVA 20% {tax.vat})
                      </span>
                    );
                  })()}
                  {collectContext.promoCode && (
                    <span className="ml-2 text-xs text-primary">
                      Promo: {collectContext.promoCode}
                      {collectContext.promoCodeType && collectContext.promoCodeValue != null && (
                        <> ({collectContext.promoCodeType === "percentage" ? `-${collectContext.promoCodeValue}%` : `-${formatPrice(collectContext.promoCodeValue)}`})</>
                      )}
                      {collectContext.promoDiscount > 0 && <> · -{formatPrice(collectContext.promoDiscount)} appliqué</>}
                    </span>
                  )}
                </>
              ) : (
                "Chargement..."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {collectContext && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-zinc-400 !mb-0">Remise manuelle</Label>
                  <Input value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="h-7 w-24 border-zinc-700 bg-zinc-800 text-xs" inputMode="decimal" />
                  <Button type="button" size="sm" onClick={applyCollectDiscount} disabled={discountSaving} className="h-7 text-xs">Appliquer</Button>
                </div>
                {collectContext.promoCode && (
                  <p className="text-xs text-zinc-500">Cette remise remplacera le code promo {collectContext.promoCode}.</p>
                )}
              </div>
            )}
            {collectContext && collectContext.overpayment > 0 && (
              <p className="text-xs text-amber-400">Trop-perçu : {formatPrice(collectContext.overpayment)} — utiliser le remboursement.</p>
            )}
            {collectContext && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Paiements saisis</span>
                  <span className="font-semibold text-foreground">{formatPrice(collectTotals.totalAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    Espèces: {formatPrice(collectTotals.cashAmount)} · CB: {formatPrice(collectTotals.cardAmount)} · Virement:{" "}
                    {formatPrice(collectTotals.transferAmount)} · Chèque: {formatPrice(collectTotals.checkAmount)}
                  </span>
                  <span>Reste: {formatPrice(collectTotals.remainingAfter)}</span>
                </div>
                {collectTotals.overpayAmount > 0 && (
                  <p className="mt-2 text-xs text-destructive">
                    Le total dépasse le reste à payer de {formatPrice(collectTotals.overpayAmount)}
                  </p>
                )}
              </div>
            )}

            {collectEntries.map((entry, idx) => (
              <div key={entry.id} className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label className="text-xs text-zinc-400">Montant (€ TTC)</Label>
                  <Input
                    value={entry.amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCollectEntries((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: v } : p)));
                    }}
                    placeholder="0,00"
                    className="border-zinc-700 bg-zinc-800"
                    inputMode="decimal"
                  />
                </div>

                <div className="col-span-5">
                  <Label className="text-xs text-zinc-400">Type</Label>
                  <select
                    value={entry.method}
                    onChange={(e) => {
                      const v = e.target.value as "cash" | "card" | "transfer" | "check";
                      setCollectEntries((prev) => prev.map((p, i) => (i === idx ? { ...p, method: v } : p)));
                    }}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  >
                    {collectContext?.bookingPaymentMethod === "card" ? (
                      <option value="card">CB</option>
                    ) : (
                      <>
                        <option value="cash">Espèces</option>
                        <option value="card">CB</option>
                        <option value="transfer">Virement</option>
                        <option value="check">Chèque</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="col-span-2 flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollectEntry(idx)}
                    disabled={collectEntries.length === 1 || collectLoading}
                    className="text-zinc-400"
                  >
                    Retirer
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={addCollectEntry}
              disabled={collectLoading}
            >
              Ajouter un paiement
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollectOpen(false)}
              className="border-zinc-700"
              disabled={collectLoading}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submitCollectPayments}
              disabled={collectLoading || !collectContext || collectTotals.overpayAmount > 0}
            >
              {collectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
