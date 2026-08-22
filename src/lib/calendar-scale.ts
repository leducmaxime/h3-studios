import { bookingEndMinutes, clockMinutes, getOpeningHoursForStudio, type StudioId } from "@/lib/booking";

export interface MinuteRect {
  top: number;
  height: number;
}

export const CAL_OPEN_HOUR_H = 60;
export const CAL_CLOSED_HOUR_H = 12;
export const CAL_EXPORT_OPEN_HOUR_H = 88;
export const CAL_EXPORT_CLOSED_HOUR_H = 16;

const STUDIOS: StudioId[] = ["la-scene", "le-podium"];

export interface HourScale {
  open: boolean[];
  heights: number[];
  tops: number[];
  totalHeight: number;
}

export interface HourBand {
  startHour: number;
  endHour: number;
  open: boolean;
  top: number;
  height: number;
}

export function isStudioOpenDuringHour(studioId: StudioId, date: Date, hour: number): boolean {
  const hours = getOpeningHoursForStudio(studioId)[date.getDay()];
  if (!hours) return false;
  const open = clockMinutes(hours.open);
  const close = hours.close === "00:00" ? 24 * 60 : clockMinutes(hours.close);
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  if (close > open) {
    return hourStart < close && hourEnd > open;
  }
  return hourEnd > open || hourStart < close;
}

export function isAnyStudioOpenDuringHour(date: Date, hour: number): boolean {
  return STUDIOS.some((id) => isStudioOpenDuringHour(id, date, hour));
}

export function buildHourScale(
  dates: Date[],
  openHeight: number = CAL_OPEN_HOUR_H,
  closedHeight: number = CAL_CLOSED_HOUR_H,
): HourScale {
  const open = Array.from({ length: 24 }, (_, hour) =>
    dates.some((date) => isAnyStudioOpenDuringHour(date, hour)),
  );
  const heights = open.map((isOpen) => (isOpen ? openHeight : closedHeight));
  const tops: number[] = [];
  let y = 0;
  for (const height of heights) {
    tops.push(y);
    y += height;
  }
  return { open, heights, tops, totalHeight: y };
}

export function hourBands(scale: HourScale): HourBand[] {
  const bands: HourBand[] = [];
  let hour = 0;
  while (hour < 24) {
    const open = scale.open[hour];
    let end = hour + 1;
    if (!open) {
      while (end < 24 && !scale.open[end]) end += 1;
    }
    bands.push({
      startHour: hour,
      endHour: end,
      open,
      top: scale.tops[hour],
      height: (end < 24 ? scale.tops[end] : scale.totalHeight) - scale.tops[hour],
    });
    hour = end;
  }
  return bands;
}

export function minutesToY(minutes: number, scale: HourScale): number {
  if (minutes <= 0) return 0;
  if (minutes >= 24 * 60) return scale.totalHeight;
  const hour = Math.min(23, Math.floor(minutes / 60));
  const frac = (minutes - hour * 60) / 60;
  return scale.tops[hour] + frac * scale.heights[hour];
}

function shiftDateISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function mapLinearMinuteRect(
  rect: MinuteRect,
  scale: HourScale,
  minHeight = 16,
): MinuteRect {
  const top = minutesToY(rect.top, scale);
  const bottom = minutesToY(rect.top + rect.height, scale);
  return { top, height: Math.max(bottom - top, minHeight) };
}

export function layoutScaledBlockOnDate(
  bookingDate: string,
  viewDate: string,
  startTime: string,
  endTime: string,
  scale: HourScale,
  minHeight = 16,
): MinuteRect | null {
  const startMin = clockMinutes(startTime);
  const endMin = bookingEndMinutes(startTime, endTime);
  if (endMin <= startMin) return null;

  if (viewDate === bookingDate) {
    const clippedEnd = Math.min(endMin, 24 * 60);
    if (clippedEnd <= startMin) return null;
    return mapLinearMinuteRect({ top: startMin, height: clippedEnd - startMin }, scale, minHeight);
  }

  if (viewDate === shiftDateISO(bookingDate, 1) && endMin > 24 * 60) {
    return mapLinearMinuteRect({ top: 0, height: endMin - 24 * 60 }, scale, minHeight);
  }

  return null;
}

export function closedBandLabel(startHour: number, endHour: number): string {
  const start = String(startHour).padStart(2, "0");
  const end = String(endHour).padStart(2, "0");
  if (endHour - startHour <= 1) return `${start} · Fermé`;
  return `${start}–${end} · Fermé`;
}
