import { describe, it, expect } from "vitest";
import { computeBookingQuote, type BookingQuoteInput } from "@/lib/booking";

// Mêmes tarifs DB que la grille publique (€/demi-heure) pour La Scène groupe.
const PEAK = 11; // 22€/h
const OFF_PEAK = 9; // 18€/h

function baseInput(overrides: Partial<BookingQuoteInput> = {}): BookingQuoteInput {
  return {
    studioId: "la-scene",
    groupType: "group",
    date: "2026-02-13", // vendredi
    startTime: "18:00",
    endTime: "20:00",
    peakStartHour: 18,
    publicHolidays: [],
    peakRatePerHalfHour: PEAK,
    offPeakRatePerHalfHour: OFF_PEAK,
    ...overrides,
  };
}

describe("computeBookingQuote (shared admin + public quote)", () => {
  it("computes base price per-slot with the configured peak threshold", () => {
    const quote = computeBookingQuote(baseInput());
    // 18:00–20:00 = 4 demi-heures, toutes "peak" (seuil 18h) à 11€ = 44€
    expect(quote.basePrice).toBe(44);
    expect(quote.equipmentPrice).toBe(0);
    expect(quote.totalPrice).toBe(44);
    expect(quote.slotBreakdown).toHaveLength(4);
    expect(quote.slotBreakdown.every((s) => s.isPeak)).toBe(true);
  });

  it("honors a custom peak_start_hour setting — no hard-coded 18h", () => {
    const quote = computeBookingQuote(baseInput({ peakStartHour: 20 }));
    // 18:00–20:00 : aucun créneau >= 20h → tout off-peak à 9€ = 36€
    expect(quote.basePrice).toBe(36);
    expect(quote.slotBreakdown.every((s) => !s.isPeak)).toBe(true);
  });

  it("treats public holidays as peak regardless of the hour", () => {
    // 2026-01-01 (jeudi, jour férié) 10:00–11:00 en semaine → quand même peak
    const quote = computeBookingQuote(baseInput({ date: "2026-01-01", startTime: "10:00", endTime: "11:00", publicHolidays: ["2026-01-01"] }));
    expect(quote.basePrice).toBe(22); // 2 demi-heures * 11
    expect(quote.slotBreakdown.every((s) => s.isPeak)).toBe(true);
  });

  it("produces identical output for the same input (public == admin)", () => {
    const a = computeBookingQuote(baseInput());
    const b = computeBookingQuote(baseInput());
    expect(a).toEqual(b);
  });

  it("adds equipment price to the gross total (total = base + equipment)", () => {
    const quote = computeBookingQuote(baseInput({
      equipment: [{ id: "cymbal", quantity: 1 }],
      equipmentCatalogue: [{ id: "cymbal", pricingType: "session", sessionPricing: [3, 5], pricePerHour: 0 }],
    }));
    expect(quote.equipmentPrice).toBe(3);
    expect(quote.totalPrice).toBe(44 + 3);
  });

  it("handles midnight as end time (boundary slot excluded)", () => {
    const quote = computeBookingQuote(baseInput({ startTime: "22:00", endTime: "00:00" }));
    // 22:00, 22:30, 23:00, 23:30 = 4 créneaux (00:00 = fin de journée)
    expect(quote.slotBreakdown).toHaveLength(4);
    expect(quote.basePrice).toBe(44);
  });

  it("returns a zero quote for an invalid range instead of crashing", () => {
    const quote = computeBookingQuote(baseInput({ startTime: "14:00", endTime: "14:00" }));
    expect(quote.basePrice).toBe(0);
    expect(quote.totalPrice).toBe(0);
    expect(quote.slotBreakdown).toHaveLength(0);
  });
});
