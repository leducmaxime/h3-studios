"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ALL_TIME_SLOTS,
  getStudioTimeSlots,
  MIN_BOOKING_SLOTS,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type OccupancyInfo,
  isSlotAvailable,
} from "@/lib/booking";
import { formatDateISO } from "@/lib/utils";

interface WeekCalendarProps {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
  studioFilter?: StudioId | null;
  groupType?: GroupType | null;
  cart?: CompletedBooking[];
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function getSlidingWeekDates(baseDate: Date, dayOffset: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(baseDate.getDate() + dayOffset + i);
    dates.push(d);
  }
  return dates;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate < today;
}

function isTooFarInFuture(date: Date): boolean {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 2);
  return date > maxDate;
}

function formatWeekRange(dates: Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];

  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${MONTHS_FR[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${MONTHS_FR[first.getMonth()]} - ${last.getDate()} ${MONTHS_FR[last.getMonth()]} ${first.getFullYear()}`;
}

function getCartOccupancy(cart: CompletedBooking[], dateStr: string): Set<OccupancyInfo> {
  const set = new Set<OccupancyInfo>();
  for (const booking of cart) {
    const d = booking.date instanceof Date ? booking.date : new Date(booking.date);
    const bookingDateStr = formatDateISO(d);
    if (bookingDateStr !== dateStr) continue;
    const startIdx = ALL_TIME_SLOTS.indexOf(booking.startTime);
    let endIdx = ALL_TIME_SLOTS.indexOf(booking.endTime);
    if (endIdx === -1 && booking.endTime === "00:00") endIdx = ALL_TIME_SLOTS.length;
    if (startIdx === -1 || endIdx === -1) continue;
    for (let i = startIdx; i < endIdx; i++) {
      set.add({ studioId: booking.studioId, time: ALL_TIME_SLOTS[i], groupType: booking.groupType });
    }
  }
  return set;
}

/**
 * Check if a date has at least MIN_BOOKING_SLOTS consecutive available slots.
 * Uses the unified availability engine with "solo" groupType (most restrictive)
 * to ensure we never show a day as available when it can't actually be booked.
 */
function hasBookableAvailability(
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId | null
): boolean {
  const studios: StudioId[] = studioFilter ? [studioFilter] : ["la-scene", "le-podium"];

  for (const studioId of studios) {
    const slots = getStudioTimeSlots(studioId, date);
    let consecutive = 0;

    for (const time of slots) {
      // Use "solo" as the most restrictive check — no displacement allowed
      const available = isSlotAvailable(time, "solo", occupancy, date, studioId);
      consecutive = available ? consecutive + 1 : 0;
      if (consecutive >= MIN_BOOKING_SLOTS) return true;
    }
  }

  return false;
}

export function WeekCalendar({ onSelectDate, selectedDate, studioFilter, groupType, cart = [] }: WeekCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [dayOffset, setDayOffset] = useState(0);
  const [weekOccupancy, setWeekOccupancy] = useState<Map<string, Set<OccupancyInfo>>>(new Map());

  const weekDates = useMemo(() => getSlidingWeekDates(today, dayOffset), [dayOffset, today]);

  const maxDayOffset = 60; // ~2 months

  useEffect(() => {
    setWeekOccupancy(new Map());
    weekDates.forEach((date) => {
      if (isPast(date) || isTooFarInFuture(date)) return;
      const dateStr = formatDateISO(date);
      fetch(`/api/availability?date=${dateStr}&groupType=${groupType || "solo"}`)
        .then((res) => res.json())
        .then((data: unknown) => {
          const json = data as { success: boolean; data: { slots: Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>>; minAdvanceHours: number; minAdvanceCutoffTime: string | null } };
          if (json.success && json.data) {
            // Convert new per-studio format to OccupancyInfo set (only occupied slots)
            const occupancy = new Set<OccupancyInfo>();
            for (const [studioId, slots] of Object.entries(json.data.slots)) {
              for (const slot of slots) {
                if (!slot.available) {
                  occupancy.add({
                    studioId: studioId as StudioId,
                    time: slot.time,
                    groupType: slot.groupType as GroupType | "blocked" | undefined,
                    bookingId: slot.bookingId,
                  });
                }
              }
            }
            setWeekOccupancy((prev) => new Map(prev).set(dateStr, occupancy));
          }
        })
        .catch(console.error);
    });
  }, [weekDates]);

  const goToPreviousWeek = () => {
    setDayOffset((d) => Math.max(0, d - 7));
  };

  const goToNextWeek = () => {
    setDayOffset((d) => Math.min(maxDayOffset, d + 7));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          disabled={dayOffset === 0}
          className="rounded-full p-2 transition-colors hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <span className="text-lg font-semibold text-center">
          {formatWeekRange(weekDates)}
        </span>
        
        <button
          onClick={goToNextWeek}
          disabled={dayOffset >= maxDayOffset}
          className="rounded-full p-2 transition-colors hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {weekDates.map((date) => {
          const dateKey = formatDateISO(date);
          const dayIndex = date.getDay();
          const past = isPast(date);
          const tooFar = isTooFarInFuture(date);
          const todayDate = isToday(date);
          const selected = selectedDate && isSameDay(date, selectedDate);
          const apiOccupancy = weekOccupancy.get(dateKey) ?? new Set<OccupancyInfo>();
          const cartOccupancyForDate = getCartOccupancy(cart, dateKey);
          const merged = new Set<OccupancyInfo>([...apiOccupancy, ...cartOccupancyForDate]);
          const hasAvailability = hasBookableAvailability(merged, date, studioFilter);
          const isFull = !past && !tooFar && !hasAvailability;
          const disabled = past || tooFar || !hasAvailability;

          return (
            <button
              key={date.toISOString()}
              onClick={() => !disabled && onSelectDate(date)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center rounded-lg lg:rounded-xl p-1.5 lg:p-3 min-h-[72px] lg:min-h-[100px] transition-all
                ${past || tooFar
                  ? "opacity-30 cursor-not-allowed bg-white/15"
                  : isFull
                    ? "opacity-70 cursor-not-allowed bg-white/15"
                    : "hover:bg-primary/20 cursor-pointer bg-white/15"
                }
                ${selected
                  ? "ring-2 ring-primary ring-offset-1 lg:ring-offset-2 ring-offset-black bg-primary/20 text-primary"
                  : ""
                }
                ${todayDate && !selected
                  ? "ring-2 ring-white/50"
                  : ""
                }
              `}
            >
              <span className={`text-[10px] lg:text-xs font-medium mb-0.5 lg:mb-1 ${selected ? "text-primary/70" : "text-white/50"}`}>
                {DAYS_FR[dayIndex]}
              </span>
              <span className={`text-lg lg:text-2xl font-bold ${selected ? "text-primary" : ""}`}>
                {date.getDate()}
              </span>
              <span className={`text-[9px] lg:text-xs mt-0.5 lg:mt-1 ${
                past || tooFar
                  ? "text-white/30"
                  : isFull
                    ? "text-red-400"
                    : selected
                      ? "text-primary/70"
                      : "text-emerald-400/80"
              }`}>
                <span className="lg:hidden">
                  {past || tooFar ? "" : isFull ? "Complet" : "Dispo"}
                </span>
                <span className="hidden lg:inline">
                  {past || tooFar ? "" : isFull ? "Complet" : "Disponible"}
                </span>
              </span>
            </button>
          );
        })}
      </div>


    </div>
  );
}
