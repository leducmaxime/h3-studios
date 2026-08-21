import { describe, expect, it } from "vitest";
import { computeBookingQuote, type BookingQuote } from "@/lib/booking";
import {
  buildRescheduleAmountAudit,
  deriveRescheduledAmounts,
  getOperatorProposedRescheduleRefund,
} from "@/lib/admin-reschedule";

const existing = { base_price: 16, equipment_price: 0, total_price: 16, promo_discount: 0 };

function quote(startTime: string, endTime: string, date = "2026-08-19"): BookingQuote {
  return computeBookingQuote({
    studioId: "le-podium",
    groupType: "group",
    date,
    startTime,
    endTime,
    peakStartHour: 18,
    publicHolidays: [],
    peakRatePerHalfHour: 8,
    offPeakRatePerHalfHour: 4,
    equipment: [],
  });
}

function persistReschedule(startTime: string, endTime: string, date?: string) {
  const update = deriveRescheduledAmounts(existing, quote(startTime, endTime, date));
  if (!update) return null;
  return { ...existing, ...update, promo_discount: update.capped_promo_discount };
}

describe("admin reschedule server amounts", () => {
  it("persists a higher total for a longer slot", () => {
    const moved = persistReschedule("10:00", "14:00");
    expect(moved?.total_price).toBeGreaterThan(existing.total_price);
    expect(moved?.total_price).toBe(32);
  });

  it("persists a lower total for a shorter slot", () => {
    const before = { ...existing, total_price: 32, base_price: 32 };
    const update = deriveRescheduledAmounts(before, quote("10:00", "12:00"));
    expect(update?.total_price).toBeLessThan(before.total_price);
    expect(update?.total_price).toBe(16);
  });

  it("reprices an identical duration when off-peak moves to peak", () => {
    const offPeak = persistReschedule("10:00", "12:00");
    const peak = persistReschedule("18:00", "20:00");
    expect(peak?.total_price).toBeGreaterThan(offPeak?.total_price ?? 0);
    expect(peak?.total_price).toBe(32);
  });

  it("does not produce persistable amounts when the quote rejects a range", () => {
    expect(persistReschedule("11:15", "12:00")).toBeNull();
  });

  it("keeps quoteable admin-force slots valid, including sub-hour and overnight ranges", () => {
    expect(persistReschedule("08:00", "08:30")?.total_price).toBeGreaterThan(0);
    expect(persistReschedule("23:00", "03:00")?.total_price).toBeGreaterThan(0);
  });

  it("caps an existing discount against the new gross", () => {
    const update = deriveRescheduledAmounts({ ...existing, promo_discount: 99 }, quote("10:00", "11:00"));
    expect(update?.total_price).toBe(8);
    expect(update?.capped_promo_discount).toBe(8);
  });

  it("records old and new amounts in the reschedule audit payload", () => {
    expect(buildRescheduleAmountAudit(existing, { ...existing, base_price: 32, total_price: 32 })).toEqual({
      old: { base_price: 16, equipment_price: 0, total_price: 16, promo_discount: 0 },
      new: { base_price: 32, equipment_price: 0, total_price: 32, promo_discount: 0 },
    });
  });

  it("proposes, but does not automatically execute, a card refund after a lower repriced total", () => {
    const proposal = getOperatorProposedRescheduleRefund(
      { ...existing, total_price: 10 },
      [{ amount: 16, status: "paid", refunded_amount: 0, method: "card" }],
    );
    expect(proposal).toEqual({ amount: 6, mode: "operator-proposed" });
  });
});
