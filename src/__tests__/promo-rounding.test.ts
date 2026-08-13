import { describe, expect, it } from "vitest";
import { applyDiscountRounding } from "../lib/booking-totals";

describe("promo discount rounding", () => {
  it("rounds down to the nearest 50 cents", () => {
    const values = [0, 0.01, 0.24, 0.25, 0.5, 0.74, 0.75, 0.99, 3, 3.01, 3.24, 3.25, 3.5, 3.74, 3.75, 3.99];
    const expected = [0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 3, 3, 3, 3.5, 3.5, 3.5, 4, 4];
    expect(values.map((value) => applyDiscountRounding(value, "down"))).toEqual(expected);
  });

  it("rounds up to the next 50 cents", () => {
    const values = [0, 0.01, 0.24, 0.25, 0.5, 0.74, 0.75, 0.99, 3, 3.01, 3.24, 3.25, 3.5, 3.74, 3.75, 3.99];
    const expected = [0, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 3, 3.5, 3.5, 3.5, 3.5, 4, 4, 4];
    expect(values.map((value) => applyDiscountRounding(value, "up"))).toEqual(expected);
    expect(applyDiscountRounding(3.51, "up")).toBe(4);
    expect(applyDiscountRounding(0.07 * 50, "up")).toBe(3.5);
  });

  it("handles no rounding, guards, and cart allocation", () => {
    expect(applyDiscountRounding(3.33, "none")).toBe(3.33);
    expect(applyDiscountRounding(-1, "up")).toBe(0);
    expect(applyDiscountRounding(Number.NaN, "down")).toBe(0);

    const allocate = (discount: number) => {
      const allocations: number[] = [];
      let remaining = discount;
      for (const subtotal of [20, 20]) {
        const amount = Math.min(remaining, subtotal);
        allocations.push(amount);
        remaining = Math.max(remaining - subtotal, 0);
      }
      return allocations;
    };

    expect(applyDiscountRounding(6, "down")).toBe(applyDiscountRounding(6, "up"));
    expect(allocate(applyDiscountRounding(40 * 0.13, "down"))).toEqual([5, 0]);
    expect(allocate(applyDiscountRounding(40 * 0.13, "up"))).toEqual([5.5, 0]);
    expect(applyDiscountRounding(3.01, "down")).not.toBe(applyDiscountRounding(3.01, "up"));
  });
});
