import {
  deletePushSubscriptionByEndpoint,
  getAllPushSubscriptions,
  getPushPreferences,
  getPushSubscriptionsForAdmin,
  markPushSubscriptionError,
  markPushSubscriptionSuccess,
} from "./db";
import type { DbPushPreference, DbPushSubscription, PushEventType } from "./db-types";
import { STUDIO_LABELS } from "./labels";
import {
  buildPushHeaders,
  createVapidJwt,
  encryptWebPushPayload,
} from "./push-crypto";

export const DEFAULT_PUSH_PREFS: Record<PushEventType, boolean> = {
  booking_created: true,
  booking_cancelled: true,
  booking_rescheduled: true,
  booking_no_show: true,
  payment_received: true,
  refund_issued: true,
  contact_message: true,
  booking_reminder: true,
  // L'administrateur qui a autorisé l'OS, installé l'application sur l'écran
  // d'accueil et activé push a déjà opté trois fois ; un quatrième opt-in
  // invisible provoque des signalements « les pushs ne marchent pas ». Les
  // échecs de synchronisation sont du bruit sur lequel l'opérateur ne peut agir.
  cron_failure: false,
};

export function resolvePreferences(stored: DbPushPreference[]): Record<PushEventType, boolean> {
  const preferences = { ...DEFAULT_PUSH_PREFS };
  for (const row of stored) {
    if (row.event_type in preferences) {
      preferences[row.event_type as PushEventType] = row.enabled === 1;
    }
  }
  return preferences;
}

export interface PushNotification {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: PushEventType;
  /** Internal metadata used to calculate reminder TTL and copy at send time. */
  reminderStartAt?: string;
  startAt?: string | Date;
}

export type PushNotificationInputByEvent = {
  booking_created: { bookingId: string; clientName: string; studioId: string; date: string | Date; startTime: string };
  booking_cancelled: { bookingId: string; clientName: string; studioId: string; date: string | Date; startTime: string };
  booking_rescheduled: { bookingId: string; clientName: string; studioId: string; date: string | Date; startTime: string };
  booking_no_show: { bookingId: string; clientName: string; studioId: string; date: string | Date; startTime: string };
  payment_received: { bookingId: string; clientName: string; amount: number | string; studioId?: string; date?: string | Date; startTime?: string };
  refund_issued: { bookingId: string; clientName: string; amount: number | string };
  contact_message: { name: string; subject: string; message?: string };
  booking_reminder: { bookingId: string; clientName: string; studioId: string; startTime: string; date?: string | Date; startAt: string | Date };
  cron_failure: { service: string; message: string };
};

export type PushNotificationInput = PushNotificationInputByEvent[PushEventType];

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function clientName(input: { clientName: string }): string {
  return input.clientName;
}

function studioName(input: { studioId: string }): string {
  const value = input.studioId;
  return (STUDIO_LABELS[value as keyof typeof STUDIO_LABELS] ?? value) || "—";
}

function displayDate(value: string | Date | undefined): string {
  if (!value) return "—";
  if (value instanceof Date) {
    return value.toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
}

function displayTime(value: string | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{1,2})[:h](\d{2})$/);
  return match ? `${match[1].padStart(2, "0")}h${match[2]}` : value;
}

export function formatEuroAmount(value: number | string | undefined): string {
  if (typeof value === "string" && !/^[-+]?\d+(?:[.,]\d+)?$/.test(value.trim())) return value;
  const amount = typeof value === "number" ? value : Number(String(value ?? 0).replace(",", "."));
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/** Format the actual remaining duration, never a fixed reminder duration. */
export function formatReminderDelay(remainingMinutes: number): string {
  const minutes = Math.max(0, Math.ceil(remainingMinutes));
  if (minutes < 60) return `dans ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `dans ${hours} h` : `dans ${hours} h ${rest} min`;
}

function toStartDate(value: string | Date | undefined, date: string | Date | undefined, time: string | undefined): Date | undefined {
  if (value instanceof Date) return value;
  if (value) return new Date(value);
  if (typeof date !== "string" || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;

  // Convert a Paris wall-clock time to an instant without relying on the
  // worker's timezone (which is normally UTC).
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.replace("h", ":").split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const local = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

function finish(notification: PushNotification): PushNotification {
  return {
    ...notification,
    title: truncate(notification.title, 32),
    body: truncate(notification.body, 120),
  };
}

export function buildBookingCreatedNotification(input: PushNotificationInputByEvent["booking_created"]): PushNotification {
  return finish({
    title: "Nouvelle réservation",
    body: `${clientName(input)} — ${studioName(input)}, le ${displayDate(input.date)} à ${displayTime(input.startTime)}`,
    url: "/admin/bookings",
    tag: "booking_created",
    type: "booking_created",
  });
}

export function buildBookingCancelledNotification(input: PushNotificationInputByEvent["booking_cancelled"]): PushNotification {
  return finish({
    title: "Réservation annulée",
    body: `${clientName(input)} — ${studioName(input)}, le ${displayDate(input.date)} à ${displayTime(input.startTime)}`,
    url: `/admin/bookings/${input.bookingId}`,
    tag: "booking_cancelled",
    type: "booking_cancelled",
  });
}

export function buildBookingRescheduledNotification(input: PushNotificationInputByEvent["booking_rescheduled"]): PushNotification {
  return finish({
    title: "Réservation déplacée",
    body: `${clientName(input)} — désormais le ${displayDate(input.date)} à ${displayTime(input.startTime)}`,
    url: `/admin/bookings/${input.bookingId}`,
    tag: "booking_rescheduled",
    type: "booking_rescheduled",
  });
}

export function buildBookingNoShowNotification(input: PushNotificationInputByEvent["booking_no_show"]): PushNotification {
  return finish({
    title: "Client absent",
    body: `${clientName(input)} — ${studioName(input)}, le ${displayDate(input.date)} à ${displayTime(input.startTime)}`,
    url: `/admin/bookings/${input.bookingId}`,
    tag: "booking_no_show",
    type: "booking_no_show",
  });
}

function paymentNotification(
  input: PushNotificationInputByEvent["payment_received"] | PushNotificationInputByEvent["refund_issued"],
  type: "payment_received" | "refund_issued",
): PushNotification {
  return finish({
    title: type === "payment_received" ? "Paiement reçu" : "Remboursement effectué",
    body: `${formatEuroAmount(input.amount)} — ${clientName(input)}`,
    url: "/admin/payments",
    tag: type,
    type,
  });
}

export function buildPaymentReceivedNotification(input: PushNotificationInputByEvent["payment_received"]): PushNotification {
  return paymentNotification(input, "payment_received");
}

export function buildRefundIssuedNotification(input: PushNotificationInputByEvent["refund_issued"]): PushNotification {
  return paymentNotification(input, "refund_issued");
}

export function buildContactMessageNotification(input: PushNotificationInputByEvent["contact_message"]): PushNotification {
  return finish({
    title: "Nouveau message",
    body: `${input.name} — ${input.subject}`,
    url: "/admin",
    tag: "contact_message",
    type: "contact_message",
  });
}

export function buildBookingReminderNotification(
  input: PushNotificationInputByEvent["booking_reminder"],
  now: Date = new Date(),
): PushNotification {
  const start = toStartDate(input.startAt, input.date, input.startTime);
  const remaining = start ? (start.getTime() - now.getTime()) / 60_000 : 0;
  return finish({
    title: `Séance ${formatReminderDelay(remaining)}`,
    body: `${clientName(input)} — ${studioName(input)} à ${displayTime(input.startTime)}`,
    url: `/admin/bookings/${input.bookingId}`,
    tag: `reminder_${input.bookingId}`,
    type: "booking_reminder",
    reminderStartAt: start?.toISOString(),
    startAt: start?.toISOString(),
  });
}

export function buildCronFailureNotification(input: PushNotificationInputByEvent["cron_failure"]): PushNotification {
  return finish({
    title: "Échec de synchronisation",
    body: `${input.service} : ${input.message}`,
    url: "/admin",
    tag: "cron_failure",
    type: "cron_failure",
  });
}

export function buildPushNotification<T extends PushEventType>(type: T, input: PushNotificationInputByEvent[T], now?: Date): PushNotification {
  switch (type) {
    case "booking_created": return buildBookingCreatedNotification(input as PushNotificationInputByEvent["booking_created"]);
    case "booking_cancelled": return buildBookingCancelledNotification(input as PushNotificationInputByEvent["booking_cancelled"]);
    case "booking_rescheduled": return buildBookingRescheduledNotification(input as PushNotificationInputByEvent["booking_rescheduled"]);
    case "booking_no_show": return buildBookingNoShowNotification(input as PushNotificationInputByEvent["booking_no_show"]);
    case "payment_received": return buildPaymentReceivedNotification(input as PushNotificationInputByEvent["payment_received"]);
    case "refund_issued": return buildRefundIssuedNotification(input as PushNotificationInputByEvent["refund_issued"]);
    case "contact_message": return buildContactMessageNotification(input as PushNotificationInputByEvent["contact_message"]);
    case "booking_reminder": return buildBookingReminderNotification(input as PushNotificationInputByEvent["booking_reminder"], now);
    case "cron_failure": return buildCronFailureNotification(input as PushNotificationInputByEvent["cron_failure"]);
  }
}

export interface PushDeps {
  db: D1Database;
  vapid: { publicKey: string; privateKey: string; subject: string };
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface PushDispatchResult {
  sent: number;
  failed: number;
  removed: number;
  results: Array<{ endpoint: string; status: number; ok: boolean }>;
}

function emptyResult(): PushDispatchResult {
  return { sent: 0, failed: 0, removed: 0, results: [] };
}

function retryDelay(response: Response, now: () => Date): number {
  const value = response.headers.get("Retry-After");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - now().getTime());
}

function refreshReminder(notification: PushNotification, now: Date): PushNotification {
  if (notification.type !== "booking_reminder") return notification;
  const startAt = notification.reminderStartAt ?? notification.startAt;
  if (!startAt) return notification;
  const remaining = (new Date(startAt).getTime() - now.getTime()) / 60_000;
  return finish({ ...notification, title: `Séance ${formatReminderDelay(remaining)}` });
}

async function dispatchEndpoint(
  deps: PushDeps,
  subscription: DbPushSubscription,
  notification: PushNotification,
): Promise<{ endpoint: string; status: number; ok: boolean; outcome: "sent" | "failed" | "removed" }> {
  const now = deps.now ?? (() => new Date());
  const fetchImpl = deps.fetchImpl ?? fetch;
  const current = refreshReminder(notification, now());
  const start = current.reminderStartAt ?? current.startAt;
  const startTime = start ? new Date(start).getTime() : NaN;
  const ttl = Number.isFinite(startTime) && current.type === "booking_reminder"
    ? Math.max(0, Math.ceil((startTime - now().getTime()) / 1000))
    : 3600;
  const payload = JSON.stringify({
    title: current.title,
    body: current.body,
    data: { url: current.url, tag: current.tag, type: current.type },
  });
  const encrypted = await encryptWebPushPayload(subscription.p256dh, subscription.auth, payload);
  const jwt = await createVapidJwt(subscription.endpoint, deps.vapid.subject, deps.vapid.publicKey, deps.vapid.privateKey);
  const headers = buildPushHeaders({
    jwt,
    vapidPublicKey: deps.vapid.publicKey,
    ttl,
    urgency: current.type === "booking_reminder" || current.type.startsWith("booking_") ? "high" : "normal",
    topic: current.tag,
  });

  let response: Response | undefined;
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    response = await fetchImpl(subscription.endpoint, {
      method: "POST",
      headers,
      body: encrypted.body as unknown as BodyInit,
    });
    if (response.status !== 429 && response.status < 500) break;
    if (attempt < 2) {
      const delay = retryDelay(response, now);
      if (delay > 0) await (deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))))(delay);
    }
  }

  const status = response?.status ?? 0;
  if (status >= 200 && status < 300) {
    await markPushSubscriptionSuccess(deps.db, subscription.endpoint);
    return { endpoint: subscription.endpoint, status, ok: true, outcome: "sent" };
  }
  if (status === 404 || status === 410) {
    await deletePushSubscriptionByEndpoint(deps.db, subscription.endpoint);
    return { endpoint: subscription.endpoint, status, ok: false, outcome: "removed" };
  }
  await markPushSubscriptionError(deps.db, subscription.endpoint, `Push provider returned HTTP ${status}`);
  return { endpoint: subscription.endpoint, status, ok: false, outcome: "failed" };
}

async function dispatchSubscriptions(
  deps: PushDeps,
  subscriptions: DbPushSubscription[],
  notification: PushNotification,
  options: { skipPreferenceCheck?: boolean } = {},
): Promise<PushDispatchResult> {
  const result = emptyResult();
  const byAdmin = new Map<string, DbPushSubscription[]>();
  for (const subscription of subscriptions) {
    const list = byAdmin.get(subscription.admin_id) ?? [];
    list.push(subscription);
    byAdmin.set(subscription.admin_id, list);
  }

  for (const [adminId, adminSubscriptions] of byAdmin) {
    if (!options.skipPreferenceCheck) {
      let preferences: Record<PushEventType, boolean>;
      try {
        preferences = resolvePreferences(await getPushPreferences(deps.db, adminId));
      } catch (error) {
        console.error("[Push] preference lookup failed", error);
        continue;
      }
      if (!preferences[notification.type]) continue;
    }

    await Promise.all(adminSubscriptions.map(async (subscription) => {
      try {
        const sent = await dispatchEndpoint(deps, subscription, notification);
        result.results.push({ endpoint: sent.endpoint, status: sent.status, ok: sent.ok });
        result[sent.outcome] += 1;
      } catch (error) {
        console.error("[Push] endpoint dispatch failed", error);
        result.failed += 1;
        result.results.push({ endpoint: subscription.endpoint, status: 0, ok: false });
        try {
          await markPushSubscriptionError(deps.db, subscription.endpoint, error instanceof Error ? error.message : String(error));
        } catch (markError) {
          console.error("[Push] unable to record endpoint error", markError);
        }
      }
    }));
  }
  return result;
}

export async function sendPushToAdmins(
  deps: PushDeps,
  notification: PushNotification,
): Promise<PushDispatchResult> {
  if (typeof deps.vapid.subject !== "string" || !deps.vapid.subject.trim()) return emptyResult();
  try {
    const subscriptions = await getAllPushSubscriptions(deps.db);
    return await dispatchSubscriptions(deps, subscriptions, notification);
  } catch (error) {
    console.error("[Push] dispatch failed", error);
    return emptyResult();
  }
}

export async function sendPushToAdmin(
  deps: PushDeps,
  adminId: string,
  notification: PushNotification,
  options: { skipPreferenceCheck?: boolean } = {},
): Promise<PushDispatchResult> {
  if (typeof deps.vapid.subject !== "string" || !deps.vapid.subject.trim()) return emptyResult();
  try {
    const subscriptions = await getPushSubscriptionsForAdmin(deps.db, adminId);
    return await dispatchSubscriptions(deps, subscriptions, notification, options);
  } catch (error) {
    console.error("[Push] admin dispatch failed", error);
    return emptyResult();
  }
}
