import { describe, expect, it } from "vitest";
import { computeEquipmentAvailability, timeRangesOverlap } from "@/lib/booking";

const equipment = (quantity: number, id = "cymbal") => [{ id, quantity }];
const booking = (startTime: string, endTime: string, status = "confirmed", quantity = 1) => ({
  startTime, endTime, status, equipment: equipment(quantity),
});
const availability = (overrides: Partial<Parameters<typeof computeEquipmentAvailability>[0]> = {}) =>
  computeEquipmentAvailability({
    stockTotal: 10,
    equipmentId: "cymbal",
    requested: { startTime: "17:00", endTime: "19:00" },
    bookings: [],
    ...overrides,
  });

describe("timeRangesOverlap", () => {
  it.each([
    ["partial overlap at start", "16:00", "18:00", "15:00", "16:30", true],
    ["partial overlap at end", "16:00", "18:00", "17:30", "19:30", true],
    ["existing enclosed", "16:00", "18:00", "15:00", "19:00", true],
    ["request enclosed", "15:00", "19:00", "16:00", "18:00", true],
    ["adjacent after", "16:00", "18:00", "18:00", "19:30", false],
    ["adjacent before", "18:00", "20:00", "16:00", "18:00", false],
  ])("%s", (_name, aStart, aEnd, bStart, bEnd, expected) => {
    expect(timeRangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(expected);
  });

  it("treats midnight as 24:00", () => {
    expect(timeRangesOverlap("22:00", "00:00", "23:00", "00:00")).toBe(true);
    expect(timeRangesOverlap("20:00", "22:00", "22:00", "00:00")).toBe(false);
  });
});

describe("computeEquipmentAvailability", () => {
  it("counts all overlapping ranges and shares stock across studios", () => {
    const studioBookings = [
      { ...booking("16:00", "18:00"), studioId: "la-scene" },
      { ...booking("17:30", "19:30"), studioId: "le-podium" },
    ];
    expect(availability({
      bookings: studioBookings,
    })).toMatchObject({ reserved: 2, reservedFromBookings: 2 });
  });

  it.each([
    ["cancelled", 0],
    ["no-show", 0],
    ["completed", 1],
    ["pending", 0],
  ])("status %s contributes %s", (status, reserved) => {
    expect(availability({ bookings: [booking("16:00", "18:00", status)] }).reservedFromBookings).toBe(reserved);
  });

  it("counts overlapping cart items but not non-overlapping ones", () => {
    expect(availability({ cartItems: [
      { startTime: "18:30", endTime: "20:00", equipment: equipment(2) },
      { startTime: "19:00", endTime: "20:00", equipment: equipment(3, "mic") },
    ] })).toMatchObject({ reserved: 2, reservedFromCart: 2 });
  });

  it("counts the named cymbal scenario and computes availability", () => {
    const input = { bookings: [booking("16:00", "18:00", "confirmed", 2)] };
    expect(availability({ stockTotal: 2, ...input })).toMatchObject({ reservedFromBookings: 2, available: 0 });
    expect(availability({ stockTotal: 6, ...input })).toMatchObject({ reservedFromBookings: 2, available: 4 });
  });

  it("clamps availability when reservations exceed stock", () => {
    expect(availability({ stockTotal: 2, bookings: [booking("16:00", "18:00", "confirmed", 5)] }).available).toBe(0);
  });

  it("counts legacy equipment JSON without lineTotal", () => {
    expect(availability({ bookings: [
      { startTime: "16:00", endTime: "18:00", status: "confirmed", equipment: '[{"id":"cymbal","quantity":2}]' },
    ] })).toMatchObject({ reserved: 2, reservedFromBookings: 2 });
  });

  it("normalizes invalid stock to zero", () => {
    expect(availability({ stockTotal: -1, bookings: [booking("16:00", "18:00")] }).available).toBe(0);
    expect(availability({ stockTotal: Number.NaN }).available).toBe(0);
  });
});
