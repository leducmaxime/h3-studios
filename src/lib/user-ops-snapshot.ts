export function formatCountRate(count: number, total: number): string {
  if (total <= 0) return "—";
  const percent = Math.round((count / total) * 100);
  return `${count} (${percent} %)`;
}

export function formatNextBookingWhen(date: string, startTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return startTime.slice(0, 5);
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${weekday} · ${startTime.slice(0, 5)}`;
}
