import type {
  DbPayment,
  MovementStatus,
  PaymentMethod,
} from "./db-types";
import { getBookingAmountDue } from "./booking-totals";
import { recomputeBookingPaymentStatus } from "./db";

export interface AllocationInput { booking_id: string; amount: number; }

export interface AllocatableBooking {
  id: string; booking_ref: string; date: string; start_time: string; remaining: number;
}

const MONEY_TOLERANCE = 0.005;

function generateId(): string {
  return crypto.randomUUID();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Waterfall pur, sans DB, testable unitairement. */
export function allocateWaterfall(
  bookings: AllocatableBooking[],
  amount: number,
): { allocations: AllocationInput[]; unallocated: number } {
  let remaining = round2(Math.max(0, amount));
  const allocations: AllocationInput[] = [];
  const ordered = [...bookings].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.start_time.localeCompare(b.start_time) ||
    a.booking_ref.localeCompare(b.booking_ref),
  );

  for (const booking of ordered) {
    if (remaining <= MONEY_TOLERANCE) break;
    const due = Math.max(0, round2(booking.remaining));
    const allocated = round2(Math.min(remaining, due));
    if (allocated > MONEY_TOLERANCE) {
      allocations.push({ booking_id: booking.id, amount: allocated });
      remaining = round2(remaining - allocated);
    }
  }

  return { allocations, unallocated: round2(remaining) };
}

function checkedAllocations(amount: number, allocations: AllocationInput[]): AllocationInput[] {
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Le montant doit être différent de zéro");
  const roundedAmount = round2(amount);
  if (roundedAmount === 0) throw new Error("Le montant doit être différent de zéro");

  const seen = new Set<string>();
  const result = allocations.map((allocation) => {
    const value = round2(Number(allocation.amount));
    if (!allocation.booking_id || !Number.isFinite(value) || value === 0) {
      throw new Error("Allocation invalide");
    }
    if (seen.has(allocation.booking_id)) throw new Error("Une réservation ne peut être allouée qu'une seule fois");
    seen.add(allocation.booking_id);
    if (Math.sign(value) !== Math.sign(roundedAmount)) {
      throw new Error("Le signe de l'allocation doit correspondre au mouvement");
    }
    return { booking_id: allocation.booking_id, amount: value };
  });

  const allocated = round2(result.reduce((sum, allocation) => sum + allocation.amount, 0));
  if (Math.abs(allocated) > Math.abs(roundedAmount) + MONEY_TOLERANCE) {
    throw new Error("Le mouvement est sur-alloué");
  }
  return result;
}

async function recomputeAllocatedBookings(db: D1Database, allocations: AllocationInput[]): Promise<void> {
  for (const bookingId of [...new Set(allocations.map((allocation) => allocation.booking_id))]) {
    await recomputeBookingPaymentStatus(db, bookingId);
  }
}

/** Mouvement + allocations en une transaction D1. */
export async function recordMovement(db: D1Database, input: {
  id?: string;
  amount: number;
  method: PaymentMethod;
  status?: MovementStatus;
  paid_at?: string | null;
  external_ref?: string | null;
  parent_id?: string | null;
  reason?: string | null;
  performed_by?: string | null;
  allocations: AllocationInput[];
}): Promise<{ id: string; inserted: boolean }> {
  const id = input.id ?? generateId();
  const amount = round2(input.amount);
  const allocations = checkedAllocations(amount, input.allocations);
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const statements = [
    db.prepare(
      `INSERT INTO payments (id, amount, method, status, paid_at, external_ref, parent_id, reason, performed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      amount,
      input.method,
      input.status ?? "settled",
      input.paid_at ?? ((input.status ?? "settled") === "settled" ? createdAt : null),
      input.external_ref ?? null,
      input.parent_id ?? null,
      input.reason ?? null,
      input.performed_by ?? null,
      createdAt,
    ),
    ...allocations.map((allocation) => db.prepare(
      `INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(generateId(), id, allocation.booking_id, allocation.amount, createdAt)),
  ];

  await db.batch(statements);
  await recomputeAllocatedBookings(db, allocations);
  return { id, inserted: true };
}

/** Contre-passation : mouvement inverse + allocations miroir. */
export async function reverseMovement(
  db: D1Database, movementId: string, reason: string, performedBy: string,
): Promise<{ id: string }> {
  const movement = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(movementId).first<DbPayment>();
  if (!movement) throw new Error("Mouvement introuvable");

  const allocationRows = await db.prepare(
    "SELECT booking_id, amount FROM payment_allocations WHERE payment_id = ? ORDER BY created_at ASC, id ASC",
  ).bind(movementId).all<AllocationInput>();
  const allocations = allocationRows.results.map((allocation) => ({
    booking_id: allocation.booking_id,
    amount: round2(-Number(allocation.amount)),
  }));
  checkedAllocations(round2(-movement.amount), allocations);
  const id = generateId();
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const statements = [
    db.prepare(
      `INSERT INTO payments (id, amount, method, status, paid_at, external_ref, parent_id, reason, performed_by, created_at)
       VALUES (?, ?, ?, 'settled', ?, NULL, ?, ?, ?, ?)`,
    ).bind(id, round2(-movement.amount), movement.method, createdAt, movementId, reason, performedBy, createdAt),
    ...allocations.map((allocation) => db.prepare(
      `INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(generateId(), id, allocation.booking_id, allocation.amount, createdAt)),
  ];
  await db.batch(statements);
  await recomputeAllocatedBookings(db, allocations);
  return { id };
}

/** Idempotent Stripe Checkout movement, including repair of missing allocations. */
export async function upsertCheckoutPayment(db: D1Database, input: {
  sessionId: string; amount: number; paidAt: string; allocations: AllocationInput[];
}): Promise<{ inserted: boolean; movementId: string }> {
  const amount = round2(input.amount);
  const allocations = checkedAllocations(amount, input.allocations);
  const candidateId = generateId();
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const insertResult = await db.prepare(
    `INSERT OR IGNORE INTO payments (id, amount, method, status, paid_at, external_ref, created_at)
     VALUES (?, ?, 'card', 'settled', ?, ?, ?)`,
  ).bind(candidateId, amount, input.paidAt, input.sessionId, createdAt).run();

  const movement = await db.prepare("SELECT * FROM payments WHERE external_ref = ?").bind(input.sessionId).first<DbPayment>();
  if (!movement) throw new Error("Mouvement Checkout introuvable après insertion");
  const inserted = (insertResult.meta?.changes ?? 0) > 0;

  const existing = await db.prepare(
    "SELECT booking_id, amount FROM payment_allocations WHERE payment_id = ?",
  ).bind(movement.id).all<AllocationInput>();
  const existingByBooking = new Map(existing.results.map((allocation) => [allocation.booking_id, Number(allocation.amount)]));
  const missing = allocations.filter((allocation) => {
    const current = existingByBooking.get(allocation.booking_id);
    if (current !== undefined && Math.abs(current - allocation.amount) > MONEY_TOLERANCE) {
      throw new Error("Allocation Checkout incohérente");
    }
    return current === undefined;
  });
  checkedAllocations(Number(movement.amount), [...existing.results, ...missing]);
  if (missing.length > 0) {
    await db.batch(missing.map((allocation) => db.prepare(
      `INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(generateId(), movement.id, allocation.booking_id, allocation.amount, createdAt)));
  }
  await recomputeAllocatedBookings(db, allocations);
  return { inserted, movementId: movement.id };
}

/** Plafond restant d'une allocation, réservations pending incluses pour les enfants. */
export async function refundableForAllocation(
  db: D1Database, paymentId: string, bookingId: string,
): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE((SELECT SUM(a.amount) FROM payment_allocations a
                       WHERE a.payment_id = ? AND a.booking_id = ?), 0)
             + COALESCE((SELECT SUM(c.amount)
                         FROM payment_allocations c
                         JOIN payments child ON child.id = c.payment_id
                         WHERE child.parent_id = ? AND c.booking_id = ?
                           AND child.status IN ('settled', 'pending')), 0) AS refundable`,
  ).bind(paymentId, bookingId, paymentId, bookingId).first<{ refundable: number }>();
  return Math.max(0, round2(Number(row?.refundable) || 0));
}

export interface BookingLedgerSummary {
  bookingId: string;
  due: number;
  settled: number;
  balance: number;
  refunded: number;
  movements: (DbPayment & { allocated: number; refundable: number })[];
}

interface LedgerRow extends DbPayment {
  booking_id: string;
  due_total: number;
  due_discount: number;
  allocated: number | null;
  child_allocated: number | null;
}

function emptySummary(bookingId: string): BookingLedgerSummary {
  return { bookingId, due: 0, settled: 0, balance: 0, refunded: 0, movements: [] };
}

function summariesFromRows(rows: LedgerRow[], requestedIds: string[]): Map<string, BookingLedgerSummary> {
  const summaries = new Map<string, BookingLedgerSummary>();
  for (const bookingId of requestedIds) summaries.set(bookingId, emptySummary(bookingId));
  for (const row of rows) {
    let summary = summaries.get(row.booking_id);
    if (!summary) {
      summary = emptySummary(row.booking_id);
      summaries.set(row.booking_id, summary);
    }
    summary.due = getBookingAmountDue({
      base_price: 0,
      equipment_price: 0,
      total_price: Number(row.due_total) || 0,
      promo_discount: Number(row.due_discount) || 0,
    });
    if (row.id) {
      const allocated = round2(Number(row.allocated) || 0);
      summary.movements.push({
        id: row.id,
        amount: Number(row.amount) || 0,
        method: row.method,
        status: row.status,
        paid_at: row.paid_at,
        external_ref: row.external_ref,
        parent_id: row.parent_id,
        reason: row.reason,
        performed_by: row.performed_by,
        created_at: row.created_at,
        allocated,
        refundable: row.status === "settled" && allocated > 0
          ? Math.max(0, round2(allocated + (Number(row.child_allocated) || 0)))
          : 0,
      });
      if (row.status === "settled") {
        summary.settled = round2(summary.settled + allocated);
        if (allocated < 0) summary.refunded = round2(summary.refunded - allocated);
      }
    }
  }
  for (const summary of summaries.values()) {
    summary.balance = round2(summary.due - summary.settled);
    summary.movements.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }
  return summaries;
}

export async function getBookingLedger(db: D1Database, bookingId: string): Promise<BookingLedgerSummary> {
  const result = await getBookingLedgerBatch(db, [bookingId]);
  return result.get(bookingId) ?? emptySummary(bookingId);
}

export async function getBookingLedgerBatch(
  db: D1Database, bookingIds: string[],
): Promise<Map<string, BookingLedgerSummary>> {
  const ids = [...new Set(bookingIds)];
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.prepare(
    `SELECT b.id AS booking_id, b.total_price AS due_total, b.promo_discount AS due_discount,
            p.id, p.amount, p.method, p.status, p.paid_at, p.external_ref, p.parent_id,
            p.reason, p.performed_by, p.created_at,
            SUM(a.amount) AS allocated,
            (SELECT COALESCE(SUM(child_a.amount), 0)
             FROM payment_allocations child_a
             JOIN payments child_p ON child_p.id = child_a.payment_id
             WHERE child_p.parent_id = p.id AND child_a.booking_id = b.id
               AND child_p.status IN ('settled', 'pending')) AS child_allocated
     FROM bookings b
     LEFT JOIN payment_allocations a ON a.booking_id = b.id
     LEFT JOIN payments p ON p.id = a.payment_id
     WHERE b.id IN (${placeholders})
     GROUP BY b.id, p.id
     ORDER BY b.id ASC, p.created_at ASC, p.id ASC`,
  ).bind(...ids).all<LedgerRow>();
  return summariesFromRows(result.results, ids);
}
