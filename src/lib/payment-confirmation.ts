import { getBookingAmountDue, getBookingBalance } from "./booking-totals";
import type { DbBooking, DbPayment, DbUser } from "./db-types";
import { daysUntilDate, reminderWhenPhrase, type BookingConfirmationData, type BookingSlot } from "./email";
import { parseBookingEquipmentLines } from "./booking";

/**
 * Finalisation idempotente d'un paiement en ligne (Stripe Checkout).
 *
 * Partagée entre le webhook (checkout.session.completed /
 * async_payment_succeeded) et le flux de récupération côté serveur
 * (GET /api/payment/session, déclenché quand le client atterrit sur
 * /payment/success). Garanties :
 *
 *  - Jamais de finalisation tant que Stripe ne rapporte pas payment_status
 *    === "paid" (pas de faux "payé" sur un paiement async en attente).
 *  - Une seule finalisation / un seul email par session grâce à la table
 *    durable `payment_confirmations` (claim INSERT OR IGNORE + retry email si
 *    l'envoi précédent n'a pas abouti).
 *  - Session expirée puis payée tardivement : les réservations annulées ne
 *    sont jamais réintégrées automatiquement — un audit log est enregistré.
 *  - Écart Stripe vs DB sur le montant : audité, jamais ignoré silencieusement.
 */

// ---------------------------------------------------------------------------
// Pure helpers (unit-testables)
// ---------------------------------------------------------------------------

export interface CheckoutSessionLike {
  id: string;
  amount_total?: number | null;
  payment_status: string;
}

/** Une session n'est finalisée que si Stripe la rapporte réellement payée. */
export function isSessionPaid(session: Pick<CheckoutSessionLike, "payment_status">): boolean {
  return session.payment_status === "paid";
}

/** Total attendu (centimes) : somme des montants nets (brut − remise) par ligne. */
export function computeExpectedTotalCents(
  bookings: Pick<DbBooking, "base_price" | "equipment_price" | "total_price" | "promo_discount">[],
): number {
  return bookings.reduce((sum, b) => sum + Math.round(getBookingAmountDue(b) * 100), 0);
}

/** Écart Stripe vs DB en centimes (null si Stripe n'expose pas amount_total). */
export function computeAmountMismatchCents(
  session: Pick<CheckoutSessionLike, "amount_total">,
  expectedTotalCents: number,
): number | null {
  if (session.amount_total == null) return null;
  return session.amount_total - expectedTotalCents;
}

export interface FinalizationPartition {
  finalizable: DbBooking[];
  cancelled: DbBooking[];
}

/**
 * Sépare les réservations finalisables de celles annulées (session expirée
 * puis payée tardivement) — les annulées ne sont jamais réintégrées.
 */
export function partitionBookingsForFinalization(bookings: DbBooking[]): FinalizationPartition {
  const finalizable: DbBooking[] = [];
  const cancelled: DbBooking[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled") cancelled.push(b);
    else finalizable.push(b);
  }
  return { finalizable, cancelled };
}

export interface PaidConfirmationEmailInput {
  bookings: DbBooking[]; // lignes du panier réellement payées (non annulées)
  user: Pick<DbUser, "name" | "phone"> & { email: string };
  equipmentNames?: Record<string, string>;
}

/**
 * Payload email consolidé, autoritaire côté serveur :
 *  - promoDiscount = SOMME des allocations promo du panier (jamais celle de la
 *    première ligne uniquement)
 *  - totalPrice = brut total − réduction aggregée (exactement une soustraction)
 */
export function buildPaidConfirmationEmailPayload(input: PaidConfirmationEmailInput): BookingConfirmationData {
  const primary = input.bookings[0];
  const aggregatePromo = input.bookings.reduce((sum, b) => sum + (Number(b.promo_discount) || 0), 0);
  const aggregateLoyalty = input.bookings.reduce((sum, b) => sum + (b.loyalty_award_id ? (Number(b.promo_discount) || 0) : 0), 0);
  const grossTotal = input.bookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
  const netTotal = Math.max(0, grossTotal - aggregatePromo);
  const promoCode = input.bookings.find((b) => b.promo_code)?.promo_code ?? null;
  const promoType = input.bookings.find((b) => b.promo_type)?.promo_type ?? null;

  const allSlots: BookingSlot[] = input.bookings.map((b) => ({
    bookingRef: b.booking_ref,
    studioId: b.studio_id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    groupType: b.group_type,
    equipment: parseBookingEquipmentLines(b.equipment),
    equipmentPrice: Number(b.equipment_price) || 0,
    equipmentNames: input.equipmentNames,
    totalPrice: Number(b.total_price) || 0,
  }));

  return {
    bookingRef: primary.booking_ref,
    studioId: primary.studio_id,
    date: primary.date,
    startTime: primary.start_time,
    endTime: primary.end_time,
    groupType: primary.group_type,
    equipment: parseBookingEquipmentLines(primary.equipment),
    equipmentPrice: Number(primary.equipment_price) || 0,
    equipmentNames: input.equipmentNames,
    totalPrice: netTotal,
    paymentMethod: "card",
    paymentStatus: "paid",
    userName: input.user.name,
    userEmail: input.user.email,
    userPhone: input.user.phone || "",
    promoCode,
    promoDiscount: aggregatePromo - aggregateLoyalty,
    loyaltyDiscount: aggregateLoyalty,
    promoType,
    allSlots: allSlots.length > 1 ? allSlots : undefined,
  };
}

export interface BookingConfirmationEmailInput {
  booking: DbBooking;
  user: Pick<DbUser, "name" | "phone"> & { email: string };
  equipmentNames?: Record<string, string>;
}

/**
 * Payload de confirmation pour une réservation unique, à l'état courant
 * (créneau, matériel, totaux, mode de paiement). Utilisé pour le renvoi admin.
 */
export function buildBookingConfirmationEmailPayload(
  input: BookingConfirmationEmailInput,
): BookingConfirmationData {
  const booking = input.booking;
  const promoDiscount = Number(booking.promo_discount) || 0;
  const isLoyalty = Boolean(booking.loyalty_award_id);

  return {
    bookingRef: booking.booking_ref,
    studioId: booking.studio_id,
    date: booking.date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    groupType: booking.group_type,
    equipment: parseBookingEquipmentLines(booking.equipment),
    equipmentPrice: Number(booking.equipment_price) || 0,
    equipmentNames: input.equipmentNames,
    totalPrice: getBookingAmountDue(booking),
    paymentMethod: booking.payment_method || "cash",
    paymentStatus: booking.payment_status || "pay-on-site",
    userName: input.user.name,
    userEmail: input.user.email,
    userPhone: input.user.phone || "",
    clientType: booking.client_type ?? undefined,
    legalName: booking.legal_name ?? undefined,
    promoCode: booking.promo_code,
    promoDiscount: isLoyalty ? 0 : promoDiscount,
    loyaltyDiscount: isLoyalty ? promoDiscount : 0,
    promoType: booking.promo_type,
  };
}

export function canResendBookingConfirmation(
  booking: Pick<DbBooking, "status" | "date"> | null | undefined,
  userEmail: string | null | undefined,
  todayISO: string,
): { ok: true } | { ok: false; error: string } {
  if (!booking) return { ok: false, error: "Réservation introuvable" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "Impossible de renvoyer un email de confirmation pour une réservation annulée" };
  }
  if (!userEmail?.trim()) {
    return { ok: false, error: "Le client n'a pas d'adresse e-mail" };
  }
  if (daysUntilDate(todayISO, booking.date) < 0) {
    return { ok: false, error: "Impossible de renvoyer un email de confirmation pour une réservation passée" };
  }
  return { ok: true };
}

export function canSendBookingReminder(
  booking: Pick<DbBooking, "status" | "date"> | null | undefined,
  userEmail: string | null | undefined,
  todayISO: string,
): { ok: true; whenPhrase: string } | { ok: false; error: string } {
  if (!booking) return { ok: false, error: "Réservation introuvable" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "Impossible d'envoyer un rappel pour une réservation annulée" };
  }
  if (!userEmail?.trim()) {
    return { ok: false, error: "Le client n'a pas d'adresse e-mail" };
  }
  const whenPhrase = reminderWhenPhrase(daysUntilDate(todayISO, booking.date));
  if (!whenPhrase) {
    return { ok: false, error: "Impossible d'envoyer un rappel pour une réservation passée" };
  }
  return { ok: true, whenPhrase };
}

export interface BookingReminderEmailInput extends BookingConfirmationEmailInput {
  payments: Pick<DbPayment, "amount" | "status" | "refunded_amount">[];
  whenPhrase: string;
}

export function buildBookingReminderEmailPayload(
  input: BookingReminderEmailInput,
): BookingConfirmationData {
  return {
    ...buildBookingConfirmationEmailPayload(input),
    reminder: {
      whenPhrase: input.whenPhrase,
      remainingDue: getBookingBalance(input.booking, input.payments),
    },
  };
}

// ---------------------------------------------------------------------------
// Finalizer orchestration (DB/email injectés pour la testabilité)
// ---------------------------------------------------------------------------

export interface FinalizePaidSessionDeps {
  getBookingsByRef: (refs: string[]) => Promise<DbBooking[]>;
  /** Complétion de paiement idempotente, clé (booking_id, stripe_event_id). */
  completePayment: (data: {
    booking_id: string;
    amount: number;
    method: string;
    status: string;
    paid_at?: string | null;
    stripe_event_id?: string | null;
  }) => Promise<{ inserted: boolean }>;
  addAuditLog: (
    entityType: string,
    entityId: string,
    action: string,
    changes: Record<string, unknown>,
    performedBy?: string,
  ) => Promise<void>;
  claimConfirmation: (sessionId: string, refs: string[]) => Promise<{ inserted: boolean }>;
  getConfirmation: (sessionId: string) => Promise<{ email_sent_at: string | null } | null>;
  /** Claim atomique de la livraison email — un seul appelant gagne. */
  claimEmail: (sessionId: string) => Promise<{ claimed: boolean; claimedAt: string }>;
  /** Libère le claim email après échec d'envoi (retry possible). */
  releaseEmailClaim: (sessionId: string, claimedAt: string) => Promise<void>;
  getUserById: (userId: string) => Promise<Pick<DbUser, "name" | "email" | "phone"> | null>;
  sendEmail: (data: BookingConfirmationData) => Promise<{ success: boolean }>;
  equipmentNames?: Record<string, string>;
  nowISO: () => string;
}

export type FinalizeOutcome =
  | { status: "not-paid" }
  | { status: "no-bookings" }
  | { status: "already-finalized" }
  | { status: "finalized"; paymentsAdded: number; cancelledSkipped: number; emailSent: boolean };

export async function finalizePaidCheckoutSession(
  session: CheckoutSessionLike,
  refs: string[],
  deps: FinalizePaidSessionDeps,
): Promise<FinalizeOutcome> {
  // Garde stricte : jamais de finalisation sur une session non payée.
  if (!isSessionPaid(session)) {
    return { status: "not-paid" };
  }

  const bookings = await deps.getBookingsByRef([...new Set(refs)]);
  if (bookings.length === 0) return { status: "no-bookings" };

  const expectedTotalCents = computeExpectedTotalCents(bookings);

  // Claim durable au niveau session (INSERT OR IGNORE) : enregistre la session
  // et identifie le propriétaire de l'audit de montant.
  const claim = await deps.claimConfirmation(session.id, refs);

  // M3 : l'audit de l'écart Stripe vs DB est enregistré UNE fois, par l'owner
  // du claim — les retries ne le dupliquent jamais.
  if (claim.inserted) {
    const mismatch = computeAmountMismatchCents(session, expectedTotalCents);
    if (mismatch !== null && mismatch !== 0) {
      await deps.addAuditLog("payment", session.id, "amount-mismatch", {
        stripeAmountCents: session.amount_total ?? null,
        expectedDBCents: expectedTotalCents,
        diffCents: mismatch,
        refs,
      }, "stripe-webhook");
    }
  }

  // Early return : email déjà livré (claim maintenu) → les paiements ont été
  // complétés par l'invocation qui a envoyé l'email (l'email vient APRÈS la
  // boucle de paiement). Une session entièrement traitée ne refait rien.
  const confirmation = await deps.getConfirmation(session.id);
  if (confirmation?.email_sent_at) {
    return { status: "already-finalized" };
  }

  const { finalizable, cancelled } = partitionBookingsForFinalization(bookings);

  // Session expirée puis payée tardivement : jamais de réintégration auto.
  for (const b of cancelled) {
    await deps.addAuditLog("booking", b.id, "late-payment-cancelled", {
      sessionId: session.id,
      reason: "Paiement reçu après annulation — aucune réintégration automatique",
    }, "stripe-webhook");
  }

  // M2 : complétion de paiement idempotente par réservation, à CHAQUE
  // invocation (webhook, récupération, retry) — clé = session.id (jamais
  // event.id). Un échec partiel est ainsi réparé par l'invocation suivante
  // sans doublon (INSERT OR IGNORE sur (booking_id, stripe_event_id)).
  let paymentsAdded = 0;
  for (const booking of finalizable) {
    const bookingDue = getBookingAmountDue(booking);
    if (bookingDue <= 0) continue; // 0€ : déjà soldée à la création
    const result = await deps.completePayment({
      booking_id: booking.id,
      amount: bookingDue,
      method: "card",
      status: "paid",
      paid_at: deps.nowISO(),
      stripe_event_id: session.id,
    });
    if (result.inserted) paymentsAdded++;
  }

  // M1 : claim atomique de la livraison email AVANT l'envoi. Seul l'appelant
  // qui gagne le claim (UPDATE WHERE email_sent_at IS NULL) envoie — un
  // webhook et la récupération concurrents ne peuvent pas envoyer deux fois.
  // En cas d'échec d'envoi, le claim est libéré pour qu'une invocation
  // ultérieure puisse retenter.
  let emailSent = false;
  if (finalizable.length > 0) {
    const user = await deps.getUserById(finalizable[0].user_id);
    if (user?.email) {
      const emailClaim = await deps.claimEmail(session.id);
      if (emailClaim.claimed) {
        const payload = buildPaidConfirmationEmailPayload({
          bookings: finalizable,
          user: { name: user.name, email: user.email, phone: user.phone },
          equipmentNames: deps.equipmentNames,
        });
        const sendResult = await deps.sendEmail(payload);
        if (sendResult.success) {
          // email_sent_at reste positionné (claim maintenu) → exactement un envoi.
          emailSent = true;
        } else {
          await deps.releaseEmailClaim(session.id, emailClaim.claimedAt);
        }
      }
    }
  }

  return { status: "finalized", paymentsAdded, cancelledSkipped: cancelled.length, emailSent };
}
