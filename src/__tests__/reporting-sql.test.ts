import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";

/**
 * Vérifications reproductibles des expressions SQL de reporting utilisées dans
 * src/lib/db.ts (getDashboardStats) et src/worker.tsx (stats/charts).
 * On exécute les expressions exactes contre une vraie base SQLite en mémoire
 * pour garantir le comportement (clamp par ligne, remise soustraite).
 */

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      date TEXT,
      total_price REAL,
      promo_discount REAL,
      payment_status TEXT,
      payment_method TEXT,
      status TEXT,
      promo_code TEXT,
      start_time TEXT,
      end_time TEXT,
      keep_balance_due INTEGER DEFAULT 0,
      user_id TEXT,
      booking_ref TEXT,
      studio_id TEXT,
      band_name TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      amount REAL,
      status TEXT,
      refunded_amount REAL DEFAULT 0
    );
  `);
});

function insertBooking(id: string, total: number, discount: number, opts: { status?: string; payment_status?: string; payment_method?: string } = {}) {
  db.prepare(
    "INSERT INTO bookings (id, date, total_price, promo_discount, payment_status, payment_method, status) VALUES (?, '2026-01-05', ?, ?, ?, ?, ?)",
  ).run(id, total, discount, opts.payment_status ?? "pay-on-site", opts.payment_method ?? "cash", opts.status ?? "confirmed");
}

function insertPayment(id: string, bookingId: string, amount: number, status = "paid") {
  db.prepare("INSERT INTO payments (id, booking_id, amount, status) VALUES (?, ?, ?, ?)").run(id, bookingId, amount, status);
}

describe("reporting SQL — max_price per-row clamp (M1)", () => {
  const MAX_PRICE_SQL =
    "SELECT COALESCE(MAX(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as max_price FROM bookings";

  it("clamps per-row so negative nets never leak into the aggregate", () => {
    db.exec("DELETE FROM bookings");
    insertBooking("a", 23, 20); // net 3
    insertBooking("b", 5, 10); // net -5 → clamp 0
    const row = db.prepare(MAX_PRICE_SQL).get() as { max_price: number };
    expect(row.max_price).toBe(3);
  });

  it("returns 0 when every row clamps to 0", () => {
    db.exec("DELETE FROM bookings");
    insertBooking("a", 5, 10);
    insertBooking("b", 0, 0);
    const row = db.prepare(MAX_PRICE_SQL).get() as { max_price: number };
    expect(row.max_price).toBe(0);
  });

  it("returns 0 on an empty range (COALESCE fallback)", () => {
    db.exec("DELETE FROM bookings");
    const row = db.prepare(MAX_PRICE_SQL).get() as { max_price: number };
    expect(row.max_price).toBe(0);
  });
});

describe("reporting SQL — monthly-report unpaid net due (M2)", () => {
  const NET_DUE_SQL = `
    WITH paid_by_booking AS (
      SELECT booking_id, COALESCE(SUM(CASE WHEN status IN ('paid','refunded','partial-refund') THEN amount - refunded_amount ELSE 0 END), 0) as paid_amount
      FROM payments GROUP BY booking_id
    )
    SELECT
      MAX(b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0), 0) as amount
    FROM bookings b
    LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
    WHERE b.status != 'cancelled'
      AND b.payment_status = 'pay-on-site'
      AND b.date >= '2026-01-01' AND b.date <= '2026-01-31'
      AND (b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0)) > 0
  `;

  it("subtracts promo_discount from the unpaid due (23€ gross − 20€ remise = 3€)", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments;");
    insertBooking("a", 23, 20);
    const row = db.prepare(NET_DUE_SQL).get() as { amount: number };
    expect(row.amount).toBe(3);
  });

  it("clamps to 0 when the discount covers the full gross", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments;");
    insertBooking("a", 23, 23);
    // Net = 0 → la prédicat > 0 exclut la ligne → aucun montant dû.
    const rows = db.prepare(NET_DUE_SQL).all();
    expect(rows).toHaveLength(0);
  });

  it("subtracts already-paid amounts and clamps at 0", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments;");
    insertBooking("a", 23, 20);
    insertPayment("p1", "a", 3, "paid");
    // Net = 23 − 20 − 3 = 0 → exclu par le prédicat > 0.
    const rows = db.prepare(NET_DUE_SQL).all();
    expect(rows).toHaveLength(0);

    insertBooking("b", 23, 0);
    insertPayment("p2", "b", 10, "paid");
    // Net = 23 − 0 − 10 = 13.
    const rows2 = db.prepare(NET_DUE_SQL).all();
    expect(rows2).toHaveLength(1);
    expect((rows2[0] as { amount: number }).amount).toBe(13);
  });
});

describe("reporting SQL — applied discounts per-row clamp (M3)", () => {
  const DISCOUNTS_SQL =
    "SELECT COALESCE(SUM(MIN(COALESCE(promo_discount, 0), MAX(total_price, 0))), 0) as discounts FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'";
  const GROSS_SQL =
    "SELECT COALESCE(SUM(MAX(total_price, 0)), 0) as gross FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'";
  const NET_SQL =
    "SELECT COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as net FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'";

  it("clamps discounts to each price, excludes cancelled rows, and reconciles net revenue", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments;");
    insertBooking("a", 23, 20);
    insertBooking("b", 5, 10); // discount exceeds price: only 5€ is applied
    insertBooking("cancelled", 100, 50, { status: "cancelled" });

    const params = ["2026-01-01", "2026-01-31"];
    const discounts = (db.prepare(DISCOUNTS_SQL).get(...params) as { discounts: number }).discounts;
    const gross = (db.prepare(GROSS_SQL).get(...params) as { gross: number }).gross;
    const net = (db.prepare(NET_SQL).get(...params) as { net: number }).net;

    expect(discounts).toBe(25);
    expect(gross - discounts).toBe(net);
  });
});

describe("reporting SQL — dashboard discount split", () => {
  const SPLIT_SQL = `
    SELECT
      COALESCE(SUM(CASE WHEN promo_code IS NOT NULL AND TRIM(promo_code) != '' THEN MIN(COALESCE(promo_discount, 0), MAX(total_price, 0)) ELSE 0 END), 0) as promo_discounts,
      COALESCE(SUM(CASE WHEN promo_code IS NULL OR TRIM(promo_code) = '' THEN MIN(COALESCE(promo_discount, 0), MAX(total_price, 0)) ELSE 0 END), 0) as manual_discounts
    FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'`;

  it("splits promo and manual discounts, clamps, and excludes cancelled rows", () => {
    db.exec("DELETE FROM bookings");
    insertBooking("promo", 20, 4); db.prepare("UPDATE bookings SET promo_code = 'WELCOME' WHERE id = 'promo'").run();
    insertBooking("manual", 20, 3);
    insertBooking("empty", 20, 2); db.prepare("UPDATE bookings SET promo_code = '' WHERE id = 'empty'").run();
    insertBooking("spaces", 20, 1); db.prepare("UPDATE bookings SET promo_code = '   ' WHERE id = 'spaces'").run();
    insertBooking("zero", 20, 0); db.prepare("UPDATE bookings SET promo_code = 'ZERO' WHERE id = 'zero'").run();
    insertBooking("clamped", 5, 10); db.prepare("UPDATE bookings SET promo_code = 'BIG' WHERE id = 'clamped'").run();
    insertBooking("cancelled", 50, 50, { status: "cancelled" });
    const row = db.prepare(SPLIT_SQL).get("2026-01-01", "2026-01-31") as { promo_discounts: number; manual_discounts: number };
    expect(row.promo_discounts).toBe(9); // 4 + 0 + min(10, 5)
    expect(row.manual_discounts).toBe(6); // 3 + 2 + 1
    expect(row.promo_discounts + row.manual_discounts).toBe(15);
  });
});

describe("reporting SQL — dashboard cancellations", () => {
  const SQL = "SELECT COUNT(*) as count FROM bookings WHERE date >= ? AND date <= ? AND status = 'cancelled'";

  it("counts only cancelled bookings by booking date and respects the range", () => {
    db.exec("DELETE FROM bookings");
    insertBooking("in", 1, 0, { status: "cancelled" });
    insertBooking("confirmed", 1, 0);
    insertBooking("noshow", 1, 0, { status: "no-show" });
    db.prepare("UPDATE bookings SET date = '2025-12-31' WHERE id = 'confirmed'").run();
    expect((db.prepare(SQL).get("2026-01-01", "2026-01-31") as { count: number }).count).toBe(1);
  });
});

describe("reporting SQL — dashboard overdue predicate", () => {
  const SQL = `
    WITH paid_by_booking AS (
      SELECT booking_id, COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN amount - refunded_amount ELSE 0 END), 0) as paid_amount
      FROM payments GROUP BY booking_id
    )
    SELECT COUNT(*) as count, COALESCE(SUM((MAX(b.total_price - COALESCE(b.promo_discount, 0), 0) - COALESCE(paid.paid_amount, 0))), 0) as total
    FROM bookings b LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
    WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
      AND b.date >= ? AND b.date <= ?
      AND (b.date < ? OR (b.date = ? AND CASE WHEN b.end_time = '00:00' THEN '24:00' ELSE b.end_time END <= ?))
      AND (MAX(b.total_price - COALESCE(b.promo_discount, 0), 0) - COALESCE(paid.paid_amount, 0)) > 0.005`;

  function add(id: string, date: string, end: string, opts: { status?: string; keep?: number; total?: number; discount?: number; paid?: number } = {}) {
    db.prepare("INSERT INTO bookings (id,date,total_price,promo_discount,payment_status,payment_method,status,end_time,keep_balance_due) VALUES (?,?,?,?,'pay-on-site','cash',?,?,?)")
      .run(id, date, opts.total ?? 10, opts.discount ?? 0, opts.status ?? "confirmed", end, opts.keep ?? 0);
    if (opts.paid != null) insertPayment(`p-${id}`, id, opts.paid);
  }

  it("handles Paris ended-session boundaries, status, payment, and clamped remaining", () => {
    db.exec("DELETE FROM bookings; DELETE FROM payments;");
    add("at", "2026-08-20", "15:00");
    add("after", "2026-08-20", "15:30");
    add("midnight", "2026-08-20", "00:00");
    add("yesterday", "2026-08-19", "00:00");
    add("tomorrow", "2026-08-21", "12:00");
    add("cancelled", "2026-08-19", "12:00", { status: "cancelled" });
    add("kept", "2026-08-19", "12:00", { status: "cancelled", keep: 1 });
    add("noshow", "2026-08-19", "13:00", { status: "no-show" });
    add("tiny", "2026-08-19", "14:00", { total: 0.004 });
    add("paid", "2026-08-19", "14:00", { paid: 10 });
    add("over", "2026-08-19", "14:00", { total: 5, paid: 20 });
    add("discounted", "2026-08-19", "14:00", { total: 5, discount: 10 });
    const row = db.prepare(SQL).get("2026-08-01", "2026-08-31", "2026-08-20", "2026-08-20", "15:00") as { count: number; total: number };
    expect(row.count).toBe(4); // at, yesterday, kept, no-show; tiny and fully-paid rows are excluded
    expect(row.total).toBe(40);
  });
});
