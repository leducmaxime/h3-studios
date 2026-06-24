"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { ChevronLeft, Clock, Zap, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getStudioTimeSlots,
  formatDate,
  formatPrice,
  calculatePrice,
  PRICING,
  STUDIOS,
  ALL_TIME_SLOTS,
  canBeStartTime,
  canBeEndTime,
  isPeakTime,
  type GroupType,
  type StudioId,
} from "@/lib/booking";

type SlotData = { time: string; available: boolean; groupType?: string; bookingId?: string };

interface TimeSlotPickerProps {
  date: Date;
  slotsByStudio: Record<string, SlotData[]>;
  startTime: string | null;
  endTime: string | null;
  studioId: StudioId | null;
  onSelectRange: (start: string, end: string, studioId: StudioId) => void;
  onClear: () => void;
  onConfirm: () => void;
  onBack: () => void;
  canConfirm: boolean;
  hideHeader?: boolean;
  groupType?: GroupType;
  minAdvanceHours?: number;
  minAdvanceCutoffTime?: string | null;
}

const STUDIO_LABELS: Record<StudioId, string> = {
  "la-scene": "LA SCÈNE",
  "le-podium": "LE PODIUM",
};

export function TimeSlotPicker({
  date,
  slotsByStudio,
  startTime,
  endTime,
  studioId: initialStudioId,
  onSelectRange,
  onClear,
  onConfirm,
  onBack,
  canConfirm,
  hideHeader = false,
  groupType = "group",
  minAdvanceHours = 0,
  minAdvanceCutoffTime = null,
}: TimeSlotPickerProps) {
  const [selectedStart, setSelectedStart] = useState<string | null>(startTime);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(endTime);
  const [activeStudio, setActiveStudio] = useState<StudioId | null>(initialStudioId);
  const [hoveredEndSlot, setHoveredEndSlot] = useState<string | null>(null);
  const [minAdvanceDialogOpen, setMinAdvanceDialogOpen] = useState(false);

  const selectionMode = selectedStart && selectedEnd ? "done" : selectedStart ? "end" : "start";

  useEffect(() => {
    setSelectedStart(startTime);
    setSelectedEnd(endTime);
    if (initialStudioId) setActiveStudio(initialStudioId);
  }, [startTime, endTime, initialStudioId]);

  const hasPeakPricing = groupType === "group";

  // Per-studio visible slots (based on opening hours)
  const studioSlots = useMemo(() => {
    const result: Record<StudioId, string[]> = { "la-scene": [], "le-podium": [] };
    for (const studioId of ["la-scene", "le-podium"] as StudioId[]) {
      result[studioId] = getStudioTimeSlots(studioId, date);
    }
    return result;
  }, [date]);

  const isSlotTooSoon = useCallback((slot: string): boolean => {
    if (!minAdvanceCutoffTime) return false;
    const [slotH, slotM] = slot.split(":").map(Number);
    const [cutH, cutM] = minAdvanceCutoffTime.split(":").map(Number);
    return slotH * 60 + slotM < cutH * 60 + cutM;
  }, [minAdvanceCutoffTime]);

  const checkSlotBooked = useCallback(
    (time: string, studioId: StudioId): boolean => {
      const slots = slotsByStudio[studioId];
      if (!slots) return true;
      const slot = slots.find((s) => s.time === time);
      if (!slot) return true;
      return !slot.available;
    },
    [slotsByStudio]
  );

  // Start a selection on a studio (clears previous studio selection)
  const startStudioSelection = useCallback((studioId: StudioId, slot: string) => {
    if (activeStudio && activeStudio !== studioId) {
      setSelectedStart(null);
      setSelectedEnd(null);
      onClear();
    }
    setActiveStudio(studioId);
  }, [activeStudio, onClear]);

  const handleClear = useCallback(() => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setActiveStudio(null);
    onClear();
  }, [onClear]);

  const tryConfirmRange = useCallback((start: string, end: string, studioId: StudioId): boolean => {
    if (!studioSlots[studioId]) {
      onClear();
      return false;
    }

    const visibleSlots = studioSlots[studioId];
    const startIdx = ALL_TIME_SLOTS.indexOf(start);
    let endIdx = ALL_TIME_SLOTS.indexOf(end);
    if (end === "00:00") endIdx = ALL_TIME_SLOTS.length;

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return false;
    }

    // Re-validate the start slot itself (intermediate loop below starts at startIdx+1).
    if (checkSlotBooked(start, studioId)) {
      return false;
    }

    // Check intermediate slots — exclusive of start and end boundaries.
    // The end boundary is allowed to be occupied. For "00:00" the boundary slot
    // sits at ALL_TIME_SLOTS index 30 (past most visible ranges), so we exclude
    // it from the check by capping exclusiveEnd at ALL_TIME_SLOTS.length - 1.
    const exclusiveEnd = end === "00:00" ? ALL_TIME_SLOTS.length - 1 : endIdx;
    for (let i = startIdx + 1; i < exclusiveEnd; i++) {
      const time = ALL_TIME_SLOTS[i];
      if (!visibleSlots.includes(time) || checkSlotBooked(time, studioId)) {
        return false;
      }
    }

    setSelectedStart(start);
    setSelectedEnd(end);
    onSelectRange(start, end, studioId);
    onConfirm();
    return true;
  }, [studioSlots, checkSlotBooked, onSelectRange, onConfirm, onClear]);

  const handleSlotClick = useCallback(
    (slot: string, studioId: StudioId) => {
      // 1. Too-soon check first
      if (isSlotTooSoon(slot)) {
        setMinAdvanceDialogOpen(true);
        return;
      }

      // 2. Mark this studio as active (clears previous studio if different)
      startStudioSelection(studioId, slot);

      // 3. Mode-specific handling
      if (selectionMode === "done" || selectionMode === "start") {
        // Start mode: require slot to have ≥ 1h runway before occupied
        if (!canBeStartTime(slot, studioSlots[studioId], (t) => checkSlotBooked(t, studioId))) {
          return;
        }
        setSelectedStart(slot);
        setSelectedEnd(null);
      } else if (selectionMode === "end") {
        // End mode: allow occupied end boundary (checked by canBeEndTime)
        if (!canBeEndTime(selectedStart!, slot, studioSlots[studioId], (t) => checkSlotBooked(t, studioId))) {
          return;
        }
        tryConfirmRange(selectedStart!, slot, studioId);
      }
    },
    [selectionMode, selectedStart, studioSlots, checkSlotBooked, isSlotTooSoon, tryConfirmRange, startStudioSelection]
  );

  const handleSlotMouseEnter = useCallback(
    (slot: string) => {
      if (selectionMode === "end") setHoveredEndSlot(slot);
    },
    [selectionMode]
  );

  const handleSlotMouseLeave = useCallback(() => {
    setHoveredEndSlot(null);
  }, []);

  const getSlotStyle = useCallback(
    (slot: string, studioId: StudioId) => {
      const isBooked = checkSlotBooked(slot, studioId);
      const isPeak = hasPeakPricing && isPeakTime(date, slot);
      const isSelectedStart = selectedStart === slot && activeStudio === studioId;
      const isSelectedEnd = selectedEnd === slot && activeStudio === studioId;
      const isActiveStudio = activeStudio === studioId;

      if (!isActiveStudio && isBooked) {
        return "bg-red-500/20 border-red-500/30 opacity-40";
      }

      if (isSelectedStart || isSelectedEnd) {
        return isPeak ? "bg-primary/50 border-primary/70 ring-2 ring-primary ring-offset-1 ring-offset-black"
                      : "bg-primary/40 border-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-black";
      }

      if (isBooked) {
        return "bg-red-500/30 border-red-500/50 cursor-not-allowed opacity-60";
      }

      // Free slot that can't start a 1h booking (no runway) — start/done mode, active studio
      if ((selectionMode === "start" || selectionMode === "done") && isActiveStudio) {
        if (!canBeStartTime(slot, studioSlots[studioId], (t) => checkSlotBooked(t, studioId))) {
          return "bg-white/5 border-white/10 opacity-30 cursor-not-allowed";
        }
      }

      // Hover range in end mode
      if (selectionMode === "end" && selectedStart && activeStudio === studioId) {
        const visibleSlots = studioSlots[studioId];
        const startIdx = visibleSlots.indexOf(selectedStart);
        const slotIdx = visibleSlots.indexOf(slot);

        if (hoveredEndSlot && slotIdx > startIdx && slotIdx < visibleSlots.indexOf(hoveredEndSlot)) {
          return isPeak ? "bg-primary/30 border-primary/50 cursor-pointer" : "bg-primary/20 border-primary/40 cursor-pointer";
        }
        if (slotIdx > startIdx) {
          return isPeak ? "bg-primary/10 hover:bg-primary/20 border-primary/20 cursor-pointer" : "bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer";
        }
      }

      if (!isActiveStudio) {
        return "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer opacity-50 hover:opacity-80";
      }

      return isPeak
        ? "bg-primary/5 hover:bg-primary/10 border-white/10 cursor-pointer"
        : "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer";
    },
    [checkSlotBooked, hasPeakPricing, date, selectedStart, selectedEnd, activeStudio, selectionMode, hoveredEndSlot, studioSlots]
  );

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

  // Price info for active studio
  const priceInfo = useMemo(() => {
    if (!selectedStart || !selectedEnd || !activeStudio) return null;
    const startIdx = ALL_TIME_SLOTS.indexOf(selectedStart);
    let endIdx = ALL_TIME_SLOTS.indexOf(selectedEnd);
    if (selectedEnd === "00:00") endIdx = ALL_TIME_SLOTS.length;
    const durationSlots = endIdx - startIdx;
    const durationHours = durationSlots * 0.5;
    const durationLabel = durationHours % 1 === 0 ? `${durationHours}h` : `${Math.floor(durationHours)}h30`;

    const price = calculatePrice(activeStudio, groupType, date, selectedStart, selectedEnd).total;

    return {
      start: selectedStart.replace(":00", "h").replace(":30", "h30"),
      end: selectedEnd.replace(":00", "h").replace(":30", "h30"),
      duration: durationLabel,
      price: formatPrice(price),
    };
  }, [selectedStart, selectedEnd, activeStudio, groupType, date]);

  // Compute price range label for a studio's mini-card
  const getPriceRangeLabel = (studioId: StudioId): string => {
    const pricing = PRICING[studioId][groupType];
    // Rates are per 30-min slot — multiply by 2 to get hourly
    const offPeakHourly = pricing.offPeak * 2;
    const peakHourly = pricing.peak * 2;
    if (offPeakHourly === peakHourly) {
      return `${offPeakHourly}€/h`;
    }
    return `${offPeakHourly}€ – ${peakHourly}€/h`;
  };

  const renderStudioBlock = (studioId: StudioId) => {
    const slots = studioSlots[studioId];
    const isActive = activeStudio === studioId;
    const studio = STUDIOS[studioId];

    // Max 3 rows — compute columns needed
    const cols = Math.ceil(slots.length / 3);
    const rows: string[][] = [];
    for (let i = 0; i < slots.length; i += cols) {
      rows.push(slots.slice(i, Math.min(i + cols, slots.length)));
    }

    return (
      <div
        key={studioId}
        className={`flex flex-col gap-3 transition-opacity duration-200 ${
          activeStudio && !isActive ? "opacity-60" : "opacity-100"
        }`}
      >
        {/* Mini-card */}
        <div
          className={`relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
            isActive
              ? "border-primary shadow-[0_0_16px_-4px_var(--color-primary,theme(colors.primary))]"
              : "border-white/15"
          }`}
        >
          {/* Photo */}
          <div className="relative h-[100px] w-full overflow-hidden">
            <img
              src={studio.image}
              alt={studio.name}
              width={1200}
              height={675}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Studio name + price badge */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-3 pb-2.5">
              <span className="text-sm font-bold tracking-widest text-white drop-shadow-lg uppercase">
                {studio.name}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "bg-primary text-black"
                    : "bg-white/20 text-white backdrop-blur-sm"
                }`}
              >
                {getPriceRangeLabel(studioId)}
              </span>
            </div>
          </div>
        </div>

        {/* Slot grid — max 3 rows */}
        <div className="flex flex-col gap-1.5">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map((slot) => {
                const isBooked = checkSlotBooked(slot, studioId);
                const isTooSoon = isSlotTooSoon(slot);
                const isPeak = hasPeakPricing && isPeakTime(date, slot);
                const style = getSlotStyle(slot, studioId);
                const isStart = selectedStart === slot && activeStudio === studioId;
                const isEnd = selectedEnd === slot && activeStudio === studioId;

                return (
                  <button
                    key={slot}
                    className={`relative flex-1 h-10 rounded-lg border transition-all duration-150 ${style}`}
                    onClick={() => handleSlotClick(slot, studioId)}
                    onMouseEnter={() => handleSlotMouseEnter(slot)}
                    onMouseLeave={handleSlotMouseLeave}
                    disabled={false}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-[11px] sm:text-xs font-semibold leading-none">
                        {formatHourLabel(slot)}
                      </span>
                      {isPeak && !isBooked && (
                        <Zap className="w-2.5 h-2.5 text-primary/60 mt-0.5" />
                      )}
                    </div>
                    {isStart && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        DÉBUT
                      </div>
                    )}
                    {isEnd && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        FIN
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

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

        {/* Two studios side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {renderStudioBlock("la-scene")}
          {renderStudioBlock("le-podium")}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-white/5 border border-white/10" />
            Libre
          </span>
          {hasPeakPricing && (
            <span className="flex items-center gap-1.5 text-primary">
              <Zap className="w-3 h-3" />
              Soirs, weekends et jours fériés
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
            Indisponible
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
                  {activeStudio && (
                    <span className="ml-2 text-primary/70">· {STUDIO_LABELS[activeStudio]}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <Dialog open={minAdvanceDialogOpen} onOpenChange={setMinAdvanceDialogOpen}>
          <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Réservation de dernière minute</DialogTitle>
              <DialogDescription className="text-zinc-300 leading-relaxed">
                Les réservations en ligne ne sont pas possibles moins de {minAdvanceHours}h avant le début de la session. Nous vous invitons à nous contacter au <span className="font-semibold text-white whitespace-nowrap">06 13 44 08 75</span> afin de vérifier ensemble si une réservation reste possible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setMinAdvanceDialogOpen(false)} className="w-full">
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
