import type { DbPayment } from "./db-types";
import {
  addAuditLog,
  getPaymentById,
  getPaymentRefunds,
  recomputeBookingPaymentStatus,
  recomputePaymentRefundState,
  upsertPaymentRefund,
} from "./db";
import * as realStripe from "./stripe";
import {
  isRefundCommitted,
  isRefundLedgerAccepted,
  type StripeResult,
} from "./stripe";
import { round2 } from "./booking-totals";

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
  | "reconciled"
  | "already_applied";

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

export interface StripeRefundPort {
  createRefund: typeof realStripe.createRefund;
  listRefundsForPaymentIntent: typeof realStripe.listRefundsForPaymentIntent;
  retrievePaymentIntentIdForSession: typeof realStripe.retrievePaymentIntentIdForSession;
}

export interface RefundDeps {
  db: D1Database;
  secretKey: string | undefined;
  performedBy: string;
  stripe?: StripeRefundPort;
  now?: () => string;
}

function computeRefundableCents(
  paymentAmountCents: number,
  ledgerCents: number,
  committedCents: number,
): number {
  return Math.max(0, paymentAmountCents - Math.max(ledgerCents, committedCents));
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

/** Retourne le total encore remboursable des paiements carte encaissés. */
export function getRefundableCardTotal(
  payments: Pick<DbPayment, "method" | "status" | "amount" | "refunded_amount">[],
): number {
  const cents = payments
    .filter((payment) =>
      payment.method === "card" &&
      (payment.status === "paid" || payment.status === "partial-refund"),
    )
    .reduce(
      (sum, payment) => sum + Math.max(0, Math.round((payment.amount - payment.refunded_amount) * 100)),
      0,
    );
  return round2(cents / 100);
}

/** Rembourse une ligne carte après confirmation de Stripe. */
export async function refundCardPayment(
  deps: RefundDeps,
  paymentId: string,
  amount: number,
  reason?: string,
): Promise<RefundOutcome> {
  const stripe = deps.stripe ?? realStripe;
  const now = deps.now ?? (() => new Date().toISOString());
  let payment = await getPaymentById(deps.db, paymentId);
  let existingCommittedCents = 0;
  if (payment) {
    const reserved = await deps.db.prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) as cents FROM payment_refunds WHERE payment_id = ? AND status IN ('succeeded', 'pending', 'requires_action')",
    ).bind(paymentId).first<{ cents: number }>();
    existingCommittedCents = Math.round(reserved?.cents ?? 0);
  }

  const auditFailure = async (code: RefundFailureCode, message: string) => {
    if (payment) {
      await addAuditLog(deps.db, "payment", paymentId, "refund-failed", { code, message }, deps.performedBy);
    }
  };

  const baseOutcome = (
    code: RefundFailureCode,
    message: string,
    extra: Partial<RefundOutcome> = {},
  ): RefundOutcome => ({
    ok: false,
    paymentId,
    requestedAmount: amount,
    refundedAmount: 0,
    refundableAfter: payment
      ? round2(computeRefundableCents(
        Math.round(payment.amount * 100),
        Math.round(payment.refunded_amount * 100),
        existingCommittedCents,
      ) / 100)
      : 0,
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
  if (payment.status !== "paid" && payment.status !== "partial-refund") {
    const message = "Ce paiement n'est pas encaissé";
    await auditFailure("not_collected", message);
    return baseOutcome("not_collected", message);
  }
  if (!deps.secretKey) {
    const message = "Stripe n'est pas configuré";
    await auditFailure("stripe_not_configured", message);
    return baseOutcome("stripe_not_configured", message);
  }
  if (!payment.stripe_event_id?.startsWith("cs_")) {
    const message = "Référence Stripe introuvable";
    await auditFailure("no_stripe_reference", message);
    return baseOutcome("no_stripe_reference", message);
  }
  const stripeSessionId = payment.stripe_event_id;

  const session = await callPort(() =>
    stripe.retrievePaymentIntentIdForSession(deps.secretKey!, stripeSessionId),
  );
  if (!session.ok) {
    await auditFailure("stripe_error", session.error.message);
    return baseOutcome("stripe_error", session.error.message);
  }
  if (!session.data) {
    const message = "PaymentIntent Stripe introuvable";
    await auditFailure("no_stripe_reference", message);
    return baseOutcome("no_stripe_reference", message);
  }

  const listed = await callPort(() =>
    stripe.listRefundsForPaymentIntent(deps.secretKey!, session.data!),
  );
  if (!listed.ok) {
    await auditFailure("stripe_error", listed.error.message);
    return baseOutcome("stripe_error", listed.error.message);
  }

  const refundedBefore = payment.refunded_amount;
  let unattributedCents = 0;
  const reconciledRefundIds: string[] = [];
  let anyInserted = false;
  let discoveredCommittedCents = 0;

  // Les remboursements possédés sont toujours upsertés pour assurer la guérison bidirectionnelle.
  for (const refund of listed.data) {
    const owner = refund.metadata?.payment_id;
    if (owner === paymentId) {
      reconciledRefundIds.push(refund.id);
      const upserted = await upsertPaymentRefund(deps.db, {
        stripeRefundId: refund.id,
        paymentId,
        bookingId: payment.booking_id,
        amountCents: refund.amount,
        status: refund.status ?? "",
        performedBy: deps.performedBy,
        now: now(),
      });
      if (upserted.inserted) {
        anyInserted = true;
        if (isRefundCommitted(refund)) discoveredCommittedCents += refund.amount;
      }
    } else if (!owner?.trim() && isRefundCommitted(refund)) {
      unattributedCents += refund.amount;
    }
  }

  const reconciledState = await recomputePaymentRefundState(deps.db, paymentId);
  if (
    anyInserted || reconciledState.refundedAmount !== refundedBefore
  ) {
    await addAuditLog(deps.db, "payment", paymentId, "refund-reconciled", {
      stripe_refund_ids: reconciledRefundIds,
      refunded_before: refundedBefore,
      refunded_after: reconciledState.refundedAmount,
    }, deps.performedBy);
  }

  payment = await getPaymentById(deps.db, paymentId) ?? payment;
  const refunds = await getPaymentRefunds(deps.db, paymentId);
  const ledgerCents = refunds
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const committedCents = refunds
    .filter((refund) =>
      refund.status === "succeeded" ||
      refund.status === "pending" ||
      refund.status === "requires_action",
    )
    .reduce((sum, refund) => sum + refund.amount_cents, 0);
  const amountCents = Math.round(amount * 100);
  const refundableCents = computeRefundableCents(
    Math.round(payment.amount * 100),
    ledgerCents,
    committedCents,
  );
  const refundableAfter = () => round2(computeRefundableCents(
    Math.round(payment!.amount * 100),
    ledgerCents,
    committedCents,
  ) / 100);
  const fail = async (
    code: RefundFailureCode,
    message: string,
    extra: Partial<RefundOutcome> = {},
  ): Promise<RefundOutcome> => {
    await addAuditLog(deps.db, "payment", paymentId, "refund-failed", { code, message }, deps.performedBy);
    return baseOutcome(code, message, {
      refundableAfter: refundableAfter(),
      unattributedAmount: unattributedCents / 100,
      ...extra,
    });
  };

  if (discoveredCommittedCents > 0) {
    const reconciledAmount = discoveredCommittedCents / 100;
    const message = `Un remboursement de ${reconciledAmount} € TTC existait déjà chez Stripe et vient d'être enregistré. Vérifiez le solde avant toute nouvelle demande.`;
    return fail("reconciled", message, { reconciledAmount });
  }

  if (amountCents <= 0) return fail("amount_invalid", "Le montant doit être supérieur à zéro");
  if (amountCents > refundableCents) {
    return fail("amount_exceeds_refundable", "Montant supérieur au montant remboursable");
  }

  const created = await callPort(() =>
    stripe.createRefund(deps.secretKey!, {
      paymentIntentId: session.data!,
      amountCents,
      idempotencyKey: `refund:${paymentId}:${ledgerCents}:${amountCents}`,
      metadata: {
        payment_id: paymentId,
        booking_id: payment.booking_id,
        admin_user_id: deps.performedBy,
      },
    }),
  );
  if (!created.ok) {
    const message = created.error.httpStatus === 409 || created.error.code === "idempotency_key_in_use"
      ? "Une opération de remboursement est déjà en cours pour ce paiement. Actualisez la page dans quelques instants."
      : created.error.message;
    return fail("stripe_error", message);
  }

  const refund = created.data;
  if (!isRefundLedgerAccepted(refund)) {
    if (refund.status === "requires_action" && typeof refund.id === "string" && refund.id.length > 0) {
      await upsertPaymentRefund(deps.db, {
        stripeRefundId: refund.id,
        paymentId,
        bookingId: payment.booking_id,
        amountCents: refund.amount,
        status: refund.status,
        reason,
        performedBy: deps.performedBy,
        now: now(),
      });
    }
    const message = refund.status === "requires_action"
      ? "Stripe a créé le remboursement mais attend des coordonnées bancaires. Ne relancez pas : traitez-le depuis le Dashboard Stripe."
      : "Stripe n'a pas confirmé le remboursement.";
    return fail("stripe_unconfirmed", message, {
      stripeRefundId: refund.id,
      stripeRefundStatus: refund.status ?? undefined,
    });
  }

  try {
    await addAuditLog(deps.db, "payment", paymentId, "refund-stripe-accepted", {
      stripe_refund_id: refund.id,
      stripe_refund_status: refund.status,
      amount,
      payment_id: paymentId,
    }, deps.performedBy);
    const result = await upsertPaymentRefund(deps.db, {
      stripeRefundId: refund.id,
      paymentId,
      bookingId: payment.booking_id,
      amountCents: refund.amount,
      status: refund.status ?? "",
      reason,
      performedBy: deps.performedBy,
      now: now(),
    });
    const state = await recomputePaymentRefundState(deps.db, paymentId);
    await recomputeBookingPaymentStatus(deps.db, payment.booking_id);
    await addAuditLog(deps.db, "payment", paymentId, "refund", {
      amount,
      total: state.refundedAmount,
      stripe_refund_id: refund.id,
      stripe_refund_status: refund.status,
      reason,
    }, deps.performedBy);
    const appliedAmount = result.inserted ? refund.amount / 100 : 0;
    const refundableAfterAmount = round2(computeRefundableCents(
      Math.round(payment.amount * 100),
      ledgerCents + (result.inserted ? refund.amount : 0),
      committedCents + (result.inserted ? refund.amount : 0),
    ) / 100);
    return {
      ok: true,
      paymentId,
      requestedAmount: amount,
      refundedAmount: appliedAmount,
      refundableAfter: refundableAfterAmount,
      stripeRefundId: refund.id,
      stripeRefundStatus: refund.status ?? undefined,
      unattributedAmount: unattributedCents / 100,
      code: result.inserted ? undefined : "already_applied",
    };
  } catch {
    return {
      ...baseOutcome(
        "ledger_write_failed",
        `Stripe a accepté le remboursement (${refund.id}) mais l'enregistrement local a échoué. Relancez l'opération.`,
        {
          stripeRefundId: refund.id,
          stripeRefundStatus: refund.status ?? undefined,
          refundableAfter: refundableAfter(),
          unattributedAmount: unattributedCents / 100,
        },
      ),
      ok: false,
    };
  }
}

/** Rembourse séquentiellement les lignes explicitement sélectionnées. */
export async function refundPayments(
  deps: RefundDeps,
  items: { paymentId: string; amount: number }[],
  reason?: string,
) {
  const outcomes: RefundOutcome[] = [];
  for (const item of items) {
    outcomes.push(await refundCardPayment(deps, item.paymentId, item.amount, reason));
  }
  return {
    refunded: round2(outcomes.reduce((sum, outcome) => sum + (outcome.ok ? outcome.refundedAmount : 0), 0)),
    outcomes,
    errors: outcomes.filter((outcome) => !outcome.ok),
  };
}
