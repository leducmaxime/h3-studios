import { describe, expect, it } from "vitest";
import {
  BOOKING_FIELD_KEYS,
  canConfirmBookingFields,
  computeAccountFieldStatus,
  getBookingFieldIssues,
  resolveBookingIdentity,
  validateBookingUserFields,
  type BookingAccountProfile,
  type BookingUserFields,
} from "@/lib/booking-fields";

const validFields: BookingUserFields = {
  userName: "Jean Dupont",
  userEmail: "jean.dupont@example.fr",
  userPhone: "0612345678",
  bandName: "Les Oiseaux",
  billingAddress: "12 rue de Paris",
  billingPostalCode: "75001",
  billingCity: "Paris",
};

const validAccount: BookingAccountProfile = {
  email: "compte@example.fr",
  name: "Jean Dupont",
  first_name: "Jean",
  last_name: "Dupont",
  phone: "0611223344",
  band_name: "Les Oiseaux",
  address_line1: "12 rue de Paris",
  postal_code: "75001",
  city: "Paris",
};

describe("booking confirmation gate", () => {
  it("accepts a complete set and ignores empty optional bandName", () => {
    expect(getBookingFieldIssues(validFields)).toEqual([]);
    expect(canConfirmBookingFields(validFields)).toBe(true);
    expect(getBookingFieldIssues({ ...validFields, bandName: "" })).toEqual([]);
  });

  it("reports missing address fields in contract order", () => {
    const issues = getBookingFieldIssues({
      ...validFields,
      billingAddress: "",
      billingPostalCode: "",
      billingCity: "",
    });
    expect(issues.map((issue) => issue.key)).toEqual([
      "billingAddress",
      "billingPostalCode",
      "billingCity",
    ]);
    expect(issues.every((issue) => issue.status === "missing")).toBe(true);
    expect(issues.map((issue) => issue.key)).toEqual(
      BOOKING_FIELD_KEYS.filter((key) => ["billingAddress", "billingPostalCode", "billingCity"].includes(key)),
    );
  });

  it("states each missing reason as grammatical French, not label concatenation", () => {
    const issues = getBookingFieldIssues({
      userName: "",
      userEmail: "",
      userPhone: "",
      bandName: "",
      billingAddress: "",
      billingPostalCode: "",
      billingCity: "",
    });
    expect(issues.map((issue) => issue.reason)).toEqual([
      "Le prénom et le nom sont obligatoires",
      "L'email est obligatoire",
      "Le numéro de téléphone est obligatoire",
      "L'adresse de facturation est obligatoire",
      "Le code postal est obligatoire",
      "La ville est obligatoire",
    ]);
    // `${label} est obligatoire` produced "Ville est obligatoire" / "Prénom et
    // nom est obligatoire" — the labels carry no article.
    expect(issues.every((issue) => issue.reason !== `${issue.label} est obligatoire`)).toBe(true);
  });

  it("reports malformed present values as invalid", () => {
    const issues = getBookingFieldIssues({ ...validFields, userPhone: "06" });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "userPhone", status: "invalid" }),
    ]));
    expect(issues.some((issue) => issue.status === "missing")).toBe(false);
    expect(canConfirmBookingFields({ ...validFields, userPhone: "06" })).toBe(false);
  });
});

describe("account field classification", () => {
  it("distinguishes nullable email and legacy phone formats", () => {
    expect(computeAccountFieldStatus({ ...validAccount, email: null }).userEmail).toBe("missing");
    expect(computeAccountFieldStatus({ ...validAccount, phone: "+33612345678" }).userPhone).toBe("invalid");

    const status = computeAccountFieldStatus(validAccount);
    expect(Object.values(status)).not.toContain("missing");
    expect(Object.values(status)).not.toContain("invalid");
  });
});

describe("resolveBookingIdentity", () => {
  it("normalises a guest body without inventing account values", () => {
    expect(resolveBookingIdentity({
      name: "  Jeanne Martin ",
      email: " Jeanne@EXEMPLE.FR ",
      phone: " 0612345678 ",
      bandName: null,
      addressLine1: " 8 rue de Lyon ",
      postalCode: " 69001 ",
      city: " Lyon ",
    }, null)).toEqual({
      name: "Jeanne Martin",
      email: "jeanne@exemple.fr",
      phone: "0612345678",
      bandName: "",
      addressLine1: "8 rue de Lyon",
      postalCode: "69001",
      city: "Lyon",
    });
  });

  it("uses the account display name, including the NULL first/last fallback", () => {
    const account = { ...validAccount, name: "Ancien nom", first_name: null, last_name: null };
    expect(resolveBookingIdentity({ name: "", email: "client@example.fr" }, account).name).toBe("Ancien nom");
  });

  it.each([
    [null, "client@example.fr"],
    ["not-an-email", "client@example.fr"],
    ["compte@example.fr", "compte@example.fr"],
  ])("resolves account email %s with valid posted fallback", (email, expected) => {
    expect(resolveBookingIdentity({ email: " client@example.fr " }, { ...validAccount, email }).email).toBe(expected);
  });

  it("falls back to account contact fields when the posted values are empty", () => {
    expect(resolveBookingIdentity({ email: "client@example.fr", phone: "", addressLine1: "", postalCode: "", city: "" }, validAccount)).toMatchObject({
      phone: "0611223344",
      addressLine1: "12 rue de Paris",
      postalCode: "75001",
      city: "Paris",
    });
  });
});

describe("validateBookingUserFields", () => {
  it("reports missing city with an error and fields", () => {
    const result = validateBookingUserFields({
      name: validFields.userName,
      email: validFields.userEmail,
      phone: validFields.userPhone,
      bandName: validFields.bandName,
      addressLine1: validFields.billingAddress,
      postalCode: validFields.billingPostalCode,
      city: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
      expect(result.fields).toEqual(["billingCity"]);
    }
  });

  it("accepts a complete resolved user", () => {
    expect(validateBookingUserFields({
      name: validFields.userName,
      email: validFields.userEmail,
      phone: validFields.userPhone,
      bandName: validFields.bandName,
      addressLine1: validFields.billingAddress,
      postalCode: validFields.billingPostalCode,
      city: validFields.billingCity,
    })).toEqual({ ok: true });
  });

  it("reports malformed email with the email field", () => {
    const result = validateBookingUserFields({
      name: validFields.userName,
      email: "bad-email",
      phone: validFields.userPhone,
      bandName: validFields.bandName,
      addressLine1: validFields.billingAddress,
      postalCode: validFields.billingPostalCode,
      city: validFields.billingCity,
    });
    expect(result).toMatchObject({ ok: false, fields: ["userEmail"] });
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
