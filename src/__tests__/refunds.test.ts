import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  getRefundableCardTotal,
  refundCardPayment,
  refundPayments,
  type RefundDeps,
} from "@/lib/refunds";
import { refundPayment, getPaymentById } from "@/lib/db";
import type { StripeRefund, StripeResult } from "@/lib/stripe";

type Row = Record<string, unknown>;

/** A deliberately small D1 adapter: the SQL is still executed by real SQLite. */
function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY, booking_ref TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL,
      studio_id TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT NOT NULL,
      end_time TEXT NOT NULL, group_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','completed','no-show')),
      base_price INTEGER NOT NULL, equipment_price INTEGER DEFAULT 0, total_price INTEGER NOT NULL,
      equipment TEXT, payment_method TEXT CHECK(payment_method IN ('card','cash')),
      payment_status TEXT CHECK(payment_status IN ('pending','paid','pay-on-site')),
      notes TEXT, round_mode TEXT, promo_code TEXT, promo_discount INTEGER DEFAULT 0,
      promo_type TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      cancelled_at TEXT, cancel_reason TEXT, band_name TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, amount INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('card','cash','transfer','check','cheque')),
      status TEXT NOT NULL CHECK(status IN ('pending','paid','refunded','partial-refund')),
      refunded_amount INTEGER DEFAULT 0, paid_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      stripe_event_id TEXT
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, changes TEXT, performed_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE payment_refunds (
      stripe_refund_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, booking_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT, performed_by TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_payment_refunds_payment_id ON payment_refunds(payment_id);
    CREATE INDEX idx_payment_refunds_booking_id ON payment_refunds(booking_id);
  `);
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            first: <T>() => Promise.resolve(statement.get(...args as never[]) as T | undefined),
            all: <T>() => Promise.resolve({ results: statement.all(...args as never[]) as T[] }),
            run: () => Promise.resolve({ success: true, meta: { changes: Number(statement.run(...args as never[]).changes) } }),
          };
        },
      };
    },
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

function seedPayment(sqlite: DatabaseSync, id = "p1", bookingId = "b1", amount = 30, method = "card", stripe = "cs_test") {
  sqlite.prepare(`INSERT INTO payments (id, booking_id, amount, method, status, refunded_amount, paid_at, stripe_event_id)
    VALUES (?, ?, ?, ?, 'paid', 0, '2026-01-01', ?)`)
    .run(id, bookingId, amount, method, stripe);
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
  return { deps: { db, secretKey: "sk_test", performedBy: "admin-1", now: () => "2026-08-13T12:00:00.000Z", stripe: fake } as RefundDeps, calls };
}

async function paymentRow(db: D1Database, id = "p1") { return getPaymentById(db, id); }
async function refundRows(db: D1Database, id = "p1") { return (await db.prepare("SELECT * FROM payment_refunds WHERE payment_id = ?").bind(id).all<Row>()).results; }

describe("Stripe refunds — ledger invariant", () => {
  it("cancel without refund emits no Stripe request and leaves the payment untouched", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    const { calls } = makeDeps(db);
    const outcome = await refundPayments(makeDeps(db).deps, []);

    expect(outcome.outcomes).toHaveLength(0);
    expect(outcome.errors).toHaveLength(0);
    expect(outcome.refunded).toBe(0);
    expect(calls.create).toHaveLength(0);
    expect((await paymentRow(db))?.status).toBe("paid");
  });

  it("successful refund writes the ledger and recomputes the booking payment status", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps } = makeDeps(db);
    const outcome = await refundCardPayment(deps, "p1", 30);
    expect(outcome.ok).toBe(true);
    expect((await paymentRow(db))?.refunded_amount).toBe(30);
    expect((await paymentRow(db))?.status).toBe("refunded");
    expect(await refundRows(db)).toHaveLength(1);
    expect((await db.prepare("SELECT payment_status FROM bookings WHERE id='b1'").bind().first<Row>())?.payment_status).toBe("pay-on-site");
  });

  it.each([
    ["HTTP 400", error("charge_already_refunded", "charge_already_refunded", 400)],
    ["network result", error("network timeout", "network_error")],
  ])("%s leaves zero refunded trace", async (_name, createResult) => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps } = makeDeps(db, { create: createResult });
    const outcome = await refundCardPayment(deps, "p1", 10);
    expect(outcome.code).toBe("stripe_error");
    expect((await paymentRow(db))?.refunded_amount).toBe(0); expect((await paymentRow(db))?.status).toBe("paid"); expect(await refundRows(db)).toHaveLength(0);
  });

  it("a thrown Stripe error is reported without changing the ledger", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite);
    const { deps } = makeDeps(db, { create: async () => { throw new Error("timeout"); } });

    // Un port qui lève doit être traité exactement comme une réponse en erreur :
    // jamais d'exception qui remonterait en 500 et masquerait l'erreur Stripe.
    const outcome = await refundCardPayment(deps, "p1", 10);

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("stripe_error");
    expect(outcome.message).toBe("timeout");
    expect((await paymentRow(db))?.refunded_amount).toBe(0);
    expect((await paymentRow(db))?.status).toBe("paid");
    expect(await refundRows(db)).toHaveLength(0);
  });

  // A retry before Stripe is confirmed must reuse its key; after success, refundedBefore changes.
  // Therefore an intentional later refund gets a different key, while a Stripe replay is deduped by id.
  // This branch assumes Stripe genuinely never received the first request; the sibling MF-1 test covers a lost response.
  it("reuses the idempotency key across an indeterminate retry", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    let attempts = 0;
    const { deps, calls } = makeDeps(db, {
      create: async () => ++attempts === 1 ? error("timeout", "network_error") : result(accepted("re_retry", 1000)),
    });

    const first = await refundCardPayment(deps, "p1", 10);
    const second = await refundCardPayment(deps, "p1", 10);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(calls.create[0].idempotencyKey).toBe(calls.create[1].idempotencyKey);
    expect(await refundRows(db)).toHaveLength(1);
  });

  it("dedupes a refund id already present in the ledger", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    const { deps } = makeDeps(db, { create: result(accepted("re_same", 1000)) });

    const first = await refundCardPayment(deps, "p1", 10);
    const second = await refundCardPayment(deps, "p1", 10);

    expect(first.ok).toBe(true);
    expect(second.code).toBe("already_applied");
    expect((await paymentRow(db))?.refunded_amount).toBe(10);
    expect(await refundRows(db)).toHaveLength(1);
  });

  it("refunds a payment even when its booking is already cancelled", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite, "b1", "cancelled"); seedPayment(sqlite);
    expect((await refundCardPayment(makeDeps(db).deps, "p1", 10)).ok).toBe(true);
  });

  it("refunds only the selected row in a shared cart session", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedBooking(sqlite, "b2", "confirmed", 20);
    seedPayment(sqlite, "p1", "b1", 30);
    seedPayment(sqlite, "p2", "b2", 20);
    const outcome = await refundCardPayment(makeDeps(db).deps, "p1", 10);
    expect(outcome.ok).toBe(true);
    expect((await paymentRow(db, "p1"))?.refunded_amount).toBe(10);
    expect((await paymentRow(db, "p2"))?.refunded_amount).toBe(0);
  });

  it("uses cent rounding for 10.10 + 10.10 + 9.80", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite, "b1", "confirmed", 30);
    seedPayment(sqlite, "p1", "b1", 30);
    let n = 0;
    const deps = makeDeps(db, { create: async () => result(accepted(`re_round_${++n}`, [1010, 1010, 980][n - 1])) }).deps;
    for (const amount of [10.10, 10.10, 9.80]) {
      expect((await refundCardPayment(deps, "p1", amount)).ok).toBe(true);
    }
    expect((await paymentRow(db))?.status).toBe("refunded");
  });

  it("fully refunds a non-integer payment amount in cents", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite, "b1", "confirmed", 30.5);
    seedPayment(sqlite, "p1", "b1", 30.5);
    const deps = makeDeps(db, { create: result(accepted("re_3050", 3050)) }).deps;

    const outcome = await refundCardPayment(deps, "p1", 30.5);

    expect(outcome.ok).toBe(true);
    expect((await paymentRow(db))?.refunded_amount).toBe(30.5);
    expect((await paymentRow(db))?.status).toBe("refunded");
  });

  it("accepts pending Stripe refunds in the ledger", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const outcome = await refundCardPayment(makeDeps(db, { create: result(accepted("re_pending", 1000, "pending")) }).deps, "p1", 10);
    expect(outcome.ok).toBe(true); expect(await refundRows(db)).toHaveLength(1);
  });

  it("does not ledger requires_action, but reserves its amount", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const outcome = await refundCardPayment(makeDeps(db, { create: result(accepted("re_action", 3000, "requires_action")) }).deps, "p1", 30);
    expect(outcome.code).toBe("stripe_unconfirmed"); expect(await refundRows(db)).toHaveLength(1); expect((await refundCardPayment(makeDeps(db).deps, "p1", 1)).code).toBe("amount_exceeds_refundable");
  });

  it.each([undefined, ""])("does not ledger requires_action with %s refund id", async (id) => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    const data = { amount: 1000, status: "requires_action" as const, ...(id === undefined ? {} : { id }) } as StripeRefund;
    const outcome = await refundCardPayment(makeDeps(db, { create: result(data) }).deps, "p1", 10);

    expect(outcome.code).toBe("stripe_unconfirmed");
    expect(await refundRows(db)).toHaveLength(0);
    expect((await paymentRow(db))?.refunded_amount).toBe(0);
  });

  it.each([undefined, ""])("rejects a 2xx refund with missing %s without writing", async (id) => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const data = { amount: 1000, status: "succeeded" as const, ...(id === undefined ? {} : { id }) } as StripeRefund;
    const outcome = await refundCardPayment(makeDeps(db, { create: result(data) }).deps, "p1", 10); expect(outcome.code).toBe("stripe_unconfirmed"); expect(await refundRows(db)).toHaveLength(0); expect((await paymentRow(db))?.refunded_amount).toBe(0);
  });

  it("fails closed when reconciliation listing fails, without POST", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const { deps, calls } = makeDeps(db, { list: error("list unavailable") }); const outcome = await refundCardPayment(deps, "p1", 10);
    expect(outcome.code).toBe("stripe_error"); expect(calls.create).toHaveLength(0); expect(await refundRows(db)).toHaveLength(0);
  });

  it("heals an owned unknown refund and blocks the original amount", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    const listed = { ...accepted("re_unknown", 1000), metadata: { payment_id: "p1" } };
    const { deps, calls } = makeDeps(db, { list: result([listed]) });
    const outcome = await refundCardPayment(deps, "p1", 10);

    expect(outcome.code).toBe("reconciled");
    expect(outcome.reconciledAmount).toBe(10);
    expect(calls.create).toHaveLength(0);
    expect((await paymentRow(db))?.refunded_amount).toBe(10);
    const audits = (await db.prepare("SELECT action FROM audit_logs WHERE entity_id = ?").bind("p1").all<{ action: string }>()).results;
    expect(audits.some((audit) => audit.action === "refund-reconciled")).toBe(true);
  });

  it("records a newly discovered failed refund but does not abort the new refund", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    const failed = { ...accepted("re_failed_new", 1000, "failed"), metadata: { payment_id: "p1" } };
    const { deps, calls } = makeDeps(db, {
      list: result([failed]),
      create: result(accepted("re_new", 1000)),
    });

    const outcome = await refundCardPayment(deps, "p1", 10);

    expect(outcome.ok).toBe(true);
    expect(calls.create).toHaveLength(1);
    expect((await refundRows(db)).find((row) => row.stripe_refund_id === "re_failed_new")?.status).toBe("failed");
    expect((await paymentRow(db))?.refunded_amount).toBe(10);
  });

  it("keeps reconciledAmount non-negative when failed refunds are inserted and healed", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    sqlite.prepare("INSERT INTO payment_refunds VALUES ('re_pending_old','p1','b1',1000,'pending',NULL,'admin','x','x')").run();
    sqlite.prepare("UPDATE payments SET refunded_amount = 10, status = 'partial-refund' WHERE id = 'p1'").run();
    const failedNew = { ...accepted("re_failed_new", 1000, "failed"), metadata: { payment_id: "p1" } };
    const failedOld = { ...accepted("re_pending_old", 1000, "failed"), metadata: { payment_id: "p1" } };
    const { deps } = makeDeps(db, {
      list: result([failedNew, failedOld]),
      create: error("stop after reconciliation"),
    });

    const outcome = await refundCardPayment(deps, "p1", 1);

    expect(outcome.reconciledAmount ?? 0).toBeGreaterThanOrEqual(0);
    expect((await paymentRow(db))?.refunded_amount).toBe(0);
    expect((await paymentRow(db))?.status).toBe("paid");
    expect((await refundRows(db)).filter((row) => row.status === "succeeded" || row.status === "pending")).toHaveLength(0);
  });

  it("does not double-refund when a timed-out Stripe request is found on retry", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    let retry = false;
    const listed = { ...accepted("re_lost", 1000), metadata: { payment_id: "p1" } };
    const { deps, calls } = makeDeps(db, {
      create: async () => {
        retry = true;
        return error("timeout", "network_error");
      },
      list: async () => retry ? result([listed]) : result([]),
    });

    const first = await refundCardPayment(deps, "p1", 10);
    const second = await refundCardPayment(deps, "p1", 10);

    expect(first.code).toBe("stripe_error");
    expect(second.code).toBe("reconciled");
    expect(calls.create).toHaveLength(1);
    expect(await refundRows(db)).toHaveLength(1);
    expect((await paymentRow(db))?.refunded_amount).toBe(10);
  });

  it("heals a pending refund that Stripe now reports failed", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite);
    // État cohérent avant guérison : le grand livre porte bien la trace « remboursé »
    // issue d'un refund que Stripe avait accepté en 'pending'.
    sqlite.prepare("INSERT INTO payment_refunds VALUES ('re_old','p1','b1',1000,'pending',NULL,'admin','x','x')").run();
    sqlite.prepare("UPDATE payments SET refunded_amount = 10, status = 'partial-refund' WHERE id = 'p1'").run();
    const { deps } = makeDeps(db, {
      list: result([{ ...accepted("re_old", 1000, "failed"), metadata: { payment_id: "p1" } }]),
      create: error("stop after reconciliation"),
    });

    await refundCardPayment(deps, "p1", 1);

    expect((await refundRows(db))[0].status).toBe("failed");
    expect((await paymentRow(db))?.refunded_amount).toBe(0);
    expect((await paymentRow(db))?.status).toBe("paid");
    expect((await refundRows(db)).filter((row) => row.status === "succeeded" || row.status === "pending")).toHaveLength(0);
    const audits = (await db.prepare("SELECT action FROM audit_logs WHERE entity_id = ?").bind("p1").all<{ action: string }>()).results;
    expect(audits.some((audit) => audit.action === "refund-reconciled")).toBe(true);
  });

  it("ignores another row's metadata and reports dashboard refunds as unattributed", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const other = { ...accepted("re_other", 1000), metadata: { payment_id: "p2" } }; const dashboard = accepted("re_dash", 500); const outcome = await refundCardPayment(makeDeps(db, { list: result([other, dashboard]) }).deps, "p1", 1);
    expect(outcome.unattributedAmount).toBe(5); expect((await refundRows(db)).some((row) => row.stripe_refund_id === "re_other" || row.stripe_refund_id === "re_dash")).toBe(false);
  });

  it("computes refundable_amount from manual and Stripe reservations", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedPayment(sqlite, "p_cash", "b1", 30, "cash", "cs_cash");
    seedPayment(sqlite, "p_pending", "b1", 30, "cash", "cs_pending");
    seedPayment(sqlite, "p_card", "b1", 30, "card", "cs_card");
    sqlite.prepare("UPDATE payments SET refunded_amount = 10 WHERE id = 'p_cash'").run();
    sqlite.prepare("UPDATE payments SET status = 'pending' WHERE id = 'p_pending'").run();
    sqlite.prepare("INSERT INTO payment_refunds VALUES ('re_action_amount','p_card','b1',1000,'requires_action',NULL,'admin','x','x')").run();

    const rows = (await db.prepare(`SELECT p.id,
      CASE WHEN p.status IN ('paid', 'refunded', 'partial-refund') THEN
        MAX(0, ROUND(p.amount * 100) - MAX(
          COALESCE((SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status IN ('succeeded', 'pending', 'requires_action')), 0),
          ROUND(p.refunded_amount * 100)
        )) / 100.0 ELSE 0 END AS refundable_amount
      FROM payments p ORDER BY p.id`).bind().all<{ id: string; refundable_amount: number }>()).results;

    expect(rows.find((row) => row.id === "p_cash")?.refundable_amount).toBe(20);
    expect(rows.find((row) => row.id === "p_pending")?.refundable_amount).toBe(0);
    expect(rows.find((row) => row.id === "p_card")?.refundable_amount).toBe(20);
  });

  it("getRefundableCardTotal ignores pending and non-card rows", () => {
    expect(getRefundableCardTotal([{ method: "card", status: "paid", amount: 10, refunded_amount: 2 }, { method: "card", status: "pending", amount: 20, refunded_amount: 0 }, { method: "cash", status: "paid", amount: 30, refunded_amount: 0 }] as never)).toBe(8);
  });

  it("cash cancellation path is not_card and leaves cash untouched", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite, "p1", "b1", 30, "cash", "cs_unused"); const outcome = await refundCardPayment(makeDeps(db).deps, "p1", 30); expect(outcome.code).toBe("not_card"); expect((await paymentRow(db))?.refunded_amount).toBe(0);
  });

  it("refundPayment refuses card but still refunds cash", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); expect((await refundPayment(db, "p1", 1)).success).toBe(false); sqlite.prepare("UPDATE payments SET method='cash' WHERE id='p1'").run(); expect((await refundPayment(db, "p1", 1)).success).toBe(true);
  });

  it("refundPayments continues after one item fails and preserves item order", async () => {
    const { sqlite, db } = makeDb();
    seedBooking(sqlite);
    seedBooking(sqlite, "b2", "confirmed", 20);
    seedPayment(sqlite, "p1", "b1", 30, "cash", "cs_unused");
    seedPayment(sqlite, "p2", "b2", 20);
    const { deps } = makeDeps(db, { create: result(accepted("re_plural", 1000)) });

    const outcome = await refundPayments(deps, [
      { paymentId: "p1", amount: 10 },
      { paymentId: "p2", amount: 10 },
    ]);

    expect(outcome.outcomes).toHaveLength(2);
    expect(outcome.outcomes[0].code).toBe("not_card");
    expect(outcome.outcomes[1].ok).toBe(true);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.refunded).toBe(10);
  });

  it("maps idempotency_key_in_use to the dedicated in-progress message", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const outcome = await refundCardPayment(makeDeps(db, { create: error("busy", "idempotency_key_in_use", 409) }).deps, "p1", 1); expect(outcome.message).toContain("opération");
  });

  it("reports a post-Stripe ledger failure without claiming Stripe failed", async () => {
    const { sqlite, db } = makeDb(); seedBooking(sqlite); seedPayment(sqlite); const original = db.prepare.bind(db); db.prepare = ((sql: string) => { if (sql.includes("INSERT INTO payment_refunds")) throw new Error("disk full"); return original(sql); }) as typeof db.prepare;
    const outcome = await refundCardPayment(makeDeps(db, { create: result(accepted("re_ledger", 1000)) }).deps, "p1", 10);
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("ledger_write_failed");
    expect(outcome.stripeRefundId).toBe("re_ledger");
    expect(outcome.message).not.toContain("remboursement a échoué");
    const audits = (await db.prepare("SELECT action, changes FROM audit_logs WHERE entity_id = ?").bind("p1").all<{ action: string; changes: string }>()).results;
    const acceptedAudit = audits.find((audit) => audit.action === "refund-stripe-accepted");
    expect(acceptedAudit).toBeDefined();
    expect(acceptedAudit?.changes).toContain("re_ledger");
  });
});
