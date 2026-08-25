import { describe, expect, it } from "vitest";
import {
  buildHourScale,
  closedBandLabel,
  hourBands,
  layoutScaledBlockOnDate,
  minutesToY,
  CAL_CLOSED_HOUR_H,
  CAL_OPEN_HOUR_H,
  assignOverlapLanes,
} from "@/lib/calendar-scale";

const monday = new Date(2026, 7, 17);
const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 17 + i));

describe("buildHourScale", () => {
  it("hides 00–18 on a Monday day view", () => {
    const scale = buildHourScale([monday]);
    expect(scale.open.slice(0, 18)).toEqual(Array(18).fill(false));
    expect(scale.open.slice(18)).toEqual(Array(6).fill(true));
    expect(scale.heights[0]).toBe(0);
    expect(scale.heights[18]).toBe(CAL_OPEN_HOUR_H);
    expect(scale.totalHeight).toBe(6 * CAL_OPEN_HOUR_H);
  });

  it("keeps a shared week axis: 00–10 hidden, 10–24 full", () => {
    const scale = buildHourScale(week);
    expect(scale.open.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(scale.open.slice(10)).toEqual(Array(14).fill(true));
    expect(scale.totalHeight).toBe(14 * CAL_OPEN_HOUR_H);
  });

  it("does not give unused closed hours a full row, but can keep an overnight remainder visible", () => {
    const scale = buildHourScale([monday]);
    expect(scale.heights[0]).toBe(0);
    const overnight = buildHourScale([monday], CAL_OPEN_HOUR_H, CAL_CLOSED_HOUR_H, [2]);
    expect(overnight.open[2]).toBe(true);
    expect(overnight.heights[2]).toBe(CAL_OPEN_HOUR_H);
  });
});

describe("hourBands", () => {
  it("groups consecutive closed hours and keeps open hours individual", () => {
    const bands = hourBands(buildHourScale(week));
    expect(bands[0]).toMatchObject({ startHour: 10, endHour: 11, open: true });
    expect(bands.at(-1)).toMatchObject({ startHour: 23, endHour: 24, open: true });
    expect(bands.some((band) => !band.open)).toBe(false);
  });
});

describe("minutesToY / layoutScaledBlockOnDate", () => {
  it("maps opening-hour bookings onto the compressed week scale", () => {
    const scale = buildHourScale(week);
    expect(minutesToY(10 * 60, scale)).toBe(0);
    expect(minutesToY(18 * 60, scale)).toBe(8 * CAL_OPEN_HOUR_H);

    const rect = layoutScaledBlockOnDate("2026-08-18", "2026-08-18", "18:00", "20:00", scale, 16);
    expect(rect).toEqual({
      top: 8 * CAL_OPEN_HOUR_H,
      height: 2 * CAL_OPEN_HOUR_H,
    });
  });

  it("keeps overnight leftovers at the top of the next day", () => {
    const scale = buildHourScale(week, CAL_OPEN_HOUR_H, 0, [0, 1, 2]);
    const first = layoutScaledBlockOnDate("2026-08-18", "2026-08-18", "23:00", "03:00", scale, 16);
    const next = layoutScaledBlockOnDate("2026-08-18", "2026-08-19", "23:00", "03:00", scale, 16);
    expect(first?.top).toBe(3 * CAL_OPEN_HOUR_H + 13 * CAL_OPEN_HOUR_H);
    expect(first?.height).toBe(CAL_OPEN_HOUR_H);
    expect(next?.top).toBe(0);
    expect(next?.height).toBe(3 * CAL_OPEN_HOUR_H);
  });
});

describe("closedBandLabel", () => {
  it("labels a closed range in French", () => {
    expect(closedBandLabel(0, 10)).toBe("00–10 · Fermé");
    expect(closedBandLabel(3, 4)).toBe("03 · Fermé");
  });
});

describe("assignOverlapLanes", () => {
  it("splits overlapping blocks while keeping separate blocks full width", () => {
    const lanes = assignOverlapLanes([
      { top: 0, height: 120 },
      { top: 60, height: 60 },
      { top: 180, height: 30 },
    ]);
    expect(lanes[0]).toEqual({ lane: 0, laneCount: 2 });
    expect(lanes[1]).toEqual({ lane: 1, laneCount: 2 });
    expect(lanes[2]).toEqual({ lane: 0, laneCount: 1 });
  });
});
