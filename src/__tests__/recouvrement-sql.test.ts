import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";

/**
 * SQL de getOverdueBookings (src/lib/db.ts) : séances terminées, solde dû,
 * sans borne de période. Aligné caractère pour caractère avec la requête.
 */

let db: DatabaseSync;

const PAID_BY_BOOKING_CTE = `paid_by_booking AS (
  SELECT a.booking_id, COALESCE(SUM(a.amount), 0) as paid_amount
  FROM payment_allocations a
  JOIN payments p ON p.id = a.payment_id
  WHERE p.status = 'settled'
  GROUP BY a.booking_id
)`;
const remainingExpr = `(MAX(b.total_price - COALESCE(b.promo_discount, 0), 0) - COALESCE(paid.paid_amount, 0))`;
const sessionEndedSql = `(b.date < ? OR (b.date = ? AND CASE WHEN b.end_time = '00:00' THEN '24:00' ELSE b.end_time END <= ?))`;

const LIST_SQL = `
  WITH ${PAID_BY_BOOKING_CTE}
  SELECT b.id, b.booking_ref, b.user_id, b.date, b.start_time, b.end_time, b.studio_id, b.status,
    b.payment_status, COALESCE(b.keep_balance_due, 0) as keep_balance_due,
    b.total_price, COALESCE(b.promo_discount, 0) as promo_discount,
    MAX(b.total_price - COALESCE(b.promo_discount, 0), 0) as amount_due,
    COALESCE(paid.paid_amount, 0) as total_paid,
    ${remainingExpr} as remaining,
    u.name as user_name, u.email as user_email, u.phone as user_phone,
    COALESCE(b.band_name, u.band_name) as band_name
  FROM bookings b
  LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
  LEFT JOIN users u ON u.id = b.user_id
  WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
    AND ${sessionEndedSql}
    AND ${remainingExpr} > 0.005
  ORDER BY b.date ASC, b.start_time ASC`;

const AGG_SQL = `
  WITH ${PAID_BY_BOOKING_CTE}
  SELECT COUNT(*) as count, COALESCE(SUM(${remainingExpr}), 0) as total
  FROM bookings b
  LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
  LEFT JOIN users u ON u.id = b.user_id
  WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
    AND ${sessionEndedSql}
    AND ${remainingExpr} > 0.005`;

const SEARCH_SQL = `
  WITH ${PAID_BY_BOOKING_CTE}
  SELECT b.id
  FROM bookings b
  LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
  LEFT JOIN users u ON u.id = b.user_id
  WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
    AND ${sessionEndedSql}
    AND ${remainingExpr} > 0.005
    AND (
      b.booking_ref LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?
      OR b.band_name LIKE ? OR u.band_name LIKE ?
    )
  ORDER BY b.date ASC, b.start_time ASC`;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      band_name TEXT
    );
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      booking_ref TEXT,
      user_id TEXT,
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      studio_id TEXT,
      status TEXT,
      payment_status TEXT,
      keep_balance_due INTEGER DEFAULT 0,
      total_price REAL,
      promo_discount REAL,
      band_name TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      amount REAL,
      method TEXT,
      status TEXT
    );
    CREATE TABLE payment_allocations (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      booking_id TEXT NOT NULL,
      amount REAL NOT NULL
    );
  `);
});

function addUser(id: string, opts: { name?: string; email?: string; phone?: string; band?: string } = {}) {
  db.prepare("INSERT INTO users (id, name, email, phone, band_name) VALUES (?, ?, ?, ?, ?)").run(
    id,
    opts.name ?? id,
    opts.email ?? `${id}@test.fr`,
    opts.phone ?? null,
    opts.band ?? null,
  );
}

function add(
  id: string,
  date: string,
  end: string,
  opts: { status?: string; keep?: number; total?: number; discount?: number; paid?: number; user?: string; ref?: string; band?: string } = {},
) {
  db.prepare(
    "INSERT INTO bookings (id, booking_ref, user_id, date, start_time, end_time, studio_id, status, payment_status, keep_balance_due, total_price, promo_discount, band_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    opts.ref ?? id.toUpperCase(),
    opts.user ?? "u1",
    date,
    "10:00",
    end,
    "la-scene",
    opts.status ?? "confirmed",
    "pay-on-site",
    opts.keep ?? 0,
    opts.total ?? 10,
    opts.discount ?? 0,
    opts.band ?? null,
  );
  if (opts.paid != null) {
    db.prepare("INSERT INTO payments (id, amount, method, status) VALUES (?, ?, 'cash', 'settled')").run(`p-${id}`, opts.paid);
    db.prepare("INSERT INTO payment_allocations (id, payment_id, booking_id, amount) VALUES (?, ?, ?, ?)").run(`a-${id}`, `p-${id}`, id, opts.paid);
  }
}

describe("recouvrement overdue (no date range)", () => {
  const today = "2026-08-20";
  const now = "15:00";

  it("handles Paris ended-session boundaries, status, payment, search, and totals", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments; DELETE FROM users;");
    addUser("u1", { name: "Alice Martin", email: "alice@test.fr", phone: "0600000001" });
    addUser("u2", { name: "Bob Durand", email: "bob@test.fr", band: "Les Échos" });

    add("at", today, "15:00", { user: "u1" });
    add("after", today, "15:30", { user: "u1" });
    add("midnight", today, "00:00", { user: "u1" });
    add("yesterday", "2026-08-19", "00:00", { user: "u2", ref: "H3-YEST", band: "Les Échos" });
    add("tomorrow", "2026-08-21", "12:00", { user: "u1" });
    add("cancelled", "2026-08-19", "12:00", { status: "cancelled", user: "u1" });
    add("kept", "2026-08-19", "12:00", { status: "cancelled", keep: 1, user: "u2" });
    add("noshow", "2026-08-19", "13:00", { status: "no-show", user: "u1" });
    add("tiny", "2026-08-19", "14:00", { total: 0.004, user: "u1" });
    add("paid", "2026-08-19", "14:00", { paid: 10, user: "u1" });
    add("over", "2026-08-19", "14:00", { total: 5, paid: 20, user: "u1" });
    add("discounted", "2026-08-19", "14:00", { total: 5, discount: 10, user: "u1" });
    add("partial", "2026-08-18", "12:00", { total: 30, paid: 10, user: "u2", ref: "H3-PART" });

    const rows = db.prepare(LIST_SQL).all(today, today, now) as Array<{ id: string; remaining: number }>;
    const ids = rows.map((row) => row.id).sort();
    expect(ids).toEqual(["at", "kept", "noshow", "partial", "yesterday"]);
    expect(rows.find((row) => row.id === "partial")?.remaining).toBe(20);

    const agg = db.prepare(AGG_SQL).get(today, today, now) as { count: number; total: number };
    expect(agg.count).toBe(5);
    expect(agg.total).toBe(60);

    const byName = "%bob%";
    const searchedByName = db.prepare(SEARCH_SQL).all(today, today, now, byName, byName, byName, byName, byName, byName) as Array<{ id: string }>;
    expect(searchedByName.map((row) => row.id).sort()).toEqual(["kept", "partial", "yesterday"]);

    const byRef = "%H3-PART%";
    const searchedByRef = db.prepare(SEARCH_SQL).all(today, today, now, byRef, byRef, byRef, byRef, byRef, byRef) as Array<{ id: string }>;
    expect(searchedByRef.map((row) => row.id)).toEqual(["partial"]);
  });
});
