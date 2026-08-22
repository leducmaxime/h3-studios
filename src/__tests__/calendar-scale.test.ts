import { describe, expect, it } from "vitest";
import {
  buildHourScale,
  closedBandLabel,
  hourBands,
  layoutScaledBlockOnDate,
  minutesToY,
  CAL_CLOSED_HOUR_H,
  CAL_OPEN_HOUR_H,
} from "@/lib/calendar-scale";

const monday = new Date(2026, 7, 17);
const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 17 + i));

describe("buildHourScale", () => {
  it("collapse 00–18 on a Monday day view", () => {
    const scale = buildHourScale([monday]);
    expect(scale.open.slice(0, 18)).toEqual(Array(18).fill(false));
    expect(scale.open.slice(18)).toEqual(Array(6).fill(true));
    expect(scale.heights[0]).toBe(CAL_CLOSED_HOUR_H);
    expect(scale.heights[18]).toBe(CAL_OPEN_HOUR_H);
    expect(scale.totalHeight).toBe(18 * CAL_CLOSED_HOUR_H + 6 * CAL_OPEN_HOUR_H);
  });

  it("keeps a shared week axis: 00–10 collapsed, 10–24 full", () => {
    const scale = buildHourScale(week);
    expect(scale.open.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(scale.open.slice(10)).toEqual(Array(14).fill(true));
    expect(scale.totalHeight).toBe(10 * CAL_CLOSED_HOUR_H + 14 * CAL_OPEN_HOUR_H);
  });
});

describe("hourBands", () => {
  it("groups consecutive closed hours and keeps open hours individual", () => {
    const bands = hourBands(buildHourScale(week));
    expect(bands[0]).toMatchObject({ startHour: 0, endHour: 10, open: false });
    expect(bands[1]).toMatchObject({ startHour: 10, endHour: 11, open: true });
    expect(bands.at(-1)).toMatchObject({ startHour: 23, endHour: 24, open: true });
  });
});

describe("minutesToY / layoutScaledBlockOnDate", () => {
  it("maps opening-hour bookings onto the compressed week scale", () => {
    const scale = buildHourScale(week);
    expect(minutesToY(10 * 60, scale)).toBe(10 * CAL_CLOSED_HOUR_H);
    expect(minutesToY(18 * 60, scale)).toBe(10 * CAL_CLOSED_HOUR_H + 8 * CAL_OPEN_HOUR_H);

    const rect = layoutScaledBlockOnDate("2026-08-18", "2026-08-18", "18:00", "20:00", scale, 16);
    expect(rect).toEqual({
      top: 10 * CAL_CLOSED_HOUR_H + 8 * CAL_OPEN_HOUR_H,
      height: 2 * CAL_OPEN_HOUR_H,
    });
  });

  it("keeps overnight leftovers at the top of the next day", () => {
    const scale = buildHourScale(week);
    const first = layoutScaledBlockOnDate("2026-08-18", "2026-08-18", "23:00", "03:00", scale, 16);
    const next = layoutScaledBlockOnDate("2026-08-18", "2026-08-19", "23:00", "03:00", scale, 16);
    expect(first?.top).toBe(10 * CAL_CLOSED_HOUR_H + 13 * CAL_OPEN_HOUR_H);
    expect(first?.height).toBe(CAL_OPEN_HOUR_H);
    expect(next?.top).toBe(0);
    expect(next?.height).toBe(3 * CAL_CLOSED_HOUR_H);
  });
});

describe("closedBandLabel", () => {
  it("labels a closed range in French", () => {
    expect(closedBandLabel(0, 10)).toBe("00–10 · Fermé");
    expect(closedBandLabel(3, 4)).toBe("03 · Fermé");
  });
});
