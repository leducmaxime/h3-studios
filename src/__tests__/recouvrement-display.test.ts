import { describe, expect, it } from "vitest";
import { buildClientGroupIdentity, groupBookingsByBand } from "@/lib/recouvrement-display";

describe("buildClientGroupIdentity", () => {
  it("uses the person name as the folded title", () => {
    const result = buildClientGroupIdentity([
      { band_name: "TeTelle Band", user_name: "Estelle Debache", user_email: "estelle@example.com" },
    ]);

    expect(result.name).toBe("Estelle Debache");
    expect(result.bands).toEqual(["TeTelle Band"]);
  });

  it("keeps the person name when several band names share the same client", () => {
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

describe("groupBookingsByBand", () => {
  it("splits remaining by band name", () => {
    const result = groupBookingsByBand([
      { id: "1", band_name: "La Noirmoutrine", remaining: 20 },
      { id: "2", band_name: "TeTelle Band", remaining: 10 },
      { id: "3", band_name: "La Noirmoutrine", remaining: 5 },
    ]);

    expect(result).toEqual([
      {
        key: "la noirmoutrine",
        label: "La Noirmoutrine",
        remaining: 25,
        bookings: [
          { id: "1", band_name: "La Noirmoutrine", remaining: 20 },
          { id: "3", band_name: "La Noirmoutrine", remaining: 5 },
        ],
      },
      {
        key: "tetelle band",
        label: "TeTelle Band",
        remaining: 10,
        bookings: [{ id: "2", band_name: "TeTelle Band", remaining: 10 }],
      },
    ]);
  });

  it("groups bookings without a band name", () => {
    const result = groupBookingsByBand([
      { id: "1", band_name: null, remaining: 8 },
      { id: "2", band_name: "  ", remaining: 2 },
    ]);

    expect(result).toEqual([
      {
        key: "",
        label: "Sans groupe",
        remaining: 10,
        bookings: [
          { id: "1", band_name: null, remaining: 8 },
          { id: "2", band_name: "  ", remaining: 2 },
        ],
      },
    ]);
  });
});
