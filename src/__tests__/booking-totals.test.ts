import { describe, it, expect } from "vitest";
import {
  getBookingAmountDue,
  getBookingBalance,
  parseAmountInput,
  isBookingPast,
  getDisplayStatus,
  getDisplayPaymentStatus,
  getDisplayPaymentStatusFromSummary,
  getTotalCurrentlyPaid,
  getTotalCollected,
  getTotalRefunded,
  getManualDiscountEligibility,
  shouldShowDisplayPaymentStatus,
} from "@/lib/booking-totals";
import type { BookingLedgerSummary } from "@/lib/ledger";

const movement = (amount: number, status: "pending" | "settled" | "failed" = "settled") => ({
  id: `movement-${amount}-${status}`, amount, allocated: amount, status,
} as never);
const ledger = (balance: number, movements: unknown[] = []): BookingLedgerSummary => ({
  bookingId: "b1", due: balance, settled: 0, balance, refunded: 0, movements: movements as never,
});

describe("manual discounts", () => {
  const b = (extra = {}) => ({ status: "confirmed" as const, promo_code: null, base_price: 50, equipment_price: 0, total_price: 50, promo_discount: 0, ...extra });
  it("blocks cancelled bookings only", () => {
    expect(getManualDiscountEligibility(b({ status: "cancelled" }))).toEqual({ allowed: false, reason: "cancelled" });
  });
  it("allows unpaid and paid bookings, including those with a promo", () => {
    expect(getManualDiscountEligibility(b())).toEqual({ allowed: true });
    expect(getManualDiscountEligibility(b({ payment_status: "paid" }))).toEqual({ allowed: true });
    expect(getManualDiscountEligibility(b({ promo_code: "X", promo_discount: 10 }))).toEqual({ allowed: true });
  });
  it("calculates net collected amounts from signed ledger allocations", () => {
    const summary = ledger(0, [movement(50), movement(-40)]);
    expect(getTotalCurrentlyPaid(summary)).toBe(10);
    expect(getTotalCollected(summary)).toBe(50);
    expect(getTotalRefunded(summary)).toBe(40);
  });
  it("treats empty and null promo codes as eligible", () => {
    expect(getManualDiscountEligibility(b({ promo_code: "" }))).toEqual({ allowed: true });
    expect(getManualDiscountEligibility(b({ promo_code: null }))).toEqual({ allowed: true });
  });
});

// ─── getBookingAmountDue ─────────────────────────────────────────────────────

describe("getBookingAmountDue", () => {
  it("returns total_price when discount is 0", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 0,
    };
    expect(getBookingAmountDue(booking)).toBe(60);
  });

  it("subtracts discount (pre-remise 50%)", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 30, // 50% of 60
    };
    expect(getBookingAmountDue(booking)).toBe(30);
  });

  it("subtracts discount (pre-remise 100%)", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 60,
    };
    expect(getBookingAmountDue(booking)).toBe(0);
  });

  it("handles discount larger than total (clamped to 0)", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 99,
    };
    expect(getBookingAmountDue(booking)).toBe(0);
  });

  it("handles 0 total with 0 discount", () => {
    const booking = {
      base_price: 0,
      equipment_price: 0,
      total_price: 0,
      promo_discount: 0,
    };
    expect(getBookingAmountDue(booking)).toBe(0);
  });

  it("handles a former post-remise-shaped row (total already net)", () => {
    // A row where total_price is already net of discount (total = subtotal - discount).
    // With the simplified logic (no heuristic), due = max(0, total - discount).
    // If the row is truly post-remise, total = subtotal - discount, so
    // due = max(0, subtotal - discount - discount) = subtotal - 2*discount … but
    // the audit confirmed ZERO such rows exist on staging and production,
    // so this is purely a safety-net / documentation case.
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 42,    // net = 60 - 18 (already net of 30% discount)
      promo_discount: 18,
    };
    // Simplified logic: due = max(0, 42 - 18) = 24.
    // Correct net would be 42 (the total IS the due). But since zero rows
    // exist with this shape, we tolerate the simplification.
    expect(getBookingAmountDue(booking)).toBe(24);
  });

  it("handles the <1€ ambiguity window (small rounding)", () => {
    // total=60, discount=30.01 → due = max(0, 60 - 30.01) = 29.99
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 30.01,
    };
    const due = getBookingAmountDue(booking);
    expect(due).toBeCloseTo(29.99, 2);
  });

  it("works with string-typed numeric fields from JSON", () => {
    // D1 may return numbers as strings in some contexts
    const booking = {
      base_price: "50" as unknown as number,
      equipment_price: "10" as unknown as number,
      total_price: "60" as unknown as number,
      promo_discount: "15" as unknown as number,
    };
    expect(getBookingAmountDue(booking)).toBe(45);
  });
});

// ─── getBookingBalance ───────────────────────────────────────────────────────

describe("getBookingBalance", () => {
  it("returns the signed balance supplied by the ledger", () => {
    expect(getBookingBalance(ledger(50))).toBe(50);
    expect(getBookingBalance(ledger(10, [movement(50), movement(-40)]))).toBe(10);
  });

  it("preserves overpayment as a signed negative balance", () => {
    expect(getBookingBalance(ledger(-5, [movement(65)]))).toBe(-5);
  });

  it("includes settled negative movements and ignores pending ones", () => {
    const summary = ledger(40, [movement(20), movement(-10), movement(-5, "pending")]);
    expect(getBookingBalance(summary)).toBe(40);
    expect(getTotalCurrentlyPaid(summary)).toBe(10);
  });
});

// ─── parseAmountInput ────────────────────────────────────────────────────────

describe("parseAmountInput", () => {
  it("parses integer string", () => {
    expect(parseAmountInput("42")).toBe(42);
  });

  it("parses decimal with dot", () => {
    expect(parseAmountInput("42.50")).toBe(42.5);
  });

  it("parses decimal with comma", () => {
    expect(parseAmountInput("42,50")).toBe(42.5);
  });

  it("parses amount with spaces", () => {
    expect(parseAmountInput("1 234,56")).toBe(1234.56);
  });

  it("returns NaN for invalid input", () => {
    expect(Number.isNaN(parseAmountInput("abc"))).toBe(true);
  });

  it("returns NaN for empty string", () => {
    expect(Number.isNaN(parseAmountInput(""))).toBe(true);
  });
});

// ─── isBookingPast ───────────────────────────────────────────────────────────

describe("isBookingPast", () => {
  const NOW = { dateISO: "2026-08-25", hours: 20, minutes: 51 };
  const LATE = { dateISO: "2026-08-25", hours: 23, minutes: 30 };

  it("returns true for a date in the past", () => {
    const booking = { date: "2020-01-01", end_time: "12:00" };
    expect(isBookingPast(booking)).toBe(true);
  });

  it("returns false for a date in the future", () => {
    // Use a far-future date to avoid timezone flakiness
    const booking = { date: "2099-12-31", end_time: "12:00" };
    expect(isBookingPast(booking)).toBe(false);
  });

  it("treats end_time 00:00 as end of day, not midnight this morning", () => {
    const midnight = { date: "2026-08-25", end_time: "00:00" };
    expect(isBookingPast(midnight, NOW)).toBe(false);
    expect(isBookingPast(midnight, LATE)).toBe(false);
    expect(isBookingPast(midnight, { dateISO: "2026-08-26", hours: 0, minutes: 0 })).toBe(true);
  });

  it("marks a same-day session past once its end time is reached", () => {
    expect(isBookingPast({ date: "2026-08-25", end_time: "17:00" }, NOW)).toBe(true);
    expect(isBookingPast({ date: "2026-08-25", end_time: "22:00" }, NOW)).toBe(false);
    expect(isBookingPast({ date: "2026-08-25", end_time: "20:51" }, NOW)).toBe(true);
  });

  it("keeps a midnight session confirmed until the day actually ends", () => {
    const booking = { status: "confirmed" as const, date: "2026-08-25", end_time: "00:00" };
    expect(getDisplayStatus(booking, NOW)).toBe("confirmed");
    expect(getDisplayStatus(booking, { dateISO: "2026-08-26", hours: 0, minutes: 1 })).toBe("completed");
  });
});

// ─── Total invariant : 23€ brut − 20€ remise = 3€ dû ─────────────────────────

describe("total invariant (23€ gross / 20€ discount)", () => {
  const booking = {
    base_price: 23,
    equipment_price: 0,
    total_price: 23, // convention : total_price = base + equipment (brut)
    promo_discount: 20,
  };

  it("never lets the client-derived net total double the deduction", () => {
    // The stored gross is 23. Due = max(0, gross − discount) = 3.
    expect(getBookingAmountDue(booking)).toBe(3);
  });

  it("keeps balance consistent with the single 3€ due", () => {
    expect(getBookingBalance(ledger(3))).toBe(3);
    expect(getBookingBalance(ledger(0, [movement(3)]))).toBe(0);
  });
});

// ─── Statut d'affichage du paiement / annulations ────────────────────────────

describe("getDisplayPaymentStatus", () => {
  const base = {
    base_price: 23,
    equipment_price: 0,
    total_price: 23,
    promo_discount: 0,
  };

  it("cancelled + unpaid (pay-on-site) → Annulée, never an amount due", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      ledger(23),
    );
    expect(status).toBe("cancelled");
  });

  it("cancelled + keep_balance_due + unpaid → Reste à payer", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      ledger(23),
    );
    expect(status).toBe("pay-on-site");
  });

  it("cancelled + keep_balance_due + later collected → Payé", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      ledger(0, [movement(23)]),
    );
    expect(status).toBe("paid");
  });

  it("cancelled + keep_balance_due + partial payment → Reste à payer", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      ledger(13, [movement(10)]),
    );
    expect(status).toBe("pay-on-site");
  });

  it("cancelled + prior payment → Payée avant annulation", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      ledger(13, [movement(10)]),
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("cancelled + full refund recorded → Remboursé", () => {
    // Un paiement remboursé intégralement passe au statut 'refunded' (son
    // montant n'apparaît plus dans "paid"), mais il a bien été collecté.
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      ledger(23, [movement(23), movement(-23)]),
    );
    expect(status).toBe("refunded");
  });

  it("cancelled + partial refund → Payée avant annulation (not refunded)", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      ledger(10, [movement(23), movement(-10)]),
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("cancelled + partially refunded with still-paid remainder → Payée avant annulation", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      ledger(13, [movement(23), movement(-10)]),
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("active paid booking → Payé", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "confirmed" as const, payment_status: "paid" },
      ledger(0, [movement(23)]),
    );
    expect(status).toBe("paid");
  });

  it("active pay-on-site booking → pay-on-site (orange due allowed)", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "confirmed" as const, payment_status: "pay-on-site" },
      ledger(23),
    );
    expect(status).toBe("pay-on-site");
  });
});

describe("getDisplayPaymentStatusFromSummary (list enrichment)", () => {
  it("maps server-side totals identically to the payments array variant", () => {
    expect(getDisplayPaymentStatusFromSummary("cancelled", "pay-on-site", 0, 0)).toBe("cancelled");
    expect(getDisplayPaymentStatusFromSummary("cancelled", "paid", 23, 0)).toBe("paid-before-cancel");
    expect(getDisplayPaymentStatusFromSummary("cancelled", "paid", 23, 23)).toBe("refunded");
    expect(getDisplayPaymentStatusFromSummary("confirmed", "paid", 23, 0)).toBe("paid");
    expect(getDisplayPaymentStatusFromSummary("confirmed", "pay-on-site", 0, 0)).toBe("pay-on-site");
    expect(getDisplayPaymentStatusFromSummary("cancelled", "pay-on-site", 0, 0, { keepBalanceDue: true, remaining: 103 })).toBe("pay-on-site");
    expect(getDisplayPaymentStatusFromSummary("cancelled", "pay-on-site", 103, 0, { keepBalanceDue: true, remaining: 0 })).toBe("paid");
    expect(getDisplayPaymentStatusFromSummary("cancelled", "pay-on-site", 0, 0, { keepBalanceDue: false, remaining: 103 })).toBe("cancelled");
  });
});

describe("shouldShowDisplayPaymentStatus", () => {
  it("shows all payment statuses except a plain cancellation", () => {
    expect(shouldShowDisplayPaymentStatus("paid")).toBe(true);
    expect(shouldShowDisplayPaymentStatus("pending")).toBe(true);
    expect(shouldShowDisplayPaymentStatus("pay-on-site")).toBe(true);
    expect(shouldShowDisplayPaymentStatus("paid-before-cancel")).toBe(true);
    expect(shouldShowDisplayPaymentStatus("refunded")).toBe(true);
    expect(shouldShowDisplayPaymentStatus("cancelled")).toBe(false);
  });
});

// ─── Grand livre (payments) helpers ──────────────────────────────────────────

describe("getTotalRefunded", () => {
  const payments = [
    movement(20), movement(10), movement(5, "pending"), movement(-10), movement(-20),
  ];

  it("sums absolute settled negative movements only", () => {
    expect(getTotalRefunded(ledger(5, payments))).toBe(30);
  });
});
