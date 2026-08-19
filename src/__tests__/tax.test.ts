import { describe, it, expect } from "vitest";
import {
  VAT_RATE,
  VAT_PERCENT,
  ttcToHt,
  vatFromTtc,
  splitTtc,
  formatEuro,
  formatPrice,
  formatTaxBreakdown,
} from "../lib/tax";

describe("TVA 20%", () => {
  it("uses the standard French rate", () => {
    expect(VAT_RATE).toBe(0.2);
    expect(VAT_PERCENT).toBe(20);
  });

  it("splits a round TTC amount so HT + TVA = TTC", () => {
    expect(ttcToHt(24)).toBe(20);
    expect(vatFromTtc(24)).toBe(4);
    expect(splitTtc(24)).toEqual({ ht: 20, vat: 4, ttc: 24 });
  });

  it("keeps HT + TVA equal to TTC after rounding", () => {
    const cases = [6, 12, 15, 18, 22, 45, 10.5, 12.75, 0, 3];
    for (const ttc of cases) {
      const { ht, vat } = splitTtc(ttc);
      expect(Math.round((ht + vat) * 100)).toBe(Math.round(ttc * 100));
    }
  });

  it("formats the legal breakdown", () => {
    expect(formatEuro(20)).toBe("20€");
    expect(formatEuro(7.5)).toBe("7,50€");
    expect(formatPrice(24)).toBe("24€ TTC");
    expect(formatTaxBreakdown(24)).toEqual({
      ht: "20€",
      vat: "4€",
      ttc: "24€ TTC",
    });
  });
});
