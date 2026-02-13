"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Banknote,
  RefreshCw,
  MoreHorizontal,
  Loader2,
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
  method: "card" | "cash";
  status: "pending" | "paid" | "refunded" | "partial-refund";
  refunded_amount: number;
  paid_at: string | null;
  created_at: string;
  booking_ref: string | null;
  user_name: string | null;
  user_id: string | null;
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
      setRefundAmount(((payment.amount - payment.refunded_amount) / 100).toFixed(2));
      setSubmitting(false);
    }
  }, [open, payment]);

  const parsedAmount = parseFloat(refundAmount) * 100;
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
              max={(maxRefund / 100).toFixed(2)}
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
}: {
  payment: ApiPayment;
  onMarkPaid: (id: string) => void;
  onRefund: (payment: ApiPayment) => void;
}) {
  const canPay = payment.status === "pending";
  const canRefund =
    payment.status === "paid" && payment.refunded_amount < payment.amount;

  if (!canPay && !canRefund) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
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
  const [methodFilter, setMethodFilter] = useState<"all" | "card" | "cash">(
    "all",
  );
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<ApiPayment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/payments?page=${page}&limit=${perPage}`,
      );
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
  }, [page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Client-side filtering on loaded page
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      return true;
    });
  }, [payments, statusFilter, methodFilter]);

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
            id="payment-method-filter"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value as typeof methodFilter);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">Toutes les méthodes</option>
            <option value="card">Carte</option>
            <option value="cash">Espèces</option>
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
                  Méthode
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">
                  Montant
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Date
                </th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredPayments.map((payment) => {
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
                      <span className="flex items-center gap-1.5 text-sm">
                        {payment.method === "card" ? (
                          <>
                            <CreditCard className="h-4 w-4" /> Carte
                          </>
                        ) : (
                          <>
                            <Banknote className="h-4 w-4" /> Espèces
                          </>
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
                      {payment.paid_at ? formatDate(payment.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentActions
                        payment={payment}
                        onMarkPaid={handleMarkPaid}
                        onRefund={openRefundDialog}
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
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
    </div>
  );
}
