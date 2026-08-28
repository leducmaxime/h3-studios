import { describe, expect, it } from "vitest";
import {
  addDaysToDateISO,
  generateLoyaltyCode,
  validateLoyaltySettings,
} from "@/lib/loyalty";

describe("fidélité — logique pure", () => {
  it("valide la durée de validité du code", () => {
    expect(validateLoyaltySettings({ loyalty_enabled: true, loyalty_discount_type: "fixed", loyalty_discount_value: 10, loyalty_threshold: 3, loyalty_code_validity_days: 60 })).toMatchObject({ ok: true });
    expect(validateLoyaltySettings({ loyalty_enabled: true, loyalty_discount_type: "fixed", loyalty_discount_value: 10, loyalty_threshold: 3, loyalty_code_validity_days: 0 })).toMatchObject({ ok: false });
  });

  it("génère des codes Crockford et ajoute des jours calendaires", () => {
    expect(generateLoyaltyCode()).toMatch(/^FID-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(addDaysToDateISO("2026-12-31", 60)).toBe("2027-03-01");
  });
});
