import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAll,
  getForAdmin,
  getPreferences,
  deleteSubscription,
  markSuccess,
  markError,
  encrypt,
  vapid,
  headers,
} = vi.hoisted(() => ({
  getAll: vi.fn(),
  getForAdmin: vi.fn(),
  getPreferences: vi.fn(),
  deleteSubscription: vi.fn(async () => ({ success: true })),
  markSuccess: vi.fn(async () => ({ success: true })),
  markError: vi.fn(async () => ({ success: true })),
  encrypt: vi.fn(async (_p256dh: string, _auth: string, plaintext: string) => ({
    body: new TextEncoder().encode(plaintext),
    salt: new Uint8Array(),
    saltBase64Url: "",
    keyid: "",
  })),
  vapid: vi.fn(async () => "jwt"),
  headers: vi.fn((options: { ttl: number | string; urgency: string; topic?: string }) => ({
    TTL: String(options.ttl),
    Urgency: options.urgency,
    Topic: options.topic ?? "",
  })),
}));

vi.mock("../lib/db", () => ({
  getAllPushSubscriptions: getAll,
  getPushSubscriptionsForAdmin: getForAdmin,
  getPushPreferences: getPreferences,
  deletePushSubscriptionByEndpoint: deleteSubscription,
  markPushSubscriptionSuccess: markSuccess,
  markPushSubscriptionError: markError,
}));
vi.mock("../lib/push-crypto", () => ({
  encryptWebPushPayload: encrypt,
  createVapidJwt: vapid,
  buildPushHeaders: headers,
}));

import {
  buildBookingCreatedNotification,
  buildBookingReminderNotification,
  formatReminderDelay,
  sendPushToAdmins,
} from "../lib/push";

const db = {} as D1Database;
const vapidConfig = { publicKey: "public", privateKey: "private", subject: "mailto:test@example.com" };
const subscription = (endpoint: string, adminId = "admin-1") => ({
  id: endpoint,
  admin_id: adminId,
  endpoint,
  p256dh: "p256dh",
  auth: "auth",
  user_agent: null,
  created_at: "2026-01-01T00:00:00.000Z",
  last_success_at: null,
  last_error: null,
});
const notification = buildBookingCreatedNotification({
  bookingId: "booking-1",
  client: "Ada",
  studioId: "la-scene",
  date: "2026-08-31",
  time: "20:00",
});

function response(status: number, retryAfter?: string): Response {
  return new Response(null, { status, headers: retryAfter ? { "Retry-After": retryAfter } : undefined });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAll.mockResolvedValue([subscription("https://push.example/one")]);
  getForAdmin.mockResolvedValue([subscription("https://push.example/one")]);
  getPreferences.mockResolvedValue([]);
  markSuccess.mockResolvedValue({ success: true });
  markError.mockResolvedValue({ success: true });
  deleteSubscription.mockResolvedValue({ success: true });
});

describe("push dispatch", () => {
  it("gates delivery by sparse preferences and defaults cron failures off", async () => {
    const fetchImpl = vi.fn(async () => response(201));
    const deps = { db, vapid: vapidConfig, fetchImpl };

    await sendPushToAdmins(deps, notification);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    getPreferences.mockResolvedValue([{ admin_id: "admin-1", event_type: "booking_created", enabled: 0 }]);
    await sendPushToAdmins(deps, notification);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const cron = { ...notification, type: "cron_failure" as const, tag: "cron_failure" };
    await sendPushToAdmins(deps, cron);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    getPreferences.mockResolvedValue([{ admin_id: "admin-1", event_type: "cron_failure", enabled: 1 }]);
    await sendPushToAdmins(deps, cron);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([404, 410])("deletes a permanently invalid subscription on %s", async (status) => {
    const result = await sendPushToAdmins(
      { db, vapid: vapidConfig, fetchImpl: vi.fn(async () => response(status)) },
      notification,
    );
    expect(deleteSubscription).toHaveBeenCalledWith(db, "https://push.example/one");
    expect(result.removed).toBe(1);
  });

  it.each([400, 403])("records %s without deleting", async (status) => {
    const result = await sendPushToAdmins(
      { db, vapid: vapidConfig, fetchImpl: vi.fn(async () => response(status)) },
      notification,
    );
    expect(deleteSubscription).not.toHaveBeenCalled();
    expect(markError).toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it("honors Retry-After and caps retries at two", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(429, "2"))
      .mockResolvedValueOnce(response(429, "0"))
      .mockResolvedValueOnce(response(201));
    const sleep = vi.fn(async () => undefined);
    const result = await sendPushToAdmins({ db, vapid: vapidConfig, fetchImpl, sleep }, notification);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(result.sent).toBe(1);

    fetchImpl.mockReset().mockResolvedValue(response(503, "0"));
    await sendPushToAdmins({ db, vapid: vapidConfig, fetchImpl, sleep }, notification);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(markError).toHaveBeenCalled();
  });

  it("isolates an endpoint failure from the others", async () => {
    getAll.mockResolvedValue([subscription("https://push.example/bad"), subscription("https://push.example/good", "admin-2")]);
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(201));
    const result = await sendPushToAdmins({ db, vapid: vapidConfig, fetchImpl }, notification);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("formats reminder copy from the actual remaining time", () => {
    const now = new Date("2026-08-31T10:00:00.000Z");
    const fortyMinutes = buildBookingReminderNotification({
      bookingId: "booking-40",
      client: "Ada",
      studioId: "la-scene",
      time: "12:40",
      startAt: new Date(now.getTime() + 40 * 60_000),
    }, now);
    const twoHours = buildBookingReminderNotification({
      bookingId: "booking-120",
      client: "Ada",
      studioId: "la-scene",
      time: "14:00",
      startAt: new Date(now.getTime() + 120 * 60_000),
    }, now);
    expect(fortyMinutes.title).toBe("Séance dans 40 min");
    expect(fortyMinutes.title).not.toContain("2 h");
    expect(twoHours.title).toBe("Séance dans 2 h");
    expect(formatReminderDelay(40)).toBe("dans 40 min");
    expect(formatReminderDelay(120)).toBe("dans 2 h");
  });

  it("sends the required payload JSON shape", async () => {
    const fetchImpl = vi.fn(async () => response(201));
    await sendPushToAdmins({ db, vapid: vapidConfig, fetchImpl }, notification);
    const sentPayload = JSON.parse(encrypt.mock.calls[0][2] as unknown as string);
    expect(sentPayload).toEqual({
      title: "Nouvelle réservation",
      body: "Ada — La Scène, le 31/08/2026 à 20h00",
      data: { url: "/admin/bookings", tag: "booking_created", type: "booking_created" },
    });
  });
});
