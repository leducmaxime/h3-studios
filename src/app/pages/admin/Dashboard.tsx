"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  CreditCard,
  Users,
  Clock,
  ShoppingCart,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Ban,
  Building2,
  Euro,
  Settings,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { STUDIOS, SLOT_DURATION_MINUTES, formatPrice } from "@/lib/booking";
import { generateMonthlyReportPDF } from "@/lib/export";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  todayBookings: number;
  todayRevenue: number;
  weekBookings: number;
  weekRevenue: number;
  monthBookings: number;
  monthRevenue: number;
  pendingPayments: number;
  pendingAmount: number;
  occupancyToday: number;

  rangeFrom: string;
  rangeTo: string;
  rangeDays: number;
  rangeBookings: number;
  rangeRevenue: number;
  rangeBookedMinutes: number;
  rangePendingPayments: number;
  rangePendingAmount: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface OccupancyPoint {
  day: string;
  occupancyPct: number;
  bookedSlots: number;
  openSlots: number;
}

interface StudioPoint {
  studio: string;
  count: number;
  revenue: number;
}

interface PaymentPoint {
  method: string;
  count: number;
  revenue: number;
}

interface UpcomingBooking {
  id: string;
  booking_ref: string;
  user_name: string | null;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  promo_discount?: number;
}

interface CalendarBooking {
  id: string;
  booking_ref: string;
  band_name?: string | null;
  user_name?: string;
  user_band_name?: string | null;
  user_id: string | null;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  promo_discount?: number;
}

interface PendingPayment {
  id: string;
  booking_id?: string;
  amount: number;
  user_name: string | null;
  booking_date: string | null;
  start_time: string | null;
  studio_id: string | null;
  kind?: "on-site" | "card";
}

type Period = "week" | "month" | "quarter" | "year";

type ActivityCalendarView = "day" | "week" | "month" | "year";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "week", label: "Semaine" },
  { value: "month", label: "30 jours" },
  { value: "quarter", label: "90 jours" },
  { value: "year", label: "12 mois" },
];

const CHART_COLORS = {
  primary: "#ffde59",
  secondary: "#a78bfa",
  green: "#4ade80",
  red: "#f87171",
  blue: "#60a5fa",
  zinc400: "#a1a1aa",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.blue, CHART_COLORS.green];

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatShortDate(dateStr: string): string {
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("fr-FR", { month: "short" });
  }

  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatISODateShort(dateISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return dateISO;
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatRange(fromISO: string, toISO: string): string {
  if (!fromISO || !toISO) return "";
  if (fromISO === toISO) return `Le ${formatISODateShort(fromISO)}`;
  return `Du ${formatISODateShort(fromISO)} au ${formatISODateShort(toISO)}`;
}

function getLocalDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthGrid(year: number, monthIndex: number): Date[][] {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));

  let startWeekday = firstDay.getUTCDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const start = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  start.setUTCDate(start.getUTCDate() - startWeekday);

  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + i);
      week.push(d);
    }
    weeks.push(week);
  }

  return weeks;
}

function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + delta, 1, 12, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  const to = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  return { from: toDateISO(from), to: toDateISO(to) };
}

function formatMonthKeyFR(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function getWeekStartUTCNoonFromISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - (day - 1));
  return monday;
}

function ActivityCalendarDay({
  dateISO,
  bookings,
  loading,
}: {
  dateISO: string;
  bookings: CalendarBooking[];
  loading: boolean;
}) {
  const dayLabel = /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? formatDate(dateISO) : dateISO;

  const items = useMemo(() => {
    const list = bookings.filter((b) => b.date === dateISO && b.status !== "cancelled");
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return list;
  }, [bookings, dateISO]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-200">{dayLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          Chargement...
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-zinc-500">Aucune réservation</p>
      ) : (
        <div className="space-y-2">
          {items.map((b) => {
            const studio = b.studio_id === "la-scene" ? "La Scène" : b.studio_id === "le-podium" ? "Le Podium" : b.studio_id;
    const displayName = b.band_name || b.user_name || "Client inconnu";
            return (
              <a
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 transition-colors hover:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {b.start_time}-{b.end_time} · {studio}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{displayName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-primary">
                    {formatPrice((b.total_price || 0) - (b.promo_discount || 0))}
                  </p>
                  {(b.promo_discount || 0) > 0 && (
                    <p className="text-[10px] text-emerald-500">-{formatPrice(b.promo_discount || 0)}</p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityCalendarWeek({
  fromISO,
  toISO,
  bookings,
  loading,
}: {
  fromISO: string;
  toISO: string;
  bookings: CalendarBooking[];
  loading: boolean;
}) {
  const days = useMemo(() => {
    const start = getWeekStartUTCNoonFromISO(fromISO);
    const list: Array<{ dateISO: string; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const iso = toDateISO(d);
      const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
      list.push({ dateISO: iso, label });
    }
    return list;
  }, [fromISO]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const list = map.get(b.date) || [];
      list.push(b);
      map.set(b.date, list);
    }
    for (const [k, list] of map) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
      map.set(k, list);
    }
    return map;
  }, [bookings]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-zinc-500">{formatRange(fromISO, toISO)}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          Chargement...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {days.map((d) => {
              const items = (byDay.get(d.dateISO) || []).slice(0, 6);
              const remaining = Math.max(0, (byDay.get(d.dateISO)?.length ?? 0) - items.length);
              return (
                <div key={d.dateISO} className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">{d.label}</span>
                    {(byDay.get(d.dateISO)?.length ?? 0) > 0 && (
                      <span className="text-[10px] text-zinc-400">{byDay.get(d.dateISO)!.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.map((b) => {
                      const studio = b.studio_id === "la-scene" ? "Scène" : b.studio_id === "le-podium" ? "Podium" : b.studio_id;
    const displayName = b.band_name || b.user_name || "";
                      return (
                        <a
                          key={b.id}
                          href={`/admin/bookings/${b.id}`}
                          className="block truncate rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900/70"
                          title={`${b.start_time}-${b.end_time} ${studio}`}
                        >
                          <span className="font-medium">{b.start_time}</span>
                          <span className="text-zinc-500">-{b.end_time}</span>
                          <span className="text-zinc-500"> · </span>
                          <span className="text-zinc-300">{studio}</span>
                          {displayName ? (
                            <>
                              <span className="text-zinc-500"> · </span>
                              <span className="text-zinc-400">{displayName}</span>
                            </>
                          ) : null}
                        </a>
                      );
                    })}
                    {remaining > 0 && <div className="text-[11px] text-zinc-500">+{remaining} autres</div>}
                    {items.length === 0 && <div className="py-6 text-center text-xs text-zinc-600">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCalendarYear({
  year,
  rangeFrom,
  rangeTo,
  bookings,
  loading,
}: {
  year: number;
  rangeFrom: string;
  rangeTo: string;
  bookings: CalendarBooking[];
  loading: boolean;
}) {
  const byDateCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      map.set(b.date, (map.get(b.date) ?? 0) + 1);
    }
    return map;
  }, [bookings]);

  const months = Array.from({ length: 12 }, (_, i) => i);
  const dayHeaders = ["L", "M", "M", "J", "V", "S", "D"];

  const cellColor = (count: number): string => {
    if (count <= 0) return "bg-zinc-800/40 text-zinc-500";
    if (count === 1) return "bg-primary/15 text-primary";
    if (count === 2) return "bg-primary/25 text-primary";
    return "bg-primary/35 text-primary";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-200">{year}</p>
          <p className="text-xs text-zinc-500">{formatRange(rangeFrom, rangeTo)}</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
            Chargement...
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((monthIdx) => {
          const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
          const grid = getMonthGrid(year, monthIdx);
          const monthLabel = new Date(Date.UTC(year, monthIdx, 1, 12, 0, 0)).toLocaleDateString("fr-FR", { month: "long" });

          return (
            <div key={monthKey} className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-200 capitalize">{monthLabel}</p>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-1">
                {dayHeaders.map((d) => (
                  <div key={`${monthKey}-h-${d}`} className="text-center text-[10px] text-zinc-600">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {grid.flat().map((date) => {
                  const dateISO = toDateISO(date);
                  const inRange = dateISO >= rangeFrom && dateISO <= rangeTo;
                  const count = byDateCount.get(dateISO) ?? 0;
                  return (
                    <a
                      key={dateISO}
                      href={`/admin/calendar?date=${dateISO}`}
                      className={
                        "flex h-6 items-center justify-center rounded text-[10px] font-semibold transition-colors " +
                        (inRange ? cellColor(count) : "bg-zinc-900/20 text-zinc-600")
                      }
                      title={count > 0 ? `${formatDate(dateISO)}: ${count} réservations` : formatDate(dateISO)}
                    >
                      {date.getUTCDate()}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCalendarMonth({
  monthKey,
  rangeFrom,
  rangeTo,
  bookings,
  loading,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  monthKey: string;
  rangeFrom: string;
  rangeTo: string;
  bookings: CalendarBooking[];
  loading: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [year, month] = monthKey.split("-").map(Number);
  const grid = useMemo<Date[][]>(() => getMonthGrid(year, month - 1), [year, month]);

  const bookingsByDay = useMemo((): Map<string, CalendarBooking[]> => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const list = map.get(b.date) || [];
      list.push(b);
      map.set(b.date, list);
    }
    for (const [k, list] of map) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
      map.set(k, list);
    }
    return map;
  }, [bookings]);

  const todayLocalISO = getLocalDateISO();
  const dayHeaders = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-200">{formatMonthKeyFR(monthKey)}</p>
          <p className="text-xs text-zinc-500">{formatRange(rangeFrom, rangeTo)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={onPrev} disabled={!canPrev || loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={onNext} disabled={!canNext || loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-zinc-500">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {grid.flat().map((date) => {
          const dateISO = toDateISO(date);
          const inRange = dateISO >= rangeFrom && dateISO <= rangeTo;
          const isToday = dateISO === todayLocalISO;
          const items = bookingsByDay.get(dateISO) || [];
          const shown = items.slice(0, 3);
          const remaining = Math.max(0, items.length - shown.length);

          return (
            <div
              key={dateISO}
              className={
                "h-[110px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/20 p-2 " +
                (inRange ? "" : "opacity-40") +
                (isToday ? " ring-1 ring-primary/60" : "")
              }
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={"text-xs font-semibold " + (isToday ? "text-primary" : "text-zinc-200")}>
                  {date.getUTCDate()}
                </span>
                {items.length > 0 && (
                  <span className="text-[10px] text-zinc-400">{items.length}</span>
                )}
              </div>

              <div className="space-y-1">
                {shown.map((b) => {
                  const studio = b.studio_id === "la-scene" ? "Scène" : b.studio_id === "le-podium" ? "Podium" : b.studio_id;
                  const displayName = b.band_name || b.user_name || "";
                  return (
                    <a
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      className="block truncate rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-900/70"
                      title={`${b.start_time}-${b.end_time} ${studio}`}
                    >
                      <span className="font-medium">{b.start_time}</span>
                      <span className="text-zinc-500">-{b.end_time}</span>
                      <span className="text-zinc-500"> · </span>
                      <span className="text-zinc-300">{studio}</span>
                      {displayName ? (
                        <>
                          <span className="text-zinc-500"> · </span>
                          <span className="text-zinc-400">{displayName}</span>
                        </>
                      ) : null}
                    </a>
                  );
                })}
                {remaining > 0 && (
                  <div className="text-[11px] text-zinc-500">+{remaining} autres</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          Chargement du calendrier...
        </div>
      )}
    </div>
  );
}

function formatSlotsToDuration(slots: number): string {
  const minutes = Math.max(0, Math.round(slots)) * SLOT_DURATION_MINUTES;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

type TooltipPayload<T> = Array<{ payload: T }>;

function OccupancyTooltip({
  active,
  payload,
  label,
  rangeMode,
}: {
  active?: boolean;
  payload?: TooltipPayload<OccupancyPoint>;
  label?: unknown;
  rangeMode: "today" | "rolling" | "week" | "month" | "year";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  const labelStr = (() => {
    if (typeof label !== "string") return "";
    if (rangeMode === "year" && /^\d{4}-\d{2}$/.test(label)) {
      const [y, m] = label.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
      return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    if (rangeMode === "month" && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
      return `Semaine du ${formatISODateShort(label)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return formatDate(label);
    return label;
  })();

  const pct = Number.isFinite(p.occupancyPct) ? (p.occupancyPct % 1 === 0 ? p.occupancyPct.toFixed(0) : p.occupancyPct.toFixed(1)) : "0";

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-sm font-medium text-zinc-100">{labelStr}</p>
      <p className="text-xs text-zinc-400">Occupation : <span className="text-zinc-100">{pct}%</span></p>
      <p className="text-xs text-zinc-400">
        Réservé : <span className="text-zinc-100">{formatSlotsToDuration(p.bookedSlots)}</span> / {formatSlotsToDuration(p.openSlots)}
      </p>
    </div>
  );
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function renderPiePercentLabel(props: PieLabelProps): React.ReactNode {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number"
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.42;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = Math.round(percent * 100);
  if (pct <= 0) return "";

  return (
    <text x={x} y={y} fill={CHART_COLORS.zinc900} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${pct}%`}
    </text>
  );
}

function getISOWeekYearAndNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);

  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year, week };
}

function getISOWeeksInYear(year: number): number {
  return getISOWeekYearAndNumber(new Date(Date.UTC(year, 11, 28, 12, 0, 0))).week;
}

function getISOWeekStartUTCNoon(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: string;
  color?: "primary" | "green" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    blue: "bg-blue-500/10 text-blue-500",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subValue && <p className="mt-1 text-sm text-zinc-500">{subValue}</p>}
        </div>
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <p className="mt-2 text-xs text-green-500">{trend}</p>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  const formattedLabel = (() => {
    if (!label) return "";
    if (/^\d{4}-\d{2}$/.test(label)) {
      const [y, m] = label.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
      return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
      const [y, m, d] = label.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    }

    return label;
  })();

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-zinc-400">{formattedLabel}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? formatPrice(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { count: number; revenue: number } }> }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-sm font-medium text-zinc-100">{entry.name}</p>
      <p className="text-xs text-zinc-400">{entry.payload.count} réservations</p>
      <p className="text-xs text-primary">{formatPrice(entry.payload.revenue)}</p>
    </div>
  );
}

function PaymentPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { count: number } }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const count = entry.payload.count;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-sm font-medium text-zinc-100">{entry.name}</p>
      <p className="text-xs text-zinc-400">{count} paiements · {pct}%</p>
    </div>
  );
}

export function AdminDashboard() {
  const nowISO = getISOWeekYearAndNumber(new Date());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsMeta, setStatsMeta] = useState<{ minYear: number | null; maxYear: number | null } | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyPoint[]>([]);
  const [studioData, setStudioData] = useState<StudioPoint[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentPoint[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [activityCalendarBookings, setActivityCalendarBookings] = useState<CalendarBooking[]>([]);
  const [activityCalendarLoading, setActivityCalendarLoading] = useState(false);
  const [activityCalendarMonth, setActivityCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [activityCalendarView, setActivityCalendarView] = useState<ActivityCalendarView>("month");
  const [period, setPeriod] = useState<Period>("month");
  const [rangeMode, setRangeMode] = useState<"today" | "rolling" | "week" | "month" | "year">("today");
  const [selectedYear, setSelectedYear] = useState(() => String(nowISO.year));
  const [selectedWeek, setSelectedWeek] = useState(() => String(nowISO.week));
  const [loading, setLoading] = useState(true);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetch("/api/admin/stats/meta")
      .then((res) => res.json())
      .then((json: any) => {
        if (json?.success && json?.data) {
          setStatsMeta({
            minYear: typeof json.data.minYear === "number" ? json.data.minYear : null,
            maxYear: typeof json.data.maxYear === "number" ? json.data.maxYear : null,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch stats meta:", err));
  }, []);

  useEffect(() => {
    const min = statsMeta?.minYear;
    const max = statsMeta?.maxYear;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;

    const currentSelected = parseInt(selectedYear, 10);
    if (!Number.isFinite(currentSelected)) {
      setSelectedYear(String(max));
      return;
    }
    if (currentSelected < (min as number) || currentSelected > (max as number)) {
      setSelectedYear(String(max));
    }
  }, [statsMeta, selectedYear]);

  useEffect(() => {
    if (rangeMode !== "month") return;
    const parts = reportMonth.split("-");
    const monthPart = parts[1] || "01";
    if (parts[0] !== selectedYear) {
      setReportMonth(`${selectedYear}-${monthPart}`);
    }
  }, [rangeMode, selectedYear, reportMonth]);

  useEffect(() => {
    if (rangeMode !== "week") return;
    const year = parseInt(selectedYear, 10);
    if (!Number.isFinite(year)) return;
    const maxWeeks = getISOWeeksInYear(year);
    const current = parseInt(selectedWeek, 10);
    if (!Number.isFinite(current)) {
      setSelectedWeek("1");
      return;
    }
    if (current < 1) setSelectedWeek("1");
    if (current > maxWeeks) setSelectedWeek(String(maxWeeks));
  }, [rangeMode, selectedYear, selectedWeek]);


  const fetchStats = useCallback(async () => {
    try {
      const url = new URL("/api/admin/stats", window.location.origin);

      if (rangeMode === "today") {
        url.searchParams.set("mode", "today");
      } else if (rangeMode === "rolling") {
        url.searchParams.set("mode", "rolling");
        url.searchParams.set("period", period);
      } else if (rangeMode === "month") {
        url.searchParams.set("mode", "month");
        const [y, m] = reportMonth.split("-").map(Number);
        url.searchParams.set("year", String(y));
        url.searchParams.set("month", String(m));
      } else if (rangeMode === "week") {
        url.searchParams.set("mode", "week");
        url.searchParams.set("year", selectedYear);
        url.searchParams.set("week", selectedWeek);
      } else if (rangeMode === "year") {
        url.searchParams.set("mode", "year");
        url.searchParams.set("year", selectedYear);
      }

      const res = await fetch(url.toString());
      const json = await res.json() as { success: boolean; data?: DashboardStats };
      if (json.success && json.data) setStats(json.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [rangeMode, reportMonth, selectedYear, selectedWeek, period]);

  const fetchCharts = useCallback(async (p: Period) => {
    try {
      const chartsUrl = new URL("/api/admin/stats/charts", window.location.origin);
      const revenueUrl = new URL("/api/admin/stats/revenue", window.location.origin);

      if (rangeMode === "today") {
        chartsUrl.searchParams.set("mode", "today");
        revenueUrl.searchParams.set("mode", "today");
      } else if (rangeMode === "month") {
        const [y, m] = reportMonth.split("-").map(Number);
        chartsUrl.searchParams.set("mode", "month");
        chartsUrl.searchParams.set("year", String(y));
        chartsUrl.searchParams.set("month", String(m));
        revenueUrl.searchParams.set("mode", "month");
        revenueUrl.searchParams.set("year", String(y));
        revenueUrl.searchParams.set("month", String(m));
      } else if (rangeMode === "week") {
        chartsUrl.searchParams.set("mode", "week");
        chartsUrl.searchParams.set("year", selectedYear);
        chartsUrl.searchParams.set("week", selectedWeek);
        revenueUrl.searchParams.set("mode", "week");
        revenueUrl.searchParams.set("year", selectedYear);
        revenueUrl.searchParams.set("week", selectedWeek);
      } else if (rangeMode === "year") {
        chartsUrl.searchParams.set("mode", "year");
        chartsUrl.searchParams.set("year", selectedYear);
        revenueUrl.searchParams.set("mode", "year");
        revenueUrl.searchParams.set("year", selectedYear);
      } else {
        chartsUrl.searchParams.set("period", p);
        revenueUrl.searchParams.set("period", p);
      }

      const [revenueRes, chartsRes] = await Promise.all([
        fetch(revenueUrl.toString()),
        fetch(chartsUrl.toString()),
      ]);

      const revenueJson = await revenueRes.json() as { success: boolean; data?: RevenuePoint[] };
      if (revenueJson.success && revenueJson.data) setRevenueData(revenueJson.data);

      const chartsJson = await chartsRes.json() as {
        success: boolean;
        data?: {
          occupancy: OccupancyPoint[];
          studios: StudioPoint[];
          payments: PaymentPoint[];
          pendingPayments: PendingPayment[];
        };
      };
      if (chartsJson.success && chartsJson.data) {
        setOccupancyData(chartsJson.data.occupancy);
        setStudioData(chartsJson.data.studios);
        setPaymentData(chartsJson.data.payments);
        setPendingPayments(chartsJson.data.pendingPayments);
      }
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    }
  }, [rangeMode, reportMonth, selectedYear, selectedWeek]);

  const activityRange = useMemo(() => {
    if (stats) return { from: stats.rangeFrom, to: stats.rangeTo };
    const today = getLocalDateISO();
    return { from: today, to: today };
  }, [stats]);

  useEffect(() => {
    if (rangeMode === "today") {
      setActivityCalendarView("day");
      return;
    }
    if (rangeMode === "week") {
      setActivityCalendarView("week");
      return;
    }
    if (rangeMode === "year") {
      setActivityCalendarView("year");
      return;
    }
    setActivityCalendarView("month");
  }, [rangeMode]);

  useEffect(() => {
    if (activityCalendarView !== "month") return;
    const toMonth = activityRange.to.slice(0, 7);
    const m = getMonthRange(activityCalendarMonth);
    const intersects = m.to >= activityRange.from && m.from <= activityRange.to;
    if (!intersects) setActivityCalendarMonth(toMonth);
  }, [activityCalendarView, activityRange.from, activityRange.to, activityCalendarMonth]);

  const activityCalendarRequest = useMemo(() => {
    if (activityCalendarView === "day") {
      return { kind: "date" as const, date: activityRange.to };
    }
    if (activityCalendarView === "week") {
      return { kind: "range" as const, startDate: activityRange.from, endDate: activityRange.to };
    }
    if (activityCalendarView === "year") {
      return { kind: "range" as const, startDate: activityRange.from, endDate: activityRange.to };
    }
    const m = getMonthRange(activityCalendarMonth);
    const startDate = m.from < activityRange.from ? activityRange.from : m.from;
    const endDate = m.to > activityRange.to ? activityRange.to : m.to;
    return { kind: "range" as const, startDate, endDate };
  }, [activityCalendarView, activityCalendarMonth, activityRange.from, activityRange.to]);

  useEffect(() => {
    setActivityCalendarLoading(true);
    const url = (() => {
      if (activityCalendarRequest.kind === "date") {
        return `/api/admin/calendar?summary=1&date=${activityCalendarRequest.date}`;
      }
      if (activityCalendarRequest.startDate > activityCalendarRequest.endDate) return null;
      return `/api/admin/calendar?summary=1&startDate=${activityCalendarRequest.startDate}&endDate=${activityCalendarRequest.endDate}`;
    })();

    if (!url) {
      setActivityCalendarBookings([]);
      setActivityCalendarLoading(false);
      return;
    }

    fetch(url)
      .then((res) => res.json())
      .then((json: any) => {
        if (json?.success && json?.data?.bookings) {
          setActivityCalendarBookings(json.data.bookings as CalendarBooking[]);
        } else {
          setActivityCalendarBookings([]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch activity calendar:", err);
        setActivityCalendarBookings([]);
      })
      .finally(() => setActivityCalendarLoading(false));
  }, [activityCalendarRequest]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchCharts(period)]).finally(() => setLoading(false));
  }, [fetchStats, fetchCharts, period]);

  const handleGenerateMonthlyReport = async () => {
    const [year, month] = reportMonth.split("-").map(Number);
    try {
      const res = await fetch(`/api/admin/stats?month=${month}&year=${year}`);
      const json = await res.json() as { success: boolean; data?: DashboardStats };
      
      const chartsRes = await fetch(`/api/admin/stats/charts?mode=month&month=${month}&year=${year}`);
      const chartsJson = await chartsRes.json() as {
        success: boolean;
        data?: { studios: StudioPoint[] };
      };

      if (json.success && json.data) {
        const studioStats = (chartsJson.data?.studios || []).map(s => ({
          studio_id: s.studio,
          count: s.count,
          revenue: s.revenue,
        }));
        const reportStats = {
          revenue: json.data.monthRevenue,
          bookingCount: json.data.monthBookings,
          occupancyRate: json.data.occupancyToday || 0,
          noShowRate: 0,
          studioStats,
          weeklyStats: Array.from({ length: 5 }, (_, i) => ({ week: i + 1, count: 0, revenue: 0 })),
        };
        generateMonthlyReportPDF(reportStats, { month, year });
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    }
  };

  const monthOptions = MONTH_LABELS.map((label, idx) => {
    const month = String(idx + 1).padStart(2, "0");
    return { value: `${selectedYear}-${month}`, label: `${label} ${selectedYear}` };
  });

  const weekOptions = (() => {
    const year = parseInt(selectedYear, 10);
    if (!Number.isFinite(year)) return [] as Array<{ value: string; label: string }>;
    const total = getISOWeeksInYear(year);
    const items: Array<{ value: string; label: string }> = [];
    for (let w = 1; w <= total; w++) {
      const monday = getISOWeekStartUTCNoon(year, w);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const start = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const end = sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const label = `Semaine ${String(w).padStart(2, "0")} (${start}–${end})`;
      items.push({ value: String(w), label });
    }
    return items;
  })();

  const rangeTitle = (() => {
    if (rangeMode === "today") {
      return "Aujourd'hui";
    }
    if (rangeMode === "week") {
      const label = weekOptions.find((w) => w.value === selectedWeek)?.label;
      return label ? label.replace(/ \(.+\)$/, "") : `Semaine ${selectedWeek}`;
    }
    if (rangeMode === "month") {
      return monthOptions.find((m) => m.value === reportMonth)?.label || reportMonth;
    }
    if (rangeMode === "year") {
      return selectedYear;
    }
    return PERIOD_OPTIONS.find((p) => p.value === period)?.label || period;
  })();

  const rangeSubtitle = stats ? formatRange(stats.rangeFrom, stats.rangeTo) : "";
  const avgBasket = stats && stats.rangeBookings > 0 ? stats.rangeRevenue / stats.rangeBookings : 0;
  const rangeBookedSlots = stats ? stats.rangeBookedMinutes / SLOT_DURATION_MINUTES : 0;

  const prevActivityMonth = addMonths(activityCalendarMonth, -1);
  const nextActivityMonth = addMonths(activityCalendarMonth, 1);
  const canPrevActivityMonth = getMonthRange(prevActivityMonth).to >= activityRange.from;
  const canNextActivityMonth = getMonthRange(nextActivityMonth).from <= activityRange.to;

  const yearOptions = (() => {
    const current = new Date().getFullYear();
    const min = statsMeta?.minYear ?? (current - 5);
    const max = statsMeta?.maxYear ?? current;
    const safeMin = Number.isFinite(min) ? min : (current - 5);
    const safeMax = Number.isFinite(max) ? max : current;

    const items: Array<{ value: string; label: string }> = [];
    for (let y = safeMax; y >= safeMin; y--) items.push({ value: String(y), label: String(y) });
    return items;
  })();

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-zinc-400">Vue d&apos;ensemble de votre activité</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as "today" | "rolling" | "week" | "month" | "year")}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="rolling">Période</SelectItem>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reportMonth} onValueChange={setReportMonth}>
              <SelectTrigger className="w-[140px]" disabled={rangeMode !== "month"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[160px]" disabled={rangeMode !== "week"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]" disabled={rangeMode === "rolling" || rangeMode === "today"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateMonthlyReport}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <FileText className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Rapport PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
          <a
            href="/admin/bookings/new"
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle réservation</span>
            <span className="sm:hidden">+ Réserver</span>
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Réservations (${rangeTitle})`}
          value={stats?.rangeBookings ?? 0}
          subValue={stats ? `${rangeSubtitle} · ${formatSlotsToDuration(rangeBookedSlots)}` : rangeSubtitle}
          icon={Calendar}
          color="primary"
        />
        <StatCard
          title="CA réservé (total)"
          value={formatPrice(stats?.rangeRevenue ?? 0)}
          subValue={`${stats?.rangeBookings ?? 0} réservations`}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Panier moyen"
          value={formatPrice(avgBasket)}
          subValue={stats ? `${stats.rangeBookings} réservations` : ""}
          icon={ShoppingCart}
          color="green"
        />
        <StatCard
          title="Sur place à encaisser"
          value={stats?.rangePendingPayments ?? 0}
          subValue={formatPrice(stats?.rangePendingAmount ?? 0)}
          icon={CreditCard}
          color={(stats?.rangePendingPayments ?? 0) > 0 ? "red" : "blue"}
        />
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="charts">Statistiques</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
            <TabsTrigger value="quick">Accès rapide</TabsTrigger>
          </TabsList>

          {rangeMode === "rolling" && (
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="charts">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-400">CA réservé</h3>
                  <p className="mt-1 text-xs text-zinc-500">Somme des réservations (hors annulations) sur la période</p>
                </div>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.zinc800} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                      tickFormatter={(v: number) => formatPrice(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="CA"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.primary, r: 3 }}
                      activeDot={{ r: 5, fill: CHART_COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <ChartCard
              title={rangeMode === "year" ? "Occupation par mois" : rangeMode === "month" ? "Occupation par semaine" : "Occupation par jour"}
            >
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.zinc800} />
                    <XAxis
                      dataKey="day"
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                      tickFormatter={(v: string) => (/^\d{4}-\d{2}/.test(v) ? formatShortDate(v) : v)}
                    />
                    <YAxis
                      stroke={CHART_COLORS.zinc400}
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: CHART_COLORS.zinc700 }}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      content={<OccupancyTooltip rangeMode={rangeMode} />}
                      contentStyle={{
                        backgroundColor: CHART_COLORS.zinc900,
                        border: `1px solid ${CHART_COLORS.zinc700}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: CHART_COLORS.zinc400 }}
                    />
                    <Bar
                      dataKey="occupancyPct"
                      name="Occupation"
                      fill={CHART_COLORS.primary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Répartition par studio">
              {(() => {
                const totalStudioCount = studioData.reduce((acc, s) => acc + s.count, 0);
                const labels = studioData.map((s) => {
                  const pct = totalStudioCount > 0 ? Math.round((s.count / totalStudioCount) * 100) : 0;
                  return { studio: s.studio, count: s.count, pct };
                });

                return (
                  <div className="h-[280px]">
                    <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-[220px] w-full sm:h-full sm:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={studioData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="studio"
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {studioData.map((s, i) => (
                                <Cell key={s.studio} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<PieTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="w-full sm:w-1/2">
                        <div className="space-y-2">
                          {labels.map((l, i) => (
                            <div key={l.studio} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-sm text-zinc-300">{l.studio}</span>
                              </div>
                              <span className="text-sm text-zinc-200">{l.count} · {l.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </ChartCard>

            <ChartCard title="Méthodes de paiement">
              <div className="h-[280px]">
                {(() => {
                  const totalCount = paymentData.reduce((acc, p) => acc + p.count, 0);
                  const labels = paymentData.map((p) => {
                    const pct = totalCount > 0 ? Math.round((p.count / totalCount) * 100) : 0;
                    return { method: p.method, count: p.count, pct };
                  });

                  return (
                    <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-[220px] w-full sm:h-full sm:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={paymentData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={95}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="method"
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {paymentData.map((p, i) => (
                                <Cell key={p.method} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<PaymentPieTooltip total={totalCount} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="w-full sm:w-1/2">
                        <div className="space-y-2">
                          {labels.map((l, i) => (
                            <div key={l.method} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-sm text-zinc-300">{l.method}</span>
                              </div>
                              <span className="text-sm text-zinc-200">{l.count} · {l.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Calendrier ({rangeTitle})</h2>
                <a href="/admin/calendar" className="text-sm text-primary hover:underline">
                  Ouvrir
                </a>
              </div>

              {activityCalendarView === "day" ? (
                <ActivityCalendarDay
                  dateISO={activityRange.to}
                  bookings={activityCalendarBookings}
                  loading={activityCalendarLoading}
                />
              ) : activityCalendarView === "week" ? (
                <ActivityCalendarWeek
                  fromISO={activityRange.from}
                  toISO={activityRange.to}
                  bookings={activityCalendarBookings}
                  loading={activityCalendarLoading}
                />
              ) : activityCalendarView === "year" ? (
                <ActivityCalendarYear
                  year={parseInt(selectedYear, 10)}
                  rangeFrom={activityRange.from}
                  rangeTo={activityRange.to}
                  bookings={activityCalendarBookings}
                  loading={activityCalendarLoading}
                />
              ) : (
                <ActivityCalendarMonth
                  monthKey={activityCalendarMonth}
                  rangeFrom={activityRange.from}
                  rangeTo={activityRange.to}
                  bookings={activityCalendarBookings}
                  loading={activityCalendarLoading}
                  canPrev={canPrevActivityMonth}
                  canNext={canNextActivityMonth}
                  onPrev={() => setActivityCalendarMonth(prevActivityMonth)}
                  onNext={() => setActivityCalendarMonth(nextActivityMonth)}
                />
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Paiements en attente ({rangeTitle})</h2>
                <a
                  href={`/admin/bookings?dateFrom=${activityRange.from}&dateTo=${activityRange.to}`}
                  className="text-sm text-primary hover:underline"
                >
                  Voir tout
                </a>
              </div>
              <div className="space-y-2">
                {pendingPayments.length === 0 ? (
                  <p className="py-8 text-center text-zinc-500">Aucun paiement en attente</p>
                ) : (
                  pendingPayments.map((payment) => {
                    const studio = payment.studio_id ? STUDIOS[payment.studio_id as keyof typeof STUDIOS] : null;

                    const bookingId = payment.booking_id || payment.id.split(":")[1] || "";
                    const kind: "on-site" | "card" = payment.kind || (payment.id.startsWith("card:") ? "card" : "on-site");
                    const kindLabel = kind === "card" ? "CB (en ligne)" : "Sur place";

                    return (
                      <a
                        key={payment.id}
                        href={bookingId ? `/admin/bookings/${bookingId}` : undefined}
                        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{payment.user_name || "Client inconnu"}</p>
                          <p className="text-sm text-zinc-400">
                            {payment.booking_date ? `${formatDate(payment.booking_date)} · ${payment.start_time}` : "—"}
                            {studio ? ` · ${studio.name}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-yellow-500">{formatPrice(payment.amount)}</p>
                          <p className="text-xs text-zinc-500">{kindLabel}</p>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quick">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-4 font-semibold">Accès rapide</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <a
                href="/admin/calendar"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Calendar className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Calendrier</p>
                  <p className="text-sm text-zinc-400">Vue planning</p>
                </div>
              </a>
              <a
                href="/admin/bookings"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Clock className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Réservations</p>
                  <p className="text-sm text-zinc-400">Gérer les créneaux</p>
                </div>
              </a>
              <a
                href="/admin/blocked-slots"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Ban className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Blocages</p>
                  <p className="text-sm text-zinc-400">Fermetures / Vacances</p>
                </div>
              </a>
              <a
                href="/admin/users"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Clients</p>
                  <p className="text-sm text-zinc-400">Gérer les comptes</p>
                </div>
              </a>
              <a
                href="/admin/equipements"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Building2 className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Studios</p>
                  <p className="text-sm text-zinc-400">Configuration</p>
                </div>
              </a>
              <a
                href="/admin/pricing"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Euro className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Tarifs</p>
                  <p className="text-sm text-zinc-400">Prix des créneaux</p>
                </div>
              </a>
              <a
                href="/admin/settings"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Settings className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Paramètres</p>
                  <p className="text-sm text-zinc-400">Config générale</p>
                </div>
              </a>
              <a
                href="/admin/audit-log"
                className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Journal d'audit</p>
                  <p className="text-sm text-zinc-400">Historique</p>
                </div>
              </a>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
