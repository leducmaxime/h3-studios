import type { DbPayment, MovementStatus, PaymentMethod } from "./db-types";
import {
  addAuditLog,
  getPaymentById,
  recomputeBookingPaymentStatus,
} from "./db";
import * as realStripe from "./stripe";
import {
  isRefundCommitted,
  isRefundLedgerAccepted,
  type StripeRefund,
  type StripeResult,
} from "./stripe";
import {
  getBookingLedger,
  recordMovement,
  refundableForAllocation,
  tryInsertManualRefundMovement,
} from "./ledger";
import { round2 } from "./booking-totals";
import { buildPushNotification, type PushNotification } from "./push";

export type RefundChannel = "stripe" | "cash" | "transfer" | "check" | "card";

export type RefundFailureCode =
  | "payment_not_found"
  | "not_card"
  | "not_collected"
  | "no_stripe_reference"
  | "stripe_not_configured"
  | "amount_invalid"
  | "amount_exceeds_refundable"
  | "stripe_error"
  | "stripe_unconfirmed"
  | "ledger_write_failed"
  | "already_applied"
  | "idempotency_conflict";

export interface RefundOutcome {
  ok: boolean;
  paymentId: string;
  requestedAmount: number;
  refundedAmount: number;
  refundableAfter: number;
  stripeRefundId?: string;
  stripeRefundStatus?: string;
  unattributedAmount?: number;
  reconciledAmount?: number;
  code?: RefundFailureCode;
  message?: string;
}

export interface RefundBatchOutcome {
  refunded: number;
  outcomes: RefundOutcome[];
  errors: RefundOutcome[];
}

export interface StripeRefundPort {
  createRefund: typeof realStripe.createRefund;
  listRefundsForPaymentIntent: typeof realStripe.listRefundsForPaymentIntent;
  retrievePaymentIntentIdForSession: typeof realStripe.retrievePaymentIntentIdForSession;
}

export interface RefundDeps {
  db: D1Database;
  secretKey: string | undefined;
  performedBy: string;
  sendPush: (notification: PushNotification) => Promise<void>;
  stripe?: StripeRefundPort;
  now?: () => string;
}

/**
 * Compute the remaining amount of one allocation.
 *
 * The values are euros (the ledger is a REAL ledger), despite the historical
 * helper name.  In particular, the first argument is the allocation amount,
 * not the amount of the parent movement.
 */
function computeRefundableCents(
  allocationAmount: number,
  ledgerRefunded: number,
  committedRefunded: number,
): number {
  return Math.max(0, round2(allocationAmount - Math.max(ledgerRefunded, committedRefunded)));
}

async function callPort<T>(
  fn: () => Promise<StripeResult<T>>,
): Promise<StripeResult<T>> {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: "network_error",
      },
    };
  }
}

function movementStatusForStripe(refund: Pick<StripeRefund, "status">): MovementStatus {
  if (refund.status === "succeeded" || refund.status === "pending") return "settled";
  if (refund.status === "requires_action") return "pending";
  return "failed";
}

async function updateRefundMovement(
  db: D1Database,
  movementId: string,
  status: MovementStatus,
  externalRef: string | null,
  paidAt: string | null,
): Promise<void> {
  await db.prepare(
    "UPDATE payments SET external_ref = ?, status = ?, paid_at = ? WHERE id = ?",
  ).bind(externalRef, status, paidAt, movementId).run();
}

async function findPendingRefund(
  db: D1Database,
  paymentId: string,
  bookingId: string,
): Promise<(DbPayment & { allocated: number }) | null> {
  return db.prepare(
    `SELECT p.*, a.amount AS allocated
     FROM payments p
     JOIN payment_allocations a ON a.payment_id = p.id
     WHERE p.parent_id = ? AND p.status = 'pending'
       AND p.method = 'card' AND a.booking_id = ? AND a.amount < 0
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 1`,
  ).bind(paymentId, bookingId).first<DbPayment & { allocated: number }>();
}

async function findMovementByExternalRef(
  db: D1Database,
  externalRef: string,
): Promise<DbPayment | null> {
  return db.prepare("SELECT * FROM payments WHERE external_ref = ?").bind(externalRef).first<DbPayment>();
}

async function getRefundableAfter(
  db: D1Database,
  paymentId: string,
  bookingId: string,
): Promise<number> {
  return round2(await refundableForAllocation(db, paymentId, bookingId));
}

async function getAllocationAmount(
  db: D1Database,
  paymentId: string,
  bookingId: string,
): Promise<number> {
  const row = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS amount FROM payment_allocations WHERE payment_id = ? AND booking_id = ?",
  ).bind(paymentId, bookingId).first<{ amount: number }>();
  return Math.max(0, round2(Number(row?.amount) || 0));
}

/** Total encore remboursable par carte pour une réservation. */
export async function getRefundableCardTotal(
  db: D1Database,
  bookingId: string,
): Promise<number> {
  const summary = await getBookingLedger(db, bookingId);
  return round2(summary.movements
    .filter((movement) => movement.method === "card")
    .reduce((sum, movement) => sum + (movement.refundable || 0), 0));
}

/**
 * Rembourse une allocation carte.
 *
 * A pending negative movement is deliberately created before the first
 * Stripe request.  Its id is consequently the stable Stripe idempotency key,
 * and its allocation immediately reserves the amount against concurrent
 * refund attempts.
 */
export async function refundAllocation(
  deps: RefundDeps,
  input: { paymentId: string; bookingId: string; amount: number; reason?: string },
): Promise<RefundOutcome> {
  const { paymentId, bookingId } = input;
  const amount = round2(Number(input.amount));
  const stripe = deps.stripe ?? realStripe;
  const now = deps.now ?? (() => new Date().toISOString());
  const payment = await getPaymentById(deps.db, paymentId);

  const auditFailure = async (code: RefundFailureCode, message: string) => {
    await addAuditLog(deps.db, "payment", paymentId, "refund-failed", { code, message }, deps.performedBy);
  };

  const baseOutcome = (
    code: RefundFailureCode,
    message: string,
    refundableAfter = 0,
    extra: Partial<RefundOutcome> = {},
  ): RefundOutcome => ({
    ok: false,
    paymentId,
    requestedAmount: amount,
    refundedAmount: 0,
    refundableAfter,
    code,
    message,
    ...extra,
  });

  if (!payment) return baseOutcome("payment_not_found", "Paiement introuvable");
  if (payment.method !== "card") {
    const message = "Ce paiement n'est pas un paiement carte";
    await auditFailure("not_card", message);
    return baseOutcome("not_card", message);
  }
  if (payment.status !== "settled" || payment.amount <= 0) {
    const message = "Ce paiement n'est pas encaissé";
    await auditFailure("not_collected", message);
    return baseOutcome("not_collected", message);
  }
  if (!deps.secretKey) {
    const message = "Stripe n'est pas configuré";
    await auditFailure("stripe_not_configured", message);
    return baseOutcome("stripe_not_configured", message);
  }
  if (!payment.external_ref?.startsWith("cs_")) {
    const message = "Référence Stripe introuvable";
    await auditFailure("no_stripe_reference", message);
    return baseOutcome("no_stripe_reference", message);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    const message = "Le montant doit être supérieur à zéro";
    await auditFailure("amount_invalid", message);
    return baseOutcome("amount_invalid", message);
  }

  // A retry after Stripe accepted the refund reuses the already-created
  // movement.  Do this lookup before applying the allocation ceiling: the
  // pending allocation itself is part of that ceiling.
  let movement = await findPendingRefund(deps.db, paymentId, bookingId);
  if (movement) {
    const reservedAmount = round2(Math.abs(Number(movement.allocated)));
    if (Math.abs(reservedAmount - amount) > 0.005) {
      const available = await getRefundableAfter(deps.db, paymentId, bookingId);
      const message = "Une opération de remboursement est déjà en cours pour cette allocation.";
      await auditFailure("amount_exceeds_refundable", message);
      return baseOutcome("amount_exceeds_refundable", message, available);
    }
  }

  const stripeSessionId = payment.external_ref;
  const session = await callPort(() =>
    stripe.retrievePaymentIntentIdForSession(deps.secretKey!, stripeSessionId),
  );
  if (!session.ok || !session.data) {
    const message = !session.ok ? session.error.message : "PaymentIntent Stripe introuvable";
    await auditFailure(session.ok ? "no_stripe_reference" : "stripe_error", message);
    return baseOutcome(session.ok ? "no_stripe_reference" : "stripe_error", message,
      await getRefundableAfter(deps.db, paymentId, bookingId));
  }

  const listed = await callPort(() =>
    stripe.listRefundsForPaymentIntent(deps.secretKey!, session.data!),
  );
  if (!listed.ok) {
    // Fail-closed strict : la réconciliation a échoué, donc l'état Stripe est
    // INCONNU. On n'écrit rien.
    //
    // Ne pas créer ici de « réservation » pending : aucun POST n'a été émis
    // (calls.create = 0), il n'existe donc aucun état Stripe contre lequel une
    // clé d'idempotence protégerait. Un tel mouvement ne sécuriserait rien et
    // amputerait durablement le plafond remboursable — pire, la garde de
    // montant en tête de fonction bloquerait ensuite toute demande d'un montant
    // différent, verrouillant la réservation après une simple panne réseau.
    //
    // Un rejeu ultérieur repart d'une réconciliation propre.
    const message = listed.error.message;
    await auditFailure("stripe_error", message);
    return baseOutcome("stripe_error", message,
      await getRefundableAfter(deps.db, paymentId, bookingId));
  }

  // Reconciliation is intentionally keyed only by the local external_ref.
  // Stripe metadata is not an ownership boundary.
  let reconciledMovement: DbPayment | null = null;
  let reconciledRefund: StripeRefund | null = null;
  let unattributedCents = 0;
  const reconciliationExtra = (): Partial<RefundOutcome> =>
    unattributedCents > 0 ? { unattributedAmount: round2(unattributedCents / 100) } : {};
  for (const refund of listed.data) {
    const owned = await findMovementByExternalRef(deps.db, refund.id);
    if (!owned || owned.parent_id !== paymentId) {
      if (!owned && isRefundCommitted(refund)) unattributedCents += refund.amount;
      continue;
    }
    const allocation = await deps.db.prepare(
      "SELECT 1 AS found FROM payment_allocations WHERE payment_id = ? AND booking_id = ?",
    ).bind(owned.id, bookingId).first<{ found: number }>();
    if (!allocation) continue;

    const status = movementStatusForStripe(refund);
    await updateRefundMovement(
      deps.db,
      owned.id,
      status,
      refund.id,
      status === "settled" ? now() : owned.paid_at,
    );
    try {
      await addAuditLog(deps.db, "payment", owned.id, "refund-reconciled", {
        stripe_refund_id: refund.id,
        stripe_refund_status: refund.status,
        movement_status: status,
      }, deps.performedBy);
    } catch {
      // Reconciliation of the movement itself remains authoritative.
    }
    if (isRefundCommitted(refund)) {
      await recomputeBookingPaymentStatus(deps.db, bookingId);
    }
    if (owned.id === movement?.id || !movement) {
      reconciledMovement = owned;
      reconciledRefund = refund;
    }
  }

  if (reconciledMovement && reconciledRefund) {
    const after = await getRefundableAfter(deps.db, paymentId, bookingId);
    if (isRefundLedgerAccepted(reconciledRefund)) {
      return {
        ok: false,
        paymentId,
        requestedAmount: amount,
        refundedAmount: 0,
        refundableAfter: after,
        stripeRefundId: reconciledRefund.id,
        stripeRefundStatus: reconciledRefund.status ?? undefined,
        code: "already_applied",
        ...reconciliationExtra(),
      };
    }
    if (reconciledRefund.status === "requires_action") {
      return baseOutcome("stripe_unconfirmed", "Stripe a créé le remboursement mais attend des coordonnées bancaires. Ne relancez pas : traitez-le depuis le Dashboard Stripe.", after, {
        stripeRefundId: reconciledRefund.id,
        stripeRefundStatus: reconciledRefund.status,
        ...reconciliationExtra(),
      });
    }
    // A locally-owned failed refund has been healed. Do not immediately issue
    // another refund during this reconciliation pass.
    return baseOutcome("stripe_error", "Stripe n'a pas confirmé le remboursement.", after, {
      stripeRefundId: reconciledRefund.id,
      stripeRefundStatus: reconciledRefund.status ?? undefined,
      ...reconciliationExtra(),
    });
  }

  if (!movement) {
    const available = await getRefundableAfter(deps.db, paymentId, bookingId);
    // The ceiling is the selected allocation, never the whole parent
    // movement. `refundableForAllocation` already includes settled/pending
    // child movements in its second operand.
    const allocationAmount = await getAllocationAmount(deps.db, paymentId, bookingId);
    const refundedBefore = round2(Math.max(0, allocationAmount - available));
    const refundable = computeRefundableCents(allocationAmount, refundedBefore, refundedBefore);
    if (amount > refundable + 0.005) {
      const message = "Montant supérieur au montant remboursable";
      await auditFailure("amount_exceeds_refundable", message);
      return baseOutcome("amount_exceeds_refundable", message, available, reconciliationExtra());
    }

    try {
      const created = await recordMovement(deps.db, {
        id: crypto.randomUUID(),
        amount: -amount,
        method: "card",
        status: "pending",
        external_ref: null,
        parent_id: paymentId,
        reason: input.reason ?? null,
        performed_by: deps.performedBy,
        allocations: [{ booking_id: bookingId, amount: -amount }],
      });
      movement = await deps.db.prepare("SELECT * FROM payments WHERE id = ?")
        .bind(created.id).first<DbPayment & { allocated: number }>();
      if (!movement) throw new Error("Mouvement de remboursement introuvable après insertion");
      movement.allocated = -amount;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de l'écriture du grand livre";
      await auditFailure("ledger_write_failed", message);
      return baseOutcome("ledger_write_failed", message, available, reconciliationExtra());
    }
  }

  const movementId = movement.id;

  const created = await callPort(() =>
    stripe.createRefund(deps.secretKey!, {
      paymentIntentId: session.data!,
      amountCents: Math.round(amount * 100),
      idempotencyKey: `refund:${movementId}`,
      metadata: {
        payment_id: paymentId,
        booking_id: bookingId,
        admin_user_id: deps.performedBy,
      },
    }),
  );

  if (!created.ok) {
    const uncertain = created.error.code === "network_error" || created.error.httpStatus === 409 || created.error.code === "idempotency_key_in_use";
    if (!uncertain) await updateRefundMovement(deps.db, movementId, "failed", null, null);
    const message = created.error.httpStatus === 409 || created.error.code === "idempotency_key_in_use"
      ? "Une opération de remboursement est déjà en cours pour ce mouvement. Actualisez la page dans quelques instants."
      : created.error.message;
    await auditFailure("stripe_error", message);
    return baseOutcome("stripe_error", message,
      await getRefundableAfter(deps.db, paymentId, bookingId), reconciliationExtra());
  }

  const refund = created.data;
  const status = movementStatusForStripe(refund);
  try {
    await updateRefundMovement(
      deps.db,
      movementId,
      status,
      refund.id,
      status === "settled" ? now() : null,
    );
  } catch {
    return baseOutcome(
      "ledger_write_failed",
      `Stripe a accepté le remboursement (${refund.id}) mais l'enregistrement local a échoué. Relancez l'opération.`,
      await getRefundableAfter(deps.db, paymentId, bookingId),
      { stripeRefundId: refund.id, stripeRefundStatus: refund.status ?? undefined, ...reconciliationExtra() },
    );
  }
  // Once external_ref has been written, a retry is harmless even if one of
  // these bookkeeping side effects fails: it will find this movement again.
  try {
    await recomputeBookingPaymentStatus(deps.db, bookingId);
    await addAuditLog(deps.db, "payment", paymentId, "refund-stripe-accepted", {
      stripe_refund_id: refund.id,
      stripe_refund_status: refund.status,
      amount,
      payment_id: paymentId,
      booking_id: bookingId,
    }, deps.performedBy);
  } catch {
    // The movement is already durably reconciled.  Do not turn an audit or
    // derived-status failure into a retry that could be mistaken for a new
    // refund request.
  }

  const refundableAfter = await getRefundableAfter(deps.db, paymentId, bookingId);
  if (!isRefundLedgerAccepted(refund)) {
    return baseOutcome(
      "stripe_unconfirmed",
      refund.status === "requires_action"
        ? "Stripe a créé le remboursement mais attend des coordonnées bancaires. Ne relancez pas : traitez-le depuis le Dashboard Stripe."
        : "Stripe n'a pas confirmé le remboursement.",
      refundableAfter,
      { stripeRefundId: refund.id, stripeRefundStatus: refund.status ?? undefined, ...reconciliationExtra() },
    );
  }

  void Promise.resolve().then(() => deps.sendPush(buildPushNotification("refund_issued", {
    bookingId,
    amount,
  }))).catch(() => {});

  return {
    ok: true,
    paymentId,
    requestedAmount: amount,
    refundedAmount: amount,
    refundableAfter,
    stripeRefundId: refund.id,
    stripeRefundStatus: refund.status ?? undefined,
    ...reconciliationExtra(),
  };
}

/**
 * Enregistre un remboursement manuel (cash, transfer, check, card, etc.) sans passer par Stripe.
 * Utilise requestId comme id du mouvement enfant pour idempotence (rejeu = no-op détecté).
 * Le cap est vérifié atomiquement avec l'INSERT conditionnel (dans un batch D1 = tx).
 * Le `method` du mouvement enfant est `channel`, pas le method du parent.
 */
export async function recordManualRefund(
  deps: RefundDeps,
  input: { paymentId: string; bookingId: string; amount: number; channel: Exclude<RefundChannel, "stripe">; requestId: string; reason?: string },
): Promise<RefundOutcome> {
  const { paymentId, bookingId, channel, requestId } = input;
  const amount = round2(Number(input.amount));
  const now = deps.now ?? (() => new Date().toISOString());
  const payment = await getPaymentById(deps.db, paymentId);

  const auditFailure = async (code: RefundFailureCode, message: string) => {
    await addAuditLog(deps.db, "payment", paymentId, "refund-failed", { code, message, channel }, deps.performedBy);
  };

  const baseOutcome = (
    code: RefundFailureCode,
    message: string,
    refundableAfter = 0,
    extra: Partial<RefundOutcome> = {},
  ): RefundOutcome => ({
    ok: false,
    paymentId,
    requestedAmount: amount,
    refundedAmount: 0,
    refundableAfter,
    code,
    message,
    ...extra,
  });

  if (!payment) return baseOutcome("payment_not_found", "Paiement introuvable");
  if (payment.status !== "settled" || payment.amount <= 0) {
    const message = "Ce paiement n'est pas encaissé";
    await auditFailure("not_collected", message);
    return baseOutcome("not_collected", message);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    const message = "Le montant doit être supérieur à zéro";
    await auditFailure("amount_invalid", message);
    return baseOutcome("amount_invalid", message);
  }

  // Idempotency via requestId-as-id is handled inside the conditional insert.
  // We still perform other validations first.
  const write = await tryInsertManualRefundMovement(deps.db, {
    id: requestId,
    amount,
    method: channel as PaymentMethod,
    parent_id: paymentId,
    booking_id: bookingId,
    reason: input.reason ?? null,
    performed_by: deps.performedBy,
  });

  if (write.capExceeded) {
    const available = await getRefundableAfter(deps.db, paymentId, bookingId);
    const message = "Montant supérieur au montant remboursable";
    await auditFailure("amount_exceeds_refundable", message);
    return baseOutcome("amount_exceeds_refundable", message, available);
  }

  if (write.conflict) {
    const available = await getRefundableAfter(deps.db, paymentId, bookingId);
    const message = "Cet identifiant de requête a déjà été utilisé pour un remboursement différent";
    await auditFailure("idempotency_conflict", message);
    return baseOutcome("idempotency_conflict", message, available);
  }

  // Genuine success (fresh insert) or genuine replay (identical params).
  // Only audit on the actual insert; replays are silent successes.
  if (write.inserted) {
    await addAuditLog(deps.db, "payment", paymentId, "refund-manual", {
      channel,
      amount,
      booking_id: bookingId,
      movement_id: requestId,
    }, deps.performedBy);
    void Promise.resolve().then(() => deps.sendPush(buildPushNotification("refund_issued", {
      bookingId,
      amount,
    }))).catch(() => {});
  }

  const refundableAfter = await getRefundableAfter(deps.db, paymentId, bookingId);

  // On genuine replay, return the amount that was actually stored (read from row),
  // not the amount from the current request (even though they match within tolerance).
  let refundedAmount = amount;
  if (!write.inserted) {
    const stored = await deps.db
      .prepare("SELECT amount FROM payments WHERE id = ?")
      .bind(requestId)
      .first<{ amount: number }>();
    if (stored) {
      refundedAmount = Math.abs(round2(Number(stored.amount)));
    }
  }

  return {
    ok: true,
    paymentId,
    requestedAmount: amount,
    refundedAmount,
    refundableAfter,
  };
}

/** Rembourse en lot les allocations explicitement sélectionnées. */
export async function refundPayments(
  deps: RefundDeps,
  items: { paymentId: string; bookingId: string; amount: number; channel?: RefundChannel; requestId?: string; reason?: string }[],
): Promise<RefundBatchOutcome> {
  const outcomes: RefundOutcome[] = [];
  for (const item of items) {
    const channel = item.channel ?? "stripe";
    if (channel === "stripe") {
      outcomes.push(await refundAllocation(deps, {
        paymentId: item.paymentId,
        bookingId: item.bookingId,
        amount: item.amount,
        reason: item.reason,
      }));
    } else {
      if (!item.requestId) {
        // Non-stripe in batch without requestId: treat as invalid (callers for manual use the single route)
        const base: RefundOutcome = {
          ok: false,
          paymentId: item.paymentId,
          requestedAmount: item.amount,
          refundedAmount: 0,
          refundableAfter: 0,
          code: "amount_invalid",
          message: "requestId obligatoire pour les remboursements manuels",
        };
        outcomes.push(base);
        continue;
      }
      outcomes.push(await recordManualRefund(deps, {
        paymentId: item.paymentId,
        bookingId: item.bookingId,
        amount: item.amount,
        channel: channel as Exclude<RefundChannel, "stripe">,
        requestId: item.requestId,
        reason: item.reason,
      }));
    }
  }
  return {
    refunded: round2(outcomes.reduce((sum, outcome) => sum + (outcome.ok ? outcome.refundedAmount : 0), 0)),
    outcomes,
    errors: outcomes.filter((outcome) => !outcome.ok),
  };
}
