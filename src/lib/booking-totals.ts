import type { DbBooking, DbPayment } from "./db-types";

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
// Dérivé du statut DB + du grand livre (payments) — aucune migration, aucun
// nouveau champ persisté. Convention : une réservation annulée ne présente
// jamais de montant dû ; "Remboursé" n'apparaît qu'après un remboursement
// intégral réellement enregistré.

export type DisplayPaymentStatus =
  | "paid"
  | "pending"
  | "pay-on-site"
  | "cancelled"
  | "paid-before-cancel"
  | "refunded";

export const PAYMENT_STATUS_LABELS: Record<DisplayPaymentStatus, string> = {
  paid: "Payé",
  pending: "En attente",
  "pay-on-site": "Reste à payer",
  cancelled: "Annulée",
  "paid-before-cancel": "Payée avant annulation",
  refunded: "Remboursé",
};

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

/**
 * Statut de paiement pour l'affichage, à partir du grand livre complet.
 * Les réservations annulées ne présentent jamais de montant dû.
 */
export function getDisplayPaymentStatus(
  booking: Pick<DbBooking, "status" | "payment_status">,
  payments: Pick<DbPayment, "amount" | "status" | "refunded_amount">[],
): DisplayPaymentStatus {
  return getDisplayPaymentStatusFromSummary(
    booking.status,
    booking.payment_status,
    getTotalCollected(payments),
    getTotalRefunded(payments),
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
): DisplayPaymentStatus {
  if (bookingStatus === "cancelled") {
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
