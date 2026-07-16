import {
  isPeakTime,
  ALL_TIME_SLOTS,
  SLOT_DURATION_MINUTES,
  type StudioId,
  type GroupType,
} from "./booking";

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
}

export interface PriceSlot {
  time: string;
  isPeak: boolean;
  rate: number;
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
  return grid[studioId][groupType][peak ? "peak" : "offPeak"];
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
  let endIndex = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIndex = ALL_TIME_SLOTS.indexOf("00:00");

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return { total: 0, breakdown: [] };
  }

  const breakdown: PriceSlot[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const time = ALL_TIME_SLOTS[i];
    const peak = isPeakTime(date, time);
    const rate = grid[studioId][groupType][peak ? "peak" : "offPeak"];
    breakdown.push({ time, isPeak: peak, rate });
  }

  const total = breakdown.reduce(
    (sum, slot) => sum + (slot.rate * SLOT_DURATION_MINUTES) / 60,
    0
  );

  return { total, breakdown };
}
