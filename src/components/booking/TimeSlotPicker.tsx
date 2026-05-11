"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft, Clock, Zap, ArrowRight } from "lucide-react";
import {
  getStudioTimeSlots,
  getUnionTimeSlots,
  getStudioClosingTime,
  isPeakTime,
  formatDate,
  formatPrice,
  calculatePrice,
  PRICING,
  ALL_TIME_SLOTS,
  canBeStartTime,
  canBeEndTime,
  type GroupType,
  type StudioId,
  type OccupancyInfo,
} from "@/lib/booking";

interface TimeSlotPickerProps {
  date: Date;
  availability: Set<string> | Set<OccupancyInfo>;
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
  const [selectionMode, setSelectionMode] = useState<"start" | "end" | "done">(
    startTime && endTime ? "done" : "start"
  );
  const [selectedStart, setSelectedStart] = useState<string | null>(startTime);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(endTime);
  const [hoveredEndSlot, setHoveredEndSlot] = useState<string | null>(null);

  const hasPeakPricing = groupType === "group";

  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  const closingTime = useMemo(() => {
    if (studioFilter) {
      return getStudioClosingTime(studioFilter, date);
    }
    const sceneClose = getStudioClosingTime("la-scene", date);
    const podiumClose = getStudioClosingTime("le-podium", date);
    if (sceneClose === "00:00" || podiumClose === "00:00") return "00:00";
    return sceneClose > podiumClose ? sceneClose : podiumClose;
  }, [studioFilter, date]);

  const occupancyArray = useMemo(() => {
    const items = Array.from(availability as Set<unknown>);
    return items
      .map((item): OccupancyInfo | null => {
        if (typeof item === "string") {
          const [studioId, time] = item.split("-");
          if (studioId && time) {
            return { studioId: studioId as StudioId, time, groupType: "blocked" };
          }
          return null;
        }
        return item as OccupancyInfo;
      })
      .filter((item): item is OccupancyInfo => item !== null);
  }, [availability]);

  const isOccupiedBy = useCallback(
    (studioId: StudioId, time: string): OccupancyInfo | null => {
      return occupancyArray.find((item) => item.studioId === studioId && item.time === time) || null;
    },
    [occupancyArray]
  );

  const isSlotBooked = useCallback(
    (time: string): boolean => {
      if (studioFilter) {
        const occupant = isOccupiedBy(studioFilter, time);
        if (!occupant) return false;
        if (groupType !== "group") {
          return occupant.groupType === "group" || occupant.groupType === "blocked";
        }
        return true;
      }
      const sceneOccupant = isOccupiedBy("la-scene", time);
      const podiumOccupant = isOccupiedBy("le-podium", time);

      if (groupType !== "group") {
        const sceneBlocked = sceneOccupant && (sceneOccupant.groupType === "group" || sceneOccupant.groupType === "blocked");
        const podiumBlocked = podiumOccupant && (podiumOccupant.groupType === "group" || podiumOccupant.groupType === "blocked");
        return !!(sceneBlocked && podiumBlocked);
      }
      const sceneBooked = !!sceneOccupant;
      const podiumBooked = !!podiumOccupant;
      return sceneBooked && podiumBooked;
    },
    [isOccupiedBy, studioFilter, groupType]
  );

  const handleClear = useCallback(() => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setSelectionMode("start");
    onClear();
  }, [onClear]);

  const handleSelectStart = useCallback((slot: string) => {
    if (slot === selectedStart) {
      handleClear();
      return;
    }

    const slotIdx = visibleSlots.indexOf(slot);
    const prevSlot = slotIdx > 0 ? visibleSlots[slotIdx - 1] : null;
    const isAfterOccupied = prevSlot ? isSlotBooked(prevSlot) : false;

    if (isSlotBooked(slot)) {
      if (selectionMode === "end" && isAfterOccupied) {
        setSelectedStart(slot);
        setSelectedEnd(null);
        setSelectionMode("end");
        return;
      }
      handleClear();
      return;
    }

    setSelectedStart(slot);
    setSelectedEnd(null);
    setSelectionMode("end");
  }, [isSlotBooked, selectedStart, visibleSlots, selectionMode, handleClear]);

  const handleSelectEnd = useCallback((slot: string) => {
    if (!selectedStart) return;

    const startIdx = visibleSlots.indexOf(selectedStart);
    const endIdx = visibleSlots.indexOf(slot);

    if (endIdx <= startIdx) {
      setSelectedStart(slot);
      setSelectedEnd(null);
      setSelectionMode("end");
      return;
    }
    if (endIdx - startIdx < 2) return;

    if (canBeEndTime(selectedStart, slot, visibleSlots, isSlotBooked)) {
      setSelectedEnd(slot);
      setSelectionMode("done");
      onSelectRange(selectedStart, slot);
      onConfirm();
      return;
    }

    const slotIdx = visibleSlots.indexOf(slot);
    const prevSlot = slotIdx > 0 ? visibleSlots[slotIdx - 1] : null;
    const isAfterOccupied = prevSlot ? isSlotBooked(prevSlot) : false;

    if (!isSlotBooked(slot) && isAfterOccupied) {
      setSelectedStart(slot);
      setSelectedEnd(null);
      setSelectionMode("end");
      return;
    }

    handleClear();
  }, [selectedStart, visibleSlots, isSlotBooked, onSelectRange, onConfirm, handleClear]);

  const handleSlotClick = useCallback((slot: string) => {
    if (selectionMode === "start" || selectionMode === "done") {
      handleSelectStart(slot);
    } else {
      handleSelectEnd(slot);
    }
  }, [selectionMode, handleSelectStart, handleSelectEnd]);

  const handleSlotMouseEnter = useCallback((slot: string) => {
    if (selectionMode !== "end" || !selectedStart) return;
    if (canBeEndTime(selectedStart, slot, visibleSlots, isSlotBooked)) {
      setHoveredEndSlot(slot);
    }
  }, [selectionMode, selectedStart, visibleSlots, isSlotBooked]);

  const handleSlotMouseLeave = useCallback(() => {
    setHoveredEndSlot(null);
  }, []);

  const handleQuickSelect = useCallback(
    (durationHours: number) => {
      const durationSlots = durationHours * 2;

      const startIdx = visibleSlots.findIndex((slot) =>
        canBeStartTime(slot, visibleSlots, isSlotBooked)
      );
      if (startIdx === -1) return;

      const start = visibleSlots[startIdx];
      const desiredEndIdx = startIdx + durationSlots;
      const maxEndIdx = Math.min(desiredEndIdx, visibleSlots.length);

      let end: string | null = null;
      for (let i = maxEndIdx; i > startIdx + 1; i--) {
        const candidateEnd = i < visibleSlots.length ? visibleSlots[i] : closingTime;
        if (canBeEndTime(start, candidateEnd, visibleSlots, isSlotBooked)) {
          end = candidateEnd;
          break;
        }
      }

      if (!end) return;

      setSelectedStart(start);
      setSelectedEnd(end);
      setSelectionMode("done");
      onSelectRange(start, end);
      onConfirm();
    },
    [visibleSlots, isSlotBooked, closingTime, onSelectRange, onConfirm]
  );

  const activeRange = useMemo(() => {
    if (selectedStart && selectedEnd) {
      return { start: selectedStart, end: selectedEnd };
    }
    return null;
  }, [selectedStart, selectedEnd]);

  const getSlotStyle = useCallback(
    (slot: string) => {
      const isBooked = isSlotBooked(slot);
      const isPeak = hasPeakPricing && isPeakTime(date, slot);
      const slotIdx = visibleSlots.indexOf(slot);

      if (isBooked) {
        return "bg-red-500/30 border-red-500/50 cursor-pointer opacity-60";
      }

      if (activeRange) {
        const startIdx = visibleSlots.indexOf(activeRange.start);
        const endIdx = activeRange.end === closingTime ? visibleSlots.length : visibleSlots.indexOf(activeRange.end);

        if (slotIdx >= startIdx && slotIdx <= endIdx) {
          return isPeak ? "bg-primary/50 border-primary/70" : "bg-primary/40 border-primary/60";
        }
      }

      if (selectedStart && !selectedEnd && selectionMode === "end") {
        const startIdx = visibleSlots.indexOf(selectedStart);

        if (hoveredEndSlot) {
          const hoverIdx = visibleSlots.indexOf(hoveredEndSlot);
          const hoverEndIdx = hoveredEndSlot === "00:00" && hoverIdx === -1
            ? visibleSlots.length
            : hoverIdx;

          if (slotIdx > startIdx && slotIdx < hoverEndIdx) {
            return isPeak
              ? "bg-primary/30 border-primary/50 cursor-pointer"
              : "bg-primary/20 border-primary/40 cursor-pointer";
          }
        }

        if (slotIdx > startIdx && !isBooked) {
          return isPeak
            ? "bg-primary/10 hover:bg-primary/20 border-primary/20 cursor-pointer"
            : "bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer";
        }
      }

      return isPeak
        ? "bg-primary/5 hover:bg-primary/10 border-white/10 cursor-pointer"
        : "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer";
    },
    [isSlotBooked, hasPeakPricing, date, activeRange, visibleSlots, closingTime, selectedStart, selectedEnd, selectionMode, hoveredEndSlot]
  );

  const priceInfo = useMemo(() => {
    if (!activeRange) return null;
    const startIdx = ALL_TIME_SLOTS.indexOf(activeRange.start);
    const endIdx = ALL_TIME_SLOTS.indexOf(activeRange.end);
    const durationSlots = endIdx - startIdx;
    const durationHours = durationSlots * 0.5;
    const durationLabel = durationHours % 1 === 0 ? `${durationHours}h` : `${Math.floor(durationHours)}h30`;

    let priceDisplay = "";
    if (studioFilter) {
      const price = calculatePrice(studioFilter, groupType, date, activeRange.start, activeRange.end).total;
      priceDisplay = formatPrice(price);
    } else {
      const offPeakMin = Math.min(PRICING["la-scene"][groupType].offPeak, PRICING["le-podium"][groupType].offPeak);
      const peakMin = Math.min(PRICING["la-scene"][groupType].peak, PRICING["le-podium"][groupType].peak);
      let estimatedPrice = 0;
      for (let i = startIdx; i < endIdx; i++) {
        const slot = ALL_TIME_SLOTS[i];
        const isPeak = hasPeakPricing && isPeakTime(date, slot);
        estimatedPrice += (isPeak ? peakMin : offPeakMin) * 0.5;
      }
      const prefix = groupType === "solo" || groupType === "duo" ? "" : "à partir de ";
      priceDisplay = `${prefix}${formatPrice(estimatedPrice)}`;
    }

    return {
      start: activeRange.start.replace(":00", "h").replace(":30", "h30"),
      end: activeRange.end.replace(":00", "h").replace(":30", "h30"),
      duration: durationLabel,
      price: priceDisplay,
    };
  }, [activeRange, visibleSlots, closingTime, studioFilter, groupType, date, hasPeakPricing]);

  const hourlyRates = useMemo(() => {
    if (studioFilter) {
      const offPeak = PRICING[studioFilter][groupType].offPeak;
      const peak = PRICING[studioFilter][groupType].peak;
      return { offPeakMin: offPeak, offPeakMax: offPeak, peakMin: peak, peakMax: peak };
    }
    return {
      offPeakMin: Math.min(PRICING["la-scene"][groupType].offPeak, PRICING["le-podium"][groupType].offPeak),
      offPeakMax: Math.max(PRICING["la-scene"][groupType].offPeak, PRICING["le-podium"][groupType].offPeak),
      peakMin: Math.min(PRICING["la-scene"][groupType].peak, PRICING["le-podium"][groupType].peak),
      peakMax: Math.max(PRICING["la-scene"][groupType].peak, PRICING["le-podium"][groupType].peak),
    };
  }, [studioFilter, groupType]);

  const formatHourLabel = (slot: string) => {
    const [h, m] = slot.split(":").map(Number);
    if (m === 0) return `${h}h`;
    return `${h}h${m}`;
  };

  const getInstructionText = () => {
    if (selectionMode === "start") return "Cliquez sur l'heure de début";
    if (selectionMode === "end") return "Cliquez sur l'heure de fin";
    return "Créneau sélectionné ✓";
  };

  const slotsPerRow = 16;
  const rows = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < visibleSlots.length; i += slotsPerRow) {
      result.push(visibleSlots.slice(i, i + slotsPerRow));
    }
    return result;
  }, [visibleSlots]);

  return (
    <div className="flex flex-col gap-6">
      {!hideHeader && (
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="rounded-full p-2 transition-colors hover:bg-white/15"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-lg font-semibold capitalize">{formatDate(date)}</h3>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">
            {getInstructionText()}
          </span>
          {selectionMode === "done" && (
            <button
              onClick={handleClear}
              className="text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              Modifier
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-8 sm:grid-cols-16 gap-1">
              {row.map((slot) => {
                const isBooked = isSlotBooked(slot);
                const isPeak = hasPeakPricing && isPeakTime(date, slot);
                const style = getSlotStyle(slot);
                const isStart = selectedStart === slot;
                const isEnd = selectedEnd === slot;

                return (
                  <button
                    key={slot}
                    className={`relative h-12 sm:h-14 rounded-lg border transition-all duration-150 ${style} ${
                      isStart ? "ring-2 ring-primary ring-offset-1 ring-offset-black" : ""
                    } ${isEnd ? "ring-2 ring-primary ring-offset-1 ring-offset-black" : ""}`}
                    onClick={() => handleSlotClick(slot)}
                    onMouseEnter={() => handleSlotMouseEnter(slot)}
                    onMouseLeave={handleSlotMouseLeave}
                    disabled={false}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-xs sm:text-sm font-semibold">
                        {formatHourLabel(slot)}
                      </span>
                      {isPeak && !isBooked && (
                        <Zap className="w-3 h-3 text-primary/60 mt-0.5" />
                      )}
                    </div>
                    {isStart && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                        DÉBUT
                      </div>
                    )}
                    {isEnd && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded">
                        FIN
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-white/5 border border-white/10" />
            Heure creuse {hourlyRates.offPeakMin === hourlyRates.offPeakMax
              ? `${hourlyRates.offPeakMin}€/h`
              : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
          </span>
          {hasPeakPricing && (
            <span className="flex items-center gap-1.5 text-primary">
              <Zap className="w-3 h-3" />
              Soirs, weekends et jours fériés {hourlyRates.peakMin === hourlyRates.peakMax
                ? `${hourlyRates.peakMin}€/h`
                : `${hourlyRates.peakMin}-${hourlyRates.peakMax}€/h`}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
            Non disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-primary/40 border border-primary/60" />
            Sélectionné
          </span>
        </div>

        {priceInfo && (
          <div className="rounded-xl border bg-primary/10 border-primary/30 p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="text-lg font-semibold">
                  {priceInfo.start} <ArrowRight className="inline w-4 h-4 mx-1" /> {priceInfo.end}
                </div>
                <div className="text-sm text-white/50">
                  {priceInfo.duration} · {priceInfo.price}
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
