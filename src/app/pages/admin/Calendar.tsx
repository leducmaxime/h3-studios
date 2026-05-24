"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  Users,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { STUDIOS, formatPrice, ALL_TIME_SLOTS, STUDIO_HOURS, EQUIPMENT, type StudioId } from "@/lib/booking";

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
  band_name?: string | null;
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
  promo_discount?: number;
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

function getNextHour(hour: string): string {
  const idx = VISIBLE_HOURS.indexOf(hour);
  if (idx === -1 || idx === VISIBLE_HOURS.length - 1) return "00:00";
  return VISIBLE_HOURS[idx + 1];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-primary/20 border-primary/50 text-primary",
  completed: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  cancelled: "bg-red-500/20 border-red-500/50 text-red-400",
  "no-show": "bg-yellow-500/20 border-red-500/70 text-yellow-400",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmée",
  completed: "Terminée",
  cancelled: "Annulée",
  "no-show": "Absent",
};

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

// Compute real occupancy rate from booked slots vs available slots per studio
function computeDayOccupancyRate(dayBookings: CalendarBooking[], date: Date): number {
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  const dow = date.getDay();
  const studios: StudioId[] = ["la-scene", "le-podium"];

  let totalOpen = 0;
  let totalBooked = 0;

  for (const studioId of studios) {
    const hours = STUDIO_HOURS[studioId]?.[dow];
    if (!hours) continue;
    const openIdx = ALL_TIME_SLOTS.indexOf(hours.open);
    const closeIdx = hours.close === "00:00" ? ALL_TIME_SLOTS.length : ALL_TIME_SLOTS.indexOf(hours.close);
    if (openIdx === -1) continue;
    const safeClose = closeIdx === -1 ? ALL_TIME_SLOTS.length : closeIdx;
    const openSlots = Math.max(0, safeClose - openIdx);
    totalOpen += openSlots;

    // Count booked 30-min slots for this studio
    for (const b of dayBookings) {
      if (b.studio_id !== studioId) continue;
      const startIdx = ALL_TIME_SLOTS.indexOf(b.start_time);
      let endIdx = ALL_TIME_SLOTS.indexOf(b.end_time);
      if (endIdx === -1 && b.end_time === "00:00") endIdx = ALL_TIME_SLOTS.length;
      if (startIdx === -1 || endIdx <= startIdx) continue;
      totalBooked += endIdx - startIdx;
    }
  }

  if (totalOpen === 0) return 0;
  return Math.min(totalBooked / totalOpen, 1);
}

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

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);

  // Monday = 0, Sunday = 6 in our grid
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - startWeekday);

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      week.push(d);
    }
    weeks.push(week);
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

// Helper to format equipment lines for tooltip
function getEquipmentLines(equipment: string | null): string[] {
  if (!equipment) return [];
  try {
    const parsed = JSON.parse(equipment) as Array<{ id: string; quantity: number; name?: string }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(eq => {
        const eqName = eq.name || EQUIPMENT[eq.id]?.name || eq.id;
        return `${eq.quantity}× ${eqName}`;
      });
    }
  } catch {
    // ignore
  }
  return [];
}

function getBookingTooltipLines(booking: CalendarBooking): string[] {
  const clientName = booking.band_name || booking.user_band_name || booking.user_name || "Client";
  const lines = [clientName, `${booking.start_time} – ${booking.end_time}`];
  return lines.concat(getEquipmentLines(booking.equipment));
}

interface TooltipInfo {
  lines: string[];
  x: number;
  y: number;
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
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);

  const [nowTime, setNowTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Switch to day view on mobile by default, and week on desktop
  useEffect(() => {
    if (isMobile && view === "week") {
      setView("day");
    } else if (!isMobile && view === "day") {
      setView("week");
    }
  }, [isMobile]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [bookingPayments, setBookingPayments] = useState<DbPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: string;
    method: "cash" | "card" | "transfer" | "check";
  }>({ amount: "", method: "cash" });

  const [calCancelOpen, setCalCancelOpen] = useState(false);
  const [calCancelReason, setCalCancelReason] = useState("");
  const [calCancelLoading, setCalCancelLoading] = useState(false);
  const [calRescheduleOpen, setCalRescheduleOpen] = useState(false);
  const [calRescheduleDate, setCalRescheduleDate] = useState("");
  const [calRescheduleStart, setCalRescheduleStart] = useState("");
  const [calRescheduleEnd, setCalRescheduleEnd] = useState("");
  const [calRescheduleLoading, setCalRescheduleLoading] = useState(false);
  const [calRescheduleError, setCalRescheduleError] = useState("");
  const [calRescheduleConflict, setCalRescheduleConflict] = useState(false);
  const [calRescheduleChecking, setCalRescheduleChecking] = useState(false);

  // Vérification de conflit live quand date/heure changent
  useEffect(() => {
    if (!calRescheduleDate || !calRescheduleStart || !calRescheduleEnd || !selectedBooking) {
      setCalRescheduleConflict(false);
      return;
    }
    setCalRescheduleChecking(true);
    setCalRescheduleConflict(false);
    const controller = new AbortController();
    fetch(`/api/availability?date=${calRescheduleDate}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: any) => {
        if (!data.success) return;
        const slots: Array<{ studioId: string; time: string; groupType?: string; bookingId?: string }> = data.data?.slots ?? [];
        const studioId = selectedBooking.studio_id;
        const bookingId = selectedBooking.id;
        // Génère les créneaux de 30min entre start et end
        const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const startMin = toMinutes(calRescheduleStart);
        const endMin = toMinutes(calRescheduleEnd);
        const conflict = slots.some(s =>
          s.studioId === studioId &&
          s.bookingId !== bookingId && // ignore la réservation elle-même
          (() => { const sm = toMinutes(s.time); return sm >= startMin && sm < endMin; })()
        );
        setCalRescheduleConflict(conflict);
      })
      .catch(() => {})
      .finally(() => setCalRescheduleChecking(false));
    return () => controller.abort();
  }, [calRescheduleDate, calRescheduleStart, calRescheduleEnd, selectedBooking]);

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
        method: "cash",
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

  const handleCalCancel = async () => {
    if (!selectedBooking) return;
    setCalCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: calCancelReason }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Réservation annulée");
        setCalCancelOpen(false);
        setSelectedBooking(null);
        loadBookings();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setCalCancelLoading(false); }
  };

  const handleCalReschedule = async () => {
    if (!selectedBooking || !calRescheduleDate || !calRescheduleStart || !calRescheduleEnd) return;
    setCalRescheduleLoading(true);
    setCalRescheduleError("");
    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: calRescheduleDate, start_time: calRescheduleStart, end_time: calRescheduleEnd }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Réservation déplacée");
        setCalRescheduleOpen(false);
        setSelectedBooking(null);
        loadBookings();
      } else {
        setCalRescheduleError(json.error || "Conflit détecté");
      }
    } catch { setCalRescheduleError("Erreur réseau"); }
    finally { setCalRescheduleLoading(false); }
  };

  // ─── Derived dates ──────────────────────────────────────────────────────

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);
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
      } else if (view === "day") {
        data = await fetchCalendar({
          date: toDateStr(currentDate),
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
  }, [view, weekDates, monthRange, currentDate]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const goToPrev = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      if (view === "month") {
        newDate.setMonth(d.getMonth() - 1);
      } else if (view === "week") {
        newDate.setDate(d.getDate() - 7);
      } else {
        newDate.setDate(d.getDate() - 1);
      }
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      if (view === "month") {
        newDate.setMonth(d.getMonth() + 1);
      } else if (view === "week") {
        newDate.setDate(d.getDate() + 7);
      } else {
        newDate.setDate(d.getDate() + 1);
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
    if (view === "day") return formatDateHeader(currentDate);
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
    const isNoShow = booking.status === "no-show";
    const border = isNoShow ? "border-red-500/70" : booking.payment_status === "paid" ? "border-emerald-500/30" : "border-orange-500/30";
    if (booking.payment_status === "paid") {
      return { bg: "bg-emerald-500/15", text: "text-emerald-400", border };
    }
    return { bg: "bg-orange-500/15", text: "text-orange-400", border };
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
        <div className="min-w-[900px] lg:min-w-[1100px]">
          <div className="grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] lg:grid-cols-[100px_repeat(7,_minmax(0,1fr))] border-b border-zinc-800">
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

          <div className="grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] lg:grid-cols-[100px_repeat(7,_minmax(0,1fr))]">
            <div className="border-r border-zinc-800 bg-zinc-950/30">
              <div className="border-b border-zinc-800" style={{ height: '23px' }} />
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
                  className={`border-l border-zinc-800 ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="grid grid-cols-2">
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

                  <div className="relative">
                    {VISIBLE_HOURS.map((hour) => (
                      <div key={hour} className="h-[60px] border-b border-zinc-800" />
                    ))}

                    {/* Clickable empty slots */}
                    {studios.map((studioId) => {
                      const leftPos = studioId === "la-scene" ? "0" : "50%";
                      const width = "50%";
                      return VISIBLE_HOURS.map((hour, hourIdx) => {
                        const nextHour = getNextHour(hour);
                        const hasBooking = bookings.some(
                          (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled" && b.start_time < nextHour && b.end_time > hour
                        );
                        const hasBlocked = blockedSlots.some(
                          (s) => s.date === dateStr && (s.studio_id === null || s.studio_id === studioId) && s.start_time < nextHour && s.end_time > hour
                        );
                        if (hasBooking || hasBlocked) return null;
                        return (
                          <a
                            key={`empty-${dateStr}-${studioId}-${hour}`}
                            href={`/admin/bookings/new?date=${dateStr}&studio=${studioId}&startTime=${hour}`}
                            className="absolute z-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 hover:bg-primary/5"
                            style={{ top: `${hourIdx * 60}px`, height: "60px", left: leftPos, width }}
                            title={`Nouvelle réservation - ${studioId === "la-scene" ? "La Scène" : "Le Podium"} ${hour}`}
                          >
                            <Plus className="h-4 w-4 text-primary/40" />
                          </a>
                        );
                      });
                    })}

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

                            const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
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
                            const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                            const height = (endIdx - startIdx) * 30;
                            const paymentColors = getPaymentStatusColor(booking);

                            return (
                              <button
                                key={booking.id}
                                type="button"
                                onMouseEnter={(e) => setTooltip({ lines: getBookingTooltipLines(booking), x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setTooltip(null)}
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
                                  {booking.start_time} · {GROUP_LABELS[booking.group_type]}
                                </p>
                                <p className="truncate text-[10px] leading-tight opacity-90">
                                  {booking.band_name || booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                                </p>
                                {hasOptions(booking.equipment) && (
                                  <span className="inline-block rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">Options</span>
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
                        const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                        const height = (endIdx - startIdx) * 30;

                        const studioId = booking.studio_id as StudioId;
                        const leftPos = studioId === "la-scene" ? "4px" : studioId === "le-podium" ? "50%" : "4px";
                        const width = studioId === "la-scene" || studioId === "le-podium" ? "calc(50% - 8px)" : "calc(100% - 8px)";

                        const consultColors = booking.status === "no-show" ? getPaymentStatusColor(booking) : CONSULTATION_COLORS;
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            onMouseEnter={(e) => setTooltip({ lines: getBookingTooltipLines(booking), x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            className={`absolute overflow-hidden rounded border px-2 py-1 text-left transition-all hover:scale-[1.02] hover:shadow-lg z-10 ${consultColors.bg} ${consultColors.border} ${consultColors.text}`}
                            style={{ top: `${top}px`, height: `${Math.max(height, 24)}px`, left: leftPos, width }}
                          >
                            <p className="truncate text-[11px] font-medium leading-tight">
                              {booking.start_time} · {GROUP_LABELS[booking.group_type]}
                            </p>
                             <p className="truncate text-[10px] leading-tight opacity-90">
                               {booking.band_name || booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                             </p>
                             {hasOptions(booking.equipment) && (
                               <span className="inline-block rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">Options</span>
                             )}
                           </button>
                         );
                       });
                     })()}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const [h, m] = nowTime.split(":").map(Number);
                      const startHour = parseInt(VISIBLE_HOURS[0].split(":")[0], 10);
                      const totalMinutes = VISIBLE_HOURS.length * 60;
                      const nowMinutes = (h - startHour) * 60 + m;
                      if (nowMinutes < 0 || nowMinutes > totalMinutes) return null;
                      const topPercent = (nowMinutes / totalMinutes) * 100;
                      return (
                        <div
                          key="now-line"
                          className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                          style={{ top: `${topPercent}%` }}
                        >
                          <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                          <div className="h-px flex-1 bg-red-500 opacity-80" />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-3">
          <span className="text-xs text-zinc-500">Légende :</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
            <span className="text-xs text-zinc-400">Payé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-orange-500/15 border border-orange-500/30" />
            <span className="text-xs text-zinc-400">Reste à payer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-orange-500/15 border border-red-500/70" />
            <span className="text-xs text-zinc-400">Absent</span>

          </div>
        </div>
      </div>
    );
  };

  // ─── Day view ───────────────────────────────────────────────────────────
  const renderDayView = () => {
    const studios: StudioId[] = ["la-scene", "le-podium"];
    const today = new Date();
    const dateStr = toDateStr(currentDate);
    const isToday = isSameDay(currentDate, today);

    const blockedByDate = new Map<string, CalendarBlockedSlot[]>();
    for (const b of blockedSlots) {
      const existing = blockedByDate.get(b.date) || [];
      existing.push(b);
      blockedByDate.set(b.date, existing);
    }

    const expandedBlocked = (studioId: StudioId) => {
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
        <div className="min-w-[350px]">
          {/* Header with date */}
          <div className={`border-b border-zinc-800 p-4 text-center ${isToday ? "bg-primary/5" : ""}`}>
            <h3 className={`text-lg ${isToday ? "font-medium text-primary" : "text-zinc-200"}`}>
              {formatDateHeader(currentDate)}
            </h3>
            {isToday && <span className="text-xs text-primary/70">Aujourd&apos;hui</span>}
          </div>

          {/* Studios side by side */}
          <div className="grid grid-cols-2 divide-x divide-zinc-800">
            {studios.map((studioId) => {
              const studio = STUDIOS[studioId];
              const studioBlocked = expandedBlocked(studioId);
              const studioBookings = bookings.filter(
                (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled" && b.group_type === "group",
              );
              const studioColors = STUDIO_COLORS[studioId];

              return (
                <div key={studioId} className="relative">
                  {/* Studio header */}
                  <div className={`border-b border-zinc-800 p-3 text-center ${studioColors.bg}`}>
                    <p className={`font-medium ${studioColors.text}`}>{studio.name}</p>
                    <p className="text-xs text-zinc-500">{studio.size}</p>
                  </div>

                  {/* Time grid */}
                  <div className="relative">
                    {VISIBLE_HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-[60px] border-b border-zinc-800/50 px-3 pt-1 text-xs text-zinc-600"
                      >
                        {hour}
                      </div>
                    ))}

                    {/* Clickable empty slots */}
                    {VISIBLE_HOURS.map((hour, hourIdx) => {
                      const nextHour = getNextHour(hour);
                      const hasBooking = bookings.some(
                        (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled" && b.start_time < nextHour && b.end_time > hour
                      );
                      const hasBlocked = blockedSlots.some(
                        (s) => s.date === dateStr && (s.studio_id === null || s.studio_id === studioId) && s.start_time < nextHour && s.end_time > hour
                      );
                      if (hasBooking || hasBlocked) return null;
                      return (
                        <a
                          key={`empty-${dateStr}-${studioId}-${hour}`}
                          href={`/admin/bookings/new?date=${dateStr}&studio=${studioId}&startTime=${hour}`}
                          className="absolute z-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 hover:bg-primary/5"
                          style={{ top: `${hourIdx * 60}px`, height: "60px", left: 0, width: "100%" }}
                          title={`Nouvelle réservation - ${studioId === "la-scene" ? "La Scène" : "Le Podium"} ${hour}`}
                        >
                          <Plus className="h-4 w-4 text-primary/40" />
                        </a>
                      );
                    })}

                    {/* Blocked slots */}
                    {studioBlocked.map((slot) => {
                      const startIdx = ALL_TIME_SLOTS.indexOf(slot.start_time);
                      let endIdx = ALL_TIME_SLOTS.indexOf(slot.end_time);
                      if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                      if (startIdx === -1) return null;

                      const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                      const height = (endIdx - startIdx) * 30;

                      return (
                        <div
                          key={slot.id}
                          title={`Bloqué: ${slot.reason}`}
                          className={`absolute left-2 right-2 overflow-hidden rounded border px-2 py-1 ${BLOCKED_COLORS.bg} ${BLOCKED_COLORS.border} ${BLOCKED_COLORS.text}`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 24)}px`,
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

                    {/* Bookings */}
                    {studioBookings.map((booking) => {
                      const startIdx = ALL_TIME_SLOTS.indexOf(booking.start_time);
                      let endIdx = ALL_TIME_SLOTS.indexOf(booking.end_time);
                      if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                      const top = (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                      const height = (endIdx - startIdx) * 30;
                      const paymentColors = getPaymentStatusColor(booking);

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedBooking(booking)}
                          onMouseEnter={(e) => setTooltip({ lines: getBookingTooltipLines(booking), x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                          className={`absolute left-2 right-2 overflow-hidden rounded border px-2 py-1 text-left transition-all hover:scale-[1.02] hover:shadow-lg z-10 ${paymentColors.bg} ${paymentColors.border} ${paymentColors.text}`}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 28)}px`,
                          }}
                        >
                          <p className="truncate text-[12px] font-medium leading-tight">
                            {booking.start_time} · {GROUP_LABELS[booking.group_type]}
                          </p>
                          <p className="truncate text-[11px] leading-tight opacity-90">
                            {booking.band_name || booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                          </p>
                          {hasOptions(booking.equipment) && (
                              <span className="inline-block rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">Options</span>
                                )}
                        </button>
                      );
                    })}

                    {/* Consultations (solo/duo) */}
                    {bookings
                      .filter(
                        (b) =>
                          b.date === dateStr &&
                          b.studio_id === studioId &&
                          (b.group_type === "solo" || b.group_type === "duo") &&
                          b.status !== "cancelled",
                      )
                      .map((booking) => {
                        const startIdx = ALL_TIME_SLOTS.indexOf(booking.start_time);
                        let endIdx = ALL_TIME_SLOTS.indexOf(booking.end_time);
                        if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
                        const top = 24 + (startIdx - ALL_TIME_SLOTS.indexOf("09:00")) * 30;
                        const height = (endIdx - startIdx) * 30;
                        const leftPos = "4px";
                        const width = "calc(100% - 8px)";

                        const consultColors = booking.status === "no-show" ? getPaymentStatusColor(booking) : CONSULTATION_COLORS;
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            onMouseEnter={(e) => setTooltip({ lines: getBookingTooltipLines(booking), x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            className={`absolute overflow-hidden rounded border px-2 py-1 text-left transition-all hover:scale-[1.02] hover:shadow-lg z-10 ${consultColors.bg} ${consultColors.border} ${consultColors.text}`}
                            style={{
                              top: `${top}px`,
                              height: `${Math.max(height, 28)}px`,
                              left: leftPos,
                              width,
                            }}
                          >
                            <p className="truncate text-[12px] font-medium leading-tight">
                              {booking.start_time} · {GROUP_LABELS[booking.group_type]}
                            </p>
                            <p className="truncate text-[11px] leading-tight opacity-90">
                              {booking.band_name || booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4)}
                            </p>
                             {hasOptions(booking.equipment) && (
                               <span className="inline-block rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">Options</span>
                             )}
                           </button>
                         );
                       })}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const [h, m] = nowTime.split(":").map(Number);
                      const startHour = parseInt(VISIBLE_HOURS[0].split(":")[0], 10);
                      const totalMinutes = VISIBLE_HOURS.length * 60;
                      const nowMinutes = (h - startHour) * 60 + m;
                      if (nowMinutes < 0 || nowMinutes > totalMinutes) return null;
                      const topPercent = (nowMinutes / totalMinutes) * 100;
                      return (
                        <div
                          key="now-line"
                          className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                          style={{ top: `${topPercent}%` }}
                        >
                          <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                          <div className="h-px flex-1 bg-red-500 opacity-80" />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-3">
          <span className="text-xs text-zinc-500">Légende :</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
            <span className="text-xs text-zinc-400">Payé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-orange-500/15 border border-orange-500/30" />
            <span className="text-xs text-zinc-400">Reste à payer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm bg-orange-500/15 border border-red-500/70" />
            <span className="text-xs text-zinc-400">Absent</span>
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
        <div className="min-w-[350px] md:min-w-[700px]">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {dayNames.map((name) => (
              <div key={name} className="border-l border-zinc-800 p-2 text-center text-xs font-medium text-zinc-400 first:border-l-0">
                {name}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {monthGrid.map((week) => (
            <div key={toDateStr(week[0])} className="grid grid-cols-7 border-b border-zinc-800 last:border-b-0">
              {week.map((date) => {
                const dateStr = toDateStr(date);
                const inMonth = date.getMonth() === currentDate.getMonth();
                const dayBookings = bookingsByDate.get(dateStr) || [];
                const dayBlocked = blockedByDate.get(dateStr) || [];
                const count = dayBookings.length;
                const occupancyRate = computeDayOccupancyRate(dayBookings, date);
                const { bg, text } = getOccupancyColor(occupancyRate);
                const isToday = isSameDay(date, today);
                const fullyBlocked = isAllStudiosWholeDay(dateStr);

                return (
                  <div
                    key={dateStr}
                    className={`group min-h-[100px] border-l border-zinc-800 p-2 text-left first:border-l-0 ${inMonth ? bg : "bg-zinc-950/50"} ${fullyBlocked ? "ring-1 ring-red-500/30" : ""}`}
                  >
                    {/* Day number */}
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                          isToday
                            ? "bg-primary font-bold text-primary-foreground"
                            : inMonth ? "text-zinc-300 group-hover:bg-zinc-700" : "text-zinc-600"
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
    const finalTotal = (b.total_price || 0) - (b.promo_discount || 0);
    const balance = finalTotal - totalPaid;

    const methodLabels: Record<string, string> = {
      card: "Carte bancaire",
      cash: "Espèces",
      check: "Chèque",
      cheque: "Chèque",
      transfer: "Virement",
    };

    return (
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl w-[95vw] border-zinc-800 bg-zinc-900 text-zinc-100">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <CalendarDays className="h-6 w-6 shrink-0 text-primary" />
              <span className="truncate">{b.band_name || b.user_name || b.booking_ref}</span>
              <Badge className={`${STATUS_COLORS[b.status] || ""} shrink-0 border px-3 py-1 text-xs uppercase tracking-wider`}>
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
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Type</p>
                    <p className="text-sm font-medium">{GROUP_LABELS[b.group_type] || b.group_type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Client</p>
                    <p className="text-sm font-medium">{b.user_name || "—"}</p>
                    {b.user_band_name && (
                      <p className="text-xs text-zinc-400">{b.user_band_name}</p>
                    )}
                  </div>
                </div>

              <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
                <CreditCard className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Total à payer</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold text-primary">{formatPrice(finalTotal)}</p>
                    {(b.promo_discount || 0) > 0 && (
                      <p className="text-[10px] text-emerald-500 font-medium">(Promo: -{formatPrice(b.promo_discount || 0)})</p>
                    )}
                    {totalPaid > 0 && totalPaid < finalTotal && (
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
                        {JSON.parse(b.equipment!).map((eq: any) => (
                          <div key={eq.id}>
                            {eq.quantity}× {eq.name || EQUIPMENT[eq.id]?.name || eq.id}
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

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-6">
            {b.status === "confirmed" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                  onClick={() => {
                    setCalRescheduleDate(b.date);
                    setCalRescheduleStart(b.start_time);
                    setCalRescheduleEnd(b.end_time);
                    setCalRescheduleOpen(true);
                  }}
                >
                  Déplacer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 border-red-900 bg-transparent text-red-400 hover:border-red-700 hover:bg-red-950/40 hover:text-red-300"
                  onClick={() => setCalCancelOpen(true)}
                >
                  Annuler
                </Button>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <a
                href={`/admin/bookings/${b.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-black transition-colors hover:bg-primary/90"
              >
                Détails complets
              </a>
            </div>
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
    <div className="space-y-4" onMouseLeave={() => setTooltip(null)}>
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[9999] rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 shadow-xl text-sm text-white"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, transform: "translateY(-100%)" }}
        >
          {tooltip.lines.map((line, i) => (
            <p key={i} className={i === 0 ? "font-semibold" : "text-zinc-300 text-xs mt-0.5"}>{line}</p>
          ))}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendrier</h1>
          <p className="text-zinc-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={goToToday}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition-colors hover:bg-zinc-800"
        >
          Aujourd&apos;hui
        </button>
      </div>

      {/* Navigation + Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToPrev} className="rounded-lg p-2 transition-colors hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={goToNext} className="rounded-lg p-2 transition-colors hover:bg-zinc-800">
            <ChevronRight className="h-5 w-5" />
          </button>
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
          <TabsList>
            {isMobile ? (
              <>
                <TabsTrigger value="day">Jour</TabsTrigger>
                <TabsTrigger value="month">Mois</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="week">Semaine</TabsTrigger>
                <TabsTrigger value="month">Mois</TabsTrigger>
              </>
            )}
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

      {/* Cancel dialog */}
      <Dialog open={calCancelOpen} onOpenChange={setCalCancelOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler la réservation</DialogTitle>
            <DialogDescription>{selectedBooking?.booking_ref}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motif (optionnel)</Label>
            <Input value={calCancelReason} onChange={e => setCalCancelReason(e.target.value)} placeholder="Motif d'annulation..." className="bg-zinc-800 border-zinc-700" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalCancelOpen(false)} className="border-zinc-700">Fermer</Button>
            <Button variant="destructive" onClick={handleCalCancel} disabled={calCancelLoading}>
              {calCancelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={calRescheduleOpen} onOpenChange={setCalRescheduleOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déplacer la réservation</DialogTitle>
            <DialogDescription>{selectedBooking?.booking_ref}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouvelle date</Label>
              <Input type="date" value={calRescheduleDate} onChange={e => setCalRescheduleDate(e.target.value)} className="bg-zinc-800 border-zinc-700" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Début</Label>
                <Input type="time" value={calRescheduleStart} onChange={e => setCalRescheduleStart(e.target.value)} step="1800" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input type="time" value={calRescheduleEnd} onChange={e => setCalRescheduleEnd(e.target.value)} step="1800" className="bg-zinc-800 border-zinc-700" />
              </div>
            </div>
            {calRescheduleConflict && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <span>⚠</span> Ce créneau est déjà occupé pour ce studio.
              </p>
            )}
            {calRescheduleError && <p className="text-sm text-destructive">{calRescheduleError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalRescheduleOpen(false)} className="border-zinc-700">Annuler</Button>
            <Button onClick={handleCalReschedule} disabled={calRescheduleLoading || calRescheduleChecking || calRescheduleConflict || !calRescheduleDate || !calRescheduleStart || !calRescheduleEnd}>
              {(calRescheduleLoading || calRescheduleChecking) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
