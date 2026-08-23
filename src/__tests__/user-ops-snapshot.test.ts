import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { buildNextBookingQuery, buildUserBookingStatusCountsQuery } from "@/lib/db";
import { formatCountRate, formatNextBookingWhen } from "@/lib/user-ops-snapshot";

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      booking_ref TEXT,
      user_id TEXT,
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      studio_id TEXT,
      status TEXT
    );
  `);
});

beforeEach(() => {
  db.exec("DELETE FROM bookings;");
});

function getRow(query: { sql: string; params: unknown[] }) {
  return db.prepare(query.sql).get(query.params[0] as string, ...(query.params.slice(1) as string[]));
}

function insert(values: {
  id: string;
  userId?: string;
  date: string;
  start?: string;
  end?: string;
  status?: string;
  studio?: string;
}) {
  db.prepare(
    "INSERT INTO bookings (id, booking_ref, user_id, date, start_time, end_time, studio_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    values.id,
    values.id.toUpperCase(),
    values.userId ?? "u1",
    values.date,
    values.start ?? "18:00",
    values.end ?? "20:00",
    values.studio ?? "la-scene",
    values.status ?? "confirmed",
  );
}

describe("formatCountRate", () => {
  it("returns an em dash without bookings", () => {
    expect(formatCountRate(0, 0)).toBe("—");
  });

  it("shows count and rounded percent", () => {
    expect(formatCountRate(1, 3)).toBe("1 (33 %)");
    expect(formatCountRate(0, 8)).toBe("0 (0 %)");
  });
});

describe("formatNextBookingWhen", () => {
  it("formats the calendar date in French without shifting timezone", () => {
    expect(formatNextBookingWhen("2026-08-29")).toContain("29");
    expect(formatNextBookingWhen("2026-08-29")).not.toContain("18:00");
  });
});

describe("buildUserBookingStatusCountsQuery", () => {
  it("counts cancelled and no-show bookings separately", () => {
    insert({ id: "ok", date: "2026-08-01", status: "completed" });
    insert({ id: "live", date: "2026-08-20", status: "confirmed" });
    insert({ id: "cancel", date: "2026-08-10", status: "cancelled" });
    insert({ id: "absent", date: "2026-08-12", status: "no-show" });
    insert({ id: "other", userId: "u2", date: "2026-08-12", status: "cancelled" });

    const query = buildUserBookingStatusCountsQuery("u1");
    const row = getRow(query) as {
      total: number;
      cancelled: number;
      no_show: number;
    };
    expect(row).toMatchObject({ total: 4, cancelled: 1, no_show: 1 });
  });
});

describe("buildNextBookingQuery", () => {
  it("returns the soonest confirmed session that has not ended", () => {
    insert({ id: "past", date: "2026-08-20", start: "10:00", end: "12:00" });
    insert({ id: "later", date: "2026-08-23", start: "20:00", end: "22:00" });
    insert({ id: "next", date: "2026-08-23", start: "18:00", end: "20:00" });
    insert({ id: "cancelled", date: "2026-08-23", start: "16:00", end: "17:00", status: "cancelled" });
    insert({ id: "ended-today", date: "2026-08-23", start: "10:00", end: "12:00" });

    const query = buildNextBookingQuery("u1", { dateISO: "2026-08-23", hours: 15, minutes: 0 });
    const row = getRow(query) as { id: string };
    expect(row.id).toBe("next");
  });

  it("ignores a session that already ended today", () => {
    insert({ id: "done", date: "2026-08-23", start: "10:00", end: "12:00" });
    const query = buildNextBookingQuery("u1", { dateISO: "2026-08-23", hours: 15, minutes: 0 });
    expect(getRow(query)).toBeUndefined();
  });
});
