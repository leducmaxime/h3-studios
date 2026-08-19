import { describe, expect, it } from "vitest";
import {
  formatSessionPricingPreview,
  formatSessionPriceDisplay,
  getOfferedUnits,
  isDegressiveSessionPricing,
  isQuantityOffered,
  ordinalFr,
  offeredUnitsSuffix,
  priceAtQuantity,
} from "@/lib/equipment-pricing";

describe("equipment pricing offers", () => {
  it("détecte les unités offertes, y compris hors tableau", () => {
    expect(priceAtQuantity([3], 2)).toBe(0);
    expect(isQuantityOffered([3], 2)).toBe(true);
    expect(isQuantityOffered([0], 1)).toBe(true);
    expect(getOfferedUnits([3, 5, 6, 6, 6], 5)).toEqual([4, 5]);
  });

  it("sépare les tarifs dégressifs des cadeaux", () => {
    expect(isDegressiveSessionPricing([])).toBe(false);
    expect(isDegressiveSessionPricing([3])).toBe(false);
    expect(isDegressiveSessionPricing([3, 5])).toBe(true);
    expect(isDegressiveSessionPricing([3, 6, 9])).toBe(false);
    expect(isDegressiveSessionPricing([3, 5, 6, 6])).toBe(true);
  });

  it("formate les aperçus exactement", () => {
    expect(formatSessionPricingPreview([3, 5, 6, 6], 4)).toBe("1× = 3€ TTC, 2× = 5€ TTC, 3× = 6€ TTC, 4× = 6€ TTC (4e unité offerte)");
    expect(offeredUnitsSuffix([4, 5])).toBe("4e et 5e unités offertes");
    expect(ordinalFr(1)).toBe("1er");
  });

  it("formate les lignes de prix publiques et administratives", () => {
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3], pricePerHour: 0 }, 0, 0)).toBe("3€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3], pricePerHour: 0 }, 1, 3)).toBe("3€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 5, 6, 6], pricePerHour: 2 }, 0, 0)).toBe("3€ TTC/séance (dégressif)");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 5, 6, 6], pricePerHour: 2 }, 4, 6)).toBe("6€ TTC/séance (dégressif)");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 6, 9], pricePerHour: 0 }, 0, 0)).toBe("3€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 6, 9], pricePerHour: 0 }, 3, 9)).toBe("9€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 6], pricePerHour: 0 }, 0, 0)).toBe("3€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: [3, 6], pricePerHour: 0 }, 2, 6)).toBe("6€ TTC/séance");
    expect(formatSessionPriceDisplay({ pricingType: "hourly", sessionPricing: [3], pricePerHour: 2 }, 1, 3)).toBe("+2€ TTC/h");
    expect(formatSessionPriceDisplay({ pricingType: "session", sessionPricing: null, pricePerHour: 2 }, 1, 0)).toBe("+2€ TTC/h");
  });
});
