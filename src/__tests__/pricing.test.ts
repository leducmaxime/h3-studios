import { describe, it, expect } from "vitest";
import {
  calculatePrice,
  getSlotRate,
  selectPriceCentsAsOf,
  buildPricingGridAsOf,
  listScheduledEffectiveDates,
  resolveGridForDate,
  type PricingGrid,
  type PricingVersion,
} from "../lib/pricing";
import type { DbPricing } from "../lib/db-types";
import {
  isPeakTime,
  formatPrice,
  calculateEquipmentPrice,
  validatePromoCode,
  calculatePromoDiscount,
  formatDuration,
  type StudioId,
  type GroupType,
  type EquipmentSelection,
} from "../lib/booking";

// Grid fixture matching the old hardcoded PRICING values (€/hour)
const TEST_GRID: PricingGrid = {
  "la-scene": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 18, peak: 22 },
  },
  "le-podium": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 15, peak: 18 },
  },
};

describe("isPeakTime", () => {
  it("should return true for evening hours (18h+)", () => {
    const weekday = new Date("2026-02-13");
    expect(weekday.getDay()).toBe(5);

    expect(isPeakTime(weekday, "18:00")).toBe(true);
    expect(isPeakTime(weekday, "19:30")).toBe(true);
    expect(isPeakTime(weekday, "22:00")).toBe(true);
  });

  it("should return false for off-peak hours on weekday", () => {
    const weekday = new Date("2026-02-13");
    
    expect(isPeakTime(weekday, "10:00")).toBe(false);
    expect(isPeakTime(weekday, "14:00")).toBe(false);
    expect(isPeakTime(weekday, "17:30")).toBe(false);
  });

  it("should return true for all hours on weekend", () => {
    const saturday = new Date("2026-02-14");
    expect(saturday.getDay()).toBe(6);
    
    expect(isPeakTime(saturday, "10:00")).toBe(true);
    expect(isPeakTime(saturday, "14:00")).toBe(true);
    expect(isPeakTime(saturday, "20:00")).toBe(true);

    const sunday = new Date("2026-02-15");
    expect(sunday.getDay()).toBe(0);
    
    expect(isPeakTime(sunday, "11:00")).toBe(true);
    expect(isPeakTime(sunday, "15:00")).toBe(true);
  });
});

describe("calculatePrice", () => {
  it("should calculate price for 1 hour solo off-peak", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice(TEST_GRID, "la-scene", "solo", weekday, "10:00", "11:00");
    
    expect(result.total).toBe(6);
    expect(result.breakdown).toHaveLength(2);
  });

  it("should calculate price for 2 hours group peak", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice(TEST_GRID, "la-scene", "group", weekday, "18:00", "20:00");
    
    expect(result.total).toBe(44);
    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown.every(s => s.isPeak)).toBe(true);
  });

  it("should calculate price for duo with mixed peak/off-peak", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice(TEST_GRID, "le-podium", "duo", weekday, "17:00", "19:00");
    
    expect(result.total).toBe(24);
    expect(result.breakdown).toHaveLength(4);
  });

  it("should return 0 for invalid time range", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice(TEST_GRID, "la-scene", "solo", weekday, "14:00", "14:00");
    
    expect(result.total).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("should handle midnight as end time", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice(TEST_GRID, "la-scene", "solo", weekday, "22:00", "00:00");

    // 22:00, 22:30, 23:00, 23:30 = 4 slots = 2h (00:00 is boundary, not a slot)
    expect(result.breakdown).toHaveLength(4);
    expect(result.total).toBe(12);
  });

  it("should get slot rate correctly", () => {
    const weekday = new Date("2026-02-13");
    const rate = getSlotRate(TEST_GRID, "la-scene", "solo", weekday, "10:00");
    expect(rate).toBe(6);
  });
});

describe("selectPriceCentsAsOf / buildPricingGridAsOf / listScheduledEffectiveDates (effective-dated)", () => {
  const makeRow = (
    studioId: string,
    groupType: string,
    isPeak: boolean,
    priceCents: number,
    effectiveFrom: string,
  ): DbPricing => ({
    id: crypto.randomUUID(),
    studio_id: studioId,
    group_type: groupType,
    is_peak: isPeak ? 1 : 0,
    price_per_half_hour: priceCents,
    updated_at: "2026-08-20 10:00:00",
    effective_from: effectiveFrom,
  });

  const rows = [
    makeRow("la-scene", "solo", false, 3000, "1970-01-01"),
    makeRow("la-scene", "solo", false, 6000, "2026-09-01"),
    makeRow("la-scene", "solo", false, 9000, "2026-12-01"),
    makeRow("la-scene", "solo", true, 4000, "1970-01-01"),
    makeRow("le-podium", "duo", false, 5000, "2026-09-01"),
  ];

  it("résout avant, à et après la date d'effet", () => {
    expect(selectPriceCentsAsOf(rows, "la-scene", "solo", false, "2026-08-20")).toBe(3000);
    expect(selectPriceCentsAsOf(rows, "la-scene", "solo", false, "2026-09-01")).toBe(6000);
    expect(selectPriceCentsAsOf(rows, "la-scene", "solo", false, "2026-09-15")).toBe(6000);
  });

  it("choisit la version correspondant à la date de séance", () => {
    expect(selectPriceCentsAsOf(rows, "la-scene", "solo", false, "2026-10-15")).toBe(6000);
    expect(selectPriceCentsAsOf(rows, "la-scene", "solo", false, "2026-12-15")).toBe(9000);
  });

  it("utilise la première version connue en cas d'absence de correspondance passée", () => {
    expect(selectPriceCentsAsOf(rows, "le-podium", "duo", false, "2026-08-01")).toBe(5000);
  });

  it("construit une grille en €/heure avec des cellules à des frontières différentes", () => {
    const before = buildPricingGridAsOf(rows, "2026-08-20");
    const after = buildPricingGridAsOf(rows, "2026-09-15");
    expect(before["la-scene"].solo.offPeak).toBe(60);
    expect(after["la-scene"].solo.offPeak).toBe(120);
    expect(after["le-podium"].duo.offPeak).toBe(100);
  });

  it("liste les dates futures distinctes et triées", () => {
    expect(listScheduledEffectiveDates(rows, "2026-08-20")).toEqual(["2026-09-01", "2026-12-01"]);
  });
});

describe("formatPrice", () => {
  it("should format integer prices without decimals and suffix TTC", () => {
    expect(formatPrice(10)).toBe("10€ TTC");
    expect(formatPrice(100)).toBe("100€ TTC");
  });

  it("should format decimal prices with comma and suffix TTC", () => {
    expect(formatPrice(10.5)).toBe("10,50€ TTC");
    expect(formatPrice(12.75)).toBe("12,75€ TTC");
  });

  it("should omit the TTC suffix when bare is set", () => {
    expect(formatPrice(10, { bare: true })).toBe("10€");
    expect(formatPrice(10.5, { bare: true })).toBe("10,50€");
  });
});

describe("formatDuration", () => {
  it("should format 1 hour", () => {
    expect(formatDuration("10:00", "11:00")).toBe("1h");
  });

  it("should format multiple hours", () => {
    expect(formatDuration("10:00", "12:00")).toBe("2h");
    expect(formatDuration("10:00", "14:00")).toBe("4h");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration("10:00", "11:30")).toBe("1h30");
    expect(formatDuration("10:00", "12:30")).toBe("2h30");
  });

  it("should format minutes only", () => {
    expect(formatDuration("10:00", "10:30")).toBe("30min");
  });

  it("should handle midnight as end time", () => {
    // 22:00 -> 00:00 = 4 slots = 2h (00:00 is boundary, not a slot)
    expect(formatDuration("22:00", "00:00")).toBe("2h");
    // 23:00 -> 00:00 = 2 slots = 1h
    expect(formatDuration("23:00", "00:00")).toBe("1h");
    // 23:30 -> 00:00 = 1 slot = 30min
    expect(formatDuration("23:30", "00:00")).toBe("30min");
  });
});

describe("calculateEquipmentPrice", () => {
  it("should calculate session-based equipment price", () => {
    const equipment: EquipmentSelection[] = [
      { id: "cymbal", quantity: 1 },
    ];
    const price = calculateEquipmentPrice(equipment, 2);
    expect(price).toBe(3);
  });

  it("should calculate multiple session items", () => {
    const equipment: EquipmentSelection[] = [
      { id: "guitar", quantity: 2 },
    ];
    const price = calculateEquipmentPrice(equipment, 2);
    expect(price).toBe(6);
  });

  it("should return 0 for empty equipment", () => {
    const price = calculateEquipmentPrice([], 2);
    expect(price).toBe(0);
  });

  it("should return 0 for quantity exceeding session pricing array", () => {
    const equipment: EquipmentSelection[] = [
      { id: "mic", quantity: 5 },
    ];
    const price = calculateEquipmentPrice(equipment, 2);
    expect(price).toBe(0);
  });

  it("should use max available session pricing", () => {
    const equipment: EquipmentSelection[] = [
      { id: "mic", quantity: 4 },
    ];
    const price = calculateEquipmentPrice(equipment, 2);
    expect(price).toBe(6);
  });
});

describe("validatePromoCode", () => {
  it("should validate existing promo code", () => {
    const result = validatePromoCode("BIENVENUE", 20);
    expect(result.valid).toBe(true);
    expect(result.promo?.value).toBe(10);
  });

  it("should be case-insensitive", () => {
    const result = validatePromoCode("bienvenue", 20);
    expect(result.valid).toBe(true);
  });

  it("should trim whitespace", () => {
    const result = validatePromoCode("  BIENVENUE  ", 20);
    expect(result.valid).toBe(true);
  });

  it("should reject invalid code", () => {
    const result = validatePromoCode("INVALID", 20);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Code promo invalide");
  });

  it("should reject code if minTotal not met", () => {
    const result = validatePromoCode("H3AMIS", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("minimum");
  });

  it("should accept code if minTotal met", () => {
    const result = validatePromoCode("H3AMIS", 20);
    expect(result.valid).toBe(true);
  });
});

describe("calculatePromoDiscount", () => {
  it("should calculate percentage discount", () => {
    const promo = { code: "TEST", type: "percentage" as const, value: 10, description: "" };
    const discount = calculatePromoDiscount(promo, 100);
    expect(discount).toBe(10);
  });

  it("should calculate fixed discount", () => {
    const promo = { code: "TEST", type: "fixed" as const, value: 5, description: "" };
    const discount = calculatePromoDiscount(promo, 100);
    expect(discount).toBe(5);
  });

  it("should cap fixed discount at total", () => {
    const promo = { code: "TEST", type: "fixed" as const, value: 50, description: "" };
    const discount = calculatePromoDiscount(promo, 30);
    expect(discount).toBe(30);
  });
});

describe("resolveGridForDate", () => {
  const gridWith = (rate: number): PricingGrid => ({
    "la-scene": { solo: { peak: rate, offPeak: rate } },
  });
  const base = { effectiveFrom: "1970-01-01", grid: gridWith(30) };
  const autumn = { effectiveFrom: "2026-09-01", grid: gridWith(40) };
  const winter = { effectiveFrom: "2026-12-01", grid: gridWith(50) };
  const rate = (versions: PricingVersion[], date: string) =>
    resolveGridForDate(versions, date)?.["la-scene"].solo.peak;

  it("resolves the version in force on the session date", () => {
    expect(rate([base, autumn, winter], "2026-08-20")).toBe(30);
    expect(rate([base, autumn, winter], "2026-10-15")).toBe(40);
    expect(rate([base, autumn, winter], "2026-12-25")).toBe(50);
  });

  it("treats effective_from as inclusive on the activation day", () => {
    expect(rate([base, autumn], "2026-08-31")).toBe(30);
    expect(rate([base, autumn], "2026-09-01")).toBe(40);
  });

  // Regression: the resolver must pick the greatest matching effectiveFrom,
  // never the last matching array element. Emission order from GET /api/pricing
  // is not a contract — if it ever changed, an order-dependent resolver would
  // silently quote every future session at the oldest grid.
  it("is independent of the order of the versions array", () => {
    const shuffled = [winter, base, autumn];
    expect(rate(shuffled, "2026-08-20")).toBe(30);
    expect(rate(shuffled, "2026-10-15")).toBe(40);
    expect(rate(shuffled, "2026-12-25")).toBe(50);
  });

  it("falls back to the earliest version for a session before any version", () => {
    expect(rate([winter, autumn], "2026-01-01")).toBe(40);
  });

  it("returns null when there is no version at all", () => {
    expect(resolveGridForDate([], "2026-08-20")).toBeNull();
  });
});
