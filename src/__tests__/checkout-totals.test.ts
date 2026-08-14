import { describe, expect, it } from "vitest";
import { calculateEquipmentPrice } from "@/lib/booking";
import { calculatePrice, type PricingGrid } from "@/lib/pricing";
import { applyDiscountRounding, round2 } from "@/lib/booking-totals";

describe("checkout totals", () => {
  it("includes equipment in display prices and the promo total relation", () => {
    const grid: PricingGrid = {
      "la-scene": { group: { peak: 40, offPeak: 30 } },
      "le-podium": { group: { peak: 32, offPeak: 24 } },
    };
    const equipment = [{ id: "headphones", pricingType: "session", sessionPricing: [7], pricePerHour: 0 }];
    const cart = [
      { studioId: "la-scene" as const, startTime: "10:00", endTime: "11:00", equipment: [{ id: "headphones", quantity: 1 }], date: new Date("2026-09-01"), groupType: "group" as const },
      { studioId: "le-podium" as const, startTime: "11:00", endTime: "12:00", equipment: [{ id: "headphones", quantity: 1 }], date: new Date("2026-09-01"), groupType: "group" as const },
    ];
    const displayPrices = cart.map((booking) => calculatePrice(grid, booking.studioId, booking.groupType, booking.date, booking.startTime, booking.endTime).total + calculateEquipmentPrice(booking.equipment, 1, equipment));
    const subtotal = round2(displayPrices.reduce((sum, price) => sum + price, 0));
    const promoDiscount = applyDiscountRounding(11.12, "up");
    const total = round2(Math.max(0, subtotal - promoDiscount));

    expect(displayPrices).toEqual([37, 31]);
    expect(subtotal).toBe(68);
    expect(subtotal).toBe(total + promoDiscount);
  });

  it("covers server-zero promo rounding while preserving stored-price zero-gate semantics", () => {
    const grid: PricingGrid = {
      "la-scene": { group: { peak: 10.5, offPeak: 10.5 } },
      "le-podium": { group: { peak: 10, offPeak: 10 } },
    };
    const booking = {
      studioId: "la-scene" as const,
      groupType: "group" as const,
      date: new Date("2026-09-01"),
      startTime: "10:00",
      endTime: "11:00",
      equipment: [],
      equipmentPrice: 0,
      // The pre-POST gate intentionally uses this stored cart price.
      price: 10.25,
    };
    const rawPromoDiscount = 10.01;
    const serverPromoDiscount = applyDiscountRounding(rawPromoDiscount, "up");
    const clientNet = Math.max(0, booking.price - rawPromoDiscount);
    const serverSubtotal = calculatePrice(
      grid,
      booking.studioId,
      booking.groupType,
      booking.date,
      booking.startTime,
      booking.endTime,
    ).total + booking.equipmentPrice;
    const serverNet = Math.max(0, serverSubtotal - serverPromoDiscount);

    // This is the legitimate divergence: rounding the server discount up
    // reaches zero while the client net remains positive.
    expect(clientNet).toBeGreaterThan(0);
    expect(serverPromoDiscount).toBeGreaterThanOrEqual(serverSubtotal);
    expect(serverNet).toBe(0);
    expect(serverSubtotal).toBe(serverPromoDiscount + serverNet);

    // Document the known gate/display split: a pricing-grid change affects
    // recomputed display totals, but not the stored-price zero gate.
    const recomputedDisplayTotal = serverSubtotal;
    expect(booking.price).not.toBe(recomputedDisplayTotal);
    expect(Math.max(0, booking.price - rawPromoDiscount)).toBe(clientNet);
  });
});
