import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  getRefundableCardTotal,
  refundAllocation,
  refundPayments,
  type RefundDeps,
} from "@/lib/refunds";
import { getPaymentById } from "@/lib/db";
import type { StripeRefund, StripeResult } from "@/lib/stripe";

type Row = Record<string, unknown>;

/** D1-shaped adapter backed by real in-memory SQLite. */
function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY, booking_ref TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL,
      studio_id TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL,
      end_time TEXT NOT NULL, group_type TEXT NOT NULL,
      status TEXT NOT NULL, base_price REAL NOT NULL, equipment_price REAL DEFAULT 0,
      total_price REAL NOT NULL, equipment TEXT, payment_method TEXT,
      payment_status TEXT, promo_discount REAL DEFAULT 0, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, band_name TEXT);
    CREATE TABLE payments (
      id TEXT PRIMARY KEY, amount REAL NOT NULL CHECK(amount <> 0), method TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','settled','failed')), paid_at TEXT,
      external_ref TEXT, parent_id TEXT, reason TEXT, performed_by TEXT, created_at TEXT
    );
    CREATE TABLE payment_allocations (
      id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, booking_id TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount <> 0), created_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, changes TEXT, performed_by TEXT NOT NULL, created_at TEXT
    );
  `);
  sqlite.prepare("INSERT INTO users (id, name, band_name) VALUES ('u1', 'Ada', NULL)").run();
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args: unknown[]) {
          const execute = () => statement.run(...args as never[]);
          return {
            first: <T>() => Promise.resolve(statement.get(...args as never[]) as T | undefined),
            all: <T>() => Promise.resolve({ results: statement.all(...args as never[]) as T[] }),
            run: () => Promise.resolve({ success: true, meta: { changes: Number(execute().changes) } }),
            _execute: execute,
          };
        },
      };
    },
    batch: async (statements: Array<{ _execute?: () => unknown }>) => statements.map((statement) => statement._execute?.()),
  } as unknown as D1Database;
  return { sqlite, db };
}

const accepted = (id: string, amount: number, status: StripeRefund["status"] = "succeeded"): StripeRefund => ({ id, amount, status });
const result = <T>(data: T): StripeResult<T> => ({ ok: true, data });
const error = (message: string, code?: string, httpStatus?: number): StripeResult<never> => ({ ok: false, error: { message, code, httpStatus } });

function seedBooking(sqlite: DatabaseSync, id = "b1", status = "confirmed", total = 30) {
  sqlite.prepare(`INSERT INTO bookings
    (id, booking_ref, user_id, studio_id, date, start_time, end_time, group_type, status,
     base_price, equipment_price, total_price, payment_method, payment_status, promo_discount,
     created_at, updated_at) VALUES (?, ?, 'u1', 'la-scene', '2026-08-13', '18:00', '20:00',
     'group', ?, ?, 0, ?, 'card', 'paid', 0, '2026-01-01', '2026-01-01')`)
    .run(id, `ref-${id}`, status, total, total);
}

function seedPayment(sqlite: DatabaseSync, id = "p1", bookingId = "b1", amount = 30, method = "card", externalRef: string | null = "cs_test", status = "settled") {
  sqlite.prepare(`INSERT INTO payments
    (id, amount, method, status, paid_at, external_ref, created_at)
    VALUES (?, ?, ?, ?, '2026-01-01', ?, '2026-01-01')`)
    .run(id, amount, method, status, externalRef);
  sqlite.prepare(`INSERT INTO payment_allocations
    (id, payment_id, booking_id, amount, created_at) VALUES (?, ?, ?, ?, '2026-01-01')`)
    .run(`a-${id}-${bookingId}`, id, bookingId, amount);
}

function seedRefund(sqlite: DatabaseSync, id: string, parentId: string, bookingId: string, amount: number, status: string, externalRef: string | null = null) {
  sqlite.prepare(`INSERT INTO payments
    (id, amount, method, status, paid_at, external_ref, parent_id, created_at)
    VALUES (?, ?, 'card', ?, NULL, ?, ?, '2026-01-02')`).run(id, -amount, status, externalRef, parentId);
  sqlite.prepare(`INSERT INTO payment_allocations
    (id, payment_id, booking_id, amount, created_at) VALUES (?, ?, ?, ?, '2026-01-02')`)
    .run(`a-${id}`, id, bookingId, -amount);
}

function makeDeps(db: D1Database, script: {
  retrieve?: StripeResult<string | null> | (() => Promise<StripeResult<string | null>>);
  list?: StripeResult<StripeRefund[]> | (() => Promise<StripeResult<StripeRefund[]>>);
  create?: StripeResult<StripeRefund> | (() => Promise<StripeResult<StripeRefund>>);
} = {}) {
  const calls: { retrieve: string[]; list: string[]; create: Array<{ paymentIntentId: string; amountCents: number; idempotencyKey: string }> } = { retrieve: [], list: [], create: [] };
  const fake = {
    retrievePaymentIntentIdForSession: async (_key: string, session: string) => { calls.retrieve.push(session); return typeof script.retrieve === "function" ? script.retrieve() : script.retrieve ?? result("pi_test"); },
    listRefundsForPaymentIntent: async (_key: string, pi: string) => { calls.list.push(pi); return typeof script.list === "function" ? script.list() : script.list ?? result([]); },
    createRefund: async (_key: string, params: { paymentIntentId: string; amountCents: number; idempotencyKey: string }) => { calls.create.push(params); return typeof script.create === "function" ? script.create() : script.create ?? result(accepted("re_test", params.amountCents)); },
  };
  return { deps: { db, secretKey: "sk_test", performedBy: "admin-1", sendPush: async () => {}, now: () => "2026-08-13T12:00:00.000Z", stripe: fake } as RefundDeps, calls };
}

async function paymentRow(db: D1Database, id = "p1") { return getPaymentById(db, id); }
async function refundRows(db: D1Database, parentId = "p1") {
  return (await db.prepare("SELECT p.*, a.booking_id, a.amount AS allocated FROM payments p JOIN payment_allocations a ON a.payment_id = p.id WHERE p.parent_id = ? ORDER BY p.created_at, p.id").bind(parentId).all<Row>()).results;
}

describe("Stripe refunds — signed ledger invariant", () => {
  it("does nothing for an empty refund batch", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { calls } = makeDeps(db);
    const outcome = await refundPayments(makeDeps(db).deps, []);
    expect(outcome).toMatchObject({ refunded: 0, outcomes: [], errors: [] });
    expect(calls.create).toHaveLength(0);
    expect((await paymentRow(db))?.status).toBe("settled");
  });

  it("records a successful refund as one settled negative movement and allocation", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const outcome = await refundAllocation(makeDeps(db).deps, { paymentId: "p1", bookingId: "b1", amount: 30, reason: "client request" });
    expect(outcome.ok).toBe(true);
    expect((await paymentRow(db))?.amount).toBe(30);
    expect((await paymentRow(db))?.status).toBe("settled");
    expect(await refundRows(db)).toEqual([expect.objectContaining({ amount: -30, allocated: -30, status: "settled", parent_id: "p1" })]);
    expect((await db.prepare("SELECT payment_status FROM bookings WHERE id='b1'").bind().first<Row>())?.payment_status).toBe("pay-on-site");
  });

  it("resolves the client name for a refund push", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const pushes: Array<{ body: string }> = [];
    const { deps } = makeDeps(db);
    deps.sendPush = async (notification) => { pushes.push(notification); };
    await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toContain("Ada");
    expect(pushes[0].body).not.toContain("— —");
  });

  it.each([["HTTP 400", error("already", "already", 400), "failed"], ["network result", error("timeout", "network_error"), "pending"]] as const)("marks a failed Stripe request without settled refund", async (_name, createResult, expectedStatus) => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const outcome = await refundAllocation(makeDeps(db, { create: createResult }).deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.code).toBe("stripe_error");
    expect(await refundRows(db)).toEqual([expect.objectContaining({ amount: -10, allocated: -10, status: expectedStatus })]);
    expect((await refundRows(db)).every((row) => row.status !== "settled")).toBe(true);
  });

  it("reports a thrown Stripe error and keeps the reservation retryable", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const outcome = await refundAllocation(makeDeps(db, { create: async () => { throw new Error("timeout"); } }).deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome).toMatchObject({ ok: false, code: "stripe_error", message: "timeout" });
    expect(await refundRows(db)).toEqual([expect.objectContaining({ status: "pending", allocated: -10 })]);
  });

  it("reuses the pending movement idempotency key across an indeterminate retry", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    let attempts = 0;
    const { deps, calls } = makeDeps(db, { create: async () => ++attempts === 1 ? error("timeout", "network_error") : result(accepted("re_retry", 1000)) });
    const first = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    const second = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(first.ok).toBe(false); expect(second.ok).toBe(true);
    expect(calls.create).toHaveLength(2);
    expect(calls.create[0].idempotencyKey).toMatch(/^refund:/);
    expect(calls.create[0].idempotencyKey).toBe(calls.create[1].idempotencyKey);
    expect(await refundRows(db)).toHaveLength(1);
  });

  it("never sends a second Stripe refund when the first refund is replayed", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps, calls } = makeDeps(db, { create: result(accepted("re_same", 1000)), list: result([]) });
    expect((await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 })).ok).toBe(true);
    const replayDeps = makeDeps(db, { create: result(accepted("re_should_not_be_called", 1000)), list: result([accepted("re_same", 1000)]) });
    const second = await refundAllocation(replayDeps.deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(second.code).toBe("already_applied");
    expect(replayDeps.calls.create).toHaveLength(0);
    expect(calls.create).toHaveLength(1);
  });

  it("refunds cancelled bookings and only the selected allocation", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite, "b1", "cancelled", 30); seedBooking(sqlite, "b2", "confirmed", 20);
    seedPayment(sqlite, "p1", "b1", 30); seedPayment(sqlite, "p2", "b2", 20);
    const outcome = await refundAllocation(makeDeps(db).deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.ok).toBe(true);
    expect((await refundRows(db, "p1"))[0]).toMatchObject({ booking_id: "b1", allocated: -10 });
    expect(await refundRows(db, "p2")).toHaveLength(0);
  });

  it("supports cent-exact repeated refunds and non-integer totals", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite, "b1", "confirmed", 30.5); seedPayment(sqlite, "p1", "b1", 30.5);
    let n = 0;
    const deps = makeDeps(db, { create: async () => result(accepted(`re_round_${++n}`, [1010, 1010, 980][n - 1])) }).deps;
    for (const amount of [10.10, 10.10, 9.80]) expect((await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount })).ok).toBe(true);
    expect((await refundRows(db)).reduce((sum, row) => sum + Number(row.allocated), 0)).toBeCloseTo(-30, 2);
    expect((await refundAllocation(makeDeps(db, { create: result(accepted("re_3050", 3050)) }).deps, { paymentId: "p1", bookingId: "b1", amount: 0.5 })).ok).toBe(true);
  });

  it("maps Stripe pending to settled and requires_action to pending", async () => {
    const first = makeDb(); seedBooking(first.sqlite); seedPayment(first.sqlite);
    const pending = await refundAllocation(makeDeps(first.db, { create: result(accepted("re_pending", 1000, "pending")) }).deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(pending.ok).toBe(true); expect((await refundRows(first.db))[0]).toMatchObject({ status: "settled", amount: -10 });

    const second = makeDb(); seedBooking(second.sqlite); seedPayment(second.sqlite);
    const action = await refundAllocation(makeDeps(second.db, { create: result(accepted("re_action", 3000, "requires_action")) }).deps, { paymentId: "p1", bookingId: "b1", amount: 30 });
    expect(action.code).toBe("stripe_unconfirmed");
    expect((await refundRows(second.db))[0]).toMatchObject({ status: "pending", amount: -30, allocated: -30 });
    expect((await refundAllocation(makeDeps(second.db).deps, { paymentId: "p1", bookingId: "b1", amount: 1 })).code).toBe("amount_exceeds_refundable");
  });

  it.each([undefined, ""])("keeps a missing Stripe id unconfirmed (%s)", async (id) => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const refund = { amount: 1000, status: "requires_action" as const, ...(id === undefined ? {} : { id }) } as StripeRefund;
    const outcome = await refundAllocation(makeDeps(db, { create: result(refund) }).deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    // A missing `id` cannot be persisted as external_ref by the D1 adapter;
    // it is therefore reported as a local ledger failure. An empty id remains
    // an unconfirmed pending reservation and is still never accepted.
    expect(outcome.code).toBe(id === undefined ? "ledger_write_failed" : "stripe_unconfirmed");
    expect(await refundRows(db)).toHaveLength(1);
    expect((await refundRows(db))[0]).toMatchObject({ status: "pending", external_ref: id ?? null });
  });

  it("fails closed when reconciliation listing fails, without POST", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps, calls } = makeDeps(db, { list: error("list unavailable") });
    const outcome = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.code).toBe("stripe_error");
    expect(calls.create).toHaveLength(0);
    // Assertion d'origine, à ne pas assouplir : l'état Stripe étant inconnu, on
    // n'écrit RIEN. Un mouvement pending fantôme amputerait le plafond
    // remboursable et verrouillerait la réservation après une panne réseau.
    expect(await refundRows(db)).toHaveLength(0);
  });

  it("does not attribute unrelated dashboard refunds to the local ledger", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps, calls } = makeDeps(db, { list: result([accepted("re_other", 1000), accepted("re_dash", 500)]) });
    const outcome = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.ok).toBe(true); expect(calls.create).toHaveLength(1);
    expect(outcome.unattributedAmount).toBe(15);
    expect((await refundRows(db)).some((row) => row.external_ref === "re_other" || row.external_ref === "re_dash")).toBe(false);
  });

  it("signale les remboursements Dashboard non attribués sans les intégrer", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps } = makeDeps(db, { list: result([accepted("re_dash", 500)]) });
    const outcome = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.unattributedAmount).toBe(5);
    expect((await refundRows(db)).some((row) => row.external_ref === "re_dash")).toBe(false);
  });

  it("heals an owned pending refund reported failed and does not count it", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); seedRefund(sqlite, "r-old", "p1", "b1", 10, "pending", "re_old");
    const { deps, calls } = makeDeps(db, { list: result([accepted("re_old", 1000, "failed")]), create: error("stop") });
    const outcome = await refundAllocation(deps, { paymentId: "p1", bookingId: "b1", amount: 10 });
    expect(outcome.code).toBe("stripe_error"); expect(calls.create).toHaveLength(0);
    expect((await refundRows(db))[0]).toMatchObject({ external_ref: "re_old", status: "failed" });
    const audits = (await db.prepare("SELECT action, entity_id FROM audit_logs").bind().all<Row>()).results;
    expect(audits.some((audit) => audit.action === "refund-reconciled")).toBe(true);
  });

  it("refuse de rembourser un encaissement non acquis", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite);
    seedPayment(sqlite, "p_pending", "b1", 30, "card", "cs_p", "pending");
    const outcome = await refundAllocation(makeDeps(db).deps, { paymentId: "p_pending", bookingId: "b1", amount: 10 });
    expect(outcome.code).toBe("not_collected");
    expect(await refundRows(db, "p_pending")).toHaveLength(0);
    expect(await getRefundableCardTotal(db, "b1")).toBe(0);
  });

  it("computes refundable card total from positive and negative allocations", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite, "p_cash", "b1", 30, "cash", "cs_cash");
    seedPayment(sqlite, "p_card", "b1", 30, "card", "cs_card"); seedRefund(sqlite, "r-card", "p_card", "b1", 10, "settled", "re_card");
    expect(await getRefundableCardTotal(db, "b1")).toBe(20);
  });

  it("rejects non-card refunds without changing the cash movement", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite, "p1", "b1", 30, "cash", null);
    const outcome = await refundAllocation(makeDeps(db).deps, { paymentId: "p1", bookingId: "b1", amount: 30 });
    expect(outcome.code).toBe("not_card"); expect(await refundRows(db)).toHaveLength(0);
  });

  it("continues a batch after one allocation fails and preserves order", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedBooking(sqlite, "b2", "confirmed", 20);
    seedPayment(sqlite, "p1", "b1", 30, "cash", null); seedPayment(sqlite, "p2", "b2", 20);
    const outcome = await refundPayments(makeDeps(db).deps, [
      { paymentId: "p1", bookingId: "b1", amount: 10 },
      { paymentId: "p2", bookingId: "b2", amount: 10 },
    ]);
    expect(outcome.outcomes).toHaveLength(2); expect(outcome.outcomes[0].code).toBe("not_card");
    expect(outcome.outcomes[1].ok).toBe(true); expect(outcome.errors).toHaveLength(1); expect(outcome.refunded).toBe(10);
  });

  it("sends one push for a batch, with the aggregate amount", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite, "b1", "confirmed", 30);
    seedBooking(sqlite, "b2", "confirmed", 20);
    seedBooking(sqlite, "b3", "confirmed", 60);
    seedPayment(sqlite, "p1", "b1", 30, "cash", null);
    seedPayment(sqlite, "p2", "b2", 20, "cash", null);
    seedPayment(sqlite, "p3", "b3", 60, "cash", null);
    const pushes: Array<{ body: string }> = [];
    const { deps } = makeDeps(db);
    deps.sendPush = async (notification) => { pushes.push(notification); };

    const outcome = await refundPayments(deps, [
      { paymentId: "p1", bookingId: "b1", amount: 10, channel: "cash", requestId: "refund-1" },
      { paymentId: "p2", bookingId: "b2", amount: 20, channel: "cash", requestId: "refund-2" },
      { paymentId: "p3", bookingId: "b3", amount: 30, channel: "cash", requestId: "refund-3" },
    ]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(outcome.refunded).toBe(60);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toContain("60,00");
    expect(pushes[0].body).toContain("3 remboursements");
  });

  it("maps an idempotency conflict to the in-progress message", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const outcome = await refundAllocation(makeDeps(db, { create: error("busy", "idempotency_key_in_use", 409) }).deps, { paymentId: "p1", bookingId: "b1", amount: 1 });
    expect(outcome.message).toContain("opération");
  });
});
