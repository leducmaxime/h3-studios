import { describe, expect, it } from "vitest";
import {
  BOOKING_FIELD_KEYS,
  CLIENT_TYPES,
  CLIENT_TYPE_RULES,
  CGV_NOT_ACCEPTED_CODE,
  CGV_NOT_ACCEPTED_ERROR,
  bookingFieldFormatHint,
  bookingFieldLabel,
  bookingFieldPlaceholder,
  computeAccountFieldStatus,
  getBookingFieldIssues,
  isAcceptedCgv,
  resolveBookingIdentity,
  resolveClientType,
  getRequiredBookingFields,
  getVisibleBookingFields,
  isValidRna,
  isValidSiret,
  normalizeRna,
  normalizeSiret,
  pruneToClientType,
  validateBookingUserFields,
  type BookingAccountProfile,
  type BookingUserFields,
} from "@/lib/booking-fields";

const validFields: BookingUserFields = {
  legalName: "", siret: "", rna: "", instagramAccounts: "",
  firstName: "Jean",
  lastName: "Dupont",
  userEmail: "jean.dupont@example.fr",
  userPhone: "0612345678",
  bandName: "Les Oiseaux",
  billingAddress: "12 rue de Paris",
  billingPostalCode: "75001",
  billingCity: "Paris",
};

const validAccount: BookingAccountProfile = {
  client_type: null, legal_name: "Association test", siret: "73282932000074", rna: "W751234567", instagram_accounts: "@oiseaux",
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
    expect(getBookingFieldIssues(validFields, "particulier")).toEqual([]);
    expect(getBookingFieldIssues(validFields, "particulier").length === 0).toBe(true);
    expect(getBookingFieldIssues({ ...validFields, bandName: "" }, "particulier")).toEqual([]);
  });

  it("reports missing address fields in contract order", () => {
    const issues = getBookingFieldIssues({
      ...validFields,
      billingAddress: "",
      billingPostalCode: "",
      billingCity: "",
    }, "particulier");
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
      legalName: "", siret: "", rna: "", instagramAccounts: "",
      firstName: "",
      lastName: "",
      userEmail: "",
      userPhone: "",
      bandName: "",
      billingAddress: "",
      billingPostalCode: "",
      billingCity: "",
    }, "particulier");
    expect(issues.map((issue) => issue.reason)).toEqual([
      "Le prénom est obligatoire",
      "Le nom est obligatoire",
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
    const issues = getBookingFieldIssues({ ...validFields, userPhone: "06" }, "particulier");
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "userPhone", status: "invalid" }),
    ]));
    expect(issues.some((issue) => issue.status === "missing")).toBe(false);
    expect(getBookingFieldIssues({ ...validFields, userPhone: "06" }, "particulier").length === 0).toBe(false);
  });
});

describe("client type contract and offline identifiers", () => {
  it("keeps rule subsets and type keys aligned", () => {
    expect(Object.keys(CLIENT_TYPE_RULES).sort()).toEqual([...CLIENT_TYPES].sort());
    for (const type of CLIENT_TYPES) {
      expect(getRequiredBookingFields(type).every((key) => getVisibleBookingFields(type).includes(key))).toBe(true);
      expect(getVisibleBookingFields(type).every((key) => BOOKING_FIELD_KEYS.includes(key))).toBe(true);
    }
  });
  it("keeps the particulier contract unchanged", () => {
    expect(getRequiredBookingFields("particulier")).toEqual(["firstName", "lastName", "userEmail", "userPhone", "billingAddress", "billingPostalCode", "billingCity"]);
    expect(getBookingFieldIssues(validFields, "particulier")).toEqual([]);
  });
  it("applies entreprise and association requirements", () => {
    const entreprise = { ...validFields, legalName: "ACME", siret: "" };
    expect(getBookingFieldIssues({ ...entreprise, legalName: "" }, "entreprise").map((i) => i.key)).toContain("legalName");
    expect(getBookingFieldIssues(entreprise, "entreprise").map((i) => i.key)).toContain("siret");
    expect(getBookingFieldIssues({ ...entreprise, siret: "73282932000075" }, "entreprise").some((i) => i.status === "invalid")).toBe(true);
    expect(getBookingFieldIssues({ ...entreprise, siret: "73282932000074" }, "entreprise")).toEqual([]);
    expect(getBookingFieldIssues({ ...validFields, legalName: "Club" }, "association")).toEqual([]);
    expect(getBookingFieldIssues({ ...validFields, legalName: "Club", rna: "X751234567" }, "association").some((i) => i.status === "invalid")).toBe(true);
  });
  it("ignores and prunes invisible SIRET", () => {
    const fields = { ...validFields, siret: "garbage" };
    expect(getBookingFieldIssues(fields, "particulier")).toEqual([]);
    expect(pruneToClientType(fields, "particulier").siret).toBe("");
  });
  it("validates SIRET and La Poste exemption", () => {
    expect(isValidSiret("73282932000074")).toBe(true);
    expect(isValidSiret("73282932000075")).toBe(false);
    expect(isValidSiret("1234567890123")).toBe(false);
    expect(isValidSiret("123456789012345")).toBe(false);
    expect(isValidSiret("ABCDEFGHIJKLMN")).toBe(false);
    expect(isValidSiret("35600000000001")).toBe(true); // digit sum 15
    expect(isValidSiret("35600000000002")).toBe(false); // digit sum 16
    expect(normalizeSiret("732 829 320 000 74")).toBe("73282932000074");
  });

  // A 14-digit SIRET that fails its check digit used to be rejected with
  // "Le SIRET doit contenir 14 chiffres" — telling the user to do what they
  // just did. The two failures must read differently.
  it("distinguishes a wrong-length SIRET from a wrong check digit", () => {
    expect(bookingFieldFormatHint("siret", "1234")).toBe("Le SIRET doit contenir 14 chiffres");
    expect(bookingFieldFormatHint("siret", "12345678912345")).toMatch(/clé de contrôle/);
    expect(bookingFieldFormatHint("siret", "732 829 320 00075")).toMatch(/clé de contrôle/);
    expect(getBookingFieldIssues({ ...validFields, legalName: "ACME", siret: "12345678912345" }, "entreprise")[0]?.reason).toMatch(/clé de contrôle/);
  });
  it("validates and normalises RNA", () => {
    expect(isValidRna("W751234567")).toBe(true);
    expect(normalizeRna("w75 123 4567")).toBe("W751234567");
    expect(isValidRna("w75 123 4567")).toBe(true);
    expect(isValidRna("X751234567")).toBe(false);
    expect(isValidRna("W75123456")).toBe(false);
    expect(isValidRna("W7512345678")).toBe(false);
  });
  it("uses dynamic French labels", () => {
    expect(bookingFieldLabel("billingAddress", "particulier")).toBe("Adresse de facturation");
    expect(bookingFieldLabel("billingAddress", "association")).toBe("Adresse de l'association");
    expect(bookingFieldLabel("billingAddress", "entreprise")).toBe("Adresse de l'entreprise");
    expect(bookingFieldLabel("legalName", "entreprise")).toBe("Nom de l'entreprise");
    expect(bookingFieldPlaceholder("legalName", "association")).toBe("Nom de votre association");
    expect(bookingFieldPlaceholder("legalName", "entreprise")).toBe("Nom de votre entreprise");
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
    }, null, "particulier")).toEqual({
      firstName: "Jeanne",
      lastName: "Martin",
      email: "jeanne@exemple.fr",
      phone: "0612345678",
      bandName: "",
      addressLine1: "8 rue de Lyon",
      postalCode: "69001",
      city: "Lyon",
      clientType: "particulier",
      legalName: "",
      siret: "",
      rna: "",
      instagramAccounts: "",
    });
  });

  it("uses the account display name, including the NULL first/last fallback", () => {
    const account = { ...validAccount, name: "Ancien nom", first_name: null, last_name: null };
    expect(resolveBookingIdentity({ name: "", email: "client@example.fr" }, account, "particulier").firstName).toBe("Ancien");
  });

  it.each([
    [null, "client@example.fr"],
    ["not-an-email", "client@example.fr"],
    ["compte@example.fr", "compte@example.fr"],
  ])("resolves account email %s with valid posted fallback", (email, expected) => {
    expect(resolveBookingIdentity({ email: " client@example.fr " }, { ...validAccount, email }, "particulier").email).toBe(expected);
  });

  it("falls back to account contact fields when the posted values are empty", () => {
    expect(resolveBookingIdentity({ email: "client@example.fr", phone: "", addressLine1: "", postalCode: "", city: "" }, validAccount, "particulier")).toMatchObject({
      phone: "0611223344",
      addressLine1: "12 rue de Paris",
      postalCode: "75001",
      city: "Paris",
    });
  });
});

describe("client type resolution and server validation", () => {
  const resolvedBase = {
    clientType: "particulier" as const,
    legalName: "",
    siret: "",
    rna: "",
    instagramAccounts: "",
    firstName: "Jean",
     lastName: "Dupont",
    email: validFields.userEmail,
    phone: validFields.userPhone,
    bandName: validFields.bandName,
    addressLine1: validFields.billingAddress,
    postalCode: validFields.billingPostalCode,
    city: validFields.billingCity,
  };
  it("resolves body intent before the session profile", () => {
    expect(resolveClientType("entreprise", { ...validAccount, client_type: "particulier" })).toBe("entreprise");
    expect(resolveClientType("particulier", { ...validAccount, client_type: "entreprise" })).toBe("particulier");
    expect(resolveClientType(undefined, { ...validAccount, client_type: "entreprise" })).toBe("entreprise");
    expect(resolveClientType(undefined, null)).toBe("particulier");
    expect(resolveClientType("Entreprise", null)).toBe(null);
    expect(resolveClientType("sarl", null)).toBe(null);
    expect(resolveClientType("", { ...validAccount, client_type: "entreprise" })).toBe("entreprise");
  });
  it("prunes session legal identity after merging a particulier booking", () => {
    const resolved = resolveBookingIdentity({}, { ...validAccount, legal_name: "Legacy SAS", siret: "73282932000074" }, "particulier");
    expect(resolved.legalName).toBe("");
    expect(resolved.siret).toBe("");
  });
  it("applies server SIRET strictness only to entreprise", () => {
    expect(validateBookingUserFields({ ...resolvedBase, clientType: "entreprise", legalName: "ACME", siret: "" })).toMatchObject({ ok: false, fields: ["siret"] });
    expect(validateBookingUserFields({ ...resolvedBase, clientType: "entreprise", legalName: "ACME", siret: "73282932000075" })).toMatchObject({ ok: false, fields: ["siret"] });
    expect(validateBookingUserFields({ ...resolvedBase, clientType: "association", legalName: "Club", rna: "bad" })).toEqual({ ok: true });
  });
});

describe("validateBookingUserFields", () => {
  it("reports missing city with an error and fields", () => {
    const result = validateBookingUserFields({
      clientType: "particulier", legalName: "", siret: "", rna: "", instagramAccounts: "",
      firstName: "Jean",
     lastName: "Dupont",
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
      clientType: "particulier", legalName: "", siret: "", rna: "", instagramAccounts: "",
      firstName: "Jean",
     lastName: "Dupont",
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
      clientType: "particulier", legalName: "", siret: "", rna: "", instagramAccounts: "",
      firstName: "Jean",
     lastName: "Dupont",
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

/**
 * These validators run on untrusted JSON bodies in the worker, where clearing a
 * field legitimately posts `null`. A `string`-only implementation threw a
 * TypeError there — a 500 on the ordinary act of erasing a mistyped SIRET from
 * either editing surface. Caught on staging, not by a test, hence this one.
 */
describe("public booking CGV acceptance", () => {
  it("accepts only the boolean true", () => {
    expect(isAcceptedCgv(true)).toBe(true);
    expect(isAcceptedCgv(false)).toBe(false);
    expect(isAcceptedCgv(undefined)).toBe(false);
    expect(isAcceptedCgv(null)).toBe(false);
    expect(isAcceptedCgv("true")).toBe(false);
    expect(isAcceptedCgv(1)).toBe(false);
  });

  it("exposes the public API rejection copy and code", () => {
    expect(CGV_NOT_ACCEPTED_ERROR).toBe("Veuillez accepter les conditions générales de vente.");
    expect(CGV_NOT_ACCEPTED_CODE).toBe("cgv-not-accepted");
  });
});

describe("SIRET/RNA validators tolerate cleared values", () => {
  for (const empty of [null, undefined, ""] as const) {
    it(`treats ${JSON.stringify(empty)} as invalid without throwing`, () => {
      expect(() => isValidSiret(empty)).not.toThrow();
      expect(() => isValidRna(empty)).not.toThrow();
      expect(isValidSiret(empty)).toBe(false);
      expect(isValidRna(empty)).toBe(false);
      expect(normalizeSiret(empty)).toBe("");
      expect(normalizeRna(empty)).toBe("");
    });
  }
});
