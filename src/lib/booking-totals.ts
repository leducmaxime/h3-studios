import type { DbBooking, DbPayment } from "./db-types";

export type PromoRoundMode = "down" | "up" | "none";
export type ManualDiscountBlockReason = "cancelled" | "promo_code";
export function getManualDiscountEligibility(
  booking: { status?: string | null; promo_code?: string | null },
): { allowed: true } | { allowed: false; reason: ManualDiscountBlockReason } {
  if (booking.status === "cancelled") return { allowed: false, reason: "cancelled" };
  if (typeof booking.promo_code === "string" && booking.promo_code.trim() !== "") return { allowed: false, reason: "promo_code" };
  return { allowed: true };
}
export function getManualDiscountBlockMessage(reason: ManualDiscountBlockReason): string {
  return reason === "cancelled" ? "Impossible d'appliquer une remise sur une réservation annulée" : "Remise manuelle indisponible : un code promo est déjà appliqué";
}

/** Apply the configured rounding rule to a promo discount. */
export function applyDiscountRounding(discount: number, mode: PromoRoundMode): number {
  if (!Number.isFinite(discount) || discount < 0) return 0;
  if (mode === "none") return discount;

  if (mode === "down") {
    const euros = Math.floor(discount);
    const cents = Math.round((discount - euros) * 100);

    if (cents < 25) return euros;
    if (cents < 75) return euros + 0.5;
    return euros + 1;
  }

  const cents = Math.round(discount * 100);
  return Math.ceil(cents / 50) * 50 / 100;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Retourne le montant réellement dû pour une réservation.
 *
 * Convention de stockage (pré-remise) :
 *   total_price = base_price + equipment_price  (montant brut)
 *   promo_discount = réduction à soustraire
 *
 * Toutes les réservations suivent cette convention depuis l'audit
 * de données (Phase 7B) qui a confirmé zéro ligne post-remise.
 */
export function getBookingAmountDue(
  booking: Pick<DbBooking, "base_price" | "equipment_price" | "total_price" | "promo_discount">,
): number {
  const total = Number(booking.total_price) || 0;
  const discount = Number(booking.promo_discount) || 0;
  return Math.max(0, total - discount);
}

/**
 * Retourne le solde restant à payer.
 */
export function getBookingBalance(
  booking: Pick<DbBooking, "base_price" | "equipment_price" | "total_price" | "promo_discount">,
  payments: Pick<DbPayment, "amount" | "status" | "refunded_amount">[],
): number {
  const amountDue = getBookingAmountDue(booking);
  const totalCollected = payments
    .filter((p) => p.status === "paid" || p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalRefunded = payments
    .filter((p) => p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.refunded_amount) || 0), 0);
  return Math.max(0, amountDue - totalCollected + totalRefunded);
}
export function getBookingOverpayment(booking: Pick<DbBooking, "base_price" | "equipment_price" | "total_price" | "promo_discount">, payments: Pick<DbPayment, "amount" | "status" | "refunded_amount">[]): number {
  return Math.max(0, getTotalCollected(payments) - getTotalRefunded(payments) - getBookingAmountDue(booking));
}

/**
 * Retourne true si la réservation est dans le passé (heure Paris).
 */
export function isBookingPast(booking: Pick<DbBooking, "date" | "end_time">): boolean {
  const parisNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const bookingEnd = new Date(`${booking.date}T${booking.end_time}:00`);
  return bookingEnd < parisNow;
}

/**
 * Parse une saisie de montant (virgule ou point comme séparateur décimal).
 * Retourne NaN si invalide.
 */
export function parseAmountInput(value: string): number {
  const n = parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? round2(n) : NaN;
}

/**
 * Retourne le statut d'affichage d'une réservation.
 * Le statut DB reste 'confirmed' après la fin du créneau —
 * ce helper calcule le statut visuel sans modifier la DB.
 */
export function getDisplayStatus(booking: Pick<DbBooking, "status" | "date" | "end_time">): string {
  if (booking.status !== "confirmed") return booking.status;
  if (isBookingPast(booking)) return "completed";
  return "confirmed";
}

// ─── Statut d'affichage du paiement ───────────────────────────────────────────
// Dérivé du statut DB + du grand livre (payments) + keep_balance_due.
// Par défaut une réservation annulée ne présente pas de montant dû.
// Exception : keep_balance_due = 1 (« Sans remboursement › Paiement dû »).
// "Remboursé" n'apparaît qu'après un remboursement intégral réellement enregistré.

/** INTEGER 0/1 (D1) ou booléen — vrai si l'annulation conserve le solde dû. */
export function isKeepBalanceDue(
  booking: { keep_balance_due?: number | boolean | null },
): boolean {
  return booking.keep_balance_due === 1 || booking.keep_balance_due === true;
}

/** Encaissement autorisé : résa active, ou annulée avec solde volontairement conservé. */
export function bookingAllowsCollection(
  booking: { status?: string | null; keep_balance_due?: number | boolean | null },
): boolean {
  if (booking.status !== "cancelled") return true;
  return isKeepBalanceDue(booking);
}

export type DisplayPaymentStatus =
  | "paid"
  | "pending"
  | "pay-on-site"
  | "cancelled"
  | "paid-before-cancel"
  | "refunded";

/** Somme des paiements réellement encaissés (status 'paid'). */
export function getTotalCurrentlyPaid(payments: Pick<DbPayment, "amount" | "status">[]): number {
  return payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

/**
 * Somme des montants réellement encaissés à un moment donné (paid, refunded
 * ou partial-refund). Un paiement remboursé change de statut ('refunded' /
 * 'partial-refund') : son montant disparaît donc de `getTotalPaid`, mais il a
 * bien été collecté à un moment — c'est ce total qu'il faut comparer aux
 * remboursements pour présenter "Remboursé" vs "Payée avant annulation".
 */
export function getTotalCollected(payments: Pick<DbPayment, "amount" | "status">[]): number {
  return payments
    .filter((p) => p.status === "paid" || p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

/** Somme des montants réellement remboursés (status 'refunded' / 'partial-refund'). */
export function getTotalRefunded(payments: Pick<DbPayment, "status" | "refunded_amount">[]): number {
  return payments
    .filter((p) => p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.refunded_amount) || 0), 0);
}

export type DisplayPaymentStatusOptions = {
  keepBalanceDue?: boolean;
  remaining?: number;
};

/**
 * Statut de paiement pour l'affichage, à partir du grand livre complet.
 * Une annulation avec keep_balance_due conserve le solde (pay-on-site / paid).
 */
export function getDisplayPaymentStatus(
  booking: Pick<DbBooking, "status" | "payment_status"> &
    Partial<Pick<DbBooking, "keep_balance_due" | "base_price" | "equipment_price" | "total_price" | "promo_discount">>,
  payments: Pick<DbPayment, "amount" | "status" | "refunded_amount">[],
): DisplayPaymentStatus {
  const hasTotals =
    booking.total_price != null || booking.base_price != null || booking.promo_discount != null;
  return getDisplayPaymentStatusFromSummary(
    booking.status,
    booking.payment_status,
    getTotalCollected(payments),
    getTotalRefunded(payments),
    {
      keepBalanceDue: isKeepBalanceDue(booking),
      remaining: hasTotals
        ? getBookingBalance(
            {
              base_price: booking.base_price ?? 0,
              equipment_price: booking.equipment_price ?? 0,
              total_price: booking.total_price ?? 0,
              promo_discount: booking.promo_discount ?? 0,
            },
            payments,
          )
        : 0,
    },
  );
}

/**
 * Variante résumé (liste enrichie) : prend les totaux du grand livre déjà
 * calculés côté serveur au lieu de la liste complète des paiements.
 * `totalCollected` = montants encaissés à un moment donné (paid + refunded +
 * partial-refund), `totalRefunded` = remboursements réellement enregistrés.
 */
export function getDisplayPaymentStatusFromSummary(
  bookingStatus: string | null | undefined,
  paymentStatus: string | null | undefined,
  totalCollected: number,
  totalRefunded: number,
  options?: DisplayPaymentStatusOptions,
): DisplayPaymentStatus {
  if (bookingStatus === "cancelled") {
    if (options?.keepBalanceDue) {
      if ((options.remaining ?? 0) > 0.005) return "pay-on-site";
      if (totalCollected > 0) return "paid";
    }
    if (totalCollected > 0) {
      // Grand livre factuel : remboursé uniquement après remboursement intégral enregistré.
      return totalRefunded >= totalCollected - 0.005 ? "refunded" : "paid-before-cancel";
    }
    return "cancelled";
  }
  if (paymentStatus === "paid") return "paid";
  if (paymentStatus === "pending") return "pending";
  return "pay-on-site";
}

/**
 * Montant brut conventionnellement persisté : total_price = base + équipement.
 * Tout appelant qui construit un montant "net" doit passer par ce helper.
 */
export function getBookingGrossTotal(
  booking: Pick<DbBooking, "base_price" | "equipment_price">,
): number {
  return (Number(booking.base_price) || 0) + (Number(booking.equipment_price) || 0);
}
