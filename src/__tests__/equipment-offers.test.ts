import { describe, expect, it } from "vitest";
import {
  formatSessionPricingPreview,
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
    expect(formatSessionPricingPreview([3, 5, 6, 6], 4)).toBe("1× = 3€, 2× = 5€, 3× = 6€, 4× = 6€ (4e offert)");
    expect(offeredUnitsSuffix([4, 5])).toBe("4e et 5e offerts");
    expect(ordinalFr(1)).toBe("1er");
  });
});
