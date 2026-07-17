import type { DbBooking, DbPayment } from "./db-types";

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
  payments: Pick<DbPayment, "amount" | "status">[],
): number {
  const amountDue = getBookingAmountDue(booking);
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  return Math.max(0, amountDue - totalPaid);
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
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
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
