"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  XCircle,
  AlertTriangle,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { formatDateISO } from "@/lib/utils";
import { STUDIOS, formatPrice, type StudioId } from "@/lib/booking";
import { type DbBooking, type BookingStatus, type BookingWithUser, type BookingSortField, type BookingSortOrder } from "@/lib/db-types";
import { exportBookingsCSV } from "@/lib/export";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookingsApiResponse {
  success: boolean;
  data?: {
    data: BookingWithUser[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, { label: string }> = {
  confirmed: { label: "Confirmé" },
  completed: { label: "Terminé" },
  cancelled: { label: "Annulé" },
  "no-show": { label: "No-show" },
};

const STATUS_CLASSES: Record<BookingStatus, string> = {
  confirmed: "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20",
  "no-show": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function getDateFilterParams(filter: string): { dateFrom?: string; dateTo?: string } {
  const today = new Date();
  const todayStr = formatDateISO(today);

  switch (filter) {
    case "today":
      return { dateFrom: todayStr, dateTo: todayStr };
    case "week": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1);
      return { dateFrom: formatDateISO(weekStart) };
    }
    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: formatDateISO(monthStart) };
    }
    default:
      return {};
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminBookings() {
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [studioFilter, setStudioFilter] = useState<StudioId | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "paid" | "pending" | "pay-on-site">("all");
  const [sortBy, setSortBy] = useState<BookingSortField>("created_at");
  const [sortOrder, setSortOrder] = useState<BookingSortOrder>("desc");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Cancel dialog state
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string; bookingRef: string }>({
    open: false,
    bookingId: "",
    bookingRef: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // No-show dialog state
  const [noShowDialog, setNoShowDialog] = useState<{ open: boolean; bookingId: string; bookingRef: string }>({
    open: false,
    bookingId: "",
    bookingRef: "",
  });
  const [noShowLoading, setNoShowLoading] = useState(false);

  const totalPages = Math.ceil(total / perPage);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (studioFilter !== "all") params.set("studio", studioFilter);
      if (paymentStatusFilter !== "all") params.set("paymentStatus", paymentStatusFilter);
      if (search) params.set("search", search);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const dateParams = getDateFilterParams(dateFilter);
      if (dateParams.dateFrom) params.set("dateFrom", dateParams.dateFrom);
      if (dateParams.dateTo) params.set("dateTo", dateParams.dateTo);

      const res = await fetch(`/api/admin/bookings?${params}`);
      const json = (await res.json()) as BookingsApiResponse;

      if (json.success && json.data) {
        setBookings(json.data.data);
        setTotal(json.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      toast.error("Erreur lors du chargement des réservations");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, studioFilter, dateFilter, paymentStatusFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${cancelDialog.bookingId}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Annulée par l'admin" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Réservation ${cancelDialog.bookingRef} annulée`);
        setCancelDialog({ open: false, bookingId: "", bookingRef: "" });
        setCancelReason("");
        fetchBookings();
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
      const res = await fetch(`/api/admin/bookings/${noShowDialog.bookingId}/no-show`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Réservation ${noShowDialog.bookingRef} marquée no-show`);
        setNoShowDialog({ open: false, bookingId: "", bookingRef: "" });
        fetchBookings();
      } else {
        toast.error(json.error || "Erreur lors du marquage no-show");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setNoShowLoading(false);
    }
  };

  const handleExportCSV = () => {
    exportBookingsCSV(bookings);
    toast.success(`${bookings.length} réservation(s) exportée(s)`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réservations</h1>
          <p className="text-zinc-400">{total} résultat(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          <a href="/admin/bookings/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle réservation
            </Button>
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, téléphone ou référence..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
            value={paymentStatusFilter}
            onChange={(e) => { setPaymentStatusFilter(e.target.value as "all" | "paid" | "pending" | "pay-on-site"); setPage(1); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les paiements</option>
            <option value="paid">Payé</option>
            <option value="pending">Reste à payer</option>
            <option value="pay-on-site">Sur place</option>
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
            <option value="today">Aujourd&apos;hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:mt-0">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as BookingSortField); setPage(1); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="date">Trier par date</option>
            <option value="start_time">Trier par heure</option>
            <option value="total_price">Trier par montant</option>
            <option value="status">Trier par statut</option>
            <option value="payment_status">Trier par paiement</option>
            <option value="created_at">Trier par création</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as BookingSortOrder); setPage(1); }}
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
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Référence</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "date") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("date"); setPage(1); } }}>
                  Date {sortBy === "date" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "start_time") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("start_time"); setPage(1); } }}>
                  Créneau {sortBy === "start_time" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Studio</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "status") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("status"); setPage(1); } }}>
                  Statut {sortBy === "status" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "payment_status") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("payment_status"); setPage(1); } }}>
                  Paiement {sortBy === "payment_status" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "total_price") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("total_price"); setPage(1); } }}>
                  Montant {sortBy === "total_price" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
                ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
                ) : (
                bookings.map((booking) => {
                  const statusConfig = STATUS_CONFIG[booking.status];
                  const studioName = STUDIOS[booking.studio_id as StudioId]?.name || booking.studio_id;

                  const paymentStatus = booking.payment_status;
                  let paymentBadge: React.ReactNode = <span className="text-zinc-500">—</span>;

                  if (paymentStatus === "paid") {
                    paymentBadge = <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Payé</Badge>;
                  } else if (paymentStatus === "pay-on-site") {
                    paymentBadge = <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">À payer sur place</Badge>;
                  } else if (paymentStatus === "pending") {
                    paymentBadge = <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Reste à payer</Badge>;
                  }

                  const displayName = booking.band_name || booking.user_name || "—";

                  return (
                    <tr key={booking.id} className="bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/bookings/${booking.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {booking.booking_ref}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/users/${booking.user_id}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{displayName}</p>
                          <p className="text-sm text-zinc-400">{booking.user_email || "—"}</p>
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(booking.date)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {booking.start_time} - {booking.end_time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{studioName}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_CLASSES[booking.status]}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {paymentBadge}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPrice(booking.total_price)}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="rounded-lg p-1.5 hover:bg-zinc-700 focus:outline-none">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <a href={`/admin/bookings/${booking.id}`} className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Voir détails
                              </a>
                            </DropdownMenuItem>
                            {booking.status === "confirmed" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setNoShowDialog({ open: true, bookingId: booking.id, bookingRef: booking.booking_ref })}
                                  className="text-yellow-400 focus:text-yellow-400"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                  Marquer no-show
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setCancelDialog({ open: true, bookingId: booking.id, bookingRef: booking.booking_ref })}
                                >
                                  <XCircle className="h-4 w-4" />
                                  Annuler
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
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

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog.open}
        onOpenChange={(open) => { if (!open) { setCancelDialog({ open: false, bookingId: "", bookingRef: "" }); setCancelReason(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la réservation</DialogTitle>
            <DialogDescription>
              Confirmez l&apos;annulation de la réservation <strong>{cancelDialog.bookingRef}</strong>.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="cancelReason" className="mb-1.5 block text-sm text-zinc-400">Raison (optionnel)</label>
            <input
              id="cancelReason"
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Raison de l'annulation..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCancelDialog({ open: false, bookingId: "", bookingRef: "" }); setCancelReason(""); }}
              disabled={cancelLoading}
            >
              Retour
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show Dialog */}
      <Dialog
        open={noShowDialog.open}
        onOpenChange={(open) => { if (!open) setNoShowDialog({ open: false, bookingId: "", bookingRef: "" }); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme no-show</DialogTitle>
            <DialogDescription>
              Confirmez le no-show pour la réservation <strong>{noShowDialog.bookingRef}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNoShowDialog({ open: false, bookingId: "", bookingRef: "" })}
              disabled={noShowLoading}
            >
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
