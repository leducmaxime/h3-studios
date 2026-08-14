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
});
