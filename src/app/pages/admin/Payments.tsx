"use client";

import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Banknote,
  RefreshCw,
} from "lucide-react";
import {
  loadAdminStore,
  markPaymentPaid,
  refundPayment,
  saveAdminStore,
  type AdminStore,
  type AdminPayment,
} from "@/lib/admin-store";
import { STUDIOS, formatPrice } from "@/lib/booking";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminPayments() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "refunded">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "card" | "cash">("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    setStore(loadAdminStore());
  }, []);

  const filteredPayments = useMemo(() => {
    if (!store) return [];

    return store.payments
      .filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (methodFilter !== "all" && p.method !== methodFilter) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [store, statusFilter, methodFilter]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredPayments.slice(start, start + perPage);
  }, [filteredPayments, page]);

  const totalPages = Math.ceil(filteredPayments.length / perPage);

  const stats = useMemo(() => {
    if (!store) return { pending: 0, pendingAmount: 0, todayPaid: 0, todayAmount: 0 };
    
    const today = new Date().toISOString().slice(0, 10);
    const pending = store.payments.filter(p => p.status === "pending");
    const todayPaid = store.payments.filter(p => 
      p.status === "paid" && 
      p.paidAt && 
      p.paidAt.toISOString().slice(0, 10) === today
    );

    return {
      pending: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      todayPaid: todayPaid.length,
      todayAmount: todayPaid.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [store]);

  const handleMarkPaid = (paymentId: string) => {
    if (!store) return;
    markPaymentPaid(store, paymentId);
    setStore({ ...store });
  };

  const handleRefund = (paymentId: string) => {
    if (!store) return;
    const payment = store.payments.find(p => p.id === paymentId);
    if (!payment) return;

    const amount = prompt(`Montant à rembourser (max ${formatPrice(payment.amount - payment.refundedAmount)}) :`);
    if (!amount) return;

    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) return;

    refundPayment(store, paymentId, refundAmount);
    setStore({ ...store });
  };

  if (!store) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paiements</h1>
            <p className="text-zinc-400">{filteredPayments.length} paiement(s)</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-400">En attente</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-sm text-zinc-500">{formatPrice(stats.pendingAmount)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-400">Encaissé aujourd'hui</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{stats.todayPaid}</p>
            <p className="text-sm text-zinc-500">{formatPrice(stats.todayAmount)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <select
              id="payment-status-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
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
              onChange={(e) => { setMethodFilter(e.target.value as typeof methodFilter); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">Toutes les méthodes</option>
              <option value="card">Carte</option>
              <option value="cash">Espèces</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Réservation</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Méthode</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Montant</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="w-24 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedPayments.map((payment) => {
                  const booking = store.bookings.find(b => b.id === payment.bookingId);
                  const user = booking ? store.users.find(u => u.id === booking.userId) : null;

                  const statusColors: Record<string, string> = {
                    pending: "bg-yellow-500/10 text-yellow-400",
                    paid: "bg-green-500/10 text-green-400",
                    refunded: "bg-red-500/10 text-red-400",
                    "partial-refund": "bg-orange-500/10 text-orange-400",
                  };

                  const statusLabels: Record<string, string> = {
                    pending: "En attente",
                    paid: "Payé",
                    refunded: "Remboursé",
                    "partial-refund": "Partiel",
                  };

                  return (
                    <tr key={payment.id} className="bg-zinc-900/50 hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        {booking ? (
                          <a href={`/admin/bookings/${booking.id}`} className="text-primary hover:underline">
                            {booking.bookingRef}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {user ? (
                          <a href={`/admin/users/${user.id}`} className="hover:underline">
                            <p className="font-medium">{user.name}</p>
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm">
                          {payment.method === "card" ? (
                            <><CreditCard className="h-4 w-4" /> Carte</>
                          ) : (
                            <><Banknote className="h-4 w-4" /> Espèces</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[payment.status]}`}>
                          {statusLabels[payment.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium">{formatPrice(payment.amount)}</p>
                        {payment.refundedAmount > 0 && (
                          <p className="text-xs text-red-400">-{formatPrice(payment.refundedAmount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {payment.paidAt ? formatDate(payment.paidAt.toISOString().slice(0, 10)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {payment.status === "pending" && (
                            <button
                              onClick={() => handleMarkPaid(payment.id)}
                              className="flex items-center gap-1 rounded-lg bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400 hover:bg-green-500/30"
                            >
                              <Check className="h-3 w-3" />
                              Payé
                            </button>
                          )}
                          {payment.status === "paid" && payment.refundedAmount < payment.amount && (
                            <button
                              onClick={() => handleRefund(payment.id)}
                              className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/30"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Rembourser
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

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
      </div>
    </AdminLayout>
  );
}
