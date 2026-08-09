import { describe, it, expect } from "vitest";
import { applyProfilePrefill, type ClientProfile } from "@/components/booking/useBookingWithRouter";
import { accountFieldsDrifted, computeAccountFieldStatus, deriveDisplayName, getBookingFieldIssues } from "@/lib/booking-fields";

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

const emptyBookingFields = {
  userName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  billingAddress: "",
  billingPostalCode: "",
  billingCity: "",
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

describe("profile classification with nullable names", () => {
  it("uses the non-empty account name when first and last names are null", () => {
    const user = { ...baseUser, first_name: null, last_name: null };
    expect(computeAccountFieldStatus(user).userName).toBe("filled");
    expect(applyProfilePrefill({ ...emptyBookingFields }, user, { initial: false }).userName).toBe("JANE DOE");
  });

  it.each([
    [{ first_name: null, last_name: "Doe" }, "Doe"],
    [{ first_name: "Jane", last_name: null }, "Jane"],
  ])("classifies a one-sided name as filled (%s)", (names, expected) => {
    const user = { ...baseUser, ...names };
    expect(computeAccountFieldStatus(user).userName).toBe("filled");
    expect(applyProfilePrefill({ ...emptyBookingFields }, user, { initial: false }).userName).toBe(expected);
  });

  it("classifies an all-blank name as missing", () => {
    const user = { ...baseUser, name: "   ", first_name: null, last_name: null };
    expect(computeAccountFieldStatus(user).userName).toBe("missing");
    expect(applyProfilePrefill({ ...emptyBookingFields }, user, { initial: false })).not.toHaveProperty("userName");
  });
});

describe("applyProfilePrefill", () => {
  const emptyFields = emptyBookingFields;

  it("syncs filled account fields and leaves invalid account fields editable", () => {
    expect(applyProfilePrefill(emptyFields, baseUser, { initial: false })).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("clears a stale persisted email only during the initial prefill", () => {
    const account = { ...baseUser, email: null };
    const state = { ...emptyFields, userEmail: "ancien@example.fr" };
    expect(applyProfilePrefill(state, account, { initial: true })).toHaveProperty("userEmail", "");
    expect(applyProfilePrefill(state, account, { initial: false })).not.toHaveProperty("userEmail");
  });

  it("still lets a valid account email win on the initial prefill", () => {
    const state = { ...emptyFields, userEmail: "ancien@example.fr" };
    expect(applyProfilePrefill(state, { ...baseUser, phone: "0612345678" }, { initial: true }).userEmail)
      .toBe("jane@example.fr");
  });

  it("leaves the other six fields identical for initial and later arrivals", () => {
    const account = { ...baseUser, email: null, phone: "0612345678" };
    const initial = applyProfilePrefill(emptyFields, account, { initial: true });
    const later = applyProfilePrefill(emptyFields, account, { initial: false });
    const { userEmail: _initialEmail, ...initialOtherFields } = initial;
    const { userEmail: _laterEmail, ...laterOtherFields } = later;
    expect(initialOtherFields).toEqual(laterOtherFields);
  });

  it("filled account values win while a differing invalid state value is kept", () => {
    const typed = {
      userName: "Typed Name",
      userEmail: "typed@example.fr",
      userPhone: "0600000000",
      bandName: "My Band",
      billingAddress: "My street",
      billingPostalCode: "69000",
      billingCity: "Lyon",
    };
    expect(applyProfilePrefill(typed, baseUser, { initial: false })).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("overwrites stale state for every filled account field", () => {
    const account = { ...baseUser, phone: "0612345678" };
    const stale = {
      userName: "Ancien nom",
      userEmail: "ancien@example.fr",
      userPhone: "0600000000",
      bandName: "Ancien groupe",
      billingAddress: "1 rue ancienne",
      billingPostalCode: "69000",
      billingCity: "Lyon",
    };
    expect(applyProfilePrefill(stale, account, { initial: false })).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      userPhone: "0612345678",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("keeps state values for fields missing or invalid on the account", () => {
    const partial = {
      userName: "Alice",
      userEmail: "",
      userPhone: "",
      bandName: "",
      billingAddress: "Somewhere",
      billingPostalCode: "",
      billingCity: "",
    };
    expect(applyProfilePrefill(partial, baseUser, { initial: false })).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
      billingPostalCode: "75001",
      billingCity: "Paris",
    });
  });

  it("clears an invalid account value when state still contains that value", () => {
    expect(applyProfilePrefill({ ...emptyFields, userPhone: "+33612345678" }, baseUser, { initial: false })).toEqual({
      userName: "Jane Doe",
      userEmail: "jane@example.fr",
      userPhone: "",
      bandName: "Les Oiseaux",
      billingAddress: "12 rue de Paris",
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
    expect(applyProfilePrefill(emptyFields, sparse, { initial: false })).toEqual({});
  });

  it("keeps a state value when the account field is missing", () => {
    const sparse = { ...baseUser, email: null };
    const state = { ...emptyFields, userEmail: "saisi@example.fr" };
    expect({ ...state, ...applyProfilePrefill(state, sparse, { initial: false }) }).toHaveProperty("userEmail", "saisi@example.fr");
  });

  it("composes with the gate for an account containing only name and email", () => {
    const account = {
      ...baseUser,
      phone: null,
      band_name: null,
      address_line1: null,
      postal_code: null,
      city: null,
    };
    const merged = { ...emptyFields, ...applyProfilePrefill(emptyFields, account, { initial: false }) };
    expect(getBookingFieldIssues(merged).map((issue) => issue.key)).toEqual([
      "userPhone",
      "billingAddress",
      "billingPostalCode",
      "billingCity",
    ]);
  });

  it("is idempotent across repeated profile arrivals", () => {
    const once = { ...emptyFields, ...applyProfilePrefill(emptyFields, { ...baseUser, phone: "0612345678" }, { initial: false }) };
    const twice = { ...once, ...applyProfilePrefill(once, { ...baseUser, phone: "0612345678" }, { initial: false }) };
    expect(twice).toEqual(once);
  });
});

describe("accountFieldsDrifted", () => {
  const completeAccount = { ...baseUser, phone: "0612345678" };
  const completeFields = {
    ...emptyBookingFields,
    userName: "Jane Doe",
    userEmail: "jane@example.fr",
    userPhone: "0612345678",
    bandName: "Les Oiseaux",
    billingAddress: "12 rue de Paris",
    billingPostalCode: "75001",
    billingCity: "Paris",
  };

  it("is false when account-filled state matches", () => {
    expect(accountFieldsDrifted(completeFields, completeAccount)).toBe(false);
  });

  it("is true when an account-filled field is empty after reset", () => {
    expect(accountFieldsDrifted({ ...completeFields, userEmail: "" }, completeAccount)).toBe(true);
  });

  it("ignores differences in missing and invalid account fields", () => {
    const missing = { ...completeAccount, city: null };
    expect(accountFieldsDrifted({ ...completeFields, billingCity: "Lyon" }, missing)).toBe(false);

    const invalid = { ...completeAccount, phone: "+33612345678" };
    expect(accountFieldsDrifted({ ...completeFields, userPhone: "0600000000" }, invalid)).toBe(false);
  });
});

describe("reset prefill composition", () => {
  it("opens the gate after applying a complete account to empty state", () => {
    const completeAccount = { ...baseUser, phone: "0612345678" };
    const merged = { ...emptyBookingFields, ...applyProfilePrefill(emptyBookingFields, completeAccount, { initial: true }) };
    expect(getBookingFieldIssues(merged)).toEqual([]);
  });
});
