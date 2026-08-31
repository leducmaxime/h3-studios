import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allocateWaterfall,
  getBookingLedger,
  getBookingLedgerBatch,
  recordMovement,
  refundableForAllocation,
  reverseMovement,
  tryInsertManualRefundMovement,
  upsertCheckoutPayment,
} from "@/lib/ledger";
import { recordManualRefund, type RefundDeps } from "@/lib/refunds";
import { recomputeBookingPaymentStatus } from "@/lib/db";

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

type BoundStatement = {
  first<T>(): Promise<T | null | undefined>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  _execute(): unknown;
};

type TestDatabase = { sqlite: DatabaseSync; db: D1Database };

function applyMigrations(sqlite: DatabaseSync) {
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    for (const statement of statements(
      readFileSync(join(migrationsDirectory, file), "utf8"),
    )) {
      try {
        sqlite.exec(statement);
      } catch (error) {
        // 0001 already contains this column although 0010 adds it again.
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

/** D1-shaped adapter backed by real in-memory SQLite. */
function makeDb(): TestDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);

  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args: unknown[]): BoundStatement {
          const execute = () => statement.run(...args as never[]);
          return {
            first: <T>() => Promise.resolve(statement.get(...args as never[]) as T | undefined),
            all: <T>() => Promise.resolve({ results: statement.all(...args as never[]) as T[] }),
            run: () => Promise.resolve({
              success: true,
              meta: { changes: Number(execute().changes) },
            }),
            _execute: execute,
          };
        },
      };
    },
    batch: async (batch: BoundStatement[]) => batch.map((statement) => statement._execute()),
  } as unknown as D1Database;

  return { sqlite, db };
}

let database: TestDatabase;

beforeEach(() => {
  database = makeDb();
  database.sqlite.prepare(
    "INSERT INTO users (id, name, email) VALUES ('u1', 'Client test', 'test@example.test')",
  ).run();
});

async function count(db: D1Database, table: "payments" | "payment_allocations", where = "1 = 1") {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).bind().first<{ count: number }>();
  return Number(row?.count ?? 0);
}

function seedBooking(
  sqlite: DatabaseSync,
  id: string,
  total = 100,
  date = "2026-03-01",
  startTime = "18:00",
) {
  sqlite.prepare(`
    INSERT INTO bookings (
      id, booking_ref, user_id, studio_id, date, start_time, end_time,
      group_type, status, base_price, equipment_price, total_price,
      payment_method, payment_status, promo_discount
    ) VALUES (?, ?, 'u1', 'la-scene', ?, ?, '20:00', 'solo', 'confirmed',
      ?, 0, ?, 'cash', 'pay-on-site', 0)
  `).run(id, `ref-${id}`, date, startTime, total, total);
}

function seedBookings(sqlite: DatabaseSync, ids: string[], total = 100) {
  ids.forEach((id, index) => seedBooking(sqlite, id, total, `2026-03-${String(index + 1).padStart(2, "0")}`));
}

describe("allocateWaterfall", () => {
  it("alloue en waterfall, plus ancienne d'abord, sans dépasser le dû", () => {
    const { allocations, unallocated } = allocateWaterfall([
      { id: "c", booking_ref: "c", date: "2026-03-03", start_time: "18:00", remaining: 80 },
      { id: "a", booking_ref: "a", date: "2026-03-01", start_time: "18:00", remaining: 100 },
      { id: "b", booking_ref: "b", date: "2026-03-02", start_time: "18:00", remaining: 90 },
    ], 250);

    expect(allocations).toEqual([
      { booking_id: "a", amount: 100 },
      { booking_id: "b", amount: 90 },
      { booking_id: "c", amount: 60 },
    ]);
    expect(unallocated).toBe(0);
  });

  it("laisse le surplus non affecté plutôt que de sur-allouer", () => {
    const { allocations, unallocated } = allocateWaterfall(
      [{ id: "a", booking_ref: "a", date: "2026-03-01", start_time: "18:00", remaining: 90 }],
      100,
    );

    expect(allocations).toEqual([{ booking_id: "a", amount: 90 }]);
    expect(unallocated).toBe(10);
  });

  it("départage par booking_ref à date et horaire égaux", () => {
    const { allocations } = allocateWaterfall([
      { id: "z-id", booking_ref: "Z-ref", date: "2026-03-01", start_time: "18:00", remaining: 5 },
      { id: "a-id", booking_ref: "A-ref", date: "2026-03-01", start_time: "18:00", remaining: 5 },
    ], 7);

    expect(allocations).toEqual([
      { booking_id: "a-id", amount: 5 },
      { booking_id: "z-id", amount: 2 },
    ]);
  });

  it("ne crée aucune allocation pour un montant nul", () => {
    expect(allocateWaterfall([
      { id: "a", booking_ref: "a", date: "2026-03-01", start_time: "18:00", remaining: 90 },
    ], 0)).toEqual({ allocations: [], unallocated: 0 });
  });
});

describe("recordMovement et ses allocations", () => {
  it("refuse une sur-affectation avant toute écriture", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);

    await expect(recordMovement(database.db, {
      amount: 100,
      method: "cash",
      allocations: [
        { booking_id: "b1", amount: 60 },
        { booking_id: "b2", amount: 60 },
      ],
    })).rejects.toThrow(/sur-alloué/i);

    expect(await count(database.db, "payments")).toBe(0);
    expect(await count(database.db, "payment_allocations")).toBe(0);
  });

  it("refuse un signe d'allocation opposé au mouvement", async () => {
    seedBooking(database.sqlite, "b1");

    await expect(recordMovement(database.db, {
      amount: 100,
      method: "cash",
      allocations: [{ booking_id: "b1", amount: -10 }],
    })).rejects.toThrow(/signe de l'allocation doit correspondre/i);

    expect(await count(database.db, "payments")).toBe(0);
    expect(await count(database.db, "payment_allocations")).toBe(0);
  });

  it("refuse deux allocations sur la même réservation", async () => {
    seedBooking(database.sqlite, "b1");

    await expect(recordMovement(database.db, {
      amount: 100,
      method: "cash",
      allocations: [
        { booking_id: "b1", amount: 40 },
        { booking_id: "b1", amount: 60 },
      ],
    })).rejects.toThrow(/Une réservation ne peut être allouée qu'une seule fois/i);

    expect(await count(database.db, "payments")).toBe(0);
    expect(await count(database.db, "payment_allocations")).toBe(0);
  });

  it("accepte une allocation partielle : le reste est non affecté", async () => {
    seedBooking(database.sqlite, "b1");

    const result = await recordMovement(database.db, {
      id: "p-partial",
      amount: 100,
      method: "cash",
      allocations: [{ booking_id: "b1", amount: 90 }],
    });

    expect(result).toEqual({ id: "p-partial", inserted: true });
    expect(await count(database.db, "payments")).toBe(1);
    expect(await count(database.db, "payment_allocations")).toBe(1);
    expect(await database.db.prepare(
      "SELECT amount FROM payment_allocations WHERE payment_id = ?",
    ).bind("p-partial").first<{ amount: number }>()).toMatchObject({ amount: 90 });
  });
});

describe("upsertCheckoutPayment", () => {
  it("n'insère qu'un mouvement par session", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);
    const input = {
      sessionId: "cs_x",
      amount: 28,
      paidAt: "2026-03-01 12:00:00",
      allocations: [{ booking_id: "b1", amount: 23 }, { booking_id: "b2", amount: 5 }],
    };

    const first = await upsertCheckoutPayment(database.db, input);
    expect(first.inserted).toBe(true);
    const replay = await upsertCheckoutPayment(database.db, input);
    expect(replay.inserted).toBe(false);
    expect(replay.movementId).toBe(first.movementId);
    expect(await count(database.db, "payments", "external_ref='cs_x'")).toBe(1);
    expect(await count(database.db, "payment_allocations")).toBe(2);
  });

  it("répare une allocation perdue après écriture partielle", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);
    const input = {
      sessionId: "cs_repair",
      amount: 28,
      paidAt: "2026-03-01 12:00:00",
      allocations: [{ booking_id: "b1", amount: 23 }, { booking_id: "b2", amount: 5 }],
    };

    const first = await upsertCheckoutPayment(database.db, input);
    database.sqlite.prepare(
      "DELETE FROM payment_allocations WHERE payment_id = ? AND booking_id = ?",
    ).run(first.movementId, "b2");
    expect(await count(database.db, "payment_allocations")).toBe(1);

    const replay = await upsertCheckoutPayment(database.db, input);
    expect(replay).toEqual({ inserted: false, movementId: first.movementId });
    expect(await count(database.db, "payments", "external_ref='cs_repair'")).toBe(1);
    expect(await count(database.db, "payment_allocations")).toBe(2);
    expect(await database.db.prepare(
      "SELECT amount FROM payment_allocations WHERE payment_id = ? AND booking_id = ?",
    ).bind(first.movementId, "b2").first<{ amount: number }>()).toMatchObject({ amount: 5 });
  });

  it("refuse une allocation incohérente sur une session déjà écrite", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);
    const first = await upsertCheckoutPayment(database.db, {
      sessionId: "cs_conflict",
      amount: 28,
      paidAt: "2026-03-01 12:00:00",
      allocations: [{ booking_id: "b1", amount: 23 }, { booking_id: "b2", amount: 5 }],
    });

    await expect(upsertCheckoutPayment(database.db, {
      sessionId: "cs_conflict",
      amount: 28,
      paidAt: "2026-03-01 12:00:00",
      allocations: [{ booking_id: "b1", amount: 22 }, { booking_id: "b2", amount: 6 }],
    })).rejects.toThrow(/Allocation Checkout incohérente/i);

    expect(await count(database.db, "payments", "external_ref='cs_conflict'")).toBe(1);
    expect(await count(database.db, "payment_allocations")).toBe(2);
    expect(first.movementId).toBeTruthy();
  });
});

describe("reverseMovement", () => {
  it("contre-passe sans muter le mouvement d'origine", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);
    const originalResult = await recordMovement(database.db, {
      id: "p-original",
      amount: 250,
      method: "cash",
      allocations: [{ booking_id: "b1", amount: 100 }, { booking_id: "b2", amount: 150 }],
    });
    const before = await database.db.prepare("SELECT * FROM payments WHERE id = ?")
      .bind(originalResult.id).first<Record<string, unknown>>();

    const { id: reversalId } = await reverseMovement(
      database.db,
      originalResult.id,
      "erreur de saisie",
      "admin-1",
    );
    const after = await database.db.prepare("SELECT * FROM payments WHERE id = ?")
      .bind(originalResult.id).first<Record<string, unknown>>();
    expect(after).toEqual(before);

    expect(await database.db.prepare("SELECT * FROM payments WHERE id = ?")
      .bind(reversalId).first<Record<string, unknown>>()).toMatchObject({
      id: reversalId,
      amount: -250,
      method: "cash",
      status: "settled",
      parent_id: originalResult.id,
      reason: "erreur de saisie",
      performed_by: "admin-1",
    });
    expect(await database.db.prepare(
      "SELECT booking_id, amount FROM payment_allocations WHERE payment_id = ? ORDER BY booking_id",
    ).bind(reversalId).all<{ booking_id: string; amount: number }>()).toEqual({
      results: [
        { booking_id: "b1", amount: -100 },
        { booking_id: "b2", amount: -150 },
      ],
    });
    expect((await getBookingLedger(database.db, "b1")).settled).toBe(0);
  });
});

describe("refundableForAllocation", () => {
  it("ne rend pas remboursable un mouvement pending", async () => {
    seedBooking(database.sqlite, "b1");
    const { id } = await recordMovement(database.db, {
      id: "p-pending",
      amount: 100,
      method: "card",
      status: "pending",
      allocations: [{ booking_id: "b1", amount: 100 }],
    });

    expect(await refundableForAllocation(database.db, id, "b1")).toBe(0);
  });

  it("déduit les mouvements enfants settled et pending du plafond", async () => {
    seedBooking(database.sqlite, "b1");
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-parent",
      amount: 100,
      method: "card",
      allocations: [{ booking_id: "b1", amount: 100 }],
    });
    await recordMovement(database.db, {
      id: "p-pending-refund",
      amount: -30,
      method: "card",
      status: "pending",
      parent_id: parentId,
      allocations: [{ booking_id: "b1", amount: -30 }],
    });
    expect(await refundableForAllocation(database.db, parentId, "b1")).toBe(70);

    await recordMovement(database.db, {
      id: "p-settled-refund",
      amount: -20,
      method: "card",
      status: "settled",
      parent_id: parentId,
      allocations: [{ booking_id: "b1", amount: -20 }],
    });
    expect(await refundableForAllocation(database.db, parentId, "b1")).toBe(50);
  });
});

describe("getBookingLedger", () => {
  it("donne en batch le même résultat qu'un appel unitaire", async () => {
    seedBookings(database.sqlite, ["b1", "b2"]);
    await recordMovement(database.db, {
      id: "p-batch",
      amount: 120,
      method: "cash",
      allocations: [{ booking_id: "b1", amount: 80 }, { booking_id: "b2", amount: 40 }],
    });
    await recordMovement(database.db, {
      id: "p-batch-pending",
      amount: 10,
      method: "card",
      status: "pending",
      allocations: [{ booking_id: "b1", amount: 10 }],
    });

    const batch = await getBookingLedgerBatch(database.db, ["b1", "b2", "b1"]);
    expect(batch.get("b1")).toEqual(await getBookingLedger(database.db, "b1"));
    expect(batch.get("b2")).toEqual(await getBookingLedger(database.db, "b2"));
  });

  it("conserve un solde signé négatif quand une réservation est sur-appliquée", async () => {
    seedBooking(database.sqlite, "b1", 50);
    await recordMovement(database.db, {
      id: "p-overpaid",
      amount: 60,
      method: "cash",
      allocations: [{ booking_id: "b1", amount: 60 }],
    });

    const ledger = await getBookingLedger(database.db, "b1");
    expect(ledger.due).toBe(50);
    expect(ledger.settled).toBe(60);
    expect(ledger.balance).toBe(-10);
  });
});

describe("recordManualRefund (via helper and high-level)", () => {
  function makeRefundDeps(): RefundDeps {
    return {
      db: database.db,
      secretKey: undefined,
      performedBy: "admin-test",
      now: () => "2026-08-31T12:00:00.000Z",
    };
  }

  it("manual refund reduces refundableForAllocation and flips booking payment status correctly", async () => {
    seedBooking(database.sqlite, "b1", 100);
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-card-parent",
      amount: 100,
      method: "card",
      allocations: [{ booking_id: "b1", amount: 100 }],
    });
    // initially paid
    expect((await database.db.prepare("SELECT payment_status FROM bookings WHERE id = ?").bind("b1").first<{ payment_status: string }>())?.payment_status).toBe("paid");

    const reqId = "req-manual-1";
    const outcome = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b1",
      amount: 40,
      channel: "cash",
      requestId: reqId,
      reason: "test manual",
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.refundedAmount).toBe(40);
    expect(await refundableForAllocation(database.db, parentId, "b1")).toBe(60);

    const child = await database.db.prepare("SELECT * FROM payments WHERE id = ?").bind(reqId).first<any>();
    expect(child).toMatchObject({ amount: -40, method: "cash", status: "settled", parent_id: parentId });

    const statusAfter = (await database.db.prepare("SELECT payment_status FROM bookings WHERE id = ?").bind("b1").first<{ payment_status: string }>())?.payment_status;
    expect(statusAfter).toBe("pay-on-site"); // net 60 >0 → pay-on-site (current recompute semantics)
  });

  it("manual refund on a CARD parent stores method = channel (not 'card' when channel='cash')", async () => {
    seedBooking(database.sqlite, "b2");
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-card2",
      amount: 50,
      method: "card",
      allocations: [{ booking_id: "b2", amount: 50 }],
    });
    const reqId = "req-cash-chan";
    await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b2",
      amount: 25,
      channel: "cash",
      requestId: reqId,
    });
    const child = await database.db.prepare("SELECT method FROM payments WHERE id = ?").bind(reqId).first<{ method: string }>();
    expect(child?.method).toBe("cash");
    expect(child?.method).not.toBe("card");
  });

  it("over-cap manual refund is rejected", async () => {
    seedBooking(database.sqlite, "b3");
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-cap",
      amount: 30,
      method: "card",
      allocations: [{ booking_id: "b3", amount: 30 }],
    });
    const outcome = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b3",
      amount: 35,
      channel: "transfer",
      requestId: "req-over",
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("amount_exceeds_refundable");
    expect(await refundableForAllocation(database.db, parentId, "b3")).toBe(30);
    const overCount = await database.db.prepare("SELECT COUNT(*) as c FROM payments WHERE parent_id = ?").bind(parentId).first<{c:number}>();
    expect(overCount?.c ?? 0).toBe(0);
  });

  it("replaying the same requestId does not double-insert", async () => {
    seedBooking(database.sqlite, "b4");
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-replay",
      amount: 80,
      method: "cash",
      allocations: [{ booking_id: "b4", amount: 80 }],
    });
    const reqId = "req-idemp";
    const first = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId, bookingId: "b4", amount: 30, channel: "check", requestId: reqId,
    });
    expect(first.ok).toBe(true);
    const second = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId, bookingId: "b4", amount: 30, channel: "check", requestId: reqId,
    });
    expect(second.ok).toBe(true);
    const countRow = await database.db.prepare("SELECT COUNT(*) as c FROM payments WHERE parent_id=?").bind(parentId).first<{c:number}>();
    const count = countRow?.c ?? 0;
    expect(count).toBe(1);
    expect(await refundableForAllocation(database.db, parentId, "b4")).toBe(50);
  });

  it("the conditional INSERT rejects when the cap is consumed concurrently (simulate by inserting competing child first)", async () => {
    seedBooking(database.sqlite, "b5");
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-concur",
      amount: 100,
      method: "card",
      allocations: [{ booking_id: "b5", amount: 100 }],
    });

    // simulate concurrent: insert a child that consumes 60
    const competingId = "competing-child";
    await recordMovement(database.db, {
      id: competingId,
      amount: -60,
      method: "cash",
      status: "settled",
      parent_id: parentId,
      allocations: [{ booking_id: "b5", amount: -60 }],
    });
    expect(await refundableForAllocation(database.db, parentId, "b5")).toBe(40);

    // now attempt 50 which >40
    const writeRes = await tryInsertManualRefundMovement(database.db, {
      id: "req-concur",
      amount: 50,
      method: "cash",
      parent_id: parentId,
      booking_id: "b5",
      reason: null,
      performed_by: "admin",
    });
    expect(writeRes.capExceeded).toBe(true);
    expect(writeRes.inserted).toBe(false);
    // no new child
    const countAfterRow = await database.db.prepare("SELECT COUNT(*) as c FROM payments WHERE parent_id=?").bind(parentId).first<{c:number}>();
    const countAfter = countAfterRow?.c ?? 0;
    expect(countAfter).toBe(1); // only the competing
  });

  it("accepts full refund at 50.00 when raw cap sum is slightly under due to FP (16.66+16.67+16.67)", async () => {
    seedBooking(database.sqlite, "b-fp", 50);
    const parentId = "p-fp";
    const imprecise = 16.666666666666 * 3; // ~49.999999999997996
    const createdAt = "2026-08-31 12:00:00";
    // Insert parent with exact +50 but alloc using imprecise value so SUM in cap expr is imprecise
    await database.db
      .prepare(
        `INSERT INTO payments (id, amount, method, status, paid_at, external_ref, parent_id, reason, performed_by, created_at)
         VALUES (?, ?, 'cash', 'settled', ?, NULL, NULL, NULL, 'admin', ?)`,
      )
      .bind(parentId, 50, createdAt, createdAt)
      .run();
    await database.db
      .prepare(
        `INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind("a-fp", parentId, "b-fp", imprecise, createdAt)
      .run();

    // refundableForAllocation applies round2 so reports 50, but raw SUM in WHERE is <50
    expect(await refundableForAllocation(database.db, parentId, "b-fp")).toBe(50);

    const reqId = "req-fp-full";
    const outcome = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b-fp",
      amount: 50,
      channel: "cash",
      requestId: reqId,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.refundedAmount).toBe(50);
    expect(await refundableForAllocation(database.db, parentId, "b-fp")).toBe(0);

    const child = await database.db.prepare("SELECT amount FROM payments WHERE id = ?").bind(reqId).first<{ amount: number }>();
    expect(child?.amount).toBe(-50);
  });

  it("replaying same requestId with different amount is idempotency_conflict failure (not treated as success)", async () => {
    seedBooking(database.sqlite, "b-conflict", 100);
    const { id: parentId } = await recordMovement(database.db, {
      id: "p-conflict",
      amount: 100,
      method: "card",
      allocations: [{ booking_id: "b-conflict", amount: 100 }],
    });
    const reqId = "req-conflict";
    const first = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b-conflict",
      amount: 30,
      channel: "transfer",
      requestId: reqId,
    });
    expect(first.ok).toBe(true);
    expect(first.refundedAmount).toBe(30);

    const second = await recordManualRefund(makeRefundDeps(), {
      paymentId: parentId,
      bookingId: "b-conflict",
      amount: 40, // different amount, same requestId
      channel: "transfer",
      requestId: reqId,
    });
    expect(second.ok).toBe(false);
    expect(second.code).toBe("idempotency_conflict");
    expect(second.refundedAmount).toBe(0);

    // only the first succeeded; no second child
    const countRow = await database.db.prepare("SELECT COUNT(*) as c FROM payments WHERE parent_id=?").bind(parentId).first<{c:number}>();
    expect(countRow?.c ?? 0).toBe(1);
    expect(await refundableForAllocation(database.db, parentId, "b-conflict")).toBe(70);
  });
});

describe("void and reverseMovement guards", () => {
  it("voiding a pending movement sets failed and leaves the booking balance untouched", async () => {
    seedBooking(database.sqlite, "b-void", 120);
    const { id: pendId } = await recordMovement(database.db, {
      id: "p-pending-void",
      amount: 120,
      method: "cash",
      status: "pending",
      allocations: [{ booking_id: "b-void", amount: 120 }],
    });
    // before void, status pending so settled=0
    let ledger = await getBookingLedger(database.db, "b-void");
    expect(ledger.settled).toBe(0);
    expect(ledger.balance).toBe(120);

    // simulate the void logic (the UPDATE + recompute)
    const upd = await database.db.prepare(
      "UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'",
    ).bind(pendId).run();
    expect((upd as any).meta?.changes ?? (upd as any).changes).toBe(1);

    const allocs = await database.db.prepare("SELECT booking_id FROM payment_allocations WHERE payment_id=?").bind(pendId).all<{booking_id:string}>();
    for (const a of allocs.results) await recomputeBookingPaymentStatus(database.db, a.booking_id);

    const after = await database.db.prepare("SELECT status FROM payments WHERE id=?").bind(pendId).first<{status:string}>();
    expect(after?.status).toBe("failed");

    ledger = await getBookingLedger(database.db, "b-void");
    expect(ledger.settled).toBe(0);
    expect(ledger.balance).toBe(120); // untouched
    expect(ledger.movements.find(m => m.id === pendId)?.status).toBe("failed");
  });

  it("reverseMovement now throws on a pending movement", async () => {
    seedBooking(database.sqlite, "b-rev");
    const { id: pendId } = await recordMovement(database.db, {
      id: "p-pending-rev",
      amount: 50,
      method: "cash",
      status: "pending",
      allocations: [{ booking_id: "b-rev", amount: 50 }],
    });
    await expect(
      reverseMovement(database.db, pendId, "test", "admin"),
    ).rejects.toThrow("Seul un mouvement encaissé peut être contre-passé");
  });
});
