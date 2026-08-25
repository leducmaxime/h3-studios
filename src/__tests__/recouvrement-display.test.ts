import { describe, expect, it } from "vitest";
import { buildClientGroupIdentity } from "@/lib/recouvrement-display";

describe("buildClientGroupIdentity", () => {
  it("uses the single band name as the folded title", () => {
    const result = buildClientGroupIdentity([
      { band_name: "TeTelle Band", user_name: "Estelle Debache", user_email: "estelle@example.com" },
    ]);

    expect(result.name).toBe("TeTelle Band");
    expect(result.bands).toEqual(["TeTelle Band"]);
  });

  it("uses the person name when several band names share the same client", () => {
    const result = buildClientGroupIdentity([
      { band_name: "La Noirmoutrine", user_name: "Estelle Debache", user_email: "estelle@example.com", user_phone: "0761423343" },
      { band_name: "TeTelle Band", user_name: "Estelle Debache", user_email: "estelle@example.com", user_phone: "0761423343" },
      { band_name: "La Noirmoutrine", user_name: "Estelle Debache" },
    ]);

    expect(result.name).toBe("Estelle Debache");
    expect(result.bands).toEqual(["La Noirmoutrine", "TeTelle Band"]);
    expect(result.email).toBe("estelle@example.com");
    expect(result.phone).toBe("0761423343");
  });

  it("falls back to joined band names when the person name is missing", () => {
    const result = buildClientGroupIdentity([
      { band_name: "La Noirmoutrine" },
      { band_name: "TeTelle Band" },
    ]);

    expect(result.name).toBe("La Noirmoutrine · TeTelle Band");
    expect(result.bands).toEqual(["La Noirmoutrine", "TeTelle Band"]);
  });
});
