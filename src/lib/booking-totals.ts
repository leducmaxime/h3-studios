import type { DbBooking, DbPayment } from "./db-types";

/**
 * Retourne le montant réellement dû pour une réservation.
 *
 * Gère les deux conventions de stockage de total_price :
 * - Post-remise (réservations publiques) : total_price est déjà net de remise
 * - Pré-remise (réservations admin) : total_price = base + equipment, remise à soustraire
 *
 * Détection automatique par équation mathématique (sans colonne source).
 */
export function getBookingAmountDue(
  booking: Pick<DbBooking, "base_price" | "equipment_price" | "total_price" | "promo_discount">,
): number {
  const base = Number(booking.base_price) || 0;
  const equip = Number(booking.equipment_price) || 0;
  const total = Number(booking.total_price) || 0;
  const discount = Number(booking.promo_discount) || 0;

  if (discount === 0) return Math.max(0, total);

  const subtotal = base + equip;
  const isPostRemise = Math.abs(total + discount - subtotal) < 1; // tolérance 1 centime
  const isPreRemise = Math.abs(total - subtotal) < 1;

  if (isPostRemise && !isPreRemise) {
    // Convention post-remise : total_price est déjà net
    return Math.max(0, total);
  }
  // Convention pré-remise (ou ambiguë) : soustraire la remise
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
