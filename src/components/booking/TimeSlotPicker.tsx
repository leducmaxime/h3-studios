"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  // Timeline states
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  // Sync pendingStart with parent state
  useEffect(() => {
    if (!startTime) {
      setPendingStart(null);
    }
  }, [startTime]);

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
      if (isSlotBooked(visibleSlots[i])) return false;
    }
    return true;
  }, [pendingStart, rulerLabels, visibleSlots, closingTime, isSlotBooked]);

  // État d'un marqueur pour le style
  const getMarkerState = useCallback((label: string, labelIdx: number): string => {
    const isLast = labelIdx === rulerLabels.length - 1; // closingTime

    // Le pendingStart sélectionné
    if (label === pendingStart) return "start-selected";

    // Si pendingStart est actif, calculer l'état par rapport à lui
    if (pendingStart) {
      const startIdx = rulerLabels.indexOf(pendingStart);
      if (labelIdx <= startIdx) {
        // Avant le start : potentiellement un nouveau start (sauf dernier label)
        if (isLast) return "closing"; // on peut pas sélectionner closingTime comme start
        if (isSlotBooked(label)) return "blocked";
        return "available"; // peut être un nouveau start (reset)
      }
      if (!isReachableAsEnd(label)) return "too-close"; // < 1h ou bloqué
      return "available-end"; // valid end time
    }

    // Pas de pendingStart
    if (isLast) return "closing"; // dernier label = closingTime seulement (pas clickable comme start)
    if (isSlotBooked(label)) return "blocked";
    if (startTime === label) return "start-confirmed"; // sélection confirmée
    return "available";
  }, [pendingStart, rulerLabels, isSlotBooked, isReachableAsEnd, startTime]);

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
    // Le segment représente le SLOT qui commence à prevLabel
    const slot = prevLabel; // slot "prevLabel → nextLabel"
    const isBooked = isSlotBooked(slot);

    if (isBooked) return "booked";

    // Dans la sélection confirmée ?
    if (startTime && endTime) {
      const startIdx = visibleSlots.indexOf(startTime);
      const endIdx = endTime === closingTime ? visibleSlots.length : visibleSlots.indexOf(endTime);
      const slotIdx = visibleSlots.indexOf(slot);
      if (slotIdx >= startIdx && slotIdx < endIdx) {
        return isPeakTime(date, slot) ? "selected-peak" : "selected";
      }
    }

    // Dans le preview hover ?
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

    // Peak non sélectionné
    if (hasPeakPricing && isPeakTime(date, slot)) return "peak";

    return "neutral";
  }, [isSlotBooked, startTime, endTime, visibleSlots, closingTime, date, pendingStart, hoveredMarker, rulerLabels, isReachableAsEnd, hasPeakPricing]);

  // Classe Tailwind d'un segment
  const getSegmentClass = useCallback((state: string): string => {
    switch (state) {
      case "booked":
        return "bg-red-500/20 border-t-2 border-red-500/50";
      case "selected":
        return "bg-white/30 border-t-2 border-white/50";
      case "selected-peak":
        return "bg-primary/40 border-t-2 border-primary/70";
      case "preview":
        return "bg-white/15 border-t border-white/30";
      case "preview-peak":
        return "bg-primary/20 border-t border-primary/40";
      case "peak":
        return "bg-primary/5";
      default:
        return "bg-white/5";
    }
  }, []);

  // Gestion du clic sur un marqueur
  const handleMarkerClick = useCallback((label: string): void => {
    const labelIdx = rulerLabels.indexOf(label);
    const isLast = labelIdx === rulerLabels.length - 1;

    if (!pendingStart) {
      // Premier clic = sélection du start
      if (isLast) return; // pas de start sur le dernier label
      if (isSlotBooked(label)) return;
      setPendingStart(label);
      onClear();
      return;
    }

    const pendingIdx = rulerLabels.indexOf(pendingStart);

    // Clic sur le pendingStart lui-même = cancel
    if (label === pendingStart) {
      setPendingStart(null);
      onClear();
      return;
    }

    // Clic avant ou au même niveau que le start = reset, nouveau start
    if (labelIdx <= pendingIdx) {
      if (isLast) {
        setPendingStart(null);
        onClear();
        return;
      }
      if (isSlotBooked(label)) {
        setPendingStart(null);
        onClear();
        return;
      }
      setPendingStart(label);
      onClear();
      return;
    }

    // Clic après le start : vérifier si atteignable
    if (!isReachableAsEnd(label)) return;

    const endLabelIdx = rulerLabels.indexOf(label);
    const actualEnd = label === closingTime ? label : rulerLabels[endLabelIdx + 1];
    onSelectRange(pendingStart, actualEnd);
    onConfirm(); // auto-avance à l'étape suivante
  }, [pendingStart, rulerLabels, isSlotBooked, isReachableAsEnd, onClear, onSelectRange, onConfirm]);

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

        {/* Container principal scrollable horizontalement */}
        <div
          data-testid="timeline-ruler"
          className="overflow-x-auto"
          onMouseLeave={() => setHoveredMarker(null)}
        >
          <div className="flex min-w-max items-end pt-6 pb-3 relative pl-9 pr-9">
            {pendingStart === null ? (
              <>
                {/* MODE DÉBUT — labels à gauche, toutes les cases 72px, fermeture à la fin */}
                {visibleSlots.map((slot, i) => {
                  const isHalfHour = slot.endsWith(":30");
                  const hourNum = parseInt(slot.split(":")[0]);
                  const segmentState = getSegmentState(slot, rulerLabels[i + 1]);
                  const markerState = getMarkerState(slot, i);
                  const isBlocked = markerState === "blocked";
                  const isYellow = segmentState === "selected" || segmentState === "selected-peak";
                  const cursorClass = isBlocked ? "cursor-not-allowed" : "cursor-pointer";
                  return (
                    <button
                      key={slot}
                      style={{ width: "72px" }}
                      className={`relative h-12 py-1 rounded transition-colors
                        ${getSegmentClass(segmentState)} ${cursorClass}
                        ${!isBlocked && !isYellow ? "hover:bg-white/[0.12]" : ""}`}
                      onClick={() => handleMarkerClick(slot)}
                      onMouseEnter={() => setHoveredMarker(slot)}
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
                        {hasPeakPricing && isPeakTime(date, slot) && (
                          <span className="text-[8px] text-primary">⚡</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {/* Marqueur de fermeture — 0px de large, overflow visible */}
                <div
                  className="flex flex-col items-center justify-end pb-1"
                  style={{ width: "0px", overflow: "visible" }}
                >
                  <div className="w-px h-4 bg-white/50" />
                  <span className="text-sm font-medium text-white/50 whitespace-nowrap">
                    {formatMarkerLabel(closingTime)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {visibleSlots.map((slot, i) => {
                  const segmentState = getSegmentState(slot, rulerLabels[i + 1]);
                  const isHalfHour = slot.endsWith(":30");
                  const hourNum = parseInt(slot.split(":")[0]);
                  const markerState = getMarkerState(slot, i);
                  const isPendingStartCell = slot === pendingStart;
                  const slotIsPeak = isPeakTime(date, slot);
                  const bgClass = isPendingStartCell
                    ? getSegmentClass(slotIsPeak ? "selected-peak" : "selected")
                    : getSegmentClass(segmentState);
                  const isYellow = isPendingStartCell || segmentState === "preview" || segmentState === "preview-peak" || segmentState === "selected" || segmentState === "selected-peak";
                  const cursorClass = markerState === "blocked" || markerState === "too-close"
                    ? "cursor-not-allowed"
                    : "cursor-pointer";
                  return (
                    <button
                      key={slot}
                      style={{ width: "72px" }}
                      className={`relative h-12 py-1 rounded transition-colors ${bgClass} ${cursorClass} ${cursorClass === "cursor-pointer" && !isYellow ? "hover:bg-white/[0.12]" : ""}`}
                      onClick={() => handleMarkerClick(slot)}
                      onMouseEnter={() => setHoveredMarker(slot)}
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
                        {hasPeakPricing && isPeakTime(date, slot) && (
                          <span className="text-[8px] text-primary">⚡</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {(() => {
                  const closingMarkerState = getMarkerState(closingTime, rulerLabels.length - 1);
                  const closingClickable = closingMarkerState === "available-end";
                  return (
                    <div
                      className={`flex flex-col items-center justify-end pb-1 ${closingClickable ? "cursor-pointer" : ""}`}
                      style={{ width: "0px", overflow: "visible" }}
                      onClick={() => { if (closingClickable) handleMarkerClick(closingTime); }}
                      onMouseEnter={() => setHoveredMarker(closingTime)}
                    >
                      <div className="w-px h-4 bg-white/50" />
                      <span className={`text-sm font-medium whitespace-nowrap ${getMarkerTextClass(closingMarkerState)}`}>
                        {formatMarkerLabel(closingTime)}
                      </span>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* Récap live — preview ou confirmé */}
        {(() => {
          const displayStart = startTime || (pendingStart && hoveredMarker && isReachableAsEnd(hoveredMarker) ? pendingStart : null);
          const hoveredActualEnd = pendingStart && hoveredMarker && isReachableAsEnd(hoveredMarker)
            ? (hoveredMarker === closingTime ? hoveredMarker : rulerLabels[rulerLabels.indexOf(hoveredMarker) + 1])
            : null;
          const displayEnd = endTime || hoveredActualEnd;

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
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${isPreview ? "bg-white/5 border border-white/10" : "bg-primary/10 border border-primary/30"}`}>
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

        {/* Légende */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 mt-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-3 bg-white/10 border border-white/20 rounded-sm" />
            Disponible
          </span>
          {hasPeakPricing && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-3 bg-primary/10 border border-primary/30 rounded-sm" />
              <span className="text-primary">⚡ Peak</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-3 bg-red-500/20 border border-red-500/40 rounded-sm" />
            Réservé
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-3 bg-primary/40 border border-primary/60 rounded-sm" />
            Sélectionné
          </span>
        </div>

        {/* Tarifs */}
        <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 xl:gap-4 text-[10px] lg:text-xs text-white/60">
          {hasPeakPricing ? (
            <>
              <div className="flex items-center gap-1 lg:gap-1.5">
                <div className="h-4 w-4 lg:h-5 lg:w-5 rounded border border-white/10 bg-white/10 flex items-center justify-center text-[8px] lg:text-[9px] text-white/50">18</div>
                <span>
                  {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                    ? `${hourlyRates.offPeakMin}€/h`
                    : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
                </span>
              </div>
              <div className="flex items-center gap-1 lg:gap-1.5">
                <div className="h-4 w-4 lg:h-5 lg:w-5 rounded border border-primary/20 bg-primary/10 flex items-center justify-center">
                  <span className="text-[9px] lg:text-[10px] text-primary">⚡</span>
                </div>
                <span className="text-primary">
                  {hourlyRates.peakMin === hourlyRates.peakMax
                    ? `${hourlyRates.peakMin}€/h`
                    : `${hourlyRates.peakMin}-${hourlyRates.peakMax}€/h`}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 lg:gap-1.5">
              <div className="h-4 w-4 lg:h-5 lg:w-5 rounded border border-white/10 bg-white/10 flex items-center justify-center text-[8px] lg:text-[9px] text-white/50">18</div>
              <span>
                {hourlyRates.offPeakMin === hourlyRates.offPeakMax
                  ? `${hourlyRates.offPeakMin}€/h`
                  : `${hourlyRates.offPeakMin}-${hourlyRates.offPeakMax}€/h`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
