import { beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

const stripComments = (sql: string) =>
  sql
    .split("\n")
    .map((line) => {
      const index = line.indexOf("--");
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");

const statements = (sql: string) =>
  stripComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

const legacyBalanceSql = `
  SELECT ROUND(SUM(MAX(b.total_price - COALESCE(b.promo_discount,0),0) - COALESCE(paid.a,0)),2) AS balance
  FROM bookings b
  LEFT JOIN (
    SELECT booking_id, SUM(CASE WHEN status IN ('paid','refunded','partial-refund')
                              THEN amount - COALESCE(refunded_amount,0) ELSE 0 END) a
    FROM payments GROUP BY booking_id
  ) paid ON paid.booking_id = b.id
  WHERE b.status != 'cancelled' OR b.keep_balance_due = 1
`;

const ledgerBalanceSql = `
  SELECT ROUND(SUM(MAX(b.total_price - COALESCE(b.promo_discount,0),0) - COALESCE(paid.a,0)),2) AS balance
  FROM bookings b
  LEFT JOIN (
    SELECT a.booking_id, SUM(a.amount) a FROM payment_allocations a
    JOIN payments p ON p.id = a.payment_id WHERE p.status='settled'
    GROUP BY a.booking_id
  ) paid ON paid.booking_id = b.id
  WHERE b.status != 'cancelled' OR b.keep_balance_due = 1
`;

type MigrationMode = "statements" | "transaction";
type TestDatabase = {
  db: DatabaseSync;
  legacyBalance: number;
  mode: MigrationMode;
};

const users = [
  "simple",
  "decimal-a",
  "decimal-b",
  "partial",
  "total",
  "action",
  "multi-a",
  "multi-b",
  "multi-c",
  "cancelled",
  "zero",
  "manual",
];

function applyStatements(db: DatabaseSync, sql: string) {
  for (const statement of statements(sql)) db.exec(statement);
}

function applyLegacyMigrations(db: DatabaseSync) {
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file !== "0020_cash_ledger.sql")
    .sort();

  for (const file of migrationFiles) {
    for (const statement of statements(
      readFileSync(join(migrationsDirectory, file), "utf8"),
    )) {
      try {
        db.exec(statement);
      } catch (error) {
        // 0001 already contains this column although 0010 adds it again.
        // Keep the real on-disk migration sequence usable without writing a
        // replacement schema in this test.
        if (
          file === "0010_add_promo_round_mode.sql" &&
          String(error).includes("duplicate column name: round_mode")
        ) {
          continue;
        }
        throw error;
      }
    }
  }
}

function seedLegacyData(db: DatabaseSync) {
  const insertUser = db.prepare(
    "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
  );
  for (const id of users) {
    insertUser.run(`u-${id}`, `Client ${id}`, `${id}@example.test`);
  }

  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, booking_ref, user_id, studio_id, date, start_time, end_time,
      group_type, status, base_price, equipment_price, total_price,
      payment_method, payment_status, promo_discount, keep_balance_due
    ) VALUES (?, ?, ?, 'la-scene', '2026-08-17', '10:00', '11:00',
      'solo', ?, ?, 0, ?, ?, ?, ?, ?)
  `);
  const booking = (
    id: string,
    total: number,
    status = "confirmed",
    paymentStatus = "paid",
    promoDiscount = 0,
    keepBalanceDue = 0,
  ) => {
    insertBooking.run(
      `b-${id}`,
      `H3-${id}`,
      `u-${id}`,
      status,
      total,
      total,
      "cash",
      paymentStatus,
      promoDiscount,
      keepBalanceDue,
    );
  };

  booking("simple", 40);
  booking("decimal-a", 12.5);
  booking("decimal-b", 9.8);
  booking("partial", 100);
  booking("total", 50);
  booking("action", 20);
  booking("multi-a", 10);
  booking("multi-b", 10);
  booking("multi-c", 10);
  booking("cancelled", 100, "cancelled", "paid", 0, 1);
  booking("zero", 100, "confirmed", "paid", 100);
  booking("manual", 80);

  const insertPayment = db.prepare(`
    INSERT INTO payments (
      id, booking_id, amount, method, status, refunded_amount, paid_at,
      created_at, stripe_event_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const payment = (
    id: string,
    bookingId: string,
    amount: number,
    method = "cash",
    status = "paid",
    refundedAmount = 0,
    stripeEventId: string | null = null,
  ) => {
    insertPayment.run(
      id,
      `b-${bookingId}`,
      amount,
      method,
      status,
      refundedAmount,
      "2026-08-17 10:00:00",
      "2026-08-16 10:00:00",
      stripeEventId,
    );
  };

  payment("p-simple", "simple", 40);
  payment("p-decimal-a", "decimal-a", 12.5);
  payment("p-decimal-b", "decimal-b", 9.8);
  payment("p-partial", "partial", 100, "card", "partial-refund", 30);
  payment("p-total", "total", 50, "card", "refunded", 50);
  payment("p-action", "action", 20, "card");
  payment("multi-1", "multi-a", 10, "card", "paid", 0, "cs_test_multi");
  payment("multi-2", "multi-b", 10, "card", "paid", 0, "cs_test_multi");
  payment("multi-3", "multi-c", 10, "card", "paid", 0, "cs_test_multi");
  payment("p-cancelled", "cancelled", 10);
  payment("p-zero", "zero", 0);
  payment("p-manual", "manual", 80, "cash", "paid", 15);

  const insertRefund = db.prepare(`
    INSERT INTO payment_refunds (
      stripe_refund_id, payment_id, booking_id, amount_cents, status,
      reason, performed_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const refund = (
    id: string,
    paymentId: string,
    bookingId: string,
    cents: number,
    status: string,
  ) => {
    insertRefund.run(
      id,
      paymentId,
      `b-${bookingId}`,
      cents,
      status,
      "client request",
      "admin-1",
      "2026-08-17 12:00:00",
      "2026-08-17 12:00:00",
    );
  };
  refund("refund-partial", "p-partial", "partial", 3000, "succeeded");
  refund("refund-total", "p-total", "total", 5000, "succeeded");
  refund("refund-action", "p-action", "action", 500, "requires_action");
}

function createMigratedDatabase(mode: MigrationMode): TestDatabase {
  const db = new DatabaseSync(":memory:");
  applyLegacyMigrations(db);
  seedLegacyData(db);

  const legacyBalance = (
    db.prepare(legacyBalanceSql).get() as { balance: number }
  ).balance;
  db.exec("PRAGMA foreign_keys = ON");

  const migration = readFileSync(
    join(migrationsDirectory, "0020_cash_ledger.sql"),
    "utf8",
  );
  if (mode === "transaction") db.exec("BEGIN");
  try {
    applyStatements(db, migration);
    if (mode === "transaction") db.exec("COMMIT");
  } catch (error) {
    if (mode === "transaction") db.exec("ROLLBACK");
    throw error;
  }

  return { db, legacyBalance, mode };
}

let databases: TestDatabase[];

beforeAll(() => {
  databases = [
    createMigratedDatabase("statements"),
    createMigratedDatabase("transaction"),
  ];
});

describe("migration du grand livre de trésorerie", () => {
  it("conserve l'invariant du reste dû au centime", () => {
    for (const { db, legacyBalance } of databases) {
      const ledgerBalance = (
        db.prepare(ledgerBalanceSql).get() as { balance: number }
      ).balance;
      expect(ledgerBalance).toBeCloseTo(legacyBalance, 2);
      expect(Math.abs(ledgerBalance - legacyBalance)).toBeLessThanOrEqual(0.005);
    }
  });

  it("ne sur-affecte aucun mouvement", () => {
    for (const { db } of databases) {
      const violations = db
        .prepare(`
          SELECT p.id
          FROM payments p
          LEFT JOIN payment_allocations a ON a.payment_id = p.id
          GROUP BY p.id
          HAVING ABS(COALESCE(SUM(a.amount), 0)) > ABS(p.amount) + 0.005
        `)
        .all();
      expect(violations).toEqual([]);
    }
  });

  it("ne laisse aucune violation de clé étrangère", () => {
    for (const { db } of databases) {
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    }
  });

  it("ne laisse aucun parent_id orphelin", () => {
    for (const { db } of databases) {
      const orphanParents = db
        .prepare(`
          SELECT p.id, p.parent_id
          FROM payments p
          LEFT JOIN payments parent ON parent.id = p.parent_id
          WHERE p.parent_id IS NOT NULL AND parent.id IS NULL
        `)
        .all();
      expect(orphanParents).toEqual([]);
    }
  });

  it("supprime alloc_staging après la migration", () => {
    for (const { db } of databases) {
      const staging = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'alloc_staging'",
        )
        .all();
      expect(staging).toEqual([]);
    }
  });

  it("fusionne le panier Stripe en un mouvement et trois allocations", () => {
    for (const { db } of databases) {
      const movements = db
        .prepare("SELECT id, amount FROM payments WHERE external_ref = 'cs_test_multi'")
        .all() as Array<{ id: string; amount: number }>;
      expect(movements).toHaveLength(1);
      expect(movements[0].id).toBe("multi-1");
      expect(movements[0].amount).toBeCloseTo(30, 2);

      const allocations = db
        .prepare(`
          SELECT booking_id, amount FROM payment_allocations
          WHERE payment_id = ? ORDER BY booking_id
        `)
        .all(movements[0].id) as Array<{ booking_id: string; amount: number }>;
      expect(allocations).toEqual([
        { booking_id: "b-multi-a", amount: 10 },
        { booking_id: "b-multi-b", amount: 10 },
        { booking_id: "b-multi-c", amount: 10 },
      ]);
      expect(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBeCloseTo(
        movements[0].amount,
        2,
      );
    }
  });

  it("rend external_ref idempotent tout en autorisant plusieurs NULL", () => {
    for (const { db } of databases) {
      db.exec("BEGIN");
      db.prepare(`
        INSERT INTO payments (id, amount, method, status, external_ref)
        VALUES (?, 1, 'cash', 'settled', NULL)
      `).run("null-ref-a");
      db.prepare(`
        INSERT INTO payments (id, amount, method, status, external_ref)
        VALUES (?, 1, 'cash', 'settled', NULL)
      `).run("null-ref-b");
      expect(() =>
        db.prepare(`
          INSERT INTO payments (id, amount, method, status, external_ref)
          VALUES (?, 1, 'card', 'settled', 'cs_test_multi')
        `).run("duplicate-external-ref"),
      ).toThrow();
      db.exec("ROLLBACK");
    }
  });

  it("convertit requires_action en mouvement pending", () => {
    for (const { db } of databases) {
      const refundMovement = db
        .prepare("SELECT amount, status, parent_id FROM payments WHERE external_ref = 'refund-action'")
        .get() as { amount: number; status: string; parent_id: string };
      expect(refundMovement).toMatchObject({
        amount: -5,
        status: "pending",
        parent_id: "p-action",
      });
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM payment_allocations WHERE payment_id = (SELECT id FROM payments WHERE external_ref = 'refund-action')",
          )
          .get(),
      ).toEqual({ count: 1 });
    }
  });

  it("ignore le paiement à zéro euro", () => {
    for (const { db } of databases) {
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM payments WHERE id = 'p-zero'").get(),
      ).toEqual({ count: 0 });
      expect(
        db
          .prepare("SELECT COUNT(*) AS count FROM payment_allocations WHERE booking_id = 'b-zero'")
          .get(),
      ).toEqual({ count: 0 });
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM payments").get(),
      ).toEqual({ count: 13 });
    }
  });

  it("reconstitue le remboursement manuel non tracé", () => {
    for (const { db } of databases) {
      const manualRefund = db
        .prepare("SELECT id, amount, parent_id, reason FROM payments WHERE parent_id = 'p-manual'")
        .get() as { id: string; amount: number; parent_id: string; reason: string };
      expect(manualRefund.amount).toBeCloseTo(-15, 2);
      expect(manualRefund.parent_id).toBe("p-manual");
      expect(manualRefund.reason).toBeTruthy();
      expect(
        db
          .prepare(
            "SELECT amount FROM payment_allocations WHERE payment_id = ? AND booking_id = 'b-manual'",
          )
          .get(manualRefund.id),
      ).toEqual({ amount: -15 });
    }
  });

  it("réussit dans les deux modes d'exécution de migration", () => {
    expect(databases.map(({ mode }) => mode)).toEqual(["statements", "transaction"]);
    for (const { db } of databases) {
      expect(db.prepare("SELECT COUNT(*) AS count FROM payments").get()).toEqual({
        count: 13,
      });
    }
  });
});
