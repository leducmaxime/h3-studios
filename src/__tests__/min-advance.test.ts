import { describe, it, expect } from "vitest";
import {
  applyMinAdvance,
  computeMinAdvance,
  isMinAdvanceViolation,
  parseMinAdvanceHours,
} from "@/lib/booking";

describe("applyMinAdvance", () => {
  it("leaves slots unchanged without an active cutoff", () => {
    const slots = [{ time: "10:00", available: true }];
    expect(applyMinAdvance(slots, null, false)).toBe(slots);
  });

  it("blocks every slot and preserves or supplies groupType when fully blocked", () => {
    const result = applyMinAdvance([
      { time: "10:00", available: true, groupType: "solo" },
      { time: "10:30", available: true },
    ], null, true);
    expect(result).toEqual([
      { time: "10:00", available: false, groupType: "solo" },
      { time: "10:30", available: false, groupType: "blocked" },
    ]);
  });

  it("keeps the exact cutoff available and blocks earlier slots", () => {
    const result = applyMinAdvance([
      { time: "14:30", available: true },
      { time: "15:00", available: true },
    ], "15:00", false);
    expect(result[0].available).toBe(false);
    expect(result[1].available).toBe(true);
  });

  it("keeps the midnight end boundary unavailable under an active cutoff", () => {
    expect(applyMinAdvance([{ time: "00:00", available: true }], "15:00", false)[0].available).toBe(false);
  });
});

describe("computeMinAdvance", () => {
  it("computes the live five-hour cutoff", () => {
    expect(computeMinAdvance({ hours: 10, minutes: 0 }, 5)).toEqual({ cutoffTime: "15:00", fullyBlocked: false });
  });

  it("fully blocks when five hours crosses midnight", () => {
    expect(computeMinAdvance({ hours: 19, minutes: 30 }, 5)).toEqual({ cutoffTime: null, fullyBlocked: true });
  });

  it("handles the boundary on either side of midnight", () => {
    expect(computeMinAdvance({ hours: 18, minutes: 59 }, 5)).toEqual({ cutoffTime: "23:59", fullyBlocked: false });
    expect(computeMinAdvance({ hours: 19, minutes: 0 }, 5)).toEqual({ cutoffTime: null, fullyBlocked: true });
  });

  it("supports zero advance and zero-pads the result", () => {
    expect(computeMinAdvance({ hours: 5, minutes: 5 }, 0)).toEqual({ cutoffTime: "05:05", fullyBlocked: false });
  });

  it("pins the code default of two hours", () => {
    expect(computeMinAdvance({ hours: 10, minutes: 0 }, 2).cutoffTime).toBe("12:00");
  });

  it("falls back safely for invalid stored values", () => {
    expect(parseMinAdvanceHours("5")).toBe(5);
    expect(parseMinAdvanceHours("NaN")).toBe(2);
    expect(parseMinAdvanceHours("-1")).toBe(2);
    expect(parseMinAdvanceHours("not-a-number")).toBe(2);
    expect(parseMinAdvanceHours(null)).toBe(2);
    expect(parseMinAdvanceHours("")).toBe(2);
    expect(computeMinAdvance({ hours: 10, minutes: 0 }, Number.NaN).cutoffTime).toBe("12:00");
  });
});

describe("same-day server min-advance decision", () => {
  // A different date (not today) is never subject to this rule; the admin
  // route intentionally bypasses it.
  it("rejects before cutoff and accepts at or after it", () => {
    const cutoff = computeMinAdvance({ hours: 10, minutes: 0 }, 5);
    expect(isMinAdvanceViolation("14:59", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
    expect(isMinAdvanceViolation("15:00", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(false);
    expect(isMinAdvanceViolation("15:30", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(false);
  });

  it("rejects every same-day start when fully blocked", () => {
    const cutoff = computeMinAdvance({ hours: 19, minutes: 30 }, 5);
    expect(isMinAdvanceViolation("23:30", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
    expect(isMinAdvanceViolation("00:00", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
  });

  it("fails closed for malformed start times", () => {
    const cutoff = computeMinAdvance({ hours: 10, minutes: 0 }, 5);
    expect(isMinAdvanceViolation("9:00", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
    expect(isMinAdvanceViolation("", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
    expect(isMinAdvanceViolation("abc", cutoff.cutoffTime, cutoff.fullyBlocked)).toBe(true);
  });
});
