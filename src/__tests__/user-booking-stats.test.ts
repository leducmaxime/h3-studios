import { describe, expect, it } from "vitest";
import {
  computeClientBookingInsights,
  formatDurationHours,
  formatSlotTime,
  slotDurationHours,
  weekdayFromISODate,
} from "@/lib/user-booking-stats";

const booking = (overrides: Partial<Parameters<typeof computeClientBookingInsights>[0][number]> = {}) => ({
  status: "confirmed",
  date: "2026-08-22",
  start_time: "18:00",
  end_time: "20:00",
  studio_id: "la-scene",
  group_type: "group",
  ...overrides,
});

describe("weekdayFromISODate", () => {
  it("uses the calendar date, not the browser timezone", () => {
    expect(weekdayFromISODate("2026-08-22")).toBe("Samedi");
    expect(weekdayFromISODate("2026-08-23")).toBe("Dimanche");
  });

  it("returns null for invalid dates", () => {
    expect(weekdayFromISODate("not-a-date")).toBeNull();
  });
});

describe("duration helpers", () => {
  it("handles sessions that cross midnight", () => {
    expect(slotDurationHours("23:00", "01:00")).toBe(2);
  });

  it("formats hours and minutes consistently", () => {
    expect(formatDurationHours(0)).toBe("—");
    expect(formatDurationHours(0.5)).toBe("30min");
    expect(formatDurationHours(2)).toBe("2h");
    expect(formatDurationHours(1.5)).toBe("1h30");
  });

  it("normalizes start times to HH:MM", () => {
    expect(formatSlotTime("18:00:00")).toBe("18:00");
  });
});

describe("computeClientBookingInsights", () => {
  it("returns empty labels when there are no eligible bookings", () => {
    expect(computeClientBookingInsights([])).toMatchObject({
      preferredWeekday: null,
      averageDurationLabel: "—",
      preferredStartTime: null,
      preferredStudioId: null,
      preferredGroupType: null,
    });
  });

  it("ignores cancelled bookings", () => {
    const insights = computeClientBookingInsights([
      booking({ status: "cancelled", date: "2026-08-21", start_time: "10:00", end_time: "11:00", studio_id: "le-podium", group_type: "solo" }),
      booking({ date: "2026-08-22", start_time: "18:00", end_time: "20:00", studio_id: "la-scene", group_type: "group" }),
    ]);
    expect(insights).toMatchObject({
      preferredWeekday: "Samedi",
      averageDurationLabel: "2h",
      preferredStartTime: "18:00",
      preferredStudioId: "la-scene",
      preferredGroupType: "group",
    });
  });

  it("breaks ties with the most recent occurrence", () => {
    const insights = computeClientBookingInsights([
      booking({ date: "2026-08-15", start_time: "14:00", end_time: "16:00", studio_id: "la-scene" }),
      booking({ date: "2026-08-16", start_time: "18:00", end_time: "20:00", studio_id: "le-podium" }),
      booking({ date: "2026-08-22", start_time: "14:00", end_time: "16:00", studio_id: "la-scene" }),
      booking({ date: "2026-08-23", start_time: "18:00", end_time: "20:00", studio_id: "le-podium" }),
    ]);
    expect(insights.preferredWeekday).toBe("Dimanche");
    expect(insights.preferredStartTime).toBe("18:00");
    expect(insights.preferredStudioId).toBe("le-podium");
  });

  it("computes the average session duration", () => {
    const insights = computeClientBookingInsights([
      booking({ start_time: "10:00", end_time: "11:00" }),
      booking({ start_time: "18:00", end_time: "20:00" }),
    ]);
    expect(insights.averageDurationHours).toBe(1.5);
    expect(insights.averageDurationLabel).toBe("1h30");
  });
});
