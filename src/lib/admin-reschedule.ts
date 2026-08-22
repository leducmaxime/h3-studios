import type { BookingQuote } from "./booking";
import { getBookingGrossTotal, getBookingOverpayment } from "./booking-totals";
import type { DbPayment } from "./db-types";

type BookingAmounts = {
  base_price: number;
  equipment_price: number;
  total_price: number;
  promo_discount?: number | null;
};

type PaymentForProposal = {
  amount: number;
  status: DbPayment["status"];
  refunded_amount: number;
  method: string;
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
  booking: BookingAmounts,
  payments: PaymentForProposal[],
): { amount: number; mode: "operator-proposed" } | null {
  if (!payments.some((payment) => payment.method === "card")) return null;
  const amount = getBookingOverpayment({ ...booking, promo_discount: Number(booking.promo_discount) || 0 }, payments);
  return amount > 0 ? { amount, mode: "operator-proposed" } : null;
}
