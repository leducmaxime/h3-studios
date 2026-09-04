import { describe, expect, it } from "vitest";
import {
  MAX_ADMIN_PRICE_PER_HOUR_EUR,
  MAX_PRICING_CENTS,
  parsePricePerHour,
} from "@/lib/pricing";

describe("parsePricePerHour", () => {
  it("accepte la virgule et le point comme séparateur décimal", () => {
    expect(parsePricePerHour("12,50")).toMatchObject({
      valid: true,
      pricePerHalfHourCents: 625,
      normalized: "12.50",
    });
    expect(parsePricePerHour("12.50")).toMatchObject({
      valid: true,
      pricePerHalfHourCents: 625,
    });
  });

  it("convertit 6 €/h en 300 centimes par demi-heure", () => {
    expect(parsePricePerHour("6")).toMatchObject({
      valid: true,
      pricePerHalfHourCents: 300,
    });
  });

  it.each(["-1", "abc", "12.999", "999999999"])('rejette "%s"', (value) => {
    const result = parsePricePerHour(value);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBeTruthy();
  });

  it.each(["199,99", "12,49", "0,01"])('refuse les centimes horaires impairs : "%s"', (value) => {
    const result = parsePricePerHour(value);
    expect(result).toMatchObject({
      valid: false,
      error: "Le tarif horaire doit être un multiple de 0,02 € (il est enregistré par demi-heure).",
    });
  });

  it("lie le plafond horaire au plafond stocké", () => {
    const result = parsePricePerHour(String(MAX_ADMIN_PRICE_PER_HOUR_EUR));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.pricePerHalfHourCents).toBe(MAX_PRICING_CENTS);
  });

  it("conserve exactement les centimes lors d'un aller-retour", () => {
    const existingCents = 625;
    const existingHourlyPrice = existingCents * 2 / 100;

    expect(parsePricePerHour(String(existingHourlyPrice))).toMatchObject({
      valid: true,
      pricePerHalfHourCents: existingCents,
    });
  });
});
