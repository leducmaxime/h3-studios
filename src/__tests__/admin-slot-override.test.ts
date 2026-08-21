import { describe, it, expect } from "vitest";
import {
  isOverrideRangeValid,
  isSlotOutsideOpeningHours,
  getAdminSlotWarnings,
  slotDurationSlots,
} from "@/lib/booking";

const tuesday = new Date(2026, 0, 6); // Jan 6, 2026 = Tuesday — la-scene 10:00–00:00

describe("isOverrideRangeValid", () => {
  it("accepts a 30-minute range", () => {
    expect(isOverrideRangeValid("10:00", "10:30")).toBe(true);
    expect(slotDurationSlots("10:00", "10:30")).toBe(1);
  });

  it("accepts a range that ends at midnight", () => {
    expect(isOverrideRangeValid("23:00", "00:00")).toBe(true);
  });

  it("rejects equal ranges and accepts an overnight range", () => {
    expect(isOverrideRangeValid("10:00", "10:00")).toBe(false);
    expect(isOverrideRangeValid("23:00", "03:00")).toBe(true);
  });

  it("rejects unknown times", () => {
    expect(isOverrideRangeValid("10:15", "11:00")).toBe(false);
  });
});

describe("isSlotOutsideOpeningHours", () => {
  it("marks pre-open slots as outside hours", () => {
    expect(isSlotOutsideOpeningHours("la-scene", tuesday, "09:00")).toBe(true);
    expect(isSlotOutsideOpeningHours("la-scene", tuesday, "10:00")).toBe(false);
  });
});

describe("getAdminSlotWarnings", () => {
  it("flags past date, short duration, occupied overlap, and closed hours", () => {
    const warnings = getAdminSlotWarnings({
      date: new Date(2026, 0, 5),
      startTime: "09:00",
      endTime: "09:30",
      studioId: "la-scene",
      occupiedTimes: ["09:00"],
      todayISO: "2026-01-06",
    });
    expect(warnings).toContain("Date passée");
    expect(warnings).toContain("Durée inférieure à 1 heure");
    expect(warnings).toContain("Chevauche une réservation ou un blocage existant");
    expect(warnings).toContain("Hors horaires d'ouverture");
  });

  it("returns no warnings for a clean future 1h slot", () => {
    expect(getAdminSlotWarnings({
      date: new Date(2026, 0, 7),
      startTime: "10:00",
      endTime: "11:00",
      studioId: "la-scene",
      occupiedTimes: [],
      todayISO: "2026-01-06",
    })).toEqual([]);
  });
});
