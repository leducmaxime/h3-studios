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
  Ban,
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
import { formatBookingSlot, formatPrice } from "@/lib/booking";
import { isBookingPast, parseAmountInput, round2 } from "@/lib/booking-totals";
import { formatTaxBreakdown } from "@/lib/tax";
import { exportAllocationsCSV, exportCollectionsCSV, type AllocationExportRow } from "@/lib/export";
import { RefundPaymentDialog, VoidPaymentDialog } from "@/components/admin/refund";
import { BookingPaymentState } from "@/components/admin/BookingPaymentState";
import { paymentRecordStatusLabel, paymentMethodLabelShort, paymentTypeLabel } from "@/lib/labels";
import { allocateCollectPayments } from "@/lib/recouvrement-collect";
import type { DbPayment, OverdueBooking } from "@/lib/db-types";

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

// ─── Payment Row Actions ────────────────────────────────────────────────────────

function PaymentActions({
  payment,
  onMarkPaid,
  onRefund,
  onVoid,
  onCollect,
}: {
  payment: ApiPayment;
  onMarkPaid: (id: string) => void;
  onRefund: (payment: ApiPayment) => void;
  onVoid: (payment: ApiPayment) => void;
  onCollect: (payment: ApiPayment) => void;
}) {
  const canPay = payment.status === "pending";
  const canVoid = payment.status === "pending";
  const canRefund =
    payment.status === "settled" && payment.amount > 0.005 &&
    payment.refundable_amount > 0.004;
  const canCollect = Boolean(payment.user_id);
  if (!canPay && !canRefund && !canVoid && !canCollect) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
        {canCollect && (
          <DropdownMenuItem onClick={() => onCollect(payment)}>
            <Banknote className="h-4 w-4 text-primary" />
            <span>Encaisser ce client</span>
          </DropdownMenuItem>
        )}
        {canCollect && (canPay || canVoid || canRefund) && <DropdownMenuSeparator />}
        {canPay && (
          <DropdownMenuItem onClick={() => onMarkPaid(payment.id)}>
            <Check className="h-4 w-4 text-green-400" />
            <span>Marquer payé</span>
          </DropdownMenuItem>
        )}
        {canVoid && (
          <DropdownMenuItem onClick={() => onVoid(payment)}>
            <Ban className="h-4 w-4 text-zinc-400" />
            <span>Annuler cette ligne</span>
          </DropdownMenuItem>
        )}
        {(canPay || canVoid) && canRefund && <DropdownMenuSeparator />}
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

// ─── Group Collect Dialog (waterfall multi-booking) ─────────────────────────────
//
// Encaisse un montant global (une ou plusieurs méthodes) pour un client, réparti
// sur plusieurs réservations sélectionnées selon la même règle que le serveur :
// waterfall, réservation la plus ancienne d'abord (date, heure, référence), chaque
// réservation soldée avant de passer à la suivante. Le calcul est partagé avec le
// serveur via `allocateCollectPayments`, afin que la prévisualisation reste sa
// source de vérité.

interface RecouvrementLookupResponse {
  success: boolean;
  data?: { bookings: OverdueBooking[]; totalCount: number; totalRemaining: number };
  error?: string;
}

function sortBookingsForWaterfall(bookings: OverdueBooking[]): OverdueBooking[] {
  return [...bookings].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.start_time.localeCompare(b.start_time) ||
    a.booking_ref.localeCompare(b.booking_ref),
  );
}

interface WaterfallRow {
  id: string;
  due: number;
  allocated: number;
}

function BookingCheckRow({
  booking,
  checked,
  onToggle,
}: {
  booking: OverdueBooking;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-zinc-800/60 px-3 py-2 last:border-b-0 hover:bg-zinc-800/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-zinc-600 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-primary">{booking.booking_ref}</p>
        <p className="truncate text-xs text-zinc-500">
          {formatBookingSlot(booking)}
          {booking.band_name ? ` · ${booking.band_name}` : ""}
        </p>
      </div>
      <BookingPaymentState remaining={booking.remaining} variant="text" urgent className="shrink-0 text-sm" />
    </label>
  );
}

export function GroupCollectDialog({
  open,
  onOpenChange,
  userId,
  clientLabel,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  clientLabel?: string | null;
  onSettled?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<OverdueBooking[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<CollectEntry[]>([
    { id: crypto.randomUUID(), amount: "", method: "cash" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setBookings([]);
    setSelectedIds(new Set());
    setEntries([{ id: crypto.randomUUID(), amount: "", method: "cash" }]);

    fetch(`/api/admin/recouvrement?userId=${encodeURIComponent(userId)}&includeUpcoming=true`)
      .then((res) => res.json() as Promise<RecouvrementLookupResponse>)
      .then((json) => {
        if (cancelled) return;
        if (!json.success || !json.data) {
          toast.error(json.error || "Impossible de charger les réservations du client");
          return;
        }
        const fetched = json.data.bookings;
        setBookings(fetched);
        // Par défaut : les séances déjà terminées sont pré-sélectionnées (le cas
        // "recouvrement" classique). Les séances à venir restent décochées — les
        // inclure change ce que l'encaissement solde, ça doit être un choix
        // explicite de l'opérateur, jamais un effet de bord de l'ouverture du dialogue.
        const due = fetched.filter((b) => isBookingPast(b));
        const defaultTotal = round2(due.reduce((sum, b) => sum + Math.max(0, b.remaining), 0));
        setSelectedIds(new Set(due.map((b) => b.id)));
        setEntries([{
          id: crypto.randomUUID(),
          amount: defaultTotal > 0 ? defaultTotal.toFixed(2).replace(".", ",") : "",
          method: "cash",
        }]);
      })
      .catch(() => { if (!cancelled) toast.error("Erreur réseau"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, userId]);

  const { past, upcoming } = useMemo(() => {
    const past: OverdueBooking[] = [];
    const upcoming: OverdueBooking[] = [];
    for (const booking of bookings) (isBookingPast(booking) ? past : upcoming).push(booking);
    return { past, upcoming };
  }, [bookings]);

  const toggleBooking = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === bookings.length ? new Set() : new Set(bookings.map((b) => b.id))));
  };

  const bookingsById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const selectedBookings = useMemo(
    () => sortBookingsForWaterfall(bookings.filter((b) => selectedIds.has(b.id))),
    [bookings, selectedIds],
  );
  const totalDueSelected = useMemo(
    () => round2(selectedBookings.reduce((sum, b) => sum + Math.max(0, b.remaining), 0)),
    [selectedBookings],
  );

  const parsedEntries = useMemo(
    () => entries
      .map((e) => ({ method: e.method, amount: parseAmountInput(e.amount) }))
      .filter((e) => Number.isFinite(e.amount) && e.amount > 0),
    [entries],
  );
  const totalAmount = useMemo(() => round2(parsedEntries.reduce((sum, e) => sum + e.amount, 0)), [parsedEntries]);
  const preview = useMemo(() => {
    const rows = selectedBookings.map((booking) => ({
      id: booking.id,
      due: round2(Math.max(0, booking.remaining)),
      allocated: 0,
    }));
    const allocation = allocateCollectPayments(
      selectedBookings.map((booking) => ({ id: booking.id, remaining: booking.remaining })),
      parsedEntries,
    );
    if ("error" in allocation) return { rows, unallocated: totalAmount };

    const allocatedByBooking = new Map<string, number>();
    for (const line of allocation) {
      allocatedByBooking.set(line.bookingId, round2((allocatedByBooking.get(line.bookingId) ?? 0) + line.amount));
    }
    const allocatedTotal = allocation.reduce((sum, line) => sum + line.amount, 0);
    return {
      rows: rows.map((row) => ({ ...row, allocated: allocatedByBooking.get(row.id) ?? 0 })),
      unallocated: round2(Math.max(0, totalAmount - allocatedTotal)),
    };
  }, [selectedBookings, parsedEntries, totalAmount]);

  const matchSelectionAmount = () => {
    setEntries((prev) => [{
      id: prev[0]?.id ?? crypto.randomUUID(),
      amount: totalDueSelected > 0 ? totalDueSelected.toFixed(2).replace(".", ",") : "",
      method: prev[0]?.method ?? "cash",
    }]);
  };

  async function handleSubmit() {
    if (!userId || selectedBookings.length === 0 || totalAmount <= 0.005) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/recouvrement/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          bookingIds: selectedBookings.map((b) => b.id),
          payments: parsedEntries,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        toast.error(json.error || "Erreur lors de l'encaissement");
        return;
      }

      const fullCount = preview.rows.filter((r) => r.allocated >= r.due - 0.005).length;
      const partialCount = preview.rows.filter((r) => r.allocated > 0.005 && r.allocated < r.due - 0.005).length;
      const parts = [`${fullCount} réservation${fullCount === 1 ? "" : "s"} soldée${fullCount === 1 ? "" : "s"}`];
      if (partialCount > 0) parts.push(`${partialCount} partielle${partialCount === 1 ? "" : "s"}`);
      if (preview.unallocated > 0.005) parts.push(`${formatPrice(preview.unallocated)} non affecté`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onSettled?.();
    } catch (error) {
      console.error("Group collect error:", error);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  const dueTax = formatTaxBreakdown(totalDueSelected);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="border-zinc-800 bg-zinc-900 lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encaisser un client</DialogTitle>
          <DialogDescription>
            {userId ? (
              <>
                {clientLabel || "Client"} · {selectedBookings.length} réservation{selectedBookings.length === 1 ? "" : "s"} sélectionnée{selectedBookings.length === 1 ? "" : "s"}
                <span className="mt-1 block">
                  Dû (sélection) : <span className="font-semibold text-foreground">{formatPrice(totalDueSelected)}</span>
                  <span className="ml-2 text-xs text-zinc-500">(HT {dueTax.ht} · TVA 20% {dueTax.vat})</span>
                </span>
              </>
            ) : "—"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Aucune réservation avec un solde dû pour ce client.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Réservations</span>
                <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {selectedIds.size === bookings.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {past.length > 0 && (
                  <>
                    <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">Terminées</p>
                    {past.map((b) => (
                      <BookingCheckRow key={b.id} booking={b} checked={selectedIds.has(b.id)} onToggle={() => toggleBooking(b.id)} />
                    ))}
                  </>
                )}
                {upcoming.length > 0 && (
                  <>
                    <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">À venir</p>
                    {upcoming.map((b) => (
                      <BookingCheckRow key={b.id} booking={b} checked={selectedIds.has(b.id)} onToggle={() => toggleBooking(b.id)} />
                    ))}
                  </>
                )}
              </div>
            </div>

            {entries.map((entry, idx) => (
              <div key={entry.id} className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Label className="text-xs text-zinc-400">Montant (€ TTC)</Label>
                  <Input
                    value={entry.amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEntries((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: v } : p)));
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
                      const v = e.target.value as CollectEntry["method"];
                      setEntries((prev) => prev.map((p, i) => (i === idx ? { ...p, method: v } : p)));
                    }}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  >
                    <option value="cash">Espèces</option>
                    <option value="card">CB</option>
                    <option value="transfer">Virement</option>
                    <option value="check">Chèque</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={entries.length === 1 || submitting}
                    className="text-zinc-400"
                  >
                    Retirer
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setEntries((prev) => [...prev, { id: crypto.randomUUID(), amount: "", method: "cash" }])}
                disabled={submitting}
              >
                Ajouter un paiement
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-zinc-400"
                onClick={matchSelectionAmount}
                disabled={submitting || selectedBookings.length === 0}
              >
                Ajuster au montant dû de la sélection
              </Button>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Montant saisi</span>
                <span className="font-semibold">{formatPrice(totalAmount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                <span>Dû (sélection) : {formatPrice(totalDueSelected)}</span>
                <span>Reste après encaissement : {formatPrice(Math.max(0, round2(totalDueSelected - (totalAmount - preview.unallocated))))}</span>
              </div>
            </div>

            {totalAmount > 0.005 && selectedBookings.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
                <p className="border-b border-zinc-800 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Ventilation prévisionnelle · plus ancienne réservation d'abord
                </p>
                <div className="divide-y divide-zinc-800/80">
                  {preview.rows.map((row) => {
                    const booking = bookingsById.get(row.id);
                    if (!booking) return null;
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-primary">{booking.booking_ref}</p>
                          <p className="truncate text-xs text-zinc-500">{formatBookingSlot(booking)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium">
                            {formatPrice(row.allocated)} <span className="text-zinc-500">/ {formatPrice(row.due)}</span>
                          </p>
                          <BookingPaymentState remaining={row.due - row.allocated} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {preview.unallocated > 0.005 && (
                  <div className="border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Excédent non affecté : <span className="font-semibold">{formatPrice(preview.unallocated)}</span> — enregistré mais non rattaché à une réservation.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-700" disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading || selectedBookings.length === 0 || totalAmount <= 0.005}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaisser {formatPrice(totalAmount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [refundsOnly, setRefundsOnly] = useState(false);
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

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<ApiPayment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundBookingOptions, setRefundBookingOptions] = useState<Array<{ id: string; ref: string }>>([]);

  // Void dialog state — encaissement en attente jamais reçu
  const [voidTarget, setVoidTarget] = useState<ApiPayment | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  const [groupCollectOpen, setGroupCollectOpen] = useState(false);
  const [groupCollectUserId, setGroupCollectUserId] = useState<string | null>(null);
  const [groupCollectClientLabel, setGroupCollectClientLabel] = useState<string | null>(null);

  const [serverStats, setServerStats] = useState<{ paidCount: number; paidAmount: number; refundedCount: number; refundedAmount: number } | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (refundsOnly) params.set("refundsOnly", "true");
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
  }, [page, statusFilter, refundsOnly, paymentTypeFilter, methodFilter, dateFilter, customDateFrom, customDateTo, search, sortBy, sortOrder]);

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

  function openGroupCollect(payment: ApiPayment) {
    if (!payment.user_id) return;
    setGroupCollectUserId(payment.user_id);
    setGroupCollectClientLabel(payment.user_name);
    setGroupCollectOpen(true);
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

  const openVoidDialog = (payment: ApiPayment) => {
    setVoidTarget(payment);
    setVoidOpen(true);
  };

  async function handleExportCollections() {
    const params = new URLSearchParams();
    params.set("all", "true");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (refundsOnly) params.set("refundsOnly", "true");
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
    if (refundsOnly) params.set("refundsOnly", "true");
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
            setRefundsOnly(false);
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
        <button
          type="button"
          aria-pressed={refundsOnly}
          onClick={() => {
            setRefundsOnly((current) => !current);
            setStatusFilter("all");
            setPage(1);
          }}
          className={`rounded-xl border bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-600 ${
            refundsOnly ? "border-red-400/50" : "border-zinc-800"
          }`}
        >
          <p className="text-sm text-zinc-400">Remboursés</p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            {stats.refundedCount}
          </p>
          <p className="text-sm text-zinc-500">
            {formatPrice(Math.abs(stats.refundedAmount))}
          </p>
        </button>
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
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setRefundsOnly(false); setPage(1); }}
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
                        onVoid={openVoidDialog}
                        onCollect={openGroupCollect}
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

      <VoidPaymentDialog
        payment={voidTarget}
        open={voidOpen}
        onOpenChange={setVoidOpen}
        onSettled={fetchPayments}
      />

      <GroupCollectDialog
        open={groupCollectOpen}
        onOpenChange={(open) => {
          setGroupCollectOpen(open);
          if (!open) {
            setGroupCollectUserId(null);
            setGroupCollectClientLabel(null);
          }
        }}
        userId={groupCollectUserId}
        clientLabel={groupCollectClientLabel}
        onSettled={fetchPayments}
      />
    </div>
  );
}
