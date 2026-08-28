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
  upsertCheckoutPayment,
} from "@/lib/ledger";

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
