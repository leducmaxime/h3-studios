"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import {
  getStudioTimeSlots,
  getUnionTimeSlots,
  getStudioClosingTime,
  isPeakTime,
  formatDate,
  PRICING,
  type GroupType,
  type StudioId,
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
  studioFilter?: StudioId;
  hideHeader?: boolean;
  groupType?: GroupType;
}

const DURATION_OPTIONS_MAIN = [
  { label: "1h", slots: 2 },
  { label: "1h30", slots: 3 },
  { label: "2h", slots: 4 },
  { label: "2h30", slots: 5 },
  { label: "3h", slots: 6 },
  { label: "3h30", slots: 7 },
  { label: "4h", slots: 8 },
  { label: "4h30", slots: 9 },
  { label: "5h", slots: 10 },
  { label: "5h30", slots: 11 },
  { label: "6h", slots: 12 },
];

const DURATION_OPTIONS_EXTRA = [
  { label: "6h30", slots: 13 },
  { label: "7h", slots: 14 },
  { label: "7h30", slots: 15 },
  { label: "8h", slots: 16 },
  { label: "8h30", slots: 17 },
  { label: "9h", slots: 18 },
  { label: "9h30", slots: 19 },
  { label: "10h", slots: 20 },
  { label: "10h30", slots: 21 },
  { label: "11h", slots: 22 },
  { label: "11h30", slots: 23 },
  { label: "12h", slots: 24 },
  { label: "12h30", slots: 25 },
  { label: "13h", slots: 26 },
  { label: "13h30", slots: 27 },
  { label: "14h", slots: 28 },
];

const ALL_DURATION_OPTIONS = [...DURATION_OPTIONS_MAIN, ...DURATION_OPTIONS_EXTRA];

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
  studioFilter,
  hideHeader = false,
  groupType = "group",
}: TimeSlotPickerProps) {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [showMoreDurations, setShowMoreDurations] = useState(false);

  // Solo/duo have flat pricing (no peak/off-peak distinction)
  const hasPeakPricing = groupType === "group";

  // Per-studio time slots based on studio + day
  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  // Closing time for end-time computation
  const closingTime = useMemo(() => {
    if (studioFilter) {
      return getStudioClosingTime(studioFilter, date);
    }
    // When no studio selected, use the latest closing time across all studios
    const sceneClose = getStudioClosingTime("la-scene", date);
    const podiumClose = getStudioClosingTime("le-podium", date);
    // "00:00" is midnight = latest
    if (sceneClose === "00:00" || podiumClose === "00:00") return "00:00";
    return sceneClose > podiumClose ? sceneClose : podiumClose;
  }, [studioFilter, date]);

  const isSlotBooked = useCallback(
    (time: string) => {
      if (studioFilter) {
        return availability.has(`${studioFilter}-${time}`);
      }
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability, studioFilter]
  );

  const canStartAt = useCallback(
    (startIdx: number): boolean => {
      if (selectedDuration === null) return false;
      const endIdx = startIdx + selectedDuration;
      if (endIdx > visibleSlots.length) return false;
      
      for (let i = startIdx; i < endIdx; i++) {
        if (isSlotBooked(visibleSlots[i])) return false;
      }
      return true;
    },
    [selectedDuration, isSlotBooked, visibleSlots]
  );

  const getEndTime = (startIdx: number): string => {
    if (selectedDuration === null) return closingTime;
    const endIdx = startIdx + selectedDuration;
    if (endIdx >= visibleSlots.length) return closingTime;
    return visibleSlots[endIdx];
  };

  const handleSlotClick = useCallback(
    (time: string) => {
      const startIdx = visibleSlots.indexOf(time);
      if (!canStartAt(startIdx)) return;
      
      const endTimeSlot = getEndTime(startIdx);
      onSelectRange(time, endTimeSlot);
      // Auto-confirm immediately after selecting a time slot
      onConfirm();
    },
    [selectedDuration, onSelectRange, onConfirm, canStartAt, getEndTime, visibleSlots]
  );

  const isWithinCurrentSelection = useCallback(
    (index: number): boolean => {
      if (!startTime || !endTime) return false;
      const selectedStartIdx = visibleSlots.indexOf(startTime);
      let selectedEndIdx = visibleSlots.indexOf(endTime);
      if (selectedEndIdx === -1) selectedEndIdx = visibleSlots.length;
      return index >= selectedStartIdx && index < selectedEndIdx;
    },
    [startTime, endTime, visibleSlots]
  );

  const getSlotState = useCallback(
    (time: string, index: number) => {
      const booked = isSlotBooked(time);
      if (booked) return "booked";

      const canStart = canStartAt(index);
      const peak = hasPeakPricing && isPeakTime(date, time);
      
      if (startTime && endTime) {
        const selectedStartIdx = visibleSlots.indexOf(startTime);
        let selectedEndIdx = visibleSlots.indexOf(endTime);
        if (selectedEndIdx === -1) selectedEndIdx = visibleSlots.length;
        if (index >= selectedStartIdx && index < selectedEndIdx) {
          return peak ? "selected-peak" : "selected";
        }
      }

      if (!canStart) return "unavailable-duration";
      return peak ? "available-peak" : "available";
    },
    [date, startTime, endTime, isSlotBooked, canStartAt, hasPeakPricing, visibleSlots]
  );

  const formatEndTime = (start: string): string => {
    const startIdx = visibleSlots.indexOf(start);
    return getEndTime(startIdx);
  };

  const hourlyRates = useMemo(() => {
    if (studioFilter) {
      const offPeak = PRICING[studioFilter][groupType].offPeak;
      const peak = PRICING[studioFilter][groupType].peak;
      return { offPeakMin: offPeak, offPeakMax: offPeak, peakMin: peak, peakMax: peak };
    }
    
    const offPeakMin = Math.min(
      PRICING["la-scene"][groupType].offPeak,
      PRICING["le-podium"][groupType].offPeak
    );
    const offPeakMax = Math.max(
      PRICING["la-scene"][groupType].offPeak,
      PRICING["le-podium"][groupType].offPeak
    );
    const peakMin = Math.min(
      PRICING["la-scene"][groupType].peak,
      PRICING["le-podium"][groupType].peak
    );
    const peakMax = Math.max(
      PRICING["la-scene"][groupType].peak,
      PRICING["le-podium"][groupType].peak
    );
    return { offPeakMin, offPeakMax, peakMin, peakMax };
  }, [groupType, studioFilter]);

  // Check if any visible slot is off-peak (to decide whether to show the off-peak legend)
  const hasAnyOffPeakSlot = useMemo(() => {
    return visibleSlots.some((time) => !isPeakTime(date, time));
  }, [visibleSlots, date]);

  const durationLabel = selectedDuration !== null
    ? ALL_DURATION_OPTIONS.find(d => d.slots === selectedDuration)?.label || "2h"
    : null;

  return (
    <div className="flex flex-col gap-4">
      {!hideHeader && (
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
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/70">Durée de la répétition</span>
        <div className="flex flex-wrap gap-2">
          {(showMoreDurations ? ALL_DURATION_OPTIONS : DURATION_OPTIONS_MAIN).map(({ label, slots }) => (
            <button
              key={slots}
              onClick={() => {
                setSelectedDuration(slots);
                onClear();
              }}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all text-sm
                ${selectedDuration === slots
                  ? "bg-primary text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
                }
              `}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowMoreDurations(!showMoreDurations)}
            className="flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all text-sm bg-white/10 hover:bg-white/20"
          >
            <span className="text-lg font-bold text-primary">{showMoreDurations ? "−" : "+"}</span>
          </button>
        </div>
      </div>

      {selectedDuration !== null && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-white/70">
            Heure de début (pour {durationLabel})
          </span>
          <div className="flex flex-wrap gap-2">
            {visibleSlots.map((time: string, index: number) => {
              const state = getSlotState(time, index);
              const canStart = canStartAt(index);
              const withinSelection = isWithinCurrentSelection(index);
              const isClickable = canStart || withinSelection;
              const isSelected = state === "selected" || state === "selected-peak";
              const isBooked = state === "booked";
              const isUnavailableDuration = state === "unavailable-duration";
              const peak = hasPeakPricing && isPeakTime(date, time);
              
              const getDisabledReason = (): string | null => {
                if (isBooked) return "Ce créneau est déjà réservé";
                if (isUnavailableDuration && selectedDuration !== null) {
                  const endIdx = index + selectedDuration;
                  if (endIdx > visibleSlots.length) {
                    return `Ce créneau dépasse l'heure de fermeture (${closingTime})`;
                  }
                  for (let i = index; i < endIdx; i++) {
                    if (isSlotBooked(visibleSlots[i])) {
                      return "Un créneau dans cette plage est déjà réservé";
                    }
                  }
                }
                return null;
              };
              const disabledReason = getDisabledReason();

              return (
                <button
                  key={time}
                  onClick={() => isClickable && handleSlotClick(time)}
                  disabled={!isClickable}
                  title={disabledReason || undefined}
                  aria-label={disabledReason ? `${time} — ${disabledReason}` : undefined}
                  className={`
                    relative rounded-lg px-3 py-2 text-sm font-medium transition-all min-w-[70px]
                    ${isBooked
                      ? "bg-red-500/10 text-red-400/50 cursor-not-allowed border border-red-500/20" 
                      : ""
                    }
                    ${isUnavailableDuration
                      ? "bg-white/5 text-white/30 cursor-not-allowed border border-dashed border-white/10" 
                      : ""
                    }
                    ${canStart && !isSelected && !peak
                      ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer" 
                      : ""
                    }
                    ${canStart && !isSelected && peak
                      ? "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer" 
                      : ""
                    }
                    ${isSelected && !peak
                      ? "bg-white text-black border-2 border-white cursor-pointer hover:bg-white/80" 
                      : ""
                    }
                    ${isSelected && peak
                      ? "bg-primary text-black border-2 border-primary cursor-pointer hover:bg-primary/80" 
                      : ""
                    }
                  `}
                >
                  {isBooked ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="text-red-400 text-xs">×</span>
                      <span className="line-through">{time}</span>
                    </span>
                  ) : (
                    <>
                      <span className="block">{time}</span>
                      {canStart && !isSelected && (
                        <span className={`block text-[10px] mt-0.5 ${peak ? "text-primary/60" : "text-white/40"}`}>
                          {peak && <span className="font-semibold">⚡ </span>}
                          {hourlyRates.peakMin}€/h → {formatEndTime(time)}
                        </span>
                      )}
                      {!canStart && isUnavailableDuration && (
                        <span className="block text-[9px] mt-0.5 text-white/20">durée insuff.</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-white/60">
            {hasPeakPricing ? (
              <>
                {hasAnyOffPeakSlot && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded border border-white/10 bg-white/10 flex items-center justify-center text-[9px] text-white/50">18</div>
                    <span>
                      {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                        ? `${hourlyRates.offPeakMin}€/h`
                        : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded border border-primary/20 bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] text-primary">⚡</span>
                  </div>
                  <span className="text-primary">
                    {hourlyRates.peakMin === hourlyRates.peakMax
                      ? `${hourlyRates.peakMin}€/h`
                      : `${hourlyRates.peakMin}-${hourlyRates.peakMax}€/h`}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded border border-white/10 bg-white/10 flex items-center justify-center text-[9px] text-white/50">18</div>
                <span>
                  {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                    ? `${hourlyRates.offPeakMin}€/h`
                    : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded border border-red-500/20 bg-red-500/10 flex items-center justify-center gap-0.5 text-[8px] text-red-400/50">
                <span>×</span>
                <span className="line-through">18</span>
              </div>
              <span>Réservé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center">
                <span className="text-[8px] text-white/30">18</span>
                <span className="text-[6px] text-white/20 leading-none">insuff.</span>
              </div>
              <span>Durée insuffisante</span>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
