import { describe, expect, it } from "vitest";
import {
  computeLoyaltyDiscount,
  getLoyaltyProgress,
  isLoyaltyConfigured,
  readLoyaltyConfig,
  resolveDiscount,
  validateLoyaltySettings,
} from "@/lib/loyalty";

const config = (threshold = 3) => ({ enabled: true as const, type: "fixed" as const, value: 10, threshold });

describe("fidélité — logique pure", () => {
  it("threshold = 0 / enabled = 0 / value = 0 : non configuré, aucun avantage", () => {
    const c = readLoyaltyConfig({ loyalty_enabled: 0, loyalty_discount_type: "fixed", loyalty_discount_value: 0, loyalty_threshold: 0 });
    expect(isLoyaltyConfigured(c)).toBe(false);
    expect(getLoyaltyProgress(c, 20, 0)).toMatchObject({ configured: false, counter: 0, isDue: false });
    expect(computeLoyaltyDiscount(c, 50)).toBe(0);
  });

  it("annulation d'une réservation ayant consommé une remise : compteur restauré et remise à nouveau due", () => {
    expect(getLoyaltyProgress(config(3), 3, 0).isDue).toBe(true);
    expect(getLoyaltyProgress(config(3), 2, 0)).toMatchObject({ counter: 2, isDue: false });
    expect(getLoyaltyProgress(config(3), 3, 0).isDue).toBe(true);
  });

  it("un no-show ne doit pas être compté et une remise consommée reste consommée", () => {
    expect(getLoyaltyProgress(config(3), 3, 1)).toMatchObject({ awardsGranted: 1, counter: 0, isDue: false });
  });

  it("annulations rétroactives : compteur jamais négatif et remise non due", () => {
    expect(getLoyaltyProgress(config(3), 2, 1)).toMatchObject({ counter: 0, isDue: false });
  });

  it("seuil relevé ne révoque pas une remise, seuil abaissé la rend immédiatement due", () => {
    expect(getLoyaltyProgress(config(4), 3, 1)).toMatchObject({ counter: 0, isDue: false });
    expect(getLoyaltyProgress(config(2), 5, 1)).toMatchObject({ counter: 3, isDue: true });
  });

  it("priorités strictes manual > promo > loyalty : les trois combinaisons", () => {
    expect(resolveDiscount({ manual: 5, promo: 4, loyalty: 3 }, 20)).toEqual({ source: "manual", amount: 5 });
    expect(resolveDiscount({ promo: 4, loyalty: 3 }, 20)).toEqual({ source: "promo", amount: 4 });
    expect(resolveDiscount({ loyalty: 3 }, 20)).toEqual({ source: "loyalty", amount: 3 });
  });

  it("récurrence : award à X, compteur à zéro, second award dû à 2X", () => {
    expect(getLoyaltyProgress(config(3), 3, 0)).toMatchObject({ earnedAwards: 1, counter: 3, isDue: true });
    expect(getLoyaltyProgress(config(3), 3, 1)).toMatchObject({ earnedAwards: 1, counter: 0, isDue: false });
    expect(getLoyaltyProgress(config(3), 6, 1)).toMatchObject({ earnedAwards: 2, counter: 3, isDue: true });
  });

  it("calcule les remises fixe et pourcentage, plafonnées et arrondies", () => {
    expect(computeLoyaltyDiscount({ ...config(), type: "percentage", value: 12.345 }, 81)).toBe(10);
    expect(computeLoyaltyDiscount({ ...config(), type: "fixed", value: 99 }, 20)).toBe(20);
  });

  it("valide les réglages administrateur en français", () => {
    expect(validateLoyaltySettings({ loyalty_enabled: true, loyalty_discount_type: "fixed", loyalty_discount_value: 10, loyalty_threshold: 3 })).toMatchObject({ ok: true });
    expect(validateLoyaltySettings({ loyalty_enabled: true, loyalty_discount_type: null, loyalty_discount_value: 0, loyalty_threshold: 0 })).toMatchObject({ ok: false });
  });
});
