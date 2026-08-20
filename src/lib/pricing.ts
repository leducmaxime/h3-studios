import {
  isPeakTime,
  ALL_TIME_SLOTS,
  SLOT_DURATION_MINUTES,
  type StudioId,
  type GroupType,
} from "./booking";
import type { DbPricing } from "./db-types";

export interface PricingGrid {
  [studioId: string]: {
    [groupType: string]: {
      peak: number;
      offPeak: number;
    };
  };
}

export interface MinMaxEntry {
  min: number;
  max: number;
}

export interface MinMaxByGroupType {
  [groupType: string]: MinMaxEntry;
}

export interface PricingData {
  grid: PricingGrid;
  minMaxByGroupType: MinMaxByGroupType;
  maxAdvanceDays: number;
  openingHours?: Record<string, Record<number, { open: string; close: string }>>;
  allowCash?: boolean;
}

export interface PriceSlot {
  time: string;
  isPeak: boolean;
  rate: number;
}

/**
 * Résolution versionnée : dernière version avec effective_from <= sessionDate.
 * Fallback : si aucune version n'est <= sessionDate, prendre la plus ancienne.
 * Returns cents (price_per_half_hour as stored).
 */
export function selectPriceCentsAsOf(
  rows: DbPricing[],
  studioId: string,
  groupType: string,
  isPeak: boolean,
  sessionDateISO: string,
): number {
  const matching = rows.filter(
    (row) =>
      row.studio_id === studioId &&
      row.group_type === groupType &&
      Boolean(row.is_peak) === isPeak,
  );
  const effective = matching
    .filter((row) => row.effective_from <= sessionDateISO)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return (effective[0] ?? matching.sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0])
    ?.price_per_half_hour ?? 0;
}

/** Construit la grille en €/heure à la date de séance donnée. */
export function buildPricingGridAsOf(rows: DbPricing[], sessionDateISO: string): PricingGrid {
  const grid: PricingGrid = {};
  const cells = new Set(rows.map((row) => `${row.studio_id}\0${row.group_type}`));

  for (const cell of cells) {
    const [studioId, groupType] = cell.split("\0");
    grid[studioId] ??= {};
    grid[studioId][groupType] = {
      offPeak: selectPriceCentsAsOf(rows, studioId, groupType, false, sessionDateISO) * 2 / 100,
      peak: selectPriceCentsAsOf(rows, studioId, groupType, true, sessionDateISO) * 2 / 100,
    };
  }

  return grid;
}

/** Liste les dates d'effet futures, distinctes et triées. */
export function listScheduledEffectiveDates(rows: DbPricing[], todayParisISO: string): string[] {
  return [...new Set(rows.map((row) => row.effective_from).filter((date) => date > todayParisISO))].sort();
}

/** Une version de grille servie par GET /api/pricing. */
export interface PricingVersion {
  effectiveFrom: string;
  grid: PricingGrid;
}

/**
 * Résout la grille en vigueur à la date de séance (miroir client de
 * `selectPriceCentsAsOf`) : la version au `effectiveFrom` le plus grand parmi
 * celles <= sessionDateISO.
 *
 * Volontairement indépendant de l'ordre du tableau : ne jamais se reposer sur
 * l'ordre d'émission de l'API, sinon un réordonnancement ferait silencieusement
 * retomber toute séance future sur la grille la plus ancienne.
 *
 * Repli : la version la plus ancienne, pour une séance antérieure à toute
 * version connue (dates passées autorisées côté admin).
 */
export function resolveGridForDate(
  versions: PricingVersion[],
  sessionDateISO: string,
): PricingGrid | null {
  let effective: PricingVersion | null = null;
  let earliest: PricingVersion | null = null;
  for (const version of versions) {
    if (
      version.effectiveFrom <= sessionDateISO &&
      (!effective || version.effectiveFrom > effective.effectiveFrom)
    ) {
      effective = version;
    }
    if (!earliest || version.effectiveFrom < earliest.effectiveFrom) {
      earliest = version;
    }
  }
  return (effective ?? earliest)?.grid ?? null;
}

/**
 * Get the hourly rate for a specific time slot using the pricing grid.
 * Grid values are in €/hour.
 */
export function getSlotRate(
  grid: PricingGrid,
  studioId: StudioId,
  groupType: GroupType,
  date: Date,
  time: string
): number {
  const peak = isPeakTime(date, time);
  // Optional chaining: a missing pricing row yields 0€ (same semantics as the
  // server-side getPricingForBooking fallback) instead of a render crash.
  return grid[studioId]?.[groupType]?.[peak ? "peak" : "offPeak"] ?? 0;
}

/**
 * Calculate total price for a time range using the pricing grid.
 * Grid values are in €/hour.
 */
export function calculatePrice(
  grid: PricingGrid,
  studioId: StudioId,
  groupType: GroupType,
  date: Date,
  startTime: string,
  endTime: string
): { total: number; breakdown: PriceSlot[] } {
  const startIndex = ALL_TIME_SLOTS.indexOf(startTime);
  const endIndex = ALL_TIME_SLOTS.indexOf(endTime);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return { total: 0, breakdown: [] };
  }

  const breakdown: PriceSlot[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const time = ALL_TIME_SLOTS[i];
    const peak = isPeakTime(date, time);
    const rate = grid[studioId]?.[groupType]?.[peak ? "peak" : "offPeak"] ?? 0;
    breakdown.push({ time, isPeak: peak, rate });
  }

  const total = breakdown.reduce(
    (sum, slot) => sum + (slot.rate * SLOT_DURATION_MINUTES) / 60,
    0
  );

  return { total, breakdown };
}
