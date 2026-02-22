"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import {
  getStudioTimeSlots,
  getUnionTimeSlots,
  getStudioClosingTime,
  isPeakTime,
  formatDate,
  formatPrice,
  calculatePrice,
  PRICING,
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
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [virtualHoverRange, setVirtualHoverRange] = useState<{ start: string; endLabel: string } | null>(null);
  const [slotsPerRow, setSlotsPerRow] = useState(10);
  const settingNewStartRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startTime) {
      if (settingNewStartRef.current) {
        settingNewStartRef.current = false;
      } else {
        setPendingStart(null);
      }
    }
  }, [startTime]);

  useEffect(() => {
    if (startTime && endTime) {
      setPendingStart(null);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      const raw = Math.floor(width / 72);
      const even = Math.max(2, Math.floor(raw / 2) * 2);
      setSlotsPerRow(Math.min(10, even));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const occupancyArray = useMemo(() => {
    const items = Array.from(availability as Set<unknown>);
    return items.map((item): OccupancyInfo | null => {
      if (typeof item === "string") {
        const [studioId, time] = item.split("-");
        if (studioId && time) {
          return { studioId: studioId as StudioId, time, groupType: "blocked" };
        }
        return null;
      }
      return item as OccupancyInfo;
    }).filter((item): item is OccupancyInfo => item !== null);
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
          return occupant.groupType === "group" || occupant.groupType === "blocked" || occupant.groupType === "solo" || occupant.groupType === "duo";
        }
        return true;
      }
      const sceneOccupant = isOccupiedBy("la-scene", time);
      const podiumOccupant = isOccupiedBy("le-podium", time);

      if (groupType !== "group") {
        const sceneBlocked = sceneOccupant && (sceneOccupant.groupType === "group" || sceneOccupant.groupType === "blocked" || sceneOccupant.groupType === "solo" || sceneOccupant.groupType === "duo");
        const podiumBlocked = podiumOccupant && (podiumOccupant.groupType === "group" || podiumOccupant.groupType === "blocked" || podiumOccupant.groupType === "solo" || podiumOccupant.groupType === "duo");
        return !!(sceneBlocked && podiumBlocked);
      }
      const sceneBooked = !!sceneOccupant;
      const podiumBooked = !!podiumOccupant;
      return sceneBooked && podiumBooked;
    },
    [isOccupiedBy, studioFilter, groupType]
  );

  const isSlotIsolated = useCallback(
    (time: string): boolean => {
      const idx = visibleSlots.indexOf(time);
      if (idx === -1 || isSlotBooked(time)) return false;
      const prevIsConstraint = idx === 0 || isSlotBooked(visibleSlots[idx - 1]);
      const nextIsConstraint = idx === visibleSlots.length - 1 || isSlotBooked(visibleSlots[idx + 1]);
      return prevIsConstraint && nextIsConstraint;
    },
    [visibleSlots, isSlotBooked]
  );

  const isSlotEffectivelyBooked = useCallback(
    (time: string): boolean => isSlotBooked(time) || isSlotIsolated(time),
    [isSlotBooked, isSlotIsolated]
  );

  const isLastFreeBeforeConstraint = useCallback(
    (slotIdx: number): boolean => {
      if (slotIdx < 0 || slotIdx >= visibleSlots.length) return false;
      if (isSlotEffectivelyBooked(visibleSlots[slotIdx])) return false;
      const nextIdx = slotIdx + 1;
      return nextIdx >= visibleSlots.length || isSlotEffectivelyBooked(visibleSlots[nextIdx]);
    },
    [visibleSlots, isSlotEffectivelyBooked]
  );

  const isSecondToLastFreeBeforeConstraint = useCallback(
    (slotIdx: number): boolean => {
      if (slotIdx < 0 || slotIdx >= visibleSlots.length) return false;
      if (isSlotEffectivelyBooked(visibleSlots[slotIdx])) return false;
      const nextIdx = slotIdx + 1;
      return nextIdx < visibleSlots.length && isLastFreeBeforeConstraint(nextIdx);
    },
    [visibleSlots, isSlotEffectivelyBooked, isLastFreeBeforeConstraint]
  );

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

  // Labels = visibleSlots + closingTime (pour avoir le marqueur de fin)
  const rulerLabels = useMemo(() => {
    return [...visibleSlots, closingTime];
  }, [visibleSlots, closingTime]);

  const rows = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < visibleSlots.length; i += slotsPerRow) {
      result.push(visibleSlots.slice(i, i + slotsPerRow));
    }
    return result;
  }, [visibleSlots, slotsPerRow]);

  // Format d'affichage des labels
  const formatMarkerLabel = useCallback((label: string): string => {
    if (label === "00:00") return "00h";
    const [h] = label.split(":").map(Number);
    return `${h}h`;
  }, []);

  // Est-ce que ce label est atteignable comme endTime depuis pendingStart ?
  const isReachableAsEnd = useCallback((label: string): boolean => {
    if (!pendingStart) return false;
    const startIdx = rulerLabels.indexOf(pendingStart);
    const endIdx = rulerLabels.indexOf(label);
    if (endIdx <= startIdx) return false;

    const startSlotIdx = visibleSlots.indexOf(pendingStart);
    const endSlotIdx = label === closingTime
      ? visibleSlots.length
      : visibleSlots.indexOf(label) + 1;

    for (let i = startSlotIdx; i < endSlotIdx; i++) {
      if (isSlotEffectivelyBooked(visibleSlots[i])) return false;
    }
    return true;
  }, [pendingStart, rulerLabels, visibleSlots, closingTime, isSlotEffectivelyBooked]);

  // État d'un marqueur pour le style
  const getMarkerState = useCallback((label: string, labelIdx: number): string => {
    const isLast = labelIdx === rulerLabels.length - 1; // closingTime

    // Le pendingStart sélectionné
    if (label === pendingStart) return "start-selected";

    if (pendingStart) {
      const startIdx = rulerLabels.indexOf(pendingStart);
      if (labelIdx <= startIdx) {
        if (isLast) return "closing";
        if (isSlotEffectivelyBooked(label)) return "blocked";
        return "available";
      }
      if (!isReachableAsEnd(label)) {
        if (!isLast && isSlotEffectivelyBooked(label)) {
          const prevIsBooked = labelIdx - 1 > startIdx && isSlotEffectivelyBooked(rulerLabels[labelIdx - 1]);
          return prevIsBooked ? "blocked" : "blocked-boundary";
        }
        return "too-close";
      }
      return "available-end";
    }

    if (isLast) return "closing";
    if (isSlotEffectivelyBooked(label)) {
      const prevIsBooked = labelIdx > 0 && isSlotEffectivelyBooked(rulerLabels[labelIdx - 1]);
      return prevIsBooked ? "blocked" : "blocked-boundary";
    }
    if (startTime === label) return "start-confirmed";
    return "available";
  }, [pendingStart, rulerLabels, isSlotEffectivelyBooked, isReachableAsEnd, startTime]);

  // Classe Tailwind d'un marqueur selon son état
  const getMarkerClass = useCallback((state: string): string => {
    switch (state) {
      case "start-selected":
        return "bg-primary text-black font-bold ring-2 ring-primary ring-offset-1 ring-offset-black cursor-pointer";
      case "start-confirmed":
        return "bg-primary/80 text-black font-semibold cursor-pointer";
      case "available-end":
        return "text-white/90 hover:bg-white/20 cursor-pointer";
      case "available":
        return "text-white/70 hover:bg-white/10 cursor-pointer";
      case "blocked":
        return "text-red-400/50 cursor-not-allowed";
      case "too-close":
        return "text-white/50 cursor-not-allowed";
      case "closing":
        return "text-white/50";
      default:
        return "text-white/50";
    }
  }, []);

  // Couleur de texte seulement (sans background/cursor)
  const getMarkerTextClass = useCallback((state: string): string => {
    switch (state) {
      case "start-selected":
        return "text-white/70";
      case "start-confirmed":
        return "text-white/70";
      case "available-end":
        return "text-white/90";
      case "available":
        return "text-white/70";
      case "blocked":
        return "text-red-400/50";
      case "blocked-boundary":
        return "text-white/70";
      case "too-close":
        return "text-white/50";
      case "closing":
        return "text-white/50";
      default:
        return "text-white/50";
    }
  }, []);

  // État d'un segment (zone colorée entre deux marqueurs)
  const getSegmentState = useCallback((prevLabel: string, nextLabel: string): string => {
    const slot = prevLabel;
    if (isSlotEffectivelyBooked(slot)) return "booked";

    if (startTime && endTime) {
      const startIdx = visibleSlots.indexOf(startTime);
      const endIdx = endTime === closingTime ? visibleSlots.length : visibleSlots.indexOf(endTime);
      const slotIdx = visibleSlots.indexOf(slot);
      if (slotIdx >= startIdx && slotIdx < endIdx) {
        return isPeakTime(date, slot) ? "selected-peak" : "selected";
      }
    }

    if (pendingStart && hoveredMarker) {
      const pStartIdx = rulerLabels.indexOf(pendingStart);
      const pHoveredIdx = rulerLabels.indexOf(hoveredMarker);
      const pEndIdx = hoveredMarker === closingTime ? pHoveredIdx : pHoveredIdx + 1;
      const labelIdx = rulerLabels.indexOf(prevLabel);
      if (pEndIdx > pStartIdx && labelIdx >= pStartIdx && labelIdx < pEndIdx) {
        if (isReachableAsEnd(hoveredMarker)) {
          return isPeakTime(date, slot) ? "preview-peak" : "preview";
        }
      }
    }

    if (!pendingStart && virtualHoverRange) {
      const vStartIdx = visibleSlots.indexOf(virtualHoverRange.start);
      const vEndLabel = virtualHoverRange.endLabel;
      const vEndIdx = vEndLabel === closingTime ? visibleSlots.length : visibleSlots.indexOf(vEndLabel);
      const slotIdx = visibleSlots.indexOf(slot);
      if (vStartIdx >= 0 && slotIdx >= vStartIdx && slotIdx < vEndIdx) {
        return isPeakTime(date, slot) ? "preview-peak" : "preview";
      }
    }

    if (hasPeakPricing && isPeakTime(date, slot)) return "peak";

    return "neutral";
  }, [isSlotEffectivelyBooked, startTime, endTime, visibleSlots, closingTime, date, pendingStart, hoveredMarker, rulerLabels, isReachableAsEnd, hasPeakPricing, virtualHoverRange]);

  // Classe Tailwind d'un segment
  const getSegmentClass = useCallback((state: string): string => {
    switch (state) {
      case "booked":
        return "bg-red-500/20 border-t-2 border-red-500/50";
      case "selected":
      case "selected-peak":
        return "bg-primary/40 border-t-2 border-primary/70";
      case "preview":
      case "preview-peak":
        return "bg-primary/20 border-t border-primary/40";
      case "peak":
        return "bg-primary/5";
      default:
        return "bg-white/5";
    }
  }, []);

  const handleMarkerClick = useCallback((label: string): void => {
    const labelIdx = rulerLabels.indexOf(label);
    const isLast = labelIdx === rulerLabels.length - 1;

    if (!pendingStart) {
      if (isLast) return;
      if (isSlotEffectivelyBooked(label)) return;

      const slotIdx = visibleSlots.indexOf(label);

      if (slotIdx >= 0 && isLastFreeBeforeConstraint(slotIdx)) {
        const prevIdx = slotIdx - 1;
        if (prevIdx >= 0 && !isSlotEffectivelyBooked(visibleSlots[prevIdx])) {
          const endLabel = rulerLabels[labelIdx + 1] ?? closingTime;
          settingNewStartRef.current = true;
          onSelectRange(visibleSlots[prevIdx], endLabel);
          onConfirm();
        }
        return;
      }

      if (slotIdx >= 0 && isSecondToLastFreeBeforeConstraint(slotIdx)) {
        const nextIdx = slotIdx + 1;
        const endLabel = rulerLabels[nextIdx + 1] ?? closingTime;
        settingNewStartRef.current = true;
        onSelectRange(label, endLabel);
        onConfirm();
        return;
      }

      settingNewStartRef.current = true;
      setPendingStart(label);
      onClear();
      return;
    }

    const pendingIdx = rulerLabels.indexOf(pendingStart);

    if (label === pendingStart) {
      setPendingStart(null);
      onClear();
      return;
    }

    if (labelIdx <= pendingIdx) {
      if (isLast || isSlotEffectivelyBooked(label)) return;
      settingNewStartRef.current = true;
      setPendingStart(label);
      onClear();
      return;
    }

    if (!isReachableAsEnd(label)) return;

    const endLabelIdx = rulerLabels.indexOf(label);
    const actualEnd = label === closingTime ? label : rulerLabels[endLabelIdx + 1];
    onSelectRange(pendingStart, actualEnd);
    onConfirm();
  }, [pendingStart, rulerLabels, visibleSlots, closingTime, isSlotEffectivelyBooked, isLastFreeBeforeConstraint, isSecondToLastFreeBeforeConstraint, isReachableAsEnd, onClear, onSelectRange, onConfirm]);

  const handleMouseEnter = useCallback((slot: string) => {
    setHoveredMarker(slot);
    if (!pendingStart) {
      const slotIdx = visibleSlots.indexOf(slot);
      if (slotIdx >= 0 && isLastFreeBeforeConstraint(slotIdx)) {
        const prevIdx = slotIdx - 1;
        if (prevIdx >= 0 && !isSlotEffectivelyBooked(visibleSlots[prevIdx])) {
          const endLabel = rulerLabels[slotIdx + 1] ?? closingTime;
          setVirtualHoverRange({ start: visibleSlots[prevIdx], endLabel });
          return;
        }
      }
      setVirtualHoverRange(null);
    }
  }, [pendingStart, visibleSlots, isLastFreeBeforeConstraint, isSlotEffectivelyBooked, rulerLabels, closingTime]);

  const handleMouseLeave = useCallback(() => {
    setHoveredMarker(null);
    setVirtualHoverRange(null);
  }, []);

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
        <span className="text-sm font-medium text-white/70">
          {pendingStart ? "Heure de fin" : "Sélectionnez votre heure de début"}
        </span>

        <div
          ref={containerRef}
          data-testid="timeline-ruler"
          className="flex flex-col"
          onMouseLeave={handleMouseLeave}
        >
          {rows.map((rowSlots, rowIdx) => {
            const isLastRow = rowIdx === rows.length - 1;
            const globalOffset = rowIdx * slotsPerRow;
            const rowEndMarker = isLastRow ? closingTime : visibleSlots[globalOffset + slotsPerRow];
            const rowEndMarkerIdx = isLastRow ? rulerLabels.length - 1 : rulerLabels.indexOf(rowEndMarker);
            const rowEndMarkerState = getMarkerState(rowEndMarker, rowEndMarkerIdx);
            const rowEndClickable = rowEndMarkerState === "available-end";
            return (
              <div key={rowIdx} className="flex items-end justify-center pt-6 pb-3 relative">
                {rowSlots.map((slot, localIdx) => {
                  const globalIdx = globalOffset + localIdx;
                  const segmentState = getSegmentState(slot, rulerLabels[globalIdx + 1]);
                  const isHalfHour = slot.endsWith(":30");
                  const hourNum = parseInt(slot.split(":")[0]);
                  const markerState = getMarkerState(slot, globalIdx);
                  const isPendingStartCell = slot === pendingStart;
                  const isBlocked = markerState === "blocked" || markerState === "blocked-boundary" || markerState === "too-close";
                  const isYellow = isPendingStartCell || segmentState === "preview" || segmentState === "preview-peak" || segmentState === "selected" || segmentState === "selected-peak";
                  const bgClass = isPendingStartCell
                    ? getSegmentClass("selected-peak")
                    : getSegmentClass(segmentState);
                  const cursorClass = isBlocked ? "cursor-not-allowed" : "cursor-pointer";
                  return (
                    <button
                      key={slot}
                      style={{ width: "72px" }}
                      className={`relative h-12 py-1 rounded transition-colors ${bgClass} ${cursorClass} ${!isBlocked && !isYellow ? "hover:bg-white/[0.12]" : ""}`}
                      onClick={() => handleMarkerClick(slot)}
                      onMouseEnter={() => handleMouseEnter(slot)}
                      aria-label={isHalfHour ? `${hourNum}h30` : `${hourNum}h`}
                    >
                      <div className="absolute bottom-1 left-0 flex flex-col items-center gap-0.5 -translate-x-1/2">
                        <div className={`w-px ${isHalfHour ? "h-2 bg-white/20" : "h-4 bg-white/50"}`} />
                        {isHalfHour ? (
                          <div className={`flex flex-col items-center leading-none ${getMarkerTextClass(markerState)}`}>
                            <span className="text-[9px]">{hourNum}h</span>
                            <span className="text-xs font-medium">30</span>
                          </div>
                        ) : (
                          <span className={`text-sm font-medium ${getMarkerTextClass(markerState)}`}>
                            {formatMarkerLabel(slot)}
                          </span>
                        )}
                      </div>
                      {hasPeakPricing && isPeakTime(date, slot) && !isSlotEffectivelyBooked(slot) && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs text-primary pointer-events-none select-none">⚡</span>
                      )}
                    </button>
                  );
                })}
                <div
                  className={`flex flex-col items-center justify-end pb-1 ${rowEndClickable ? "cursor-pointer" : ""}`}
                  style={{ width: "0px", overflow: "visible" }}
                  onClick={() => { if (rowEndClickable) handleMarkerClick(rowEndMarker); }}
                  onMouseEnter={() => handleMouseEnter(rowEndMarker)}
                >
                  <div className="w-px h-4 bg-white/50" />
                  <span className={`text-sm font-medium whitespace-nowrap ${getMarkerTextClass(rowEndMarkerState)}`}>
                    {formatMarkerLabel(rowEndMarker)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Récap live — preview ou confirmé */}
        {(() => {
          const displayStart = startTime
            || (pendingStart && hoveredMarker && isReachableAsEnd(hoveredMarker) ? pendingStart : null)
            || (virtualHoverRange ? virtualHoverRange.start : null);
          const hoveredActualEnd = pendingStart && hoveredMarker && isReachableAsEnd(hoveredMarker)
            ? (hoveredMarker === closingTime ? hoveredMarker : rulerLabels[rulerLabels.indexOf(hoveredMarker) + 1])
            : null;
          const displayEnd = endTime || hoveredActualEnd || (virtualHoverRange ? virtualHoverRange.endLabel : null);

          if (!displayStart || !displayEnd) return null;

          const startIdx = visibleSlots.indexOf(displayStart);
          const endIdx = displayEnd === closingTime ? visibleSlots.length : visibleSlots.indexOf(displayEnd);
          const durationSlots = endIdx - startIdx;
          const durationHours = durationSlots * 0.5;
          const durationLabel = durationHours % 1 === 0 ? `${durationHours}h` : `${Math.floor(durationHours)}h30`;

          // Prix
          let priceDisplay = "";
          if (studioFilter) {
            const price = calculatePrice(studioFilter, groupType, date, displayStart, displayEnd).total;
            priceDisplay = `· ${formatPrice(price)}`;
          } else {
            const offPeakMin = Math.min(PRICING["la-scene"][groupType].offPeak, PRICING["le-podium"][groupType].offPeak);
            const peakMin = Math.min(PRICING["la-scene"][groupType].peak, PRICING["le-podium"][groupType].peak);
            // Calculer le prix estimé (min)
            let estimatedPrice = 0;
            for (let i = startIdx; i < endIdx; i++) {
              const slot = visibleSlots[i] || closingTime;
              const isPeak = hasPeakPricing && isPeakTime(date, slot);
              estimatedPrice += (isPeak ? peakMin : offPeakMin) * 0.5;
            }
            const prefix = groupType === "solo" || groupType === "duo" ? "" : "à partir de ";
            priceDisplay = `· ${prefix}${formatPrice(estimatedPrice)}`;
          }

          const isPreview = !startTime || !endTime;

          return (
            <div className={`mt-3 flex items-center justify-center gap-3 rounded-lg px-4 py-3 text-base ${isPreview ? "bg-white/5 border border-white/10" : "bg-primary/10 border border-primary/30"}`}>
              <span className={`font-semibold ${isPreview ? "text-white/70" : "text-primary"}`}>
                {displayStart.replace(":00", "h").replace(":30", "h30")} → {displayEnd.replace(":00", "h").replace(":30", "h30")}
              </span>
              <span className="text-white/50">·</span>
              <span className={isPreview ? "text-white/50" : "text-white/80"}>{durationLabel}</span>
              {priceDisplay && (
                <>
                  <span className="text-white/50">·</span>
                  <span className={isPreview ? "text-white/50" : "text-primary font-medium"}>{priceDisplay.replace("· ", "")}</span>
                </>
              )}
            </div>
          );
        })()}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/50 mt-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-3 flex-shrink-0 bg-white/10 border border-white/20 rounded-sm" />
            Disponible {hourlyRates.offPeakMin === hourlyRates.offPeakMax ? hourlyRates.offPeakMin : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}`}€/h
          </span>
          {hasPeakPricing && (
            <span className="flex items-center gap-1.5 text-primary">
              <span className="text-sm leading-none">⚡</span>
              Disponible {hourlyRates.peakMin === hourlyRates.peakMax ? hourlyRates.peakMin : `${hourlyRates.peakMin}-${hourlyRates.peakMax}`}€/h
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-3 flex-shrink-0 bg-red-500/20 border border-red-500/40 rounded-sm" />
            Réservé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-3 flex-shrink-0 bg-primary/40 border border-primary/60 rounded-sm" />
            Sélectionné
          </span>
        </div>
      </div>
    </div>
  );
}
