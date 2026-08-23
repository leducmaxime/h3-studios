export interface BookingStatSource {
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  studio_id: string;
  group_type?: string | null;
}

export interface ClientBookingInsights {
  preferredWeekday: string | null;
  averageDurationHours: number;
  averageDurationLabel: string;
  preferredStartTime: string | null;
  preferredStudioId: string | null;
  preferredGroupType: string | null;
}

const WEEKDAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

export function slotDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

export function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours >= 1) {
    const h = Math.floor(hours);
    const mins = Math.round((hours % 1) * 60);
    return mins > 0 ? `${h}h${String(mins).padStart(2, "0")}` : `${h}h`;
  }
  return `${Math.round(hours * 60)}min`;
}

export function weekdayFromISODate(dateStr: string): (typeof WEEKDAYS_FR)[number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return WEEKDAYS_FR[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function formatSlotTime(time: string): string {
  return time.slice(0, 5);
}

function bookingRecency(booking: Pick<BookingStatSource, "date" | "start_time">): string {
  return `${booking.date}T${booking.start_time}`;
}

function mostCommonByRecency<T extends string>(
  bookings: BookingStatSource[],
  keyOf: (booking: BookingStatSource) => T | null | undefined,
): T | null {
  const counts = new Map<T, { count: number; last: string }>();
  for (const booking of bookings) {
    const key = keyOf(booking);
    if (!key) continue;
    const recency = bookingRecency(booking);
    const prev = counts.get(key);
    if (!prev) {
      counts.set(key, { count: 1, last: recency });
      continue;
    }
    prev.count += 1;
    if (recency > prev.last) prev.last = recency;
  }

  let winner: T | null = null;
  let bestCount = 0;
  let bestLast = "";
  for (const [key, { count, last }] of counts) {
    if (count > bestCount || (count === bestCount && last > bestLast)) {
      winner = key;
      bestCount = count;
      bestLast = last;
    }
  }
  return winner;
}

export function computeClientBookingInsights(bookings: BookingStatSource[]): ClientBookingInsights {
  const eligible = bookings.filter((booking) => booking.status !== "cancelled");
  const totalHours = eligible.reduce(
    (acc, booking) => acc + slotDurationHours(booking.start_time, booking.end_time),
    0,
  );
  const averageDurationHours = eligible.length > 0 ? totalHours / eligible.length : 0;

  return {
    preferredWeekday: mostCommonByRecency(eligible, (booking) => weekdayFromISODate(booking.date)),
    averageDurationHours,
    averageDurationLabel: eligible.length > 0 ? formatDurationHours(averageDurationHours) : "—",
    preferredStartTime: mostCommonByRecency(eligible, (booking) => formatSlotTime(booking.start_time)),
    preferredStudioId: mostCommonByRecency(eligible, (booking) => booking.studio_id || null),
    preferredGroupType: mostCommonByRecency(eligible, (booking) => booking.group_type || null),
  };
}
