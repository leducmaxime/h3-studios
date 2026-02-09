"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import {
  ALL_TIME_SLOTS,
  getStudioTimeSlots,
  getUnionTimeSlots,
  getStudioClosingTime,
  isPeakTime,
  formatDate,
  PRICING,
  formatPrice,
  calculatePrice,
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

const DURATION_OPTIONS = [
  { label: "1h", slots: 2 },
  { label: "1h30", slots: 3 },
  { label: "2h", slots: 4 },
  { label: "2h30", slots: 5 },
  { label: "3h", slots: 6 },
  { label: "4h", slots: 8 },
];

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
    },
    [selectedDuration, onSelectRange, canStartAt, getEndTime, visibleSlots]
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

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

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

  const priceBreakdown = useMemo(() => {
    if (!startTime || !endTime) return null;
    
    if (studioFilter) {
      const price = calculatePrice(studioFilter, groupType, date, startTime, endTime);
      const totalSlots = price.breakdown.length;
      const offPeakRate = PRICING[studioFilter][groupType].offPeak;
      const peakRate = PRICING[studioFilter][groupType].peak;

      if (!hasPeakPricing) {
        // Solo/duo: flat rate, show all hours as one line
        return {
          total: price.total,
          offPeakHours: totalSlots * 0.5,
          peakHours: 0,
          offPeakRate,
          peakRate,
          offPeakSubtotal: price.total,
          peakSubtotal: 0,
          isRange: false,
        };
      }

      const offPeakSlots = price.breakdown.filter((s) => !s.isPeak).length;
      const peakSlots = price.breakdown.filter((s) => s.isPeak).length;
      
      return {
        total: price.total,
        offPeakHours: offPeakSlots * 0.5,
        peakHours: peakSlots * 0.5,
        offPeakRate,
        peakRate,
        offPeakSubtotal: offPeakSlots * 0.5 * offPeakRate,
        peakSubtotal: peakSlots * 0.5 * peakRate,
        isRange: false,
      };
    }
    
    const scenePrice = calculatePrice("la-scene", groupType, date, startTime, endTime);
    const podiumPrice = calculatePrice("le-podium", groupType, date, startTime, endTime);
    return {
      total: Math.min(scenePrice.total, podiumPrice.total),
      totalMax: Math.max(scenePrice.total, podiumPrice.total),
      isRange: true,
    };
  }, [startTime, endTime, groupType, date, studioFilter, hasPeakPricing]);

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
    ? DURATION_OPTIONS.find(d => d.slots === selectedDuration)?.label || "2h"
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
            <p className="text-sm text-white/60">
              Choisissez la durée puis l'heure de début
            </p>
          </div>
        </div>
      )}

      {hideHeader && (
        <p className="text-sm text-white/60">
          Choisissez la durée puis l'heure de début
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/70">Durée de la répétition</span>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map(({ label, slots }) => (
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
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/70">
          {durationLabel ? `Heure de début (pour ${durationLabel})` : "Choisissez d'abord une durée"}
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
            
            return (
              <button
                key={time}
                onClick={() => isClickable && handleSlotClick(time)}
                disabled={!isClickable}
                className={`
                  relative rounded-lg px-3 py-2.5 text-sm font-medium transition-all min-w-[70px]
                  ${isBooked
                    ? "bg-red-500/10 text-red-400/50 cursor-not-allowed line-through border border-red-500/20" 
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
                    ? "bg-primary/10 hover:bg-primary/20 text-primary/70 border border-primary/20 cursor-pointer" 
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
                <span className="block">{time}</span>
                {canStart && !isSelected && (
                  <span className={`block text-[10px] mt-0.5 ${peak ? "text-primary/50" : "text-white/40"}`}>
                    → {formatEndTime(time)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-white/60">
        {hasPeakPricing ? (
          <>
            {hasAnyOffPeakSlot && (
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded border border-white/10 bg-white/10" />
                <span>
                  {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                    ? `${hourlyRates.offPeakMin}€/h`
                    : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border border-primary/20 bg-primary/10" />
              <span className="text-primary/70">
                {!hasAnyOffPeakSlot ? "Soir, week-end & jour férié " : (date.getDay() === 0 || date.getDay() === 6) ? "Weekend & jour férié " : "Soir, week-end & jour férié "}
                {hourlyRates.peakMin === hourlyRates.peakMax
                  ? `${hourlyRates.peakMin}€/h`
                  : `${hourlyRates.peakMin}-${hourlyRates.peakMax}€/h`}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded border border-white/10 bg-white/10" />
            <span>
              {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                ? `${hourlyRates.offPeakMin}€/h`
                : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded border border-red-500/20 bg-red-500/10 line-through text-[8px] text-red-400/50 flex items-center justify-center">×</div>
          <span>Réservé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded border border-dashed border-white/10 bg-white/5" />
          <span>Durée insuffisante</span>
        </div>
      </div>

      {startTime && endTime && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/50 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-white/70">Votre sélection</span>
              <div className="text-lg font-semibold">
                {startTime} - {endTime}
                {durationLabel && <span className="ml-2 text-primary">({durationLabel})</span>}
              </div>
            </div>
            <button
              onClick={handleClear}
              className="rounded px-3 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              Effacer
            </button>
          </div>

          {priceBreakdown && (
            <div className="flex flex-col gap-2 rounded-md bg-black/30 px-3 py-2">
              {priceBreakdown.isRange ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Estimation</span>
                  <span className="text-lg font-bold text-primary">
                    {priceBreakdown.total === priceBreakdown.totalMax
                      ? formatPrice(priceBreakdown.total)
                      : `${formatPrice(priceBreakdown.total)} - ${formatPrice(priceBreakdown.totalMax!)}`}
                  </span>
                </div>
              ) : (
                <>
                  {priceBreakdown.offPeakHours! > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">
                        {priceBreakdown.offPeakHours}h × {priceBreakdown.offPeakRate}€/h
                      </span>
                      <span className="text-white">{formatPrice(priceBreakdown.offPeakSubtotal!)}</span>
                    </div>
                  )}
                  {priceBreakdown.peakHours! > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary/80">
                        {priceBreakdown.peakHours}h × {priceBreakdown.peakRate}€/h (soir, week-end & jour férié)
                      </span>
                      <span className="text-primary">{formatPrice(priceBreakdown.peakSubtotal!)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(priceBreakdown.total)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          
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
            Choisir ce créneau →
          </button>
        </div>
      )}
    </div>
  );
}
