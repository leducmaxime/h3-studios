"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import {
  TIME_SLOTS,
  MIN_BOOKING_SLOTS,
  isPeakTime,
  formatDate,
  formatDuration,
} from "@/lib/booking";

interface TimeSlotPickerProps {
  date: Date;
  availability: Set<string>;
  startTime: string | null;
  endTime: string | null;
  onSelectRange: (start: string, end: string) => void;
  onClear: () => void;
  onConfirm: () => void;
  onBack: () => void;
  canConfirm: boolean;
}

export function TimeSlotPicker({
  date,
  availability,
  startTime,
  endTime,
  onSelectRange,
  onClear,
  onConfirm,
  onBack,
  canConfirm,
}: TimeSlotPickerProps) {
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [selectingStart, setSelectingStart] = useState(true);

  const isSlotBooked = useCallback(
    (time: string) => {
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability]
  );

  const handleSlotClick = useCallback(
    (time: string) => {
      if (isSlotBooked(time)) return;

      if (selectingStart || !startTime) {
        onSelectRange(time, "");
        setSelectingStart(false);
        setHoverSlot(null);
      } else {
        const startIdx = TIME_SLOTS.indexOf(startTime);
        const clickIdx = TIME_SLOTS.indexOf(time);

        if (clickIdx <= startIdx) {
          onSelectRange(time, "");
          setSelectingStart(false);
        } else {
          const endTimeSlot = TIME_SLOTS[clickIdx + 1] || TIME_SLOTS[clickIdx];
          if (clickIdx - startIdx + 1 >= MIN_BOOKING_SLOTS) {
            onSelectRange(startTime, endTimeSlot);
            setSelectingStart(true);
          }
        }
      }
    },
    [startTime, selectingStart, onSelectRange, isSlotBooked]
  );

  const handleClear = useCallback(() => {
    onClear();
    setSelectingStart(true);
    setHoverSlot(null);
  }, [onClear]);

  const getSlotState = useCallback(
    (time: string, index: number) => {
      const booked = isSlotBooked(time);
      if (booked) return "booked";

      const peak = isPeakTime(date, time);
      const startIdx = startTime ? TIME_SLOTS.indexOf(startTime) : -1;
      const endIdx = endTime ? TIME_SLOTS.indexOf(endTime) : -1;

      if (startIdx !== -1 && endIdx !== -1) {
        if (index >= startIdx && index < endIdx) {
          return peak ? "selected-peak" : "selected";
        }
      } else if (startIdx !== -1 && index === startIdx) {
        return peak ? "start-peak" : "start";
      }

      if (!selectingStart && startTime && hoverSlot) {
        const hoverIdx = TIME_SLOTS.indexOf(hoverSlot);
        if (hoverIdx > startIdx && index >= startIdx && index <= hoverIdx) {
          return peak ? "preview-peak" : "preview";
        }
      }

      return peak ? "available-peak" : "available";
    },
    [date, startTime, endTime, hoverSlot, selectingStart, isSlotBooked]
  );

  const morningSlots = TIME_SLOTS.slice(0, 8);
  const afternoonSlots = TIME_SLOTS.slice(8, 18);
  const eveningSlots = TIME_SLOTS.slice(18);

  const slotGroups = [
    { label: "Matin", slots: morningSlots, startIndex: 0 },
    { label: "Après-midi", slots: afternoonSlots, startIndex: 8 },
    { label: "Soir", slots: eveningSlots, startIndex: 18 },
  ];

  const selectedDuration = useMemo(() => {
    if (startTime && endTime) {
      return formatDuration(startTime, endTime);
    }
    return null;
  }, [startTime, endTime]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-lg font-semibold capitalize">{formatDate(date)}</h3>
          <p className="text-sm text-white/60">
            {selectingStart
              ? "Cliquez sur l'heure de début"
              : "Cliquez sur l'heure de fin (min. 1h)"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {slotGroups.map(({ label, slots, startIndex }) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/70">{label}</span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {slots.map((time, i) => {
                const globalIndex = startIndex + i;
                const state = getSlotState(time, globalIndex);
                
                return (
                  <button
                    key={time}
                    onClick={() => handleSlotClick(time)}
                    onMouseEnter={() => !selectingStart && setHoverSlot(time)}
                    onMouseLeave={() => setHoverSlot(null)}
                    disabled={state === "booked"}
                    className={`
                      relative rounded px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-all
                      ${state === "booked" 
                        ? "bg-white/10 text-white/30 cursor-not-allowed line-through" 
                        : ""
                      }
                      ${state === "available" 
                        ? "bg-white/10 hover:bg-white/20 text-white" 
                        : ""
                      }
                      ${state === "available-peak" 
                        ? "bg-primary/20 hover:bg-primary/30 text-primary" 
                        : ""
                      }
                      ${state === "selected" || state === "start"
                        ? "bg-primary text-black" 
                        : ""
                      }
                      ${state === "selected-peak" || state === "start-peak"
                        ? "bg-primary text-black ring-2 ring-primary ring-offset-1 ring-offset-black" 
                        : ""
                      }
                      ${state === "preview" 
                        ? "bg-primary/40 text-white" 
                        : ""
                      }
                      ${state === "preview-peak" 
                        ? "bg-primary/50 text-black" 
                        : ""
                      }
                    `}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-white/60">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-white/10" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-primary/20" />
          <span>Pointe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-white/10 line-through" />
          <span>Réservé</span>
        </div>
      </div>

      {startTime && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/50 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-white/70">Votre sélection</span>
              <div className="text-lg font-semibold">
                {startTime} - {endTime || "..."}
                {selectedDuration && (
                  <span className="ml-2 text-primary">({selectedDuration})</span>
                )}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="rounded px-3 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Effacer
            </button>
          </div>
          
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`
              w-full rounded-lg py-3 font-semibold transition-all
              ${canConfirm
                ? "bg-primary text-black hover:bg-primary/90"
                : "bg-white/10 text-white/50 cursor-not-allowed"
              }
            `}
          >
            {canConfirm ? "Choisir ce créneau →" : "Sélectionnez l'heure de fin"}
          </button>
        </div>
      )}
    </div>
  );
}
