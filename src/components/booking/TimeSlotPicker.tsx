"use client";

import { useState, useCallback, useMemo, useEffect, useRef, useId } from "react";
import { ChevronLeft, Clock, ArrowRight } from "lucide-react";
import {
  getStudioTimeSlots,
  formatDate,
  STUDIOS,
  ALL_TIME_SLOTS,
  canBeStartTime,
  canBeEndTime,
  isPeakTime,
  isOverrideRangeValid,
  isSlotOutsideOpeningHours,
  type GroupType,
  type StudioId,
} from "@/lib/booking";
import { calculatePrice } from "@/lib/pricing";
import type { PricingGrid } from "@/lib/pricing";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { Price } from "@/components/common/Price";

type SlotData = { time: string; available: boolean; groupType?: string; bookingId?: string };

interface TimeSlotPickerProps {
  date: Date;
  slotsByStudio: Record<string, SlotData[]>;
  startTime: string | null;
  endTime: string | null;
  studioId: StudioId | null;
  onSelectRange: (start: string, end: string, studioId: StudioId) => void;
  onClear: () => void;
  onBack: () => void;
  hideHeader?: boolean;
  groupType?: GroupType;
  pricingGrid?: PricingGrid | null;
  /** True while the availability fetch for `date` is in flight. */
  slotsLoading?: boolean;
  /** Error message from the pricing fetch, or null. */
  pricingError?: string | null;
  /** Refetch pricing data. */
  refetchPricing?: () => void;
  /** When true, every slot of the day renders as unavailable. */
  todayFullyBlocked?: boolean;
  allowOverride?: boolean;
}

const STUDIO_LABELS: Record<StudioId, string> = {
  "la-scene": "LA SCÈNE",
  "le-podium": "LE PODIUM",
};

/** Shown on hover/focus for slots usable as an end but not a start. */
const MIN_DURATION_HINT = "Durée minimum de réservation : 1 heure";

// Slot grid tracks: auto-fill with a 44px minimum cell width, instead of the
// old fixed `ceil(slots.length / 3)` column count. That formula was unbounded
// — in a narrow container (admin reschedule modal) 31 slots forced 11
// columns of ~29px cells for ~33px labels, and 48 slots (#77) would be
// worse. Auto-fill derives the column count from the actual container width,
// so ANY slots.length wraps to as many rows as needed while cells always fit
// their content. 44px fits a "10h30" label at lg:text-xs (~34px) plus
// borders, and the compact DÉBUT/FIN badge (~35px). Both studio grids occupy
// equal-width tracks, so auto-fill also keeps their column counts identical.
const SLOT_GRID_TEMPLATE = "repeat(auto-fill, minmax(44px, 1fr))";

type SlotPresentation = { className: string; hint: string | null };

// Softer variant of the normal free-slot hue: the slot stays in its color
// family (peak amber / off-peak neutral) at reduced intensity — free, just not
// a valid boundary here. Never the greyed-out "unavailable" look.
// Peak slots are outline-only: an amber border on the neutral background,
// white text like off-peak, no amber fill — the fill is reserved for the
// selection.
const softFreeStyle = (isPeak: boolean, cursor: string): string =>
  isPeak
    ? `bg-white/5 border-amber-400/50 text-white ${cursor}`
    : `bg-white/[0.03] border-white/5 text-white/50 ${cursor}`;

export function TimeSlotPicker({
  date,
  slotsByStudio,
  startTime,
  endTime,
  studioId: initialStudioId,
  onSelectRange,
  onClear,
  onBack,
  hideHeader = false,
  groupType = "group",
  pricingGrid,
  slotsLoading = false,
  pricingError = null,
  refetchPricing,
  todayFullyBlocked = false,
  allowOverride = false,
}: TimeSlotPickerProps) {
  const [selectedStart, setSelectedStart] = useState<string | null>(startTime);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(endTime);
  const [activeStudio, setActiveStudio] = useState<StudioId | null>(initialStudioId);
  const [hoveredSlot, setHoveredSlot] = useState<{ slot: string; studioId: StudioId } | null>(null);
  // Slot hint (« Hors horaires », min-duration) currently disclosed by
  // hover/focus. Rendered in ONE shared line per studio below the grid —
  // never inside a 44px cell — so the text stays fully legible with zero
  // per-cell overflow or neighbor overlap.
  const [activeHint, setActiveHint] = useState<{ studioId: StudioId; text: string } | null>(null);
  const hintIdBase = useId();
  // Set when the parent is cleared as part of an internal transition that
  // immediately rebuilds local selection state — the resulting prop sync
  // must not wipe it.
  const skipPropSyncRef = useRef(false);

  const selectionMode = selectedStart && selectedEnd ? "done" : selectedStart ? "end" : "start";

  useEffect(() => {
    if (skipPropSyncRef.current) {
      skipPropSyncRef.current = false;
      return;
    }
    setSelectedStart(startTime);
    setSelectedEnd(endTime);
    if (initialStudioId) setActiveStudio(initialStudioId);
  }, [startTime, endTime, initialStudioId]);

  // Per-studio visible slots (based on opening hours).
  // NOTE: getStudioTimeSlots reads a module-level opening-hours store
  // populated by usePricing, so this memo can't key on the hours directly.
  // Keying on pricingGrid is the pragmatic fix: usePricing calls
  // setOpeningHours() in the same tick as setPricing(), so when the grid
  // flips null → loaded the memo recomputes with the real DB hours.
  // Combined with the slotsLoading || !pricingGrid skeleton gate below,
  // the slot grid only ever renders with correct geometry.
  const studioSlots = useMemo(() => {
    const result: Record<StudioId, string[]> = { "la-scene": [], "le-podium": [] };
    for (const studioId of ["la-scene", "le-podium"] as StudioId[]) {
      result[studioId] = allowOverride ? ALL_TIME_SLOTS : getStudioTimeSlots(studioId, date);
    }
    return result;
  }, [date, pricingGrid, allowOverride]);

  // Exact DB rates for a studio + the current group type, straight from the
  // grid. null = grid not loaded yet (the legend renders skeletons).
  const getStudioRates = useCallback(
    (studioId: StudioId) => pricingGrid?.[studioId]?.[groupType] ?? null,
    [pricingGrid, groupType]
  );

  // Peak coloring is grid-driven: only when the studio actually bills
  // evenings/weekends differently for this group type.
  const studioHasPeakPricing = useCallback(
    (studioId: StudioId): boolean => {
      const rates = getStudioRates(studioId);
      return rates !== null && rates.peak !== rates.offPeak;
    },
    [getStudioRates]
  );

  const checkSlotBooked = useCallback(
    (time: string, studioId: StudioId): boolean => {
      if (allowOverride) return slotsByStudio[studioId]?.find((s) => s.time === time)?.available === false;
      if (todayFullyBlocked) return true;
      const slots = slotsByStudio[studioId];
      if (!slots) return true;
      const slot = slots.find((s) => s.time === time);
      if (!slot) return true;
      return !slot.available;
    },
    [slotsByStudio, todayFullyBlocked, allowOverride]
  );

  const isStartOfOccupiedBlock = useCallback(
    (time: string, studioId: StudioId): boolean => {
      const availabilitySlots = slotsByStudio[studioId];
      const currentSlot = availabilitySlots?.find((slot) => slot.time === time);
      if (currentSlot?.available !== false) return false;

      const visibleSlots = studioSlots[studioId];
      const idx = visibleSlots.indexOf(time);
      if (idx <= 0) return false;

      const previousSlot = availabilitySlots?.find((slot) => slot.time === visibleSlots[idx - 1]);
      return previousSlot?.available !== false;
    },
    [slotsByStudio, studioSlots]
  );

  // Run-based slot analysis, per studio. Mirrors canBeStartTime's slice(0,-1)
  // runway semantics: the closing-boundary slot (last visible, end-only by
  // design) never counts as a bookable half-hour.
  // - deadFree[i]: free slot whose maximal contiguous free run holds fewer
  //   than 2 real slots — it can never belong to any booking (min 1h), so it
  //   renders as plain unavailable.
  // - endCapable[i]: occupied slot immediately preceded by ≥ 2 contiguous
  //   free real slots — a ≥1h booking can legally end on it. Covers the last
  //   visible slot with no special case.
  const slotRuns = useMemo(() => {
    const result: Record<StudioId, { deadFree: boolean[]; endCapable: boolean[] }> = {
      "la-scene": { deadFree: [], endCapable: [] },
      "le-podium": { deadFree: [], endCapable: [] },
    };
    for (const studioId of ["la-scene", "le-podium"] as StudioId[]) {
      const visible = studioSlots[studioId];
      const n = visible.length;
      const deadFree = new Array<boolean>(n).fill(false);
      const endCapable = new Array<boolean>(n).fill(false);
      result[studioId] = { deadFree, endCapable };
      if (n === 0) continue;

      const isFree = (i: number) => !checkSlotBooked(visible[i], studioId);
      const realCount = n - 1; // closing-boundary slot excluded from runway

      // Maximal contiguous free runs over real slots → run length per index.
      const runLenAt = new Array<number>(n).fill(0);
      let i = 0;
      while (i < realCount) {
        if (!isFree(i)) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < realCount && isFree(j + 1)) j++;
        for (let k = i; k <= j; k++) runLenAt[k] = j - i + 1;
        i = j + 1;
      }
      // Free real slots immediately before idx = length of the run containing
      // idx-1 (runs are maximal, so 0 when idx-1 is occupied or idx is 0).
      const precedingRun = (idx: number) => (idx > 0 ? runLenAt[idx - 1] : 0);

      for (let k = 0; k < realCount; k++) {
        if (isFree(k) && runLenAt[k] < 2) deadFree[k] = true;
      }
      // Closing-boundary slot: its only runway is the run right before it.
      if (isFree(n - 1) && precedingRun(n - 1) < 2) deadFree[n - 1] = true;
      // Occupied slots (incl. the closing one) reachable as a ≥1h booking end.
      for (let k = 1; k < n; k++) {
        if (!isFree(k) && precedingRun(k) >= 2) endCapable[k] = true;
      }
    }
    return result;
  }, [studioSlots, checkSlotBooked]);

  const handleClear = useCallback(() => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setActiveStudio(null);
    onClear();
  }, [onClear]);

  const tryConfirmRange = useCallback((start: string, end: string, studioId: StudioId): boolean => {
    if (allowOverride) {
      if (!isOverrideRangeValid(start, end)) return false;
      setSelectedStart(start);
      setSelectedEnd(end);
      onSelectRange(start, end, studioId);
      return true;
    }
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
    return true;
  }, [allowOverride, studioSlots, checkSlotBooked, onSelectRange, onClear]);

  const handleSlotClick = useCallback(
    (slot: string, studioId: StudioId) => {
      const switchingStudio = activeStudio !== null && studioId !== activeStudio;

      if (allowOverride) {
        if (selectionMode === "end" && !switchingStudio) {
          if (slot === selectedStart) {
            handleClear();
          } else if (isOverrideRangeValid(selectedStart!, slot)) {
            tryConfirmRange(selectedStart!, slot, studioId);
          } else if (slot !== "00:00" && ALL_TIME_SLOTS.indexOf(slot) < ALL_TIME_SLOTS.indexOf(selectedStart!)) {
            setSelectedStart(slot);
            setSelectedEnd(null);
          } else {
            handleClear();
          }
          return;
        }
        if (selectionMode === "done") {
          skipPropSyncRef.current = true;
          onClear();
        }
        if (slot === "00:00") {
          handleClear();
          return;
        }
        setSelectedStart(slot);
        setSelectedEnd(null);
        setActiveStudio(studioId);
        return;
      }

      // End mode on the studio holding the start: the click either completes
      // the range or deselects — there is no dead click.
      if (selectionMode === "end" && !switchingStudio) {
        if (
          slot !== selectedStart &&
          canBeEndTime(selectedStart!, slot, studioSlots[studioId], (t) => checkSlotBooked(t, studioId)) &&
          tryConfirmRange(selectedStart!, slot, studioId)
        ) {
          return; // Valid later slot → range confirmed.
        }
        // Start slot again, an unavailable slot, or anything before the start.
        handleClear();
        return;
      }

      // Everything else is a fresh start attempt — including a click on the
      // other studio mid-selection, which moves the start there in one click.
      // A confirmed range still lives in the parent: clear it so the recap
      // disappears, but keep the local state rebuilt just below (skip the
      // prop sync this clear triggers).
      if (selectionMode === "done") {
        skipPropSyncRef.current = true;
        onClear();
      }

      if (!canBeStartTime(slot, studioSlots[studioId], (t) => checkSlotBooked(t, studioId))) {
        // Unavailable or no 1h runway → full deselect.
        handleClear();
        return;
      }

      setSelectedStart(slot);
      setSelectedEnd(null);
      setActiveStudio(studioId);
    },
    [allowOverride, selectionMode, selectedStart, activeStudio, studioSlots, checkSlotBooked, tryConfirmRange, handleClear, onClear]
  );

  const handleSlotMouseEnter = useCallback(
    (slot: string, studioId: StudioId) => {
      if (selectionMode === "end") setHoveredSlot({ slot, studioId });
    },
    [selectionMode]
  );

  const handleSlotMouseLeave = useCallback(() => {
    setHoveredSlot(null);
  }, []);

  const getSlotStyle = useCallback(
    (slot: string, studioId: StudioId): SlotPresentation => {
      const isBooked = checkSlotBooked(slot, studioId);
      // Peak hue for the NORMAL free rendering — unavailable trumps peak.
      // The soft treatment hues by time instead (isPeakAtTime), so an
      // end-capable occupied boundary keeps its evening tint.
      const isPeakAtTime = studioHasPeakPricing(studioId) && isPeakTime(date, slot);
      const isPeak = !isBooked && isPeakAtTime;
      const isSameStudio = activeStudio === studioId;
      const isSelectedStart = selectedStart === slot && isSameStudio;
      const isSelectedEnd = selectedEnd === slot && isSameStudio;
      const isOccupiedBoundary = isStartOfOccupiedBlock(slot, studioId);
      const visibleSlots = studioSlots[studioId];
      const slotIdx = visibleSlots.indexOf(slot);
      const runs = slotRuns[studioId];
      // Free slot whose contiguous free run can't hold a 1h booking.
      const isDeadFree = !isBooked && slotIdx >= 0 && runs.deadFree[slotIdx] === true;
      // Occupied boundary a ≥1h booking can legally close on.
      const isEndCapableBoundary = isOccupiedBoundary && slotIdx >= 0 && runs.endCapable[slotIdx] === true;

      const ok = (className: string): SlotPresentation => ({ className, hint: null });
      // Slot usable as a booking END but not as a start (free without 1h
      // runway, or end-capable occupied boundary) → softened hue, tinted by
      // time of day, + min-duration tooltip.
      const soft = (cursor: string): SlotPresentation => ({
        className: softFreeStyle(isPeakAtTime, cursor),
        hint: MIN_DURATION_HINT,
      });

      // Selection highlight always wins; the amber border keeps the peak
      // nature of the slot legible.
      if (isSelectedStart || isSelectedEnd) {
        return ok(
          isPeak
            ? "bg-primary/50 border-amber-400 ring-2 ring-primary ring-offset-1 ring-offset-black cursor-pointer"
            : "bg-primary/40 border-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-black cursor-pointer"
        );
      }

      // Confirmed range: fill the interior so the booking reads as one block.
      if (selectionMode === "done" && isSameStudio && selectedStart && selectedEnd) {
        const startIdx = visibleSlots.indexOf(selectedStart);
        let endIdx = visibleSlots.indexOf(selectedEnd);
        if (selectedEnd === "00:00" && endIdx === -1) endIdx = visibleSlots.length;
        if (slotIdx > startIdx && slotIdx < endIdx) {
          return ok(
            isPeak
              ? "bg-primary/25 border-amber-400/50 cursor-pointer"
              : "bg-primary/20 border-primary/30 cursor-pointer"
          );
        }
      }

      // Occupied interior — hard-blocked, red on both studios alike.
      if (isBooked && !isOccupiedBoundary) {
        return ok("bg-red-500/30 border-red-500/50 cursor-not-allowed opacity-60");
      }

      // Dead free slot — its contiguous free run holds fewer than 2 real
      // slots, so it can never be part of any booking (min 1h): paint it
      // unavailable in every mode, no tooltip.
      if (isDeadFree) {
        return ok("bg-red-500/30 border-red-500/50 cursor-not-allowed opacity-60");
      }

      if (selectionMode === "end" && selectedStart) {
        if (isSameStudio) {
          const startIdx = visibleSlots.indexOf(selectedStart);

          if (slotIdx > startIdx) {
            // Only genuine end candidates get the end-zone treatment — free
            // slots parked behind an occupied one stay quiet (clicking them
            // deselects).
            if (!canBeEndTime(selectedStart, slot, visibleSlots, (t) => checkSlotBooked(t, studioId))) {
              // The slot right after the start fails only on the 1h minimum —
              // say so. Anything further ahead is unreachable (occupied block
              // between) and keeps the quiet muted style.
              if (!isBooked && slotIdx === startIdx + 1) return soft("cursor-not-allowed");
              return ok("bg-white/5 border-white/10 opacity-40 cursor-pointer");
            }
            // Range preview between the start and the hovered end candidate.
            const hoveredIdx =
              hoveredSlot && hoveredSlot.studioId === studioId ? visibleSlots.indexOf(hoveredSlot.slot) : -1;
            if (hoveredIdx > startIdx && slotIdx > startIdx && slotIdx < hoveredIdx) {
              return ok("bg-primary/30 border-primary/50 cursor-pointer");
            }
            return ok(
              isPeak
                ? "bg-white/10 hover:bg-white/20 border-amber-400/50 hover:border-amber-400/80 cursor-pointer"
                : "bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer"
            );
          }

          // At or before the start — clicking deselects.
          return ok("bg-white/5 border-white/10 opacity-40 cursor-pointer");
        }

        // Other studio: every slot is a potential new START here, never an end.
        if (!canBeStartTime(slot, visibleSlots, (t) => checkSlotBooked(t, studioId))) {
          if (isBooked) {
            // End-capable occupied boundary: a ≥1h booking may close on it —
            // softened hue + min-duration hint. A dead boundary (preceding
            // free run < 2) is plain unavailable.
            return isEndCapableBoundary
              ? soft("cursor-not-allowed")
              : ok("bg-red-500/30 border-red-500/50 cursor-not-allowed opacity-60");
          }
          return soft("cursor-not-allowed");
        }
        if (hoveredSlot?.studioId === studioId && hoveredSlot.slot === slot) {
          // Single-slot start preview.
          return ok("bg-primary/30 border-primary/60 ring-1 ring-primary/60 cursor-pointer");
        }
        return ok(
          isPeak
            ? "bg-white/5 hover:bg-white/10 border-amber-400/50 hover:border-amber-400/80 cursor-pointer"
            : "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer"
        );
      }

      // Start/done mode: slots that can't open a range. Only occupied-boundary
      // booked slots reach this branch (interiors returned red above): an
      // end-capable boundary gets the softened hue + min-duration tooltip, a
      // dead boundary goes red. Free slots without a 1h runway (incl. the
      // closing-boundary slot) keep the softened hue + tooltip.
      if (!canBeStartTime(slot, visibleSlots, (t) => checkSlotBooked(t, studioId))) {
        if (isBooked) {
          return isEndCapableBoundary
            ? soft("cursor-not-allowed")
            : ok("bg-red-500/30 border-red-500/50 cursor-not-allowed opacity-60");
        }
        return soft("cursor-not-allowed");
      }

      // Default free slot — equal prominence on both studios.
      return ok(
        isPeak
          ? "bg-white/5 hover:bg-white/10 border-amber-400/50 hover:border-amber-400/80 cursor-pointer"
          : "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer"
      );
    },
    [checkSlotBooked, isStartOfOccupiedBlock, studioHasPeakPricing, date, selectedStart, selectedEnd, activeStudio, selectionMode, hoveredSlot, studioSlots, slotRuns]
  );

  const getOverrideSlotStyle = useCallback(
    (slot: string, studioId: StudioId): SlotPresentation => {
      const isBooked = checkSlotBooked(slot, studioId);
      const isOutside = isSlotOutsideOpeningHours(studioId, date, slot);
      const isSameStudio = activeStudio === studioId;
      const isSelectedStart = selectedStart === slot && isSameStudio;
      const isSelectedEnd = selectedEnd === slot && isSameStudio;
      const isPeak = studioHasPeakPricing(studioId) && isPeakTime(date, slot);
      const visibleSlots = studioSlots[studioId];
      const slotIdx = visibleSlots.indexOf(slot);
      const ok = (className: string, hint: string | null = null): SlotPresentation => ({ className, hint });

      if (isSelectedStart || isSelectedEnd) {
        return ok(isPeak ? "bg-primary/50 border-amber-400 ring-2 ring-primary ring-offset-1 ring-offset-black cursor-pointer" : "bg-primary/40 border-primary/60 ring-2 ring-primary ring-offset-1 ring-offset-black cursor-pointer");
      }
      if (selectionMode === "done" && isSameStudio && selectedStart && selectedEnd) {
        const startIdx = visibleSlots.indexOf(selectedStart);
        let endIdx = visibleSlots.indexOf(selectedEnd);
        if (selectedEnd === "00:00") endIdx = visibleSlots.length;
        if (slotIdx > startIdx && slotIdx < endIdx) return ok(isPeak ? "bg-primary/25 border-amber-400/50 cursor-pointer" : "bg-primary/20 border-primary/30 cursor-pointer");
      }
      if (selectionMode === "end" && isSameStudio && selectedStart && slotIdx > visibleSlots.indexOf(selectedStart) && isOverrideRangeValid(selectedStart, slot)) {
        const hoveredIdx = hoveredSlot?.studioId === studioId ? visibleSlots.indexOf(hoveredSlot.slot) : -1;
        if (hoveredIdx > visibleSlots.indexOf(selectedStart) && slotIdx < hoveredIdx) return ok("bg-primary/30 border-primary/50 cursor-pointer");
        return ok(isPeak ? "bg-white/10 hover:bg-white/20 border-amber-400/50 hover:border-amber-400/80 cursor-pointer" : "bg-white/10 hover:bg-white/20 border-white/20 cursor-pointer");
      }
      if (isBooked) return ok("bg-red-500/30 border-red-500/50 cursor-pointer hover:bg-red-500/45");
      if (isOutside) return ok("bg-white/[0.02] border-dashed border-white/15 text-white/40 cursor-pointer", "Hors horaires");
      return ok(isPeak ? "bg-white/5 hover:bg-white/10 border-amber-400/50 hover:border-amber-400/80 cursor-pointer" : "bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer");
    },
    [checkSlotBooked, date, activeStudio, selectedStart, selectedEnd, studioHasPeakPricing, studioSlots, selectionMode, hoveredSlot]
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
    if (!selectedStart || !selectedEnd || !activeStudio || !pricingGrid) return null;
    const startIdx = ALL_TIME_SLOTS.indexOf(selectedStart);
    let endIdx = ALL_TIME_SLOTS.indexOf(selectedEnd);
    if (selectedEnd === "00:00") endIdx = ALL_TIME_SLOTS.length;
    const durationSlots = endIdx - startIdx;
    const durationHours = durationSlots * 0.5;
    const durationLabel = durationHours % 1 === 0 ? `${durationHours}h` : `${Math.floor(durationHours)}h30`;

    const price = calculatePrice(pricingGrid, activeStudio, groupType, date, selectedStart, selectedEnd).total;

    return {
      start: selectedStart.replace(":00", "h").replace(":30", "h30"),
      end: selectedEnd.replace(":00", "h").replace(":30", "h30"),
      duration: durationLabel,
      // Montant brut (number) : le rendu compose la mention « TTC »
      // en nœud subordonné via <Price> au moment de l'affichage.
      price,
    };
  }, [selectedStart, selectedEnd, activeStudio, groupType, date, pricingGrid]);

  const renderStudioBlock = (studioId: StudioId) => {
    const slots = studioSlots[studioId];
    const isActive = activeStudio === studioId;
    // The other studio has a selection in progress or confirmed — recede
    // this block, but keep it clickable (hover partially restores it).
    const isDimmed = activeStudio !== null && !isActive;
    const studio = STUDIOS[studioId];
    const rates = getStudioRates(studioId);
    // True when this studio/day has at least one visible off-peak bookable
    // slot (closing-boundary slot excluded — it is end-only, often 00:00, and
    // must not fake an off-peak band on a peak-only evening schedule).
    // Opening-hours based, NOT availability: a fully booked off-peak slot
    // still counts, this is a pricing legend.
    const hasOffPeakSlot = slots.slice(0, -1).some((slot) => !isPeakTime(date, slot));

    return (
      <div
        key={studioId}
        className={`group flex flex-col gap-3 rounded-2xl p-2 -m-2 transition-all duration-300 hover:bg-white/[0.04] ${
          isDimmed ? "saturate-[0.35] brightness-[0.72] hover:saturate-[0.9] hover:brightness-[0.95]" : ""
        }`}
      >
        {/* Mini-card */}
        <div
          className={`relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${
            isActive
              ? "border-primary shadow-[0_0_16px_-4px_var(--color-primary,theme(colors.primary))]"
              : "border-white/15 group-hover:border-primary/40 group-hover:shadow-[0_0_20px_-6px_var(--color-primary,theme(colors.primary))]"
          }`}
        >
          {/* Photo — same shared embla carousel as /les-studios (compact mode,
              manual navigation only: two auto-playing blocks side by side in
              the booking grid would be distracting). */}
          <div className="relative h-[130px] w-full overflow-hidden sm:h-[160px]">
            <ImageCarousel images={studio.images} autoPlay={false} compact />
            {/* Gradient overlay — pointer-events-none so the carousel arrows
                and dots underneath stay clickable. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Studio name + area */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-0.5 px-3 pb-2.5">
              <span className="text-sm font-bold tracking-widest text-white drop-shadow-lg uppercase">
                {studio.name}
                <span className="ml-1.5 font-semibold tracking-normal text-white/85 normal-case">
                  · {studio.size}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Slot grid — wraps to as many rows as the container width needs
            (see SLOT_GRID_TEMPLATE). Skeleton while availability or the
            pricing grid loads (C7: gating on the grid also masks the
            opening-hours race and guarantees exact geometry — same tracks
            as the real buttons, so no layout shift). Studio headers
            and photos stay visible. */}
        {slotsLoading || (!pricingGrid && !pricingError) ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: SLOT_GRID_TEMPLATE }}
            aria-busy="true"
            aria-label="Chargement des créneaux"
          >
            {slots.map((slot) => (
              <div
                key={slot}
                className="box-border h-10 min-w-0 animate-pulse rounded-lg border border-white/10 bg-white/10"
              />
            ))}
          </div>
        ) : pricingError && !pricingGrid ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5">
            <span className="text-sm text-red-300">Impossible de charger les tarifs.</span>
            {refetchPricing && (
              <button
                type="button"
                onClick={refetchPricing}
                className="shrink-0 rounded-md border border-red-400/40 px-2.5 py-1 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20"
              >
                Réessayer
              </button>
            )}
          </div>
        ) : (
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: SLOT_GRID_TEMPLATE }}
        >
          {slots.map((slot) => {
            const { className: style, hint } = allowOverride
              ? getOverrideSlotStyle(slot, studioId)
              : getSlotStyle(slot, studioId);
            const isStart = selectedStart === slot && activeStudio === studioId;
            const isEnd = selectedEnd === slot && activeStudio === studioId;
            // Mid-selection, the other studio previews this slot as a
            // potential new start — never as an end.
            const isStartPreview =
              selectionMode === "end" &&
              activeStudio !== null &&
              activeStudio !== studioId &&
              hoveredSlot?.studioId === studioId &&
              hoveredSlot.slot === slot &&
              (allowOverride || canBeStartTime(slot, slots, (t) => checkSlotBooked(t, studioId)));

            return (
              <button
                key={slot}
                type="button"
                className={`group/slot relative box-border h-10 min-w-0 rounded-lg border transition-all duration-150 ${style}`}
                onClick={() => handleSlotClick(slot, studioId)}
                onMouseEnter={() => {
                  handleSlotMouseEnter(slot, studioId);
                  setActiveHint(hint ? { studioId, text: hint } : null);
                }}
                onMouseLeave={() => {
                  handleSlotMouseLeave();
                  setActiveHint(null);
                }}
                onFocus={() => {
                  if (hint) setActiveHint({ studioId, text: hint });
                }}
                onBlur={() => setActiveHint(null)}
                aria-disabled={!allowOverride && hint ? true : undefined}
                aria-describedby={
                  hint && activeHint?.studioId === studioId && activeHint.text === hint
                    ? `${hintIdBase}-${studioId}`
                    : undefined
                }
              >
                <div className="flex h-full items-center justify-center">
                  <span className="text-[11px] font-semibold leading-none lg:text-xs">
                    {formatHourLabel(slot)}
                  </span>
                </div>
                {isStart && (
                  // Compact badge (~35px) capped to the cell width: it stays
                  // inside the 44px-min cell footprint and can no longer
                  // overlap neighboring cells or inflate the cell's overflow.
                  <div className="absolute inset-x-0 top-0 z-10 overflow-hidden truncate rounded-b bg-primary px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-black">
                    DÉBUT
                  </div>
                )}
                {isEnd && (
                  <div className="absolute inset-x-0 top-0 z-10 overflow-hidden truncate rounded-b bg-primary px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-black">
                    FIN
                  </div>
                )}
                {isStartPreview && (
                  <div className="absolute inset-x-0 top-0 z-10 overflow-hidden truncate rounded-b bg-primary/70 px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-black">
                    DÉBUT
                  </div>
                )}
              </button>
            );
          })}
        </div>
        )}

        {/* Shared slot-hint line — the visible disclosure for « Hors horaires »
            and the min-duration hint. In normal flow, outside the grid, with a
            reserved line height: it can't overflow a cell, can't overlap the
            row above/below, and shows nothing (but keeps its height) when no
            hinted slot is hovered/focused. */}
        <p
          id={`${hintIdBase}-${studioId}`}
          className="min-h-4 text-center text-[11px] leading-4 text-amber-200/80"
        >
          {activeHint?.studioId === studioId ? activeHint.text : ""}
        </p>

        {/* Per-studio price legend — exact DB rates via the pricing grid.
            text-white/70 (pas /50) : l'opacité 0.6 de la mention « TTC/h » se
            compose avec l'alpha du parent — à /50 elle tombait à 0.30
            effectif, sous le plancher de lisibilité. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/70">
          {rates === null ? (
            <>
              <span className="h-3.5 w-28 animate-pulse rounded bg-white/10" />
              <span className="h-3.5 w-24 animate-pulse rounded bg-white/10" />
            </>
          ) : rates.peak !== rates.offPeak ? (
            <>
              {hasOffPeakSlot && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded border border-white/10 bg-white/5" />
                  <span>Heure creuse — <Price amount={rates.offPeak} unit="/h" /></span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded border border-amber-400/50 bg-white/5" />
                <span>Heure pleine — <Price amount={rates.peak} unit="/h" /></span>
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded border border-white/10 bg-white/5" />
              <span>Tarif — <Price amount={rates.offPeak} unit="/h" /></span>
            </span>
          )}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {renderStudioBlock("la-scene")}
          {renderStudioBlock("le-podium")}
        </div>

        {/* Legend — slot states. Prices live under each studio block. */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
            Indisponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-primary/40 border border-primary/60" />
            Sélectionné
          </span>
          {allowOverride && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-4 w-4 rounded border border-dashed border-white/15 bg-white/[0.02]" />
              Hors horaires
            </span>
          )}
        </div>

        {priceInfo && (
          <div className="rounded-xl border bg-primary/10 border-primary/30 p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="text-lg font-semibold">
                  {priceInfo.start} <ArrowRight className="inline w-4 h-4 mx-1" /> {priceInfo.end}
                </div>
                <div className="text-sm text-white/70">
                  {priceInfo.duration} · <Price amount={priceInfo.price} />
                  {activeStudio && (
                    <span className="ml-2 text-primary/70">· {STUDIO_LABELS[activeStudio]}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
