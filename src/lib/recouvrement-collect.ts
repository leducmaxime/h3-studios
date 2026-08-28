import { round2 } from "./booking-totals";

export type CollectMethod = "cash" | "card" | "transfer" | "check";

export interface CollectPaymentInput {
  amount: number;
  method: CollectMethod;
}

export interface CollectBookingInput {
  id: string;
  remaining: number;
}

export interface CollectAllocation {
  bookingId: string;
  amount: number;
  method: CollectMethod;
}

const VALID_METHODS = new Set<CollectMethod>(["cash", "card", "transfer", "check"]);

export function isCollectMethod(value: string): value is CollectMethod {
  return VALID_METHODS.has(value as CollectMethod);
}

export function sumAmounts(items: { amount: number }[]): number {
  return round2(items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0));
}

export function amountsMatch(left: number, right: number): boolean {
  return Math.abs(round2(left) - round2(right)) <= 0.005;
}

/**
 * Répartit des encaissements (méthodes + montants) sur les réservations,
 * plus anciennes d'abord. Chaque réservation est soldée avant de passer à la suivante.
 */
export function allocateCollectPayments(
  bookings: CollectBookingInput[],
  payments: CollectPaymentInput[],
): CollectAllocation[] | { error: string } {
  const due = bookings
    .map((booking) => ({ id: booking.id, remaining: round2(booking.remaining) }))
    .filter((booking) => booking.remaining > 0.005);
  const entries = payments
    .map((payment) => ({ method: payment.method, amount: round2(payment.amount) }))
    .filter((payment) => payment.amount > 0);

  if (due.length === 0) return { error: "Aucune réservation à encaisser" };
  if (entries.length === 0) return { error: "Ajoutez au moins un paiement" };

  const allocations: CollectAllocation[] = [];
  let paymentIndex = 0;
  let paymentLeft = entries[0]?.amount ?? 0;

  for (const booking of due) {
    let left = booking.remaining;
    while (left > 0.005 && paymentIndex < entries.length) {
      while (paymentLeft <= 0.005) {
        paymentIndex += 1;
        if (paymentIndex >= entries.length) break;
        paymentLeft = entries[paymentIndex].amount;
      }
      if (paymentIndex >= entries.length) break;
      const amount = round2(Math.min(left, paymentLeft));
      if (amount <= 0) break;
      allocations.push({
        bookingId: booking.id,
        amount,
        method: entries[paymentIndex].method,
      });
      left = round2(left - amount);
      paymentLeft = round2(paymentLeft - amount);
    }
  }

  return allocations;
}
