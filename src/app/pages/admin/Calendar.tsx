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
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Banknote,
  Wallet,
  Loader2,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { STUDIOS, formatPrice, ALL_TIME_SLOTS, type StudioId } from "@/lib/booking";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DbPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

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

interface CalendarBlockedSlot {
  id: string;
  studio_id: StudioId | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

type ViewType = "week" | "month";

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
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
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

async function fetchCalendar(params: { date?: string; startDate?: string; endDate?: string }): Promise<{ bookings: CalendarBooking[]; blockedSlots: CalendarBlockedSlot[] }> {
  const searchParams = new URLSearchParams();
  if (params.date) searchParams.set("date", params.date);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);

  const res = await fetch(`/api/admin/calendar?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch calendar data");
  const json = await res.json() as { success: boolean; data: { bookings: CalendarBooking[]; blockedSlots: CalendarBlockedSlot[] } };
  return json.data || { bookings: [], blockedSlots: [] };
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
  const [blockedSlots, setBlockedSlots] = useState<CalendarBlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [view, setView] = useState<ViewType>("week");
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [bookingPayments, setBookingPayments] = useState<DbPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: string;
    method: "cash" | "card" | "transfer" | "check";
  }>({ amount: "", method: "cash" });

  useEffect(() => {
    if (selectedBooking) {
      setLoadingPayments(true);
      fetch(`/api/admin/bookings/${selectedBooking.id}/payments`)
        .then((res) => res.json())
        .then((json: any) => {
          if (json.success) setBookingPayments(json.data);
        })
        .catch(console.error)
        .finally(() => setLoadingPayments(false));
      
      setNewPayment({
        amount: String(selectedBooking.total_price),
        method: selectedBooking.payment_method === "card" ? "card" : "cash",
      });
    } else {
      setBookingPayments([]);
    }
  }, [selectedBooking]);

  const handleAddPayment = async () => {
    if (!selectedBooking || !newPayment.amount) return;
    const n = parseFloat(newPayment.amount.replace(/\s/g, "").replace(",", "."));
    const amount = Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    if (selectedBooking.payment_method === "card" && newPayment.method !== "card") {
      toast.error("En ligne, les paiements sont uniquement par CB");
      return;
    }

    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: newPayment.method,
          status: "paid", // Direct payments from admin are usually already paid
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Paiement ajouté");
        // Refresh payments
        const pRes = await fetch(`/api/admin/bookings/${selectedBooking.id}/payments`);
        const pJson = await pRes.json() as any;
        if (pJson.success) setBookingPayments(pJson.data);
        // Refresh booking status in the list
        loadBookings();
      } else {
        toast.error(json.error || "Erreur lors de l'ajout");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

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
      let data: { bookings: CalendarBooking[]; blockedSlots: CalendarBlockedSlot[] };
      if (view === "week") {
        data = await fetchCalendar({
          startDate: toDateStr(weekDates[0]),
          endDate: toDateStr(weekDates[6]),
        });
      } else {
        data = await fetchCalendar(monthRange);
      }
      setBookings(data.bookings);
      setBlockedSlots(data.blockedSlots);
    } catch (error) {
      console.error("Calendar fetch error:", error);
      setBookings([]);
      setBlockedSlots([]);
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

  // ─── View subtitle ─────────────────────────────────────────────────────

  const subtitle = useMemo(() => {
    if (view === "week") return `Semaine du ${formatShortDate(weekDates[0])}`;
    return formatMonthHeader(currentDate);
  }, [view, currentDate, weekDates]);

  // ─── Week view ──────────────────────────────────────────────────────────

  const STUDIO_COLORS: Record<StudioId, { bg: string; text: string; border: string }> = {
    "la-scene": {
      bg: "bg-blue-500/15",
      text: "text-blue-400",
      border: "border-blue-500/30",
    },
    "le-podium": {
      bg: "bg-purple-500/15",
      text: "text-purple-400",
      border: "border-purple-500/30",
    },
  };

  const CONSULTATION_COLORS = {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  };

  function getPaymentStatusColor(booking: CalendarBooking): { bg: string; text: string; border: string } {
    if (booking.payment_status === "paid") {
      return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" };
    }
    return { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" };
  }

  const renderWeekView = () => {
    const studios: StudioId[] = ["la-scene", "le-podium"];
    const today = new Date();

    const blockedByDate = new Map<string, CalendarBlockedSlot[]>();
    for (const b of blockedSlots) {
      const existing = blockedByDate.get(b.date) || [];
      existing.push(b);
      blockedByDate.set(b.date, existing);
    }

    const expandedBlocked = (dateStr: string, studioId: StudioId) => {
      const day = blockedByDate.get(dateStr) || [];
      return day.filter((s) => s.studio_id === null || s.studio_id === studioId);
    };

    const BLOCKED_COLORS = {
      bg: "bg-zinc-800/60",
      text: "text-zinc-200",
      border: "border-zinc-700/70",
    };

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[100px_repeat(7,_minmax(0,1fr))] border-b border-zinc-800">
            <div className="p-3 text-sm font-medium text-zinc-400">Studio</div>
            {weekDates.map((date) => {
              const isToday = isSameDay(date, today);
              return (
                <div
                  key={date.toISOString()}
                  className={`border-l border-zinc-800 p-3 text-center ${isToday ? "bg-primary/5" : ""}`}
                >
                  <p className={`text-sm ${isToday ? "font-medium text-primary" : "text-zinc-400"}`}>
                    {formatShortDate(date)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[100px_repeat(7,_minmax(0,1fr))]">
            <div className="border-r border-zinc-800 bg-zinc-950/30">
              {VISIBLE_HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-zinc-800 pr-3 pt-1 text-right text-xs text-zinc-500">
                  {hour}
                </div>
              ))}
            </div>

            {weekDates.map((date) => {
              const dateStr = toDateStr(date);
              const isToday = isSameDay(date, today);

              return (
                <div
                  key={`${date.toISOString()}-day`}
                  className={`relative border-l border-zinc-800 ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="grid grid-cols-2 h-full">
                    <div className={`border-r border-zinc-800/50 ${isToday ? "bg-blue-500/5" : ""}`}>
                      <div className={`text-center py-1 text-[10px] font-medium border-b border-zinc-800 ${STUDIO_COLORS["la-scene"].text}`}>
                        La Scène
                      </div>
                    </div>
                    <div className={`${isToday ? "bg-purple-500/5" : ""}`}>
                      <div className={`text-center py-1 text-[10px] font-medium border-b border-zinc-800 ${STUDIO_COLORS["le-podium"].text}`}>
                        Le Podium
                      </div>
                    </div>
                  </div>

                  {VISIBLE_HOURS.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-zinc-800" />
                  ))}

                   {studios.map((studioId) => {
                     const studioBlocked = expandedBlocked(dateStr, studioId);
                     const studioBookings = bookings.filter(
                       (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled" && b.group_type === "group",
                     );

                     const leftPos = studioId === "la-scene" ? "4px" : "50%";
                     const width = "calc(50% - 8px)";

                     return (
                       <div key={`${dateStr}-${studioId}`} className="contents">
                         {studioBlocked.map((slot) => {
                           const startIdx = ALL_TIME_SLOTS.indexOf(slot.start_time);
                           let endIdx = ALL_TIME_SLOTS.indexOf(slot.end_time);
                           if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                           if (startIdx === -1) return null;

                           const top = 24 + (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                           const height = (endIdx - startIdx) * 30;

                           return (
                             <div
                               key={`${slot.id}-${studioId}`}
                               title={`Bloqué: ${slot.reason}`}
                               className={`absolute overflow-hidden rounded border px-1.5 py-1 ${BLOCKED_COLORS.bg} ${BLOCKED_COLORS.border} ${BLOCKED_COLORS.text}`}
                               style={{
                                 top: `${top}px`,
                                 height: `${Math.max(height, 24)}px`,
                                 left: leftPos,
                                 width,
                                 zIndex: 1,
                                 backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.0) 6px, rgba(255,255,255,0.0) 12px)",
                               }}
                             >
                               <p className="truncate text-[11px] font-medium leading-tight">
                                 {slot.start_time} Bloqué
                               </p>
                               <p className="truncate text-[9px] opacity-80">{slot.reason}</p>
                             </div>
                           );
                         })}

                         {studioBookings.map((booking) => {
                           const startIdx = ALL_TIME_SLOTS.indexOf(booking.start_time);
                           let endIdx = ALL_TIME_SLOTS.indexOf(booking.end_time);
                           if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                           const top = 24 + (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                           const height = (endIdx - startIdx) * 30;
                           const paymentColors = getPaymentStatusColor(booking);

                           return (
                             <button
                               key={booking.id}
                               type="button"
                               onClick={() => setSelectedBooking(booking)}
                               className={`absolute overflow-hidden rounded border px-1.5 py-1 text-left transition-all hover:scale-[1.02] hover:shadow-lg z-10 ${paymentColors.bg} ${paymentColors.border} ${paymentColors.text}`}
                               style={{
                                 top: `${top}px`,
                                 height: `${Math.max(height, 24)}px`,
                                 left: leftPos,
                                 width,
                               }}
                             >
                               <p className="truncate text-[11px] font-medium leading-tight">
                                 {booking.start_time} {booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                               </p>
                               {hasOptions(booking.equipment) && (
                                 <span className="text-[9px] opacity-80">(opt)</span>
                               )}
                             </button>
                           );
                         })}
                       </div>
                     );
                   })}

                  {(() => {
                    const consultationBookings = bookings.filter(
                      (b) => b.date === dateStr && (b.group_type === "solo" || b.group_type === "duo") && b.status !== "cancelled",
                    );

                    return consultationBookings.map((booking) => {
                      const startIdx = ALL_TIME_SLOTS.indexOf(booking.start_time);
                      let endIdx = ALL_TIME_SLOTS.indexOf(booking.end_time);
                      if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                      const top = 24 + (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                      const height = (endIdx - startIdx) * 30;

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBooking(booking)}
                          className={`absolute left-1 right-1 overflow-hidden rounded border px-2 py-1 text-left transition-all hover:scale-[1.02] hover:shadow-lg z-10 ${CONSULTATION_COLORS.bg} ${CONSULTATION_COLORS.border} ${CONSULTATION_COLORS.text}`}
                          style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                        >
                          <p className="truncate text-[11px] font-medium leading-tight">
                            {booking.start_time} {booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                          </p>
                          <p className="text-[9px] opacity-80">
                            {GROUP_LABELS[booking.group_type]}
                          </p>
                        </button>
                      );
                    });
                  })()}
                </div>
              );
            })}
          </div>
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

    const blockedByDate = new Map<string, CalendarBlockedSlot[]>();
    for (const s of blockedSlots) {
      const existing = blockedByDate.get(s.date) || [];
      existing.push(s);
      blockedByDate.set(s.date, existing);
    }

    const isAllStudiosWholeDay = (dateStr: string) => {
      const day = blockedByDate.get(dateStr) || [];
      return day.some((s) => s.studio_id === null && s.start_time === "09:00" && s.end_time === "00:00");
    };

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
                const dayBlocked = blockedByDate.get(dateStr) || [];
                const count = dayBookings.length;
                const occupancyRate = count > 0 ? Math.min(count / MAX_BOOKINGS_PER_DAY, 1) : 0;
                const { bg, text } = getOccupancyColor(occupancyRate);
                const isToday = isSameDay(date, today);
                const fullyBlocked = isAllStudiosWholeDay(dateStr);

                return (
                  <div
                    key={dateStr}
                    className={`group min-h-[100px] border-l border-zinc-800 p-2 text-left first:border-l-0 ${bg} ${fullyBlocked ? "ring-1 ring-red-500/30" : ""}`}
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

                    {(fullyBlocked || dayBlocked.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {fullyBlocked ? (
                          <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-300">
                            Bloqué
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                            {dayBlocked.length} blocage{dayBlocked.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
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

    const totalPaid = bookingPayments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);
    const balance = b.total_price - totalPaid;

    const methodLabels: Record<string, string> = {
      card: "Carte bancaire",
      cash: "Espèces",
      check: "Chèque",
      cheque: "Chèque",
      transfer: "Virement",
    };

    return (
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-900 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-xl font-bold">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-6 w-6 text-primary" />
                {b.user_band_name || b.user_name || b.booking_ref}
              </div>
              <Badge className={`${STATUS_COLORS[b.status] || ""} border px-3 py-1 text-xs uppercase tracking-wider`}>
                {STATUS_LABELS[b.status] || b.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Réf: {b.booking_ref} · {new Date(b.date + "T00:00:00").toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Détails de la session</h4>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Horaire</p>
                    <p className="text-sm font-medium">{b.start_time} – {b.end_time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                  <Music className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Studio</p>
                    <p className="text-sm font-medium">{studioName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Client</p>
                    <p className="text-sm font-medium">
                      {b.user_name || "—"}
                      {b.user_band_name && <span className="ml-1 text-zinc-400">({b.user_band_name})</span>}
                    </p>
                  </div>
                </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                <CreditCard className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Total à payer</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-primary">{formatPrice(b.total_price)}</p>
                    {totalPaid > 0 && totalPaid < b.total_price && (
                      <p className="text-[10px] text-emerald-500 font-medium">(Déjà payé: {formatPrice(totalPaid)})</p>
                    )}
                  </div>
                </div>
              </div>

                {hasOptions(b.equipment) && (
                  <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <Plus className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Options</p>
                      <div className="mt-1 text-xs text-zinc-300">
                        {JSON.parse(b.equipment!).map((eq: any, i: number) => (
                          <div key={eq.id}>
                            {eq.quantity}× {eq.id}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {b.notes && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-sm italic text-zinc-400">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 not-italic">Notes</p>
                  {b.notes}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Paiements</h4>
                {balance <= 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Soldé</Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-500">Reste: {formatPrice(balance)}</Badge>
                )}
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {loadingPayments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  </div>
                ) : bookingPayments.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-600 italic">Aucun paiement enregistré</p>
                ) : (
                  bookingPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/40 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        {p.status === "paid" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock className="h-3 w-3 text-amber-500" />}
                        <div>
                          <p className="font-medium text-zinc-200">{formatPrice(p.amount)} · {methodLabels[p.method] || p.method}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[9px] h-4">
                        {p.status === "paid" ? "Payé" : "Attente"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>

              {balance > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/20 p-3 space-y-3">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Ajouter un paiement</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="amount" className="text-[9px] text-zinc-500 uppercase">Montant (€)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="h-8 text-xs bg-zinc-900 border-zinc-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="method" className="text-[9px] text-zinc-500 uppercase">Méthode</Label>
                      <Select
                        value={newPayment.method}
                        onValueChange={(v) => setNewPayment({ ...newPayment, method: v as "cash" | "card" | "transfer" | "check" })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
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
                    className="w-full h-8 text-xs gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Enregistrer le paiement
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex gap-3 border-t border-zinc-800 pt-6">
            <a
              href={`/admin/bookings/${b.id}`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Détails complets
              <ChevronRight className="h-4 w-4" />
            </a>
            <Button
              variant="outline"
              onClick={() => setSelectedBooking(null)}
              className="flex-1 bg-transparent border-zinc-700 text-zinc-400 hover:text-zinc-100"
            >
              Fermer
            </Button>
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
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="month">Mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar content */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        {view === "week" && renderWeekView()}
        {view === "month" && renderMonthView()}
      </div>

      {/* Booking detail dialog */}
      {renderBookingDialog()}
    </div>
  );
}
