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
import { formatPrice } from "@/lib/booking";
import { exportPaymentsCSV } from "@/lib/export";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ApiPayment {
  id: string;
  booking_id: string;
  amount: number;
  method: "" | "card" | "cash" | "transfer" | "check";
  payment_type: "on-site" | "online";
  status: "pending" | "paid" | "refunded" | "partial-refund";
  refunded_amount: number;
  paid_at: string | null;
  created_at: string;
  booking_ref: string | null;
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
  };
}

type BookingPaymentMethod = "card" | "cash" | null;

interface CollectContext {
  bookingId: string;
  bookingRef: string | null;
  userName: string | null;
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  bookingPaymentMethod: BookingPaymentMethod;
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

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "En attente", variant: "outline" },
  paid: { label: "Payé", variant: "default" },
  refunded: { label: "Remboursé", variant: "destructive" },
  "partial-refund": { label: "Partiel", variant: "secondary" },
};

// ─── Refund Dialog ──────────────────────────────────────────────────────────────

function RefundDialog({
  payment,
  open,
  onOpenChange,
  onConfirm,
}: {
  payment: ApiPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentId: string, amount: number) => void;
}) {
  const [refundAmount, setRefundAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxRefund = payment ? payment.amount - payment.refunded_amount : 0;

  useEffect(() => {
    if (open && payment) {
      setRefundAmount((payment.amount - payment.refunded_amount).toFixed(2).replace(".", ","));
      setSubmitting(false);
    }
  }, [open, payment]);

  const parsedAmount = parseFloat(refundAmount.replace(/\s/g, "").replace(",", "."));
  const isValid =
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxRefund;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment || !isValid) return;

    setSubmitting(true);
    onConfirm(payment.id, parsedAmount);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Confirmer le remboursement</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                Paiement de{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(payment.amount)}
                </span>
                {payment.refunded_amount > 0 && (
                  <> (déjà remboursé : {formatPrice(payment.refunded_amount)})</>
                )}
                <br />
                Maximum remboursable :{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(maxRefund)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Montant à rembourser (€)</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={maxRefund.toFixed(2)}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              className="border-zinc-700 bg-zinc-800"
              autoFocus
            />
            {refundAmount && !isValid && (
              <p className="text-xs text-destructive">
                Montant invalide (max {formatPrice(maxRefund)})
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isValid || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rembourser {isValid ? formatPrice(parsedAmount) : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Row Actions ────────────────────────────────────────────────────────

function PaymentActions({
  payment,
  onMarkPaid,
  onRefund,
  onAddPayment,
}: {
  payment: ApiPayment;
  onMarkPaid: (id: string) => void;
  onRefund: (payment: ApiPayment) => void;
  onAddPayment: (bookingId: string) => void;
}) {
  const isSynthetic = payment.id.startsWith("on-site:") && payment.method === "";
  const canPay = payment.status === "pending" && !isSynthetic;
  const canRefund = !isSynthetic && payment.status === "paid" && payment.refunded_amount < payment.amount;

  const canAddPayment = !!payment.booking_id;

  if (!canPay && !canRefund && !canAddPayment) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
        {canAddPayment && (
          <DropdownMenuItem onClick={() => onAddPayment(payment.booking_id)}>
            <Banknote className="h-4 w-4" />
            <span>Ajouter un paiement</span>
          </DropdownMenuItem>
        )}
        {canAddPayment && (canPay || canRefund) && <DropdownMenuSeparator />}
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
    "all" | "pending" | "paid" | "refunded"
  >("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "on-site" | "online">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "card" | "cash" | "transfer" | "check">(
    "all",
  );
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "booking_date" | "amount" | "status" | "method" | "payment_type">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<ApiPayment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const [collectOpen, setCollectOpen] = useState(false);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectContext, setCollectContext] = useState<CollectContext | null>(null);
  const [collectEntries, setCollectEntries] = useState<CollectEntry[]>([
    { id: crypto.randomUUID(), amount: "", method: "cash" },
  ]);

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
    const remainingAfter = Math.max(remainingStart - totalAmount, 0);
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

      const dateParams = getDateFilterParams(dateFilter);
      if (dateParams.dateFrom) params.set("dateFrom", dateParams.dateFrom);
      if (dateParams.dateTo) params.set("dateTo", dateParams.dateTo);

      const res = await fetch(`/api/admin/payments?${params}`);
      const json = (await res.json()) as PaymentsResponse;
      if (json.success) {
        setPayments(json.data.data);
        setTotal(json.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      toast.error("Erreur lors du chargement des paiements");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentTypeFilter, methodFilter, dateFilter, search, sortBy, sortOrder]);

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

  // Stats from current page data
  const stats = useMemo(() => {
    const pending = payments.filter((p) => p.status === "pending");
    const paid = payments.filter((p) => p.status === "paid");

    return {
      pending: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      paid: paid.length,
      paidAmount: paid.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);

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
      const pJson = (await pRes.json()) as { success: boolean; data: any[]; error?: string };
      if (!bJson.success) throw new Error(bJson.error || "Booking fetch failed");
      if (!pJson.success) throw new Error(pJson.error || "Payments fetch failed");

      const booking = bJson.data as {
        booking_ref: string;
        total_price: number;
        payment_method: BookingPaymentMethod;
        band_name?: string | null;
        user_name?: string | null;
        user_band_name?: string | null;
      };
      const paymentsRows = pJson.data as Array<{ amount: number; status: string }>;
      const totalPaid = paymentsRows.reduce((acc, p) => (p.status === "paid" ? acc + p.amount : acc), 0);
      const remaining = Math.max(booking.total_price - totalPaid, 0);

      if (remaining <= 0) {
        toast.success("La réservation est déjà soldée");
        return;
      }

      setCollectContext({
        bookingId,
        bookingRef: booking.booking_ref,
        userName: booking.band_name || booking.user_name || null,
        totalPrice: booking.total_price,
        totalPaid,
        remaining,
        bookingPaymentMethod: booking.payment_method || null,
      });

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
    if (collectContext.remaining > 0 && totalToAdd > collectContext.remaining) {
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
            status: "paid",
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

  async function handleRefundConfirm(paymentId: string, amount: number) {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Remboursement de ${formatPrice(amount)} effectué`);
        setRefundOpen(false);
        fetchPayments();
      } else {
        toast.error(json.error || "Échec du remboursement");
      }
    } catch (error) {
      console.error("Refund error:", error);
      toast.error("Erreur réseau");
    }
  }

  function openRefundDialog(payment: ApiPayment) {
    setRefundTarget(payment);
    setRefundOpen(true);
  }

  function handleExportCSV() {
    exportPaymentsCSV(payments);
    toast.success(`${payments.length} paiement(s) exporté(s)`);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="text-zinc-400">
            {total} paiement(s) au total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          Exporter CSV
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">En attente</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">
            {stats.pending}
          </p>
          <p className="text-sm text-zinc-500">
            {formatPrice(stats.pendingAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Payés</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {stats.paid}
          </p>
          <p className="text-sm text-zinc-500">
            {formatPrice(stats.paidAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
       <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
           <Input
             id="payments-search"
             placeholder="Rechercher par client ou référence..."
             value={searchInput}
             onChange={(e) => setSearchInput(e.target.value)}
             className="pl-10 border-zinc-700 bg-zinc-800"
           />
         </div>

         <div className="flex flex-wrap gap-2">
          <select
            id="payment-status-filter"
            value={statusFilter}
             onChange={(e) => {
               setStatusFilter(e.target.value as typeof statusFilter);
               setPage(1);
             }}
             className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
           >
             <option value="all">Tous les statuts</option>
             <option value="pending">En attente</option>
             <option value="paid">Payé</option>
            <option value="refunded">Remboursé</option>
          </select>

          <select
            id="payment-type-filter"
            value={paymentTypeFilter}
            onChange={(e) => {
              setPaymentTypeFilter(e.target.value as typeof paymentTypeFilter);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les types</option>
            <option value="on-site">Sur place</option>
            <option value="online">En ligne</option>
          </select>

          <select
            id="payment-method-filter"
            value={methodFilter}
             onChange={(e) => {
               setMethodFilter(e.target.value as typeof methodFilter);
               setPage(1);
             }}
             className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">Toutes les méthodes</option>
            <option value="cash">Espèces</option>
            <option value="card">CB</option>
            <option value="transfer">Virement</option>
            <option value="check">Chèque</option>
          </select>
           <select
             id="payments-date-filter"
             value={dateFilter}
             onChange={(e) => {
               setDateFilter(e.target.value as typeof dateFilter);
               setPage(1);
             }}
             className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
           >
             <option value="all">Toutes les dates</option>
             <option value="today">Aujourd'hui</option>
             <option value="week">Cette semaine</option>
             <option value="month">Ce mois</option>
           </select>
           <select
             id="payments-sort-by"
             value={sortBy}
             onChange={(e) => {
               setSortBy(e.target.value as typeof sortBy);
               setPage(1);
             }}
             className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
           >
             <option value="created_at">Trier par création</option>
             <option value="booking_date">Trier par date réservation</option>
             <option value="amount">Trier par montant</option>
            <option value="status">Trier par statut</option>
            <option value="method">Trier par méthode</option>
            <option value="payment_type">Trier par type</option>
          </select>
           <select
             id="payments-sort-order"
             value={sortOrder}
             onChange={(e) => {
               setSortOrder(e.target.value as typeof sortOrder);
               setPage(1);
             }}
             className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
           >
             <option value="desc">Décroissant</option>
             <option value="asc">Croissant</option>
           </select>
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
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {payments.map((payment: ApiPayment) => {
                const statusCfg = STATUS_CONFIG[payment.status] || {
                  label: payment.status,
                  variant: "outline" as const,
                };

                return (
                  <tr
                    key={payment.id}
                    className="bg-zinc-900/50 hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      {payment.booking_ref ? (
                        <span className="font-mono text-sm text-primary">
                          {payment.booking_ref}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.user_name ? (
                        <p className="font-medium">{payment.user_name}</p>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.user_band_name ? (
                        <p className="text-sm text-zinc-200">{payment.user_band_name}</p>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                        {payment.payment_type === "on-site" ? "Sur place" : "En ligne"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm">
                        {payment.method === "" ? (
                          <>—</>
                        ) : payment.method === "card" ? (
                          <>
                            <CreditCard className="h-4 w-4" /> CB
                          </>
                        ) : payment.method === "cash" ? (
                          <>
                            <Banknote className="h-4 w-4" /> Espèces
                          </>
                        ) : payment.method === "transfer" ? (
                          <>
                            <Landmark className="h-4 w-4" /> Virement
                          </>
                        ) : payment.method === "check" ? (
                          <>
                            <FileText className="h-4 w-4" /> Chèque
                          </>
                        ) : (
                          <>—</>
                        )}
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
                      {payment.refunded_amount > 0 && (
                        <p className="text-xs text-red-400">
                          -{formatPrice(payment.refunded_amount)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {payment.paid_at
                        ? formatDate(payment.paid_at)
                        : payment.booking_date
                          ? formatDate(payment.booking_date)
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {payment.payment_type === "on-site" && payment.status === "pending" && payment.method === "" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700"
                          onClick={() => openCollectDialog(payment.booking_id)}
                        >
                          Encaisser
                        </Button>
                      ) : (
                        <PaymentActions
                          payment={payment}
                          onMarkPaid={handleMarkPaid}
                          onRefund={openRefundDialog}
                          onAddPayment={openCollectDialog}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
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
      <RefundDialog
        payment={refundTarget}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onConfirm={handleRefundConfirm}
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
                </>
              ) : (
                "Chargement..."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
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
                  <Label className="text-xs text-zinc-400">Montant (EUR)</Label>
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
