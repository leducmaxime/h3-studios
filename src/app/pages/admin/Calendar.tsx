"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  Music,
  CreditCard,
  Plus,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { STUDIOS, formatPrice, ALL_TIME_SLOTS, type StudioId } from "@/lib/booking";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarBooking {
  id: string;
  booking_ref: string;
  user_id: string;
  user_name?: string;
  user_band_name?: string;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_type: string;
  status: string;
  base_price: number;
  equipment_price: number;
  total_price: number;
  equipment: string | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
}

type ViewType = "day" | "week" | "month";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function formatMonthHeader(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const VISIBLE_HOURS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  "21:00", "22:00", "23:00",
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-primary/20 border-primary/50 text-primary",
  completed: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  cancelled: "bg-red-500/20 border-red-500/50 text-red-400",
  "no-show": "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmée",
  completed: "Terminée",
  cancelled: "Annulée",
  "no-show": "No-show",
};

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

// Approximate max bookings per day (both studios, ~14 bookings worth of slots)
const MAX_BOOKINGS_PER_DAY = 14;

// ─── API fetch ──────────────────────────────────────────────────────────────

async function fetchBookings(params: { date?: string; startDate?: string; endDate?: string }): Promise<CalendarBooking[]> {
  const searchParams = new URLSearchParams();
  if (params.date) searchParams.set("date", params.date);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);

  const res = await fetch(`/api/admin/calendar?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch calendar data");
  const json = await res.json() as { success: boolean; data: CalendarBooking[] };
  return json.data || [];
}

// ─── Month grid helpers ─────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6 in our grid
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < startWeekday; i++) {
    currentWeek.push(null);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    currentWeek.push(new Date(year, month, d));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function getOccupancyColor(rate: number): { bg: string; text: string } {
  if (rate === 0) return { bg: "bg-zinc-800/50", text: "text-zinc-500" };
  if (rate < 0.5) return { bg: "bg-emerald-500/15", text: "text-emerald-400" };
  if (rate <= 0.8) return { bg: "bg-amber-500/15", text: "text-amber-400" };
  return { bg: "bg-red-500/15", text: "text-red-400" };
}

function hasOptions(equipment: string | null): boolean {
  if (!equipment) return false;
  try {
    const parsed = JSON.parse(equipment);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminCalendar() {
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [view, setView] = useState<ViewType>("day");
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  // ─── Derived dates ──────────────────────────────────────────────────────

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  const monthGrid = useMemo(
    () => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );

  const monthRange = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return { startDate: toDateStr(first), endDate: toDateStr(last) };
  }, [currentDate]);

  // ─── Fetch bookings from API ────────────────────────────────────────────

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      let data: CalendarBooking[];
      if (view === "day") {
        data = await fetchBookings({ date: toDateStr(currentDate) });
      } else if (view === "week") {
        data = await fetchBookings({
          startDate: toDateStr(weekDates[0]),
          endDate: toDateStr(weekDates[6]),
        });
      } else {
        data = await fetchBookings(monthRange);
      }
      setBookings(data);
    } catch (error) {
      console.error("Calendar fetch error:", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [view, currentDate, weekDates, monthRange]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const goToPrev = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      if (view === "month") {
        newDate.setMonth(d.getMonth() - 1);
      } else {
        newDate.setDate(d.getDate() - (view === "week" ? 7 : 1));
      }
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      if (view === "month") {
        newDate.setMonth(d.getMonth() + 1);
      } else {
        newDate.setDate(d.getDate() + (view === "week" ? 7 : 1));
      }
      return newDate;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const navigateToDay = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  // ─── View subtitle ─────────────────────────────────────────────────────

  const subtitle = useMemo(() => {
    if (view === "day") return formatDateHeader(currentDate);
    if (view === "week") return `Semaine du ${formatShortDate(weekDates[0])}`;
    return formatMonthHeader(currentDate);
  }, [view, currentDate, weekDates]);

  // ─── Day view ───────────────────────────────────────────────────────────

  const renderDayView = () => {
    const dateStr = toDateStr(currentDate);
    const dayBookings = bookings.filter((b) => b.date === dateStr);
    const studios: StudioId[] = ["la-scene", "le-podium"];

    const getBookingStyle = (booking: CalendarBooking) => {
      const startIdx = ALL_TIME_SLOTS.indexOf(booking.start_time);
      let endIdx = ALL_TIME_SLOTS.indexOf(booking.end_time);
      if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
      const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
      const height = (endIdx - startIdx) * 30;
      return { top: `${top}px`, height: `${Math.max(height, 30)}px` };
    };

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_1fr] border-b border-zinc-800">
            <div className="p-3 text-sm font-medium text-zinc-400" />
            {studios.map((studioId) => (
              <div key={studioId} className="border-l border-zinc-800 p-3 text-center">
                <p className="font-medium">{STUDIOS[studioId].name}</p>
                <p className="text-sm text-zinc-400">{STUDIOS[studioId].size}</p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative grid grid-cols-[80px_1fr_1fr]">
            <div className="border-r border-zinc-800">
              {VISIBLE_HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-zinc-800 pr-3 pt-1 text-right text-xs text-zinc-500">
                  {hour}
                </div>
              ))}
            </div>

            {studios.map((studioId) => {
              const studioBookings = dayBookings.filter((b) => b.studio_id === studioId);
              return (
                <div key={studioId} className="relative border-l border-zinc-800">
                  {VISIBLE_HOURS.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-zinc-800" />
                  ))}
                  {studioBookings.map((booking) => {
                    const style = getBookingStyle(booking);
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className={`absolute left-1 right-1 overflow-hidden rounded-lg border p-2 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed}`}
                        style={style}
                      >
                        <div className="flex items-center gap-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">
                            {booking.user_band_name || booking.user_name || booking.booking_ref}
                          </p>
                          {hasOptions(booking.equipment) && (
                            <span title="Options incluses" className="shrink-0 rounded bg-primary/20 px-1 text-[10px] font-bold text-primary italic">
                              (option)
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs opacity-80">
                          {booking.start_time}–{booking.end_time} · {formatPrice(booking.total_price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── Week view ──────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const studios: StudioId[] = ["la-scene", "le-podium"];
    const today = new Date();

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 border-b border-zinc-800">
            <div className="p-3" />
            {weekDates.map((date) => {
              const isToday = isSameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => navigateToDay(date)}
                  className={`border-l border-zinc-800 p-3 text-center transition-colors hover:bg-zinc-800/50 ${isToday ? "bg-primary/5" : ""}`}
                >
                  <p className={`text-sm ${isToday ? "font-medium text-primary" : "text-zinc-400"}`}>
                    {formatShortDate(date)}
                  </p>
                </button>
              );
            })}
          </div>

          {studios.map((studioId) => (
            <div key={studioId} className="grid grid-cols-8 border-b border-zinc-800">
              <div className="p-3 text-sm font-medium">{STUDIOS[studioId].name}</div>
              {weekDates.map((date) => {
                const dateStr = toDateStr(date);
                const dayBookings = bookings.filter(
                  (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled",
                );
                const isToday = isSameDay(date, today);

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[100px] border-l border-zinc-800 p-1 ${isToday ? "bg-primary/5" : ""}`}
                  >
                    {dayBookings.slice(0, 4).map((booking) => (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBooking(booking)}
                          className="mb-1 flex w-full items-center gap-1 overflow-hidden rounded bg-primary/20 px-1.5 py-0.5 text-left text-xs text-primary transition-colors hover:bg-primary/30"
                        >
                          <span className="truncate">
                            {booking.start_time} {booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                          </span>
                          {hasOptions(booking.equipment) && (
                            <span className="shrink-0 text-[10px] font-bold italic opacity-80">(option)</span>
                          )}
                        </button>
                    ))}
                    {dayBookings.length > 4 && (
                      <span className="text-xs text-zinc-500">+{dayBookings.length - 4} autres</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Month view ─────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const today = new Date();
    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

    // Pre-compute bookings per date
    const bookingsByDate = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const existing = bookingsByDate.get(b.date) || [];
      existing.push(b);
      bookingsByDate.set(b.date, existing);
    }

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {dayNames.map((name) => (
              <div key={name} className="border-l border-zinc-800 p-2 text-center text-xs font-medium text-zinc-400 first:border-l-0">
                {name}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {monthGrid.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-zinc-800 last:border-b-0">
              {week.map((date, dayIdx) => {
                if (!date) {
                  return (
                    <div key={`empty-${dayIdx}`} className="min-h-[100px] border-l border-zinc-800 bg-zinc-950/50 first:border-l-0" />
                  );
                }

                const dateStr = toDateStr(date);
                const dayBookings = bookingsByDate.get(dateStr) || [];
                const count = dayBookings.length;
                const occupancyRate = count > 0 ? Math.min(count / MAX_BOOKINGS_PER_DAY, 1) : 0;
                const { bg, text } = getOccupancyColor(occupancyRate);
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => navigateToDay(date)}
                    className={`group min-h-[100px] border-l border-zinc-800 p-2 text-left transition-all first:border-l-0 hover:bg-zinc-800/30 ${bg}`}
                  >
                    {/* Day number */}
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                          isToday
                            ? "bg-primary font-bold text-primary-foreground"
                            : "text-zinc-300 group-hover:bg-zinc-700"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Booking count + occupation indicator */}
                    {count > 0 && (
                      <div className="space-y-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${text} border-current/20`}
                        >
                          {count} résa{count > 1 ? "s" : ""}
                        </Badge>

                        {/* Occupation bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              occupancyRate < 0.5
                                ? "bg-emerald-500"
                                : occupancyRate <= 0.8
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${Math.round(occupancyRate * 100)}%` }}
                          />
                        </div>

                        {/* Mini studio breakdown */}
                        <div className="flex gap-1">
                          {(["la-scene", "le-podium"] as StudioId[]).map((studioId) => {
                            const studioCount = dayBookings.filter((b) => b.studio_id === studioId).length;
                            if (studioCount === 0) return null;
                            return (
                              <span key={studioId} className="text-[9px] text-zinc-500">
                                {studioId === "la-scene" ? "S" : "P"}:{studioCount}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-3">
            <span className="text-xs text-zinc-500">Occupation :</span>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400">&lt; 50%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-zinc-400">50–80%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-zinc-400">&gt; 80%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Booking detail dialog ──────────────────────────────────────────────

  const renderBookingDialog = () => {
    if (!selectedBooking) return null;
    const b = selectedBooking;
    const studioName = b.studio_id === "la-scene" ? "La Scène" : b.studio_id === "le-podium" ? "Le Podium" : b.studio_id;

    return (
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Réservation {b.booking_ref}
            </DialogTitle>
            <DialogDescription>
              {new Date(b.date + "T00:00:00").toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status badge */}
            <div>
              <Badge
                className={`${STATUS_COLORS[b.status] || ""} border`}
              >
                {STATUS_LABELS[b.status] || b.status}
              </Badge>
            </div>

            {/* Details grid */}
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-zinc-400">Horaire</p>
                  <p className="font-medium">{b.start_time} – {b.end_time}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <Music className="h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-zinc-400">Studio</p>
                  <p className="font-medium">{studioName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-zinc-400">Client</p>
                  <p className="font-medium">
                    {b.user_name || "—"}
                    {b.user_band_name && <span className="ml-1 text-zinc-500">({b.user_band_name})</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <User className="h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-zinc-400">Type</p>
                  <p className="font-medium">{GROUP_LABELS[b.group_type] || b.group_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <CreditCard className="h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-zinc-400">Tarif</p>
                  <p className="font-medium">
                    {formatPrice(b.total_price)}
                    {b.equipment_price > 0 && (
                      <span className="ml-1 text-xs text-zinc-500">(dont {formatPrice(b.equipment_price)} équipement)</span>
                    )}
                  </p>
                </div>
              </div>

              {hasOptions(b.equipment) && (
                <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <Plus className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Options incluses</p>
                    <div className="mt-1 text-sm text-zinc-300">
                      {JSON.parse(b.equipment!).map((eq: any, i: number) => (
                        <span key={eq.id}>
                          {eq.quantity}× {eq.id}{i < JSON.parse(b.equipment!).length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment info */}
            {b.payment_status && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Paiement :</span>
                <Badge variant="outline" className="text-xs">
                  {b.payment_method === "card" ? "Carte" : b.payment_method === "cash" ? "Espèces" : b.payment_method}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    b.payment_status === "paid"
                      ? "border-emerald-500/30 text-emerald-400"
                      : b.payment_status === "pending"
                        ? "border-amber-500/30 text-amber-400"
                        : "border-zinc-500/30 text-zinc-400"
                  }`}
                >
                  {b.payment_status === "paid" ? "Payé" : b.payment_status === "pending" ? "En attente" : b.payment_status}
                </Badge>
              </div>
            )}

            {/* Notes */}
            {b.notes && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-sm">
                <p className="mb-1 text-xs text-zinc-500">Notes</p>
                <p className="text-zinc-300">{b.notes}</p>
              </div>
            )}

            {/* Link to full details */}
            <a
              href={`/admin/bookings/${b.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Voir les détails complets
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading && bookings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendrier</h1>
          <p className="text-zinc-400">{subtitle}</p>
        </div>
        <button
          onClick={goToToday}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition-colors hover:bg-zinc-800"
        >
          Aujourd&apos;hui
        </button>
      </div>

      {/* Navigation + Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} className="rounded-lg p-2 transition-colors hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToNext} className="rounded-lg p-2 transition-colors hover:bg-zinc-800">
            <ChevronRight className="h-5 w-5" />
          </button>
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
          <TabsList>
            <TabsTrigger value="day">Jour</TabsTrigger>
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="month">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar content */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        {view === "day" && renderDayView()}
        {view === "week" && renderWeekView()}
        {view === "month" && renderMonthView()}
      </div>

      {/* Booking detail dialog */}
      {renderBookingDialog()}
    </div>
  );
}
