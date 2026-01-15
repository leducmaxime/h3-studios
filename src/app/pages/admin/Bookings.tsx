"use client";

import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Calendar,
  X,
  Check,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  loadAdminStore,
  saveAdminStore,
  cancelBooking,
  markNoShow,
  type AdminStore,
  type AdminBooking,
  type BookingStatus,
} from "@/lib/admin-store";
import { STUDIOS, formatPrice, type StudioId } from "@/lib/booking";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; icon: React.ElementType }> = {
  confirmed: { label: "Confirmé", color: "bg-green-500/10 text-green-500", icon: Check },
  completed: { label: "Terminé", color: "bg-blue-500/10 text-blue-500", icon: Check },
  cancelled: { label: "Annulé", color: "bg-red-500/10 text-red-500", icon: XCircle },
  "no-show": { label: "No-show", color: "bg-yellow-500/10 text-yellow-500", icon: AlertTriangle },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function AdminBookings() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [studioFilter, setStudioFilter] = useState<StudioId | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const perPage = 20;

  useEffect(() => {
    setStore(loadAdminStore());
  }, []);

  const filteredBookings = useMemo(() => {
    if (!store) return [];

    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    return store.bookings
      .filter((b) => {
        if (statusFilter !== "all" && b.status !== statusFilter) return false;
        if (studioFilter !== "all" && b.studioId !== studioFilter) return false;
        
        if (dateFilter === "today" && b.date !== today) return false;
        if (dateFilter === "week" && b.date < weekStartStr) return false;
        if (dateFilter === "month" && b.date < monthStartStr) return false;

        if (search) {
          const user = store.users.find((u) => u.id === b.userId);
          const searchLower = search.toLowerCase();
          const matchesRef = b.bookingRef.toLowerCase().includes(searchLower);
          const matchesUser = user?.name.toLowerCase().includes(searchLower) ||
            user?.email.toLowerCase().includes(searchLower) ||
            user?.phone.includes(search);
          if (!matchesRef && !matchesUser) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
      });
  }, [store, search, statusFilter, studioFilter, dateFilter]);

  const paginatedBookings = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredBookings.slice(start, start + perPage);
  }, [filteredBookings, page]);

  const totalPages = Math.ceil(filteredBookings.length / perPage);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedBookings.map((b) => b.id)));
    }
  };

  const handleCancel = (bookingId: string) => {
    if (!store) return;
    const reason = prompt("Raison de l'annulation :");
    if (reason === null) return;
    
    cancelBooking(store, bookingId, reason || "Non spécifié");
    setStore({ ...store });
    setActionMenuId(null);
  };

  const handleNoShow = (bookingId: string) => {
    if (!store) return;
    if (!confirm("Marquer comme no-show ?")) return;
    
    markNoShow(store, bookingId);
    setStore({ ...store });
    setActionMenuId(null);
  };

  const handleBulkCancel = () => {
    if (!store || selectedIds.size === 0) return;
    const reason = prompt(`Annuler ${selectedIds.size} réservation(s) ? Raison :`);
    if (reason === null) return;

    selectedIds.forEach((id) => {
      cancelBooking(store, id, reason || "Annulation groupée");
    });
    setStore({ ...store });
    setSelectedIds(new Set());
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
            <h1 className="text-2xl font-bold">Réservations</h1>
            <p className="text-zinc-400">{filteredBookings.length} résultat(s)</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
              <Download className="h-4 w-4" />
              Exporter
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone ou référence..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as BookingStatus | "all"); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="confirmed">Confirmé</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
              <option value="no-show">No-show</option>
            </select>
            <select
              value={studioFilter}
              onChange={(e) => { setStudioFilter(e.target.value as StudioId | "all"); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">Tous les studios</option>
              <option value="la-scene">La Scène</option>
              <option value="le-podium">Le Podium</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value as "all" | "today" | "week" | "month"); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 rounded-lg bg-primary/10 px-4 py-3">
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
            <button
              onClick={handleBulkCancel}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30"
            >
              Annuler
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-lg p-1.5 hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedBookings.length && paginatedBookings.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Référence</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Créneau</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Studio</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Montant</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedBookings.map((booking) => {
                  const user = store.users.find((u) => u.id === booking.userId);
                  const statusConfig = STATUS_CONFIG[booking.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={booking.id} className="bg-zinc-900/50 hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(booking.id)}
                          onChange={() => toggleSelect(booking.id)}
                          className="rounded border-zinc-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/bookings/${booking.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {booking.bookingRef}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/users/${booking.userId}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{user?.name || "—"}</p>
                          <p className="text-sm text-zinc-400">{user?.email || "—"}</p>
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(booking.date)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {booking.startTime} - {booking.endTime}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{STUDIOS[booking.studioId].name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPrice(booking.totalPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === booking.id ? null : booking.id)}
                            className="rounded-lg p-1.5 hover:bg-zinc-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionMenuId === booking.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
                              <a
                                href={`/admin/bookings/${booking.id}`}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-700"
                              >
                                Voir détails
                              </a>
                              {booking.status === "confirmed" && (
                                <>
                                  <a
                                    href={`/admin/bookings/${booking.id}/reschedule`}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-zinc-700"
                                  >
                                    Déplacer
                                  </a>
                                  <button
                                    onClick={() => handleNoShow(booking.id)}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-yellow-400 hover:bg-zinc-700"
                                  >
                                    Marquer no-show
                                  </button>
                                  <button
                                    onClick={() => handleCancel(booking.id)}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
                                  >
                                    Annuler
                                  </button>
                                </>
                              )}
                            </div>
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
