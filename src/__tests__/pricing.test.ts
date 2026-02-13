import { describe, it, expect } from "vitest";
import {
  calculatePrice,
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
    const result = calculatePrice("la-scene", "solo", weekday, "10:00", "11:00");
    
    expect(result.total).toBe(6);
    expect(result.breakdown).toHaveLength(2);
  });

  it("should calculate price for 2 hours group peak", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice("la-scene", "group", weekday, "18:00", "20:00");
    
    expect(result.total).toBe(44);
    expect(result.breakdown).toHaveLength(4);
    expect(result.breakdown.every(s => s.isPeak)).toBe(true);
  });

  it("should calculate price for duo with mixed peak/off-peak", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice("le-podium", "duo", weekday, "17:00", "19:00");
    
    expect(result.total).toBe(24);
    expect(result.breakdown).toHaveLength(4);
  });

  it("should return 0 for invalid time range", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice("la-scene", "solo", weekday, "14:00", "14:00");
    
    expect(result.total).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("should handle midnight as end time", () => {
    const weekday = new Date("2026-02-13");
    const result = calculatePrice("la-scene", "solo", weekday, "22:00", "00:00");
    
    expect(result.breakdown).toHaveLength(4);
    expect(result.total).toBe(12);
  });
});

describe("formatPrice", () => {
  it("should format integer prices without decimals", () => {
    expect(formatPrice(10)).toBe("10€");
    expect(formatPrice(100)).toBe("100€");
  });

  it("should format decimal prices with comma", () => {
    expect(formatPrice(10.5)).toBe("10,50€");
    expect(formatPrice(12.75)).toBe("12,75€");
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
    expect(formatDuration("22:00", "00:00")).toBe("2h");
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
