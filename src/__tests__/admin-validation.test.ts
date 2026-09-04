import { describe, expect, it } from "vitest";
import { isValidEmail, isPlausiblePhone } from "../lib/booking-fields";
import { isValidPricingCents } from "../lib/db";
import { MAX_PRICING_CENTS } from "../lib/pricing";

describe("admin contact validation", () => {
  it("accepts valid email addresses", () => {
    expect(isValidEmail("client@example.fr")).toBe(true);
    expect(isValidEmail(" prenom.nom+studio@example.com ")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("client@")).toBe(false);
    expect(isValidEmail("@example.fr")).toBe(false);
  });

  it("accepts French phone formats", () => {
    expect(isPlausiblePhone("0612345678")).toBe(true);
    expect(isPlausiblePhone("+33612345678")).toBe(true);
    expect(isPlausiblePhone("06 12 34 56 78")).toBe(true);
    expect(isPlausiblePhone("06.12.34.56.78")).toBe(true);
  });

  it("rejects invalid French phone values", () => {
    expect(isPlausiblePhone("123")).toBe(false);
    expect(isPlausiblePhone("")).toBe(false);
    expect(isPlausiblePhone("letters")).toBe(false);
  });
});

describe("pricing numeric guard", () => {
  it("accepts the inclusive cent bounds", () => {
    expect(isValidPricingCents(0)).toBe(true);
    expect(isValidPricingCents(MAX_PRICING_CENTS)).toBe(true);
  });

  it("rejects negative, fractional, non-finite and excessive values", () => {
    expect(isValidPricingCents(-1)).toBe(false);
    expect(isValidPricingCents(12.5)).toBe(false);
    expect(isValidPricingCents(Number.NaN)).toBe(false);
    expect(isValidPricingCents(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidPricingCents(MAX_PRICING_CENTS + 1)).toBe(false);
  });
});
