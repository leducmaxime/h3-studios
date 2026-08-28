import { beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let db: DatabaseSync;

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
const stripComments = (sql: string) => sql.split("\n").map((line) => {
  const index = line.indexOf("--");
  return index === -1 ? line : line.slice(0, index);
}).join("\n");
const statements = (sql: string) => stripComments(sql).split(";").map((s) => s.trim()).filter(Boolean);

function applyMigrations() {
  for (const file of readdirSync(migrationsDirectory).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of statements(readFileSync(join(migrationsDirectory, file), "utf8"))) {
      try {
        db.exec(statement);
      } catch (error) {
        if (file === "0010_add_promo_round_mode.sql" && String(error).includes("duplicate column name: round_mode")) continue;
        throw error;
      }
    }
  }
}

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  applyMigrations();
  db.prepare("INSERT INTO users (id, name) VALUES ('u1', 'Client')").run();
});

// Keep this projection synchronized with buildPaymentsCTE in src/lib/db.ts.
const PAYMENTS_ENRICHED_SQL = `
  WITH payments_enriched AS (
    SELECT
      p.id as id, p.amount as amount, p.method as method, p.status as status,
      p.paid_at as paid_at, p.external_ref as external_ref, p.parent_id as parent_id,
      p.reason as reason, p.performed_by as performed_by, p.created_at as created_at,
      COALESCE((SELECT GROUP_CONCAT(booking_ref, ', ') FROM (
        SELECT b.booking_ref FROM payment_allocations a JOIN bookings b ON b.id = a.booking_id
        WHERE a.payment_id = p.id ORDER BY b.date ASC, b.id ASC
      ) ordered_bookings), '') as booking_refs,
      (SELECT COUNT(*) FROM payment_allocations a WHERE a.payment_id = p.id) as allocation_count,
      COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0) as allocated_amount,
      p.amount - COALESCE((SELECT SUM(a.amount) FROM payment_allocations a WHERE a.payment_id = p.id), 0) as unallocated_amount,
      CASE WHEN p.status = 'settled' AND p.amount > 0 THEN COALESCE((
        SELECT SUM(CASE WHEN a.amount + COALESCE((SELECT SUM(c.amount)
          FROM payment_allocations c JOIN payments child ON child.id = c.payment_id
          WHERE child.parent_id = p.id AND c.booking_id = a.booking_id
            AND child.status IN ('settled', 'pending')), 0) > 0
          THEN a.amount + COALESCE((SELECT SUM(c.amount)
            FROM payment_allocations c JOIN payments child ON child.id = c.payment_id
            WHERE child.parent_id = p.id AND c.booking_id = a.booking_id
              AND child.status IN ('settled', 'pending')), 0)
          ELSE 0 END)
        FROM payment_allocations a WHERE a.payment_id = p.id
      ), 0) ELSE 0 END as refundable_amount,
      (SELECT COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.name)
       FROM payment_allocations a JOIN bookings b ON b.id = a.booking_id LEFT JOIN users u ON u.id = b.user_id
       WHERE a.payment_id = p.id ORDER BY b.date ASC, b.id ASC LIMIT 1) as user_name,
      (SELECT u.band_name FROM payment_allocations a JOIN bookings b ON b.id = a.booking_id LEFT JOIN users u ON u.id = b.user_id
       WHERE a.payment_id = p.id ORDER BY b.date ASC, b.id ASC LIMIT 1) as user_band_name,
      (SELECT u.id FROM payment_allocations a JOIN bookings b ON b.id = a.booking_id LEFT JOIN users u ON u.id = b.user_id
       WHERE a.payment_id = p.id ORDER BY b.date ASC, b.id ASC LIMIT 1) as user_id,
      (SELECT b.date FROM payment_allocations a JOIN bookings b ON b.id = a.booking_id
       WHERE a.payment_id = p.id ORDER BY b.date ASC, b.id ASC LIMIT 1) as booking_date,
      CASE WHEN p.external_ref LIKE 'cs_%' THEN 'online' ELSE 'on-site' END as payment_type
    FROM payments p
  )
  SELECT * FROM payments_enriched
`;

function rows() { return db.prepare(PAYMENTS_ENRICHED_SQL).all() as Array<Record<string, unknown>>; }
function reset() {
  db.exec("DELETE FROM payment_allocations; DELETE FROM payments; DELETE FROM bookings;");
}
function insertBooking(id: string, date = "2026-01-05") {
  db.prepare(`INSERT INTO bookings
    (id, booking_ref, user_id, studio_id, date, start_time, end_time, group_type, status,
     base_price, equipment_price, total_price, payment_method, payment_status, created_at, updated_at)
    VALUES (?, ?, 'u1', 'la-scene', ?, '10:00', '11:00', 'group', 'confirmed', 10, 0, 10, 'cash', 'pay-on-site', '2026-01-01', '2026-01-01')`).run(id, id, date);
}
function insertPayment(id: string, amount: number, bookingIds: string[], externalRef: string | null = null) {
  const method = externalRef ? "card" : "cash";
  db.prepare(`INSERT INTO payments (id, amount, method, status, paid_at, external_ref, created_at)
    VALUES (?, ?, ?, 'settled', '2026-01-02', ?, '2026-01-02')`).run(id, amount, method, externalRef);
  for (const bookingId of bookingIds) {
    db.prepare(`INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
      VALUES (?, ?, ?, ?, '2026-01-02')`).run(`${id}-${bookingId}`, id, bookingId, amount / bookingIds.length);
  }
}

describe("payments ledger SQL", () => {
  it("retourne deux mouvements réels", () => {
    reset(); insertBooking("b1");
    insertPayment("p1", 10, ["b1"]); insertPayment("p2", 15, ["b1"]);
    expect(rows()).toHaveLength(2);
  });

  it("ne retourne aucune ligne sans mouvement", () => {
    reset(); insertBooking("b1");
    expect(rows()).toHaveLength(0);
  });

  it("projette les allocations et les montants dérivés du mouvement", () => {
    reset(); insertBooking("b1"); insertBooking("b2", "2026-01-06"); insertBooking("b3", "2026-01-07");
    insertPayment("p1", 250, ["b1", "b2", "b3"], "cs_shared");
    const row = rows()[0];
    expect(row).toMatchObject({
      id: "p1", booking_refs: "b1, b2, b3", allocation_count: 3,
      allocated_amount: 250, unallocated_amount: 0, refundable_amount: 250,
      payment_type: "online",
    });
  });

  it("ne retourne que les mouvements d'une réservation partiellement payée", () => {
    reset(); insertBooking("b1"); insertPayment("p1", 10, ["b1"]);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].id).toBe("p1");
  });
});
