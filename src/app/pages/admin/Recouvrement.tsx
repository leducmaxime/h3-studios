"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/booking";
import { getDisplayStatus } from "@/lib/booking-totals";
import { BOOKING_STATUS_LABELS, studioLabel } from "@/lib/labels";
import type { BookingStatus, OverdueBooking } from "@/lib/db-types";

const VIEW_STORAGE_KEY = "h3-admin-recouvrement-view";

type ViewMode = "bookings" | "clients";

interface RecouvrementResponse {
  success: boolean;
  data?: {
    bookings: OverdueBooking[];
    totalCount: number;
    totalRemaining: number;
  };
  error?: string;
}

interface ClientGroup {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  bookings: OverdueBooking[];
  remaining: number;
}

const STATUS_CLASSES: Record<BookingStatus, string> = {
  confirmed: "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20",
  "no-show": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function clientDisplayName(booking: Pick<OverdueBooking, "band_name" | "user_name">): string {
  return booking.band_name || booking.user_name || "Client inconnu";
}

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "bookings";
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "clients" ? "clients" : "bookings";
}

export function AdminRecouvrement() {
  const [bookings, setBookings] = useState<OverdueBooking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const fetchOverdue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const query = params.toString();
      const res = await fetch(`/api/admin/recouvrement${query ? `?${query}` : ""}`);
      const json = (await res.json()) as RecouvrementResponse;
      if (json.success && json.data) {
        setBookings(json.data.bookings);
        setTotalCount(json.data.totalCount);
        setTotalRemaining(json.data.totalRemaining);
      } else {
        toast.error(json.error || "Erreur lors du chargement du recouvrement");
      }
    } catch (error) {
      console.error("Failed to fetch overdue bookings:", error);
      toast.error("Erreur lors du chargement du recouvrement");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchOverdue();
  }, [fetchOverdue]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setViewMode = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const groups = useMemo<ClientGroup[]>(() => {
    const byUser = new Map<string, ClientGroup>();
    for (const booking of bookings) {
      const userId = booking.user_id || "unknown";
      const existing = byUser.get(userId);
      if (existing) {
        existing.bookings.push(booking);
        existing.remaining += booking.remaining;
        continue;
      }
      byUser.set(userId, {
        userId,
        name: clientDisplayName(booking),
        email: booking.user_email,
        phone: booking.user_phone,
        bookings: [booking],
        remaining: booking.remaining,
      });
    }
    return [...byUser.values()].sort((a, b) => b.remaining - a.remaining);
  }, [bookings]);

  const toggleGroup = (userId: string) => {
    setOpenGroups((current) => ({ ...current, [userId]: !current[userId] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recouvrement</h1>
          <p className="text-zinc-400">
            {totalCount} réservation{totalCount === 1 ? "" : "s"} · {formatPrice(totalRemaining)} restant dû
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Séances terminées dont le solde n’est pas soldé.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Réf, client, email, tél…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-zinc-700 bg-zinc-800 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("bookings")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "bookings" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Toutes les réservations
          </button>
          <button
            type="button"
            onClick={() => setViewMode("clients")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "clients" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Par client
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">
            {search ? "Aucun résultat." : "Aucune créance en souffrance."}
          </p>
        </div>
      ) : view === "bookings" ? (
        <BookingsTable bookings={bookings} />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const open = Boolean(openGroups[group.userId]);
            return (
              <div key={group.userId} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.userId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/60"
                  aria-expanded={open}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    {group.userId !== "unknown" ? (
                      <a
                        href={`/admin/users/${group.userId}`}
                        className="truncate font-medium hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {group.name}
                      </a>
                    ) : (
                      <p className="truncate font-medium">{group.name}</p>
                    )}
                    <p className="truncate text-xs text-zinc-500">
                      {group.email || "—"}
                      {group.phone ? ` · ${group.phone}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-red-400">{formatPrice(group.remaining)}</p>
                    <p className="text-xs text-zinc-500">
                      {group.bookings.length} réservation{group.bookings.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-zinc-800">
                    <BookingsTable bookings={group.bookings} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookingsTable({ bookings, compact = false }: { bookings: OverdueBooking[]; compact?: boolean }) {
  return (
    <div className={compact ? "" : "overflow-hidden rounded-xl border border-zinc-800"}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Réf</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Studio</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Dû</th>
              <th className="px-4 py-3 text-right font-medium">Payé</th>
              <th className="px-4 py-3 text-right font-medium">Reste</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const displayStatus = getDisplayStatus({
                status: booking.status as BookingStatus,
                date: booking.date,
                end_time: booking.end_time,
              }) as BookingStatus;
              return (
                <tr
                  key={booking.id}
                  className="cursor-pointer border-t border-zinc-800/80 bg-zinc-900/50 transition-colors hover:bg-zinc-800/50"
                  onClick={() => {
                    window.location.href = `/admin/bookings/${booking.id}`;
                  }}
                >
                  <td className="px-4 py-3">
                    <a
                      href={`/admin/bookings/${booking.id}`}
                      className="font-mono text-sm text-primary hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {booking.booking_ref}
                    </a>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {booking.start_time} – {booking.end_time}
                    </p>
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    {booking.user_id ? (
                      <a href={`/admin/users/${booking.user_id}`} className="hover:underline">
                        <p className="font-medium">{clientDisplayName(booking)}</p>
                        <p className="text-sm text-zinc-400">{booking.user_email || "—"}</p>
                      </a>
                    ) : (
                      <>
                        <p className="font-medium">{clientDisplayName(booking)}</p>
                        <p className="text-sm text-zinc-400">{booking.user_email || "—"}</p>
                      </>
                    )}
                    {booking.user_phone && (
                      <a
                        href={`tel:${booking.user_phone}`}
                        className="text-xs text-zinc-500 hover:text-primary"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {booking.user_phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(booking.date)}</td>
                  <td className="px-4 py-3 text-sm">{studioLabel(booking.studio_id)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_CLASSES[displayStatus] ?? STATUS_CLASSES.confirmed}>
                      {BOOKING_STATUS_LABELS[displayStatus] ?? displayStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{formatPrice(booking.amount_due)}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{formatPrice(booking.total_paid)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-red-400">
                    {formatPrice(booking.remaining)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
