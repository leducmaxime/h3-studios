import type { BookingQuote } from "./booking";
import { getBookingGrossTotal, round2 } from "./booking-totals";
import type { BookingLedgerSummary } from "./ledger";

type BookingAmounts = {
  base_price: number;
  equipment_price: number;
  total_price: number;
  promo_discount?: number | null;
};

/**
 * Converts the server quote into the only amounts a reschedule may persist.
 * `null` means the quote itself refused the range; callers must not write it.
 */
export function deriveRescheduledAmounts(
  existing: BookingAmounts,
  quote: BookingQuote,
): { base_price: number; equipment_price: number; total_price: number; capped_promo_discount: number } | null {
  if (quote.halfHours <= 0 || quote.slotBreakdown.length === 0) return null;
  const total_price = getBookingGrossTotal({
    base_price: quote.basePrice,
    equipment_price: quote.equipmentPrice,
  });
  return {
    base_price: quote.basePrice,
    equipment_price: quote.equipmentPrice,
    total_price,
    capped_promo_discount: Math.max(0, Math.min(Number(existing.promo_discount) || 0, total_price)),
  };
}

export function buildRescheduleAmountAudit(oldAmounts: BookingAmounts, newAmounts: BookingAmounts) {
  return {
    old: {
      base_price: oldAmounts.base_price,
      equipment_price: oldAmounts.equipment_price,
      total_price: oldAmounts.total_price,
      promo_discount: oldAmounts.promo_discount ?? 0,
    },
    new: {
      base_price: newAmounts.base_price,
      equipment_price: newAmounts.equipment_price,
      total_price: newAmounts.total_price,
      promo_discount: newAmounts.promo_discount ?? 0,
    },
  };
}

/**
 * A reschedule never creates a Stripe refund: a card overpayment is proposed to
 * an operator, who can use the existing partial-refund endpoint after review.
 */
export function getOperatorProposedRescheduleRefund(
  ledger: Pick<BookingLedgerSummary, "balance" | "movements">,
): { amount: number; mode: "operator-proposed" } | null {
  if (!ledger.movements.some((movement) => movement.method === "card")) return null;
  // Le solde du grand livre est signé : négatif = sur-appliqué, donc trop-perçu.
  // `ledger.due` reflète déjà les montants de la réservation reprogrammée,
  // il n'y a rien à recalculer côté appelant.
  const amount = round2(Math.max(0, -ledger.balance));
  return amount > 0 ? { amount, mode: "operator-proposed" } : null;
}
