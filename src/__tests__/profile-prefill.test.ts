import { describe, it, expect } from "vitest";
import {
  deriveDisplayName,
  mergeProfilePrefill,
  type ClientProfile,
} from "@/components/booking/useBookingWithRouter";

const baseUser: ClientProfile = {
  id: "u1",
  email: "jane@example.fr",
  name: "JANE DOE",
  first_name: "Jane",
  last_name: "Doe",
  phone: "+33612345678",
  band_name: "Les Oiseaux",
  address_line1: "12 rue de Paris",
  address_line2: null,
  postal_code: "75001",
  city: "Paris",
};

describe("deriveDisplayName", () => {
  it("prefers trimmed first + last name over the name fallback", () => {
    expect(deriveDisplayName(baseUser)).toBe("Jane Doe");
  });

  it("trims whitespace from first/last name parts", () => {
    expect(
      deriveDisplayName({ ...baseUser, first_name: "  Jane  ", last_name: "  Doe  " }),
    ).toBe("Jane Doe");
  });

  it("falls back to name when first/last are absent", () => {
    expect(deriveDisplayName({ ...baseUser, first_name: null, last_name: null })).toBe("JANE DOE");
  });

  it("returns only the present part when one of first/last is missing", () => {
    expect(deriveDisplayName({ ...baseUser, first_name: null, last_name: "Doe" })).toBe("Doe");
  });

  it("returns empty only when every source is absent or blank", () => {
    expect(deriveDisplayName({ name: "   ", first_name: null, last_name: null })).toBe("");
    expect(deriveDisplayName({ name: "", first_name: "", last_name: "" })).toBe("");
  });
});

describe("mergeProfilePrefill", () => {
  const emptyFields = {
    userName: "",
    userEmail: "",
    userPhone: "",
    bandName: "",
    billingAddress: "",
    billingPostalCode: "",
    billingCity: "",
  };

  it("fills empty booking fields from the account", () => {
    expect(mergeProfilePrefill(emptyFields, baseUser)).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      userPhone: "+33612345678",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("state values win over account values — typed input is never clobbered", () => {
    const typed = {
      userName: "Typed Name",
      userEmail: "typed@example.fr",
      userPhone: "0600000000",
      bandName: "My Band",
      billingAddress: "My street",
      billingPostalCode: "69000",
      billingCity: "Lyon",
    };
    expect(mergeProfilePrefill(typed, baseUser)).toEqual(typed);
  });

  it("mixes: keeps non-empty typed fields and fills the remaining empty ones", () => {
    const partial = {
      userName: "Alice",
      userEmail: "",
      userPhone: "",
      bandName: "",
      billingAddress: "Somewhere",
      billingPostalCode: "",
      billingCity: "",
    };
    expect(mergeProfilePrefill(partial, baseUser)).toEqual({
      userName: "Alice",
      userEmail: "jane@example.fr",
      userPhone: "+33612345678",
      bandName: "Les Oiseaux",
      billingAddress: "Somewhere",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("produces empty strings when the account lacks the field", () => {
    const sparse = {
      ...baseUser,
      email: null,
      phone: null,
      band_name: null,
      address_line1: null,
      postal_code: null,
      city: null,
      name: "",
      first_name: null,
      last_name: null,
    };
    expect(mergeProfilePrefill(emptyFields, sparse)).toEqual({
      userName: "",
      userEmail: "",
      userPhone: "",
      bandName: "",
      billingAddress: "",
      billingPostalCode: "",
      billingCity: "",
    });
  });
});
