import { describe, expect, it } from "vitest";
import { formatBookingSlot } from "@/lib/booking";

describe("formatBookingSlot", () => {
  it("formats a standard slot", () => {
    expect(formatBookingSlot({ date: "2026-03-14", start_time: "18:00", end_time: "21:00" }))
      .toBe("sam. 14 mars · 18:00–21:00 (3h)");
  });

  it("treats 00:00 as the end-of-day sentinel", () => {
    expect(formatBookingSlot({ date: "2026-03-14", start_time: "22:00", end_time: "00:00" }))
      .toBe("sam. 14 mars · 22:00–00:00 (2h)");
  });

  it("formats half-hour durations", () => {
    expect(formatBookingSlot({ date: "2026-03-14", start_time: "18:00", end_time: "21:30" }))
      .toBe("sam. 14 mars · 18:00–21:30 (3h30)");
  });

  it("returns an empty label for an invalid date", () => {
    expect(formatBookingSlot({ date: "not-a-date", start_time: "18:00", end_time: "21:00" })).toBe("");
  });
});
