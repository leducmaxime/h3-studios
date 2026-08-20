import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { USER_BOOKING_STATS_SQL } from "@/lib/db";

let db: DatabaseSync;

const statsSql = `SELECT * FROM (${USER_BOOKING_STATS_SQL}) WHERE user_id = ?`;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      status TEXT,
      total_price REAL,
      promo_discount REAL,
      equipment_price REAL,
      studio_id TEXT,
      start_time TEXT,
      end_time TEXT
    );
  `);
});

beforeEach(() => {
  db.exec("DELETE FROM users; DELETE FROM bookings;");
});

function insertBooking(
  id: string,
  userId: string,
  values: Partial<{
    status: string;
    total_price: number;
    promo_discount: number;
    equipment_price: number;
    studio_id: string;
    start_time: string;
    end_time: string;
  }> = {},
) {
  db.prepare(
    `INSERT INTO bookings
      (id, user_id, status, total_price, promo_discount, equipment_price, studio_id, start_time, end_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    values.status ?? "confirmed",
    values.total_price ?? 20,
    values.promo_discount ?? 0,
    values.equipment_price ?? 0,
    values.studio_id ?? "la-scene",
    values.start_time ?? "10:00",
    values.end_time ?? "11:00",
  );
}

function stats(userId: string) {
  return db.prepare(statsSql).get(userId) as Record<string, number> | undefined;
}

describe("USER_BOOKING_STATS_SQL", () => {
  it("aggregates mixed bookings and excludes cancelled values from active totals", () => {
    insertBooking("confirmed-night", "mixed", { total_price: 30, promo_discount: 5, equipment_price: 7, studio_id: "la-scene", start_time: "21:30", end_time: "00:00" });
    insertBooking("confirmed-day", "mixed", { total_price: 20, promo_discount: 2, equipment_price: 3, studio_id: "le-podium", start_time: "10:00", end_time: "12:00" });
    insertBooking("cancelled", "mixed", { status: "cancelled", total_price: 100, promo_discount: 50, equipment_price: 40, studio_id: "la-scene", start_time: "12:00", end_time: "14:00" });

    expect(stats("mixed")).toMatchObject({ total_bookings: 2, total_spent: 43, total_cancellations: 1, total_discounts: 7, total_equipment: 10, total_minutes: 270, total_bookings_la_scene: 1, total_bookings_le_podium: 1 });
  });

  it("treats midnight as minute 1440", () => {
    insertBooking("midnight", "midnight-user", { start_time: "21:30", end_time: "00:00" });
    expect(stats("midnight-user")?.total_minutes).toBe(150);
  });

  it("returns zero active aggregates for a user with only cancelled bookings", () => {
    insertBooking("cancelled-only", "cancelled-user", { status: "cancelled", total_price: 40, promo_discount: 5, equipment_price: 6, start_time: "10:00", end_time: "12:00" });
    expect(stats("cancelled-user")).toMatchObject({ total_bookings: 0, total_spent: 0, total_cancellations: 1, total_minutes: 0, total_discounts: 0, total_equipment: 0 });
  });

  it("has no stats row without bookings and coalesces missing users to zero", () => {
    db.prepare("INSERT INTO users (id) VALUES (?)").run("no-bookings");
    expect(stats("no-bookings")).toBeUndefined();
    const row = db.prepare(`
      SELECT u.id, COALESCE(s.total_bookings, 0) AS total_bookings,
        COALESCE(s.total_spent, 0) AS total_spent,
        COALESCE(s.total_cancellations, 0) AS total_cancellations,
        COALESCE(s.total_discounts, 0) AS total_discounts,
        COALESCE(s.total_equipment, 0) AS total_equipment,
        COALESCE(s.total_minutes, 0) AS total_minutes,
        COALESCE(s.total_bookings_la_scene, 0) AS total_bookings_la_scene,
        COALESCE(s.total_bookings_le_podium, 0) AS total_bookings_le_podium
      FROM users u LEFT JOIN (${USER_BOOKING_STATS_SQL}) s ON u.id = s.user_id
      WHERE u.id = ?
    `).get("no-bookings") as Record<string, number>;
    expect(row).toMatchObject({ total_bookings: 0, total_spent: 0, total_cancellations: 0, total_discounts: 0, total_equipment: 0, total_minutes: 0, total_bookings_la_scene: 0, total_bookings_le_podium: 0 });
  });

  it("clamps net spending per booking", () => {
    insertBooking("negative", "clamp", { total_price: 5, promo_discount: 10 });
    insertBooking("positive", "clamp", { total_price: 23, promo_discount: 20 });
    expect(stats("clamp")?.total_spent).toBe(3);
  });

  it("splits active bookings by studio", () => {
    for (let i = 0; i < 3; i++) insertBooking(`scene-${i}`, "studios", { studio_id: "la-scene" });
    insertBooking("podium", "studios", { studio_id: "le-podium" });
    insertBooking("cancelled-scene", "studios", { status: "cancelled", studio_id: "la-scene" });
    expect(stats("studios")).toMatchObject({ total_bookings_la_scene: 3, total_bookings_le_podium: 1 });
  });
});
