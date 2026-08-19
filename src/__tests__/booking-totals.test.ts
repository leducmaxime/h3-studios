import { describe, it, expect } from "vitest";
import {
  getBookingAmountDue,
  getBookingBalance,
  parseAmountInput,
  isBookingPast,
  getDisplayPaymentStatus,
  getDisplayPaymentStatusFromSummary,
  getTotalRefunded,
  getManualDiscountEligibility,
  getBookingOverpayment,
} from "@/lib/booking-totals";

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
  it("calculates overpayment from net collected payments", () => {
    expect(getBookingOverpayment(b({ promo_discount: 10 }), [{ amount: 50, status: "paid", refunded_amount: 0 }])).toBe(10);
    expect(getBookingOverpayment(b({ promo_discount: 10 }), [{ amount: 40, status: "paid", refunded_amount: 0 }])).toBe(0);
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
  it("returns full amount when no payments", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 10,
    };
    expect(getBookingBalance(booking, [])).toBe(50);
  });

  it("subtracts paid payments", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 0,
    };
    const payments = [
      { amount: 20, refunded_amount: 0, status: "paid" as const },
      { amount: 30, refunded_amount: 0, status: "paid" as const },
    ];
    expect(getBookingBalance(booking, payments)).toBe(10);
  });

  it("ignores non-paid payments (pending/refunded)", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 0,
    };
    const payments = [
      { amount: 20, refunded_amount: 0, status: "paid" as const },
      { amount: 15, refunded_amount: 0, status: "pending" as const },
      { amount: 10, refunded_amount: 10, status: "refunded" as const },
    ];
    expect(getBookingBalance(booking, payments)).toBe(40);
  });

  it("returns 0 when overpaid", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 0,
    };
    const payments = [
      { amount: 60, refunded_amount: 0, status: "paid" as const },
      { amount: 10, refunded_amount: 0, status: "paid" as const },
    ];
    expect(getBookingBalance(booking, payments)).toBe(0);
  });

  it("handles partial payment with discount", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 20,
    };
    const payments = [{ amount: 20, refunded_amount: 0, status: "paid" as const }];
    expect(getBookingBalance(booking, payments)).toBe(20);
  });

  it("accounts for refunded payments while preserving unchanged no-refund behavior", () => {
    const booking = {
      base_price: 50,
      equipment_price: 10,
      total_price: 60,
      promo_discount: 0,
    };
    const refundedPayments = [{ amount: 60, refunded_amount: 60, status: "refunded" as const }];
    const unchangedPayments = [{ amount: 60, refunded_amount: 0, status: "paid" as const }];
    expect(getBookingBalance(booking, refundedPayments)).toBe(60);
    expect(getBookingBalance(booking, unchangedPayments)).toBe(0);
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
  it("returns true for a date in the past", () => {
    const booking = { date: "2020-01-01", end_time: "12:00" };
    expect(isBookingPast(booking)).toBe(true);
  });

  it("returns false for a date in the future", () => {
    // Use a far-future date to avoid timezone flakiness
    const booking = { date: "2099-12-31", end_time: "12:00" };
    expect(isBookingPast(booking)).toBe(false);
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
    expect(getBookingBalance(booking, [])).toBe(3);
    expect(getBookingBalance(booking, [{ amount: 3, refunded_amount: 0, status: "paid" as const }])).toBe(0);
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
      [],
    );
    expect(status).toBe("cancelled");
  });

  it("cancelled + keep_balance_due + unpaid → Reste à payer", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      [],
    );
    expect(status).toBe("pay-on-site");
  });

  it("cancelled + keep_balance_due + later collected → Payé", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      [{ amount: 23, status: "paid" as const, refunded_amount: 0 }],
    );
    expect(status).toBe("paid");
  });

  it("cancelled + keep_balance_due + partial payment → Reste à payer", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site", keep_balance_due: 1 },
      [{ amount: 10, status: "paid" as const, refunded_amount: 0 }],
    );
    expect(status).toBe("pay-on-site");
  });

  it("cancelled + prior payment → Payée avant annulation", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      [{ amount: 10, status: "paid" as const, refunded_amount: 0 }],
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("cancelled + full refund recorded → Remboursé", () => {
    // Un paiement remboursé intégralement passe au statut 'refunded' (son
    // montant n'apparaît plus dans "paid"), mais il a bien été collecté.
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      [{ amount: 23, status: "refunded" as const, refunded_amount: 23 }],
    );
    expect(status).toBe("refunded");
  });

  it("cancelled + partial refund → Payée avant annulation (not refunded)", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      [
        { amount: 23, status: "partial-refund" as const, refunded_amount: 10 },
      ],
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("cancelled + partially refunded with still-paid remainder → Payée avant annulation", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "cancelled" as const, payment_status: "pay-on-site" },
      [
        { amount: 23, status: "paid" as const, refunded_amount: 0 },
        { amount: 23, status: "partial-refund" as const, refunded_amount: 10 },
      ],
    );
    expect(status).toBe("paid-before-cancel");
  });

  it("active paid booking → Payé", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "confirmed" as const, payment_status: "paid" },
      [{ amount: 23, status: "paid" as const, refunded_amount: 0 }],
    );
    expect(status).toBe("paid");
  });

  it("active pay-on-site booking → pay-on-site (orange due allowed)", () => {
    const status = getDisplayPaymentStatus(
      { ...base, status: "confirmed" as const, payment_status: "pay-on-site" },
      [],
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

// ─── Grand livre (payments) helpers ──────────────────────────────────────────

describe("getTotalRefunded", () => {
  const payments = [
    { amount: 20, status: "paid" as const, refunded_amount: 0 },
    { amount: 10, status: "paid" as const, refunded_amount: 0 },
    { amount: 5, status: "pending" as const, refunded_amount: 0 },
    { amount: 30, status: "partial-refund" as const, refunded_amount: 10 },
    { amount: 20, status: "refunded" as const, refunded_amount: 20 },
  ];

  it("sums refunded amounts from refunded/partial-refund records only", () => {
    expect(getTotalRefunded(payments)).toBe(30);
  });
});
