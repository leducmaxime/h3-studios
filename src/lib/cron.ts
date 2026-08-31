import { bookingReminderKey } from "./utils";

const DAILY_CRON = "0 6 * * *";
const REMINDER_CRON = "*/5 * * * *";

export type CronJob = "daily" | "reminders";

export function resolveCronJob(cron: string | undefined): CronJob | null {
  const normalized = (cron ?? "").trim().replace(/\s+/g, " ");
  if (normalized === DAILY_CRON) return "daily";
  if (normalized === REMINDER_CRON) return "reminders";
  return null;
}

export function resolveReminderLeadHours(raw: string | null | undefined): number {
  if (raw == null || String(raw).trim() === "") return 2;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(24, Math.max(1, parsed));
}

export interface DueReminderRow {
  booking_id: string;
  date: string;
  start_time: string;
}

export async function dispatchDueReminderRows<T extends DueReminderRow>(
  rows: T[],
  claim: (bookingId: string, targetKey: string) => Promise<boolean>,
  send: (row: T) => Promise<void>,
): Promise<{ sent: number; ignored: number }> {
  let sent = 0;
  let ignored = 0;
  for (const row of rows) {
    const targetKey = bookingReminderKey(row.date, row.start_time);
    try {
      if (!await claim(row.booking_id, targetKey)) {
        ignored++;
        continue;
      }
      await send(row);
      sent++;
    } catch {
      ignored++;
    }
  }
  return { sent, ignored };
}
