import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";

/** Vérifie que le grand livre SQL ne contient que les vrais enregistrements de paiement. */

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      name TEXT,
      band_name TEXT
    );
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      booking_ref TEXT,
      user_id TEXT,
      date TEXT,
      payment_status TEXT,
      status TEXT,
      created_at TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      amount REAL,
      method TEXT,
      status TEXT,
      refunded_amount REAL DEFAULT 0,
      paid_at TEXT,
      created_at TEXT,
      stripe_event_id TEXT
    );
  `);
});

const PAYMENTS_ENRICHED_SQL = `
  WITH payments_enriched AS (
    SELECT
      p.id as id,
      p.booking_id as booking_id,
      p.amount as amount,
      CASE WHEN p.method IN ('cheque', 'check') THEN 'check' ELSE p.method END as method,
      p.status as status,
      p.refunded_amount as refunded_amount,
      p.paid_at as paid_at,
      p.created_at as created_at,
      p.stripe_event_id as stripe_event_id,
      b.booking_ref as booking_ref,
      COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.name) as user_name,
      u.band_name as user_band_name,
      u.id as user_id,
      b.date as booking_date,
      CASE
        WHEN b.payment_status = 'pay-on-site' THEN 'on-site'
        WHEN p.method = 'card' THEN 'online'
        ELSE 'on-site'
      END as payment_type
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    LEFT JOIN users u ON u.id = b.user_id
  )
  SELECT * FROM payments_enriched
`;

function rows() {
  return db.prepare(PAYMENTS_ENRICHED_SQL).all();
}

function reset() {
  db.exec("DELETE FROM payments; DELETE FROM bookings; DELETE FROM users;");
  db.prepare("INSERT INTO users (id, name) VALUES ('u1', 'Client')").run();
}

function insertBooking(id: string, paymentStatus = "pay-on-site") {
  db.prepare(
    "INSERT INTO bookings (id, booking_ref, user_id, date, payment_status, status, created_at) VALUES (?, ?, 'u1', '2026-01-05', ?, 'confirmed', '2026-01-01')",
  ).run(id, id, paymentStatus);
}

function insertPayment(id: string, bookingId: string, amount: number) {
  db.prepare(
    "INSERT INTO payments (id, booking_id, amount, method, status, created_at) VALUES (?, ?, ?, 'cash', 'paid', '2026-01-02')",
  ).run(id, bookingId, amount);
}

describe("payments ledger SQL", () => {
  it("retourne deux lignes pour deux paiements réels", () => {
    reset();
    insertBooking("b1");
    insertPayment("p1", "b1", 10);
    insertPayment("p2", "b1", 15);

    expect(rows()).toHaveLength(2);
  });

  it("ne retourne aucune ligne pour une réservation sur place impayée", () => {
    reset();
    insertBooking("b1");

    expect(rows()).toHaveLength(0);
  });

  it("retourne uniquement les paiements réels d'une réservation partiellement payée", () => {
    reset();
    insertBooking("b1");
    insertPayment("p1", "b1", 10);

    expect(rows()).toHaveLength(1);
    expect((rows()[0] as { id: string }).id).toBe("p1");
  });
});
