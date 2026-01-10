"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekCalendarProps {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
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

export function WeekCalendar({ onSelectDate, selectedDate }: WeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  
  const weekDates = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekDates(base);
  }, [weekOffset]);

  const weekRange = useMemo(() => {
    const first = weekDates[0];
    const last = weekDates[6];
    
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} - ${last.getDate()} ${MONTHS_FR[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${first.getDate()} ${MONTHS_FR[first.getMonth()]} - ${last.getDate()} ${MONTHS_FR[last.getMonth()]} ${last.getFullYear()}`;
  }, [weekDates]);

  const goToPreviousWeek = () => {
    if (weekOffset > 0) setWeekOffset((w) => w - 1);
  };

  const goToNextWeek = () => {
    if (weekOffset < 8) setWeekOffset((w) => w + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          disabled={weekOffset === 0}
          className="rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <span className="text-lg font-semibold">{weekRange}</span>
        
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
          const past = isPast(date);
          const today = isToday(date);
          const selected = selectedDate && isSameDay(date, selectedDate);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => !past && onSelectDate(date)}
              disabled={past}
              className={`
                flex flex-col items-center gap-1 rounded-lg p-2 sm:p-3 transition-all
                ${past 
                  ? "opacity-40 cursor-not-allowed bg-white/5" 
                  : "hover:bg-primary/20 cursor-pointer"
                }
                ${selected 
                  ? "bg-primary text-black ring-2 ring-primary ring-offset-2 ring-offset-black" 
                  : ""
                }
                ${today && !selected 
                  ? "ring-2 ring-white/50" 
                  : ""
                }
                ${isWeekend && !selected && !past
                  ? "bg-primary/10" 
                  : ""
                }
              `}
            >
              <span className="text-xs sm:text-sm font-medium opacity-70">
                {DAYS_FR[date.getDay()]}
              </span>
              <span className={`text-lg sm:text-2xl font-bold ${selected ? "text-black" : ""}`}>
                {date.getDate()}
              </span>
              {isWeekend && !past && (
                <span className={`text-[10px] sm:text-xs ${selected ? "text-black/70" : "text-primary"}`}>
                  Pointe
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-white/60">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-primary/10" />
          <span>Week-end (tarif pointe)</span>
        </div>
      </div>
    </div>
  );
}
