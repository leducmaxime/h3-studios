"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAvailableRanges, type StudioId } from "@/lib/booking";

interface WeekCalendarProps {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
  studioFilter?: StudioId | null;
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
  return `${first.getDate()} ${MONTHS_FR[first.getMonth()]} - ${last.getDate()} ${MONTHS_FR[last.getMonth()]} ${last.getFullYear()}`;
}

export function WeekCalendar({ onSelectDate, selectedDate, studioFilter }: WeekCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [dayOffset, setDayOffset] = useState(0);

  const weekDates = useMemo(() => getSlidingWeekDates(today, dayOffset), [dayOffset, today]);

  const maxDayOffset = 60; // ~2 months

  const availabilityMap = useMemo(() => {
    const map = new Map<string, string[]>();
    weekDates.forEach((date) => {
      if (isPast(date) || isTooFarInFuture(date)) return;
      const key = date.toISOString().split("T")[0];
      map.set(key, getAvailableRanges(date, studioFilter));
    });
    return map;
  }, [weekDates, studioFilter]);

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
          className="rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
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
          className="rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const dayIndex = date.getDay();
          const past = isPast(date);
          const tooFar = isTooFarInFuture(date);
          const todayDate = isToday(date);
          const selected = selectedDate && isSameDay(date, selectedDate);
          const ranges = availabilityMap.get(dateKey) || [];
          const hasAvailability = ranges.length > 0;
          const disabled = past || tooFar || !hasAvailability;
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => !disabled && onSelectDate(date)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center rounded-xl p-3 min-h-[100px] transition-all
                ${disabled
                  ? "opacity-30 cursor-not-allowed bg-white/5" 
                  : "hover:bg-primary/20 cursor-pointer bg-white/10"
                }
                ${selected 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-black bg-primary/20 text-primary" 
                  : ""
                }
                ${todayDate && !selected 
                  ? "ring-2 ring-white/50" 
                  : ""
                }
              `}
            >
              <span className={`text-xs font-medium mb-1 ${selected ? "text-primary/70" : "text-white/50"}`}>
                {DAYS_FR[dayIndex]}
              </span>
              <span className={`text-2xl font-bold ${selected ? "text-primary" : ""}`}>
                {date.getDate()}
              </span>
              <span className={`text-xs mt-1 ${
                disabled
                  ? "text-white/30"
                  : selected
                    ? "text-primary/70"
                    : "text-emerald-400/80"
              }`}>
                {disabled ? "Complet" : "Disponible"}
              </span>
            </button>
          );
        })}
      </div>


    </div>
  );
}
