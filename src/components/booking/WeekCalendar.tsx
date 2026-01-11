"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAvailableRanges, type StudioId } from "@/lib/booking";

interface WeekCalendarProps {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
  studioFilter?: StudioId | null;
}

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function getWeekDates(startOfWeek: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
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
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  
  const startOfCurrentWeek = useMemo(() => getStartOfWeek(today), []);
  
  const weekStart = useMemo(() => {
    const d = new Date(startOfCurrentWeek);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset, startOfCurrentWeek]);
  
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

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
    if (weekOffset > 0) setWeekOffset((w) => w - 1);
  };

  const goToNextWeek = () => {
    if (weekOffset < 8) setWeekOffset((w) => w + 1); // ~2 months = 8 weeks
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          disabled={weekOffset === 0}
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
          disabled={weekOffset >= 8}
          className="rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const dayOfWeek = date.getDay();
          const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0 index
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
                  ? "bg-primary text-black ring-2 ring-primary ring-offset-2 ring-offset-black" 
                  : ""
                }
                ${todayDate && !selected 
                  ? "ring-2 ring-white/50" 
                  : ""
                }
              `}
            >
              <span className={`text-xs font-medium mb-1 ${selected ? "text-black/60" : "text-white/50"}`}>
                {DAYS_FR[dayIndex]}
              </span>
              <span className={`text-2xl font-bold ${selected ? "text-black" : ""}`}>
                {date.getDate()}
              </span>
              {!disabled && hasAvailability && (
                <span className={`text-xs mt-1 ${selected ? "text-black/60" : "text-white/40"}`}>
                  {ranges.length} dispo
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-white/60">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded ring-2 ring-white/50" />
          <span>Aujourd'hui</span>
        </div>
      </div>
    </div>
  );
}
