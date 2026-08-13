import { describe, expect, it } from "vitest";
import {
  computeBookingQuote,
  equipmentLinesTotal,
  parseBookingEquipmentLines,
  resolveEquipmentDisplay,
  type BookingQuoteInput,
} from "@/lib/booking";

const PEAK = 11;
const OFF_PEAK = 9;

function baseInput(overrides: Partial<BookingQuoteInput> = {}): BookingQuoteInput {
  return {
    studioId: "la-scene",
    groupType: "group",
    date: "2026-02-13",
    startTime: "18:00",
    endTime: "20:00",
    peakStartHour: 18,
    publicHolidays: [],
    peakRatePerHalfHour: PEAK,
    offPeakRatePerHalfHour: OFF_PEAK,
    ...overrides,
  };
}

describe("parseBookingEquipmentLines", () => {
  it("keeps old {id, quantity} without inventing a lineTotal", () => {
    const lines = parseBookingEquipmentLines('[{"id":"cymbal","quantity":2}]');
    expect(lines).toEqual([{ id: "cymbal", quantity: 2 }]);
    expect(lines[0].lineTotal).toBeUndefined();
  });

  it("preserves new {id, name, quantity, lineTotal}", () => {
    const lines = parseBookingEquipmentLines([
      { id: "mic", name: "Micro supplémentaire", quantity: 4, lineTotal: 6 },
    ]);
    expect(lines).toEqual([
      { id: "mic", name: "Micro supplémentaire", quantity: 4, lineTotal: 6 },
    ]);
  });

  it("accepts legacy price as lineTotal", () => {
    const lines = parseBookingEquipmentLines([{ id: "bass", quantity: 1, price: 3 }]);
    expect(lines[0].lineTotal).toBe(3);
  });

  it("returns [] for invalid JSON or non-arrays", () => {
    expect(parseBookingEquipmentLines("not-json")).toEqual([]);
    expect(parseBookingEquipmentLines({ id: "cymbal" })).toEqual([]);
    expect(parseBookingEquipmentLines(null)).toEqual([]);
  });
});

describe("equipmentLinesTotal", () => {
  it("uses persisted subtotal for legacy lines and catalogue lookup names", () => {
    const display = resolveEquipmentDisplay('[{"id":"cymbal","quantity":2}]', 3, id => id === "cymbal" ? "2 Cymbales Crash" : undefined);
    expect(display.showLinePrices).toBe(false);
    expect(display.subtotal).toBe(3);
    expect(display.lines[0]).toEqual({ id: "cymbal", quantity: 2, name: "2 Cymbales Crash" });
  });
  it("shows matching persisted line prices only when totals match", () => {
    expect(resolveEquipmentDisplay([{ id: "mic", quantity: 1, lineTotal: 3 }], 3).showLinePrices).toBe(true);
    const mismatch = resolveEquipmentDisplay([{ id: "mic", quantity: 1, lineTotal: 3 }], 4);
    expect(mismatch.showLinePrices).toBe(false);
    expect(mismatch.subtotal).toBe(4);
  });
  it("returns null when any line is missing lineTotal", () => {
    expect(equipmentLinesTotal([{ id: "cymbal", quantity: 2 }])).toBeNull();
  });

  it("sums lineTotals when every line has one", () => {
    expect(equipmentLinesTotal([
      { id: "cymbal", quantity: 1, lineTotal: 3 },
      { id: "mic", quantity: 4, lineTotal: 6 },
    ])).toBe(9);
  });

  it("legacy JSON + persisted equipment_price uses the persisted subtotal", () => {
    const lines = parseBookingEquipmentLines('[{"id":"cymbal","quantity":2}]');
    expect(equipmentLinesTotal(lines)).toBeNull();
    const equipmentPrice = 3;
    expect(equipmentLinesTotal(lines) ?? equipmentPrice).toBe(3);
  });
});

describe("computeBookingQuote equipment lines", () => {
  it("emits mic ×4 lineTotal 6 and sum === equipmentPrice", () => {
    const quote = computeBookingQuote(baseInput({
      equipment: [{ id: "mic", quantity: 4 }],
      equipmentCatalogue: [{
        id: "mic",
        name: "Micro supplémentaire",
        pricingType: "session",
        sessionPricing: [3, 5, 6, 6],
        pricePerHour: 2,
      }],
    }));
    expect(quote.equipmentLines).toEqual([
      { id: "mic", name: "Micro supplémentaire", quantity: 4, lineTotal: 6 },
    ]);
    expect(quote.equipmentPrice).toBe(6);
    expect(equipmentLinesTotal(quote.equipmentLines)).toBe(quote.equipmentPrice);
  });

  it("keeps Σ lineTotal === equipmentPrice across several items", () => {
    const quote = computeBookingQuote(baseInput({
      equipment: [
        { id: "cymbal", quantity: 1 },
        { id: "mic", quantity: 4 },
        { id: "guitar", quantity: 2 },
      ],
      equipmentCatalogue: [
        { id: "cymbal", name: "2 Cymbales Crash", pricingType: "session", sessionPricing: [3], pricePerHour: 0 },
        { id: "mic", name: "Micro supplémentaire", pricingType: "session", sessionPricing: [3, 5, 6, 6], pricePerHour: 2 },
        { id: "guitar", name: "Guitare électrique", pricingType: "session", sessionPricing: [3, 6, 9], pricePerHour: 0 },
      ],
    }));
    expect(equipmentLinesTotal(quote.equipmentLines)).toBe(quote.equipmentPrice);
    expect(quote.equipmentPrice).toBe(3 + 6 + 6);
  });
});
