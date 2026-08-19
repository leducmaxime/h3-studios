/**
 * Shared contract for the booking "coordonnées" fields.
 *
 * This module is the single source of truth for:
 *   - which fields a booking requires,
 *   - what makes a value valid,
 *   - how an account profile maps onto those fields,
 *   - how the server resolves and validates the incoming user block.
 *
 * It is imported by BOTH the client hook/form (`src/components/booking/*`) and
 * the worker route (`POST /api/bookings` in `src/worker.tsx`), which is what
 * keeps the client gate and the server contract in agreement.
 *
 * IMPORTANT: this file must stay React-free and side-effect-free. The booking
 * hook is a `"use client"` module and cannot be imported by the worker, so the
 * shared logic has to live somewhere neutral — here.
 */

import type { ClientUser } from "./client-user";

// ---------------------------------------------------------------------------
// Field identity
// ---------------------------------------------------------------------------

export type BookingFieldKey =
  | "legalName"
  | "siret"
  | "rna"
  | "firstName"
  | "lastName"
  | "userEmail"
  | "userPhone"
  | "bandName"
  | "instagramAccounts"
  | "billingAddress"
  | "billingPostalCode"
  | "billingCity";

/** Every coordonnées field, in display order. */
export const BOOKING_FIELD_KEYS: readonly BookingFieldKey[] = [
  "legalName",
  "siret",
  "rna",
  "firstName",
  "lastName",
  "userEmail",
  "userPhone",
  "bandName",
  "instagramAccounts",
  "billingAddress",
  "billingPostalCode",
  "billingCity",
] as const;

export const CLIENT_TYPES = ["particulier", "association", "entreprise"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export const DEFAULT_CLIENT_TYPE: ClientType = "particulier";
export function isClientType(value: unknown): value is ClientType {
  return typeof value === "string" && (CLIENT_TYPES as readonly string[]).includes(value);
}

// `clientType` deliberately is not a BookingFieldKey: as a field it would be
// classified filled for every account (the backfill default is never empty),
// so the drift-correction effect plus applyProfilePrefill would revert a
// logged-in user's choice, and BookingForm would render a read-only <dl> row.

/** User-facing French labels, reused by the form and by error messages. */
export const BOOKING_FIELD_LABELS: Record<BookingFieldKey, string> = {
  legalName: "Raison sociale",
  siret: "SIRET",
  rna: "Numéro RNA",
  firstName: "Prénom",
  lastName: "Nom",
  userEmail: "Email",
  userPhone: "Téléphone",
  bandName: "Nom du groupe",
  instagramAccounts: "Compte(s) Instagram",
  billingAddress: "Adresse de facturation",
  billingPostalCode: "Code postal",
  billingCity: "Ville",
};

export type BookingUserFields = Record<BookingFieldKey, string>;

export const EMPTY_BOOKING_USER_FIELDS: BookingUserFields = {
  legalName: "",
  siret: "",
  rna: "",
  firstName: "",
  lastName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  instagramAccounts: "",
  billingAddress: "",
  billingPostalCode: "",
  billingCity: "",
};

interface ClientTypeRule {
  label: string;
  fields: readonly BookingFieldKey[];
  required: readonly BookingFieldKey[];
  labelOverrides: Partial<Record<BookingFieldKey, string>>;
  placeholderOverrides: Partial<Record<BookingFieldKey, string>>;
  requiredHintOverrides: Partial<Record<BookingFieldKey, string>>;
}

export const CLIENT_TYPE_RULES: Record<ClientType, ClientTypeRule> = {
  particulier: {
    label: "Particulier",
    fields: ["firstName", "lastName", "userEmail", "userPhone", "bandName", "instagramAccounts", "billingAddress", "billingPostalCode", "billingCity"],
    required: ["firstName", "lastName", "userEmail", "userPhone", "billingAddress", "billingPostalCode", "billingCity"],
    labelOverrides: {}, placeholderOverrides: {}, requiredHintOverrides: {},
  },
  association: {
    label: "Association",
    fields: ["legalName", "rna", "siret", "firstName", "lastName", "userEmail", "userPhone", "bandName", "instagramAccounts", "billingAddress", "billingPostalCode", "billingCity"],
    required: ["legalName", "firstName", "lastName", "userEmail", "userPhone", "billingAddress", "billingPostalCode", "billingCity"],
    labelOverrides: { legalName: "Nom de l'association", billingAddress: "Adresse de l'association" },
    placeholderOverrides: { legalName: "Nom de votre association" },
    requiredHintOverrides: { legalName: "Le nom de l'association est obligatoire" },
  },
  entreprise: {
    label: "Entreprise",
    fields: ["legalName", "siret", "firstName", "lastName", "userEmail", "userPhone", "bandName", "instagramAccounts", "billingAddress", "billingPostalCode", "billingCity"],
    required: ["legalName", "siret", "firstName", "lastName", "userEmail", "userPhone", "billingAddress", "billingPostalCode", "billingCity"],
    labelOverrides: { legalName: "Nom de l'entreprise", billingAddress: "Adresse de l'entreprise" },
    placeholderOverrides: { legalName: "Nom de votre entreprise" },
    requiredHintOverrides: { legalName: "Le nom de l'entreprise est obligatoire" },
  },
};
export function getVisibleBookingFields(t: ClientType | null): readonly BookingFieldKey[] { return t ? CLIENT_TYPE_RULES[t].fields : []; }
export function getRequiredBookingFields(t: ClientType | null): readonly BookingFieldKey[] { return t ? CLIENT_TYPE_RULES[t].required : []; }
export function bookingFieldLabel(key: BookingFieldKey, t: ClientType | null): string { return (t ? CLIENT_TYPE_RULES[t].labelOverrides[key] : undefined) ?? BOOKING_FIELD_LABELS[key]; }
export function bookingFieldPlaceholder(key: BookingFieldKey, t: ClientType | null): string | undefined {
  return t ? CLIENT_TYPE_RULES[t].placeholderOverrides[key] : undefined;
}

/** Why a required value is missing, in French, for direct display. */
const BOOKING_FIELD_REQUIRED_HINTS: Partial<Record<BookingFieldKey, string>> = {
  legalName: "La raison sociale est obligatoire",
  siret: "Le SIRET est obligatoire",
  firstName: "Le prénom est obligatoire",
  lastName: "Le nom est obligatoire",
  userEmail: "L'email est obligatoire",
  userPhone: "Le numéro de téléphone est obligatoire",
  billingAddress: "L'adresse de facturation est obligatoire",
  billingPostalCode: "Le code postal est obligatoire",
  billingCity: "La ville est obligatoire",
};
export function bookingFieldRequiredHint(key: BookingFieldKey, t: ClientType | null): string { return (t ? CLIENT_TYPE_RULES[t].requiredHintOverrides[key] : undefined) ?? BOOKING_FIELD_REQUIRED_HINTS[key] ?? `${bookingFieldLabel(key, t)} est obligatoire`; }

/** Blank fields outside the selected type: one normalisation point prevents stale profile data crossing types. */
export function pruneToClientType(fields: BookingUserFields, t: ClientType | null): BookingUserFields {
  const visible = getVisibleBookingFields(t);
  return Object.fromEntries(BOOKING_FIELD_KEYS.map((key) => [key, visible.includes(key) ? fields[key] : ""])) as BookingUserFields;
}

// ---------------------------------------------------------------------------
// Validity predicates — the ONLY definition of "valid" in the booking flow
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** French mobile/landline format as entered in this flow: exactly 10 digits. */
export function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, "").length === 10;
}

/** French postal code: exactly 5 digits. */
export function isValidPostalCode(value: string): boolean {
  return value.replace(/\D/g, "").length === 5;
}

/**
 * Null-tolerant on purpose: these run on untrusted JSON bodies in the worker
 * (`PUT /api/admin/users/:id`, `PUT /api/client/profile`), where clearing a
 * field legitimately posts `null`. A `string`-only signature is not enforceable
 * at that boundary, and the strict version threw a TypeError — a 500 on the
 * perfectly ordinary act of erasing a mistyped SIRET.
 */
export function normalizeSiret(value: string | null | undefined): string { return (value ?? "").replace(/\D/g, ""); }
export function isValidSiret(value: string | null | undefined): boolean {
  const normalized = normalizeSiret(value);
  if (!/^\d{14}$/.test(normalized)) return false;
  if (normalized.startsWith("356000000")) {
    // La Poste's SIRETs legitimately fail ordinary Luhn; their accepted rule is digit sum / 5.
    return [...normalized].reduce((sum, digit) => sum + Number(digit), 0) % 5 === 0;
  }
  let total = 0;
  for (let i = normalized.length - 1, position = 0; i >= 0; i--, position++) {
    let digit = Number(normalized[i]);
    if (position % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return total % 10 === 0;
}
/** Null-tolerant for the same reason as `normalizeSiret` above. */
export function normalizeRna(value: string | null | undefined): string { return (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }
export function isValidRna(value: string | null | undefined): boolean {
  // Overseas and legacy RNA numbers contain letters; digits-only would reject real associations for no gain.
  return /^W[0-9A-Z]{9}$/.test(normalizeRna(value));
}

/**
 * Format check for a single field. Only meaningful for a non-empty value —
 * emptiness is "missing", not "invalid". Fields without a format constraint
 * (name, band name, address, city) are always valid once non-empty.
 */
export function isValidBookingFieldValue(key: BookingFieldKey, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  switch (key) {
    case "userEmail":
      return isValidEmail(trimmed);
    case "userPhone":
      return isValidPhone(trimmed);
    case "billingPostalCode":
      return isValidPostalCode(trimmed);
    case "siret":
      return isValidSiret(trimmed);
    case "rna":
      return isValidRna(trimmed);
    default:
      return true;
  }
}

/** Why a value fails its format check, in French, for direct display. */
export const BOOKING_FIELD_FORMAT_HINTS: Partial<Record<BookingFieldKey, string>> = {
  userEmail: "L'email est invalide",
  userPhone: "Le numéro de téléphone doit contenir 10 chiffres",
  billingPostalCode: "Le code postal doit contenir 5 chiffres",
  siret: "Le SIRET doit contenir 14 chiffres",
  rna: "Le numéro RNA doit commencer par W suivi de 9 caractères",
};

// ---------------------------------------------------------------------------
// Account profile → booking fields
// ---------------------------------------------------------------------------

/**
 * Structural shape of a client account as far as the booking flow cares.
 * Matches both `ClientProfile` (client) and `ClientUser` (server session).
 */
export type BookingAccountProfile = Pick<ClientUser,
  "email" | "name" | "first_name" | "last_name" | "phone" | "band_name" | "address_line1" | "postal_code" | "city" | "client_type" | "legal_name" | "siret" | "rna" | "instagram_accounts">;

/**
 * Display name from trimmed `first_name` + `last_name`, falling back to the
 * NOT NULL `name` column. Accounts created before migration 0003, and every
 * guest-created account, have NULL first/last name — the `name` fallback is
 * what keeps those accounts working. Returns "" only when every source is
 * absent or blank.
 */
export function deriveDisplayName(
  user: Pick<BookingAccountProfile, "name" | "first_name" | "last_name">,
): string {
  const first = user.first_name?.trim() ?? "";
  const last = user.last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  return user.name?.trim() ?? "";
}

export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const normalized = name.trim();
  if (!normalized) return { firstName: "", lastName: "" };
  const match = normalized.match(/^(\S+)(?:\s+(.+))?$/);
  return { firstName: match?.[1] ?? "", lastName: match?.[2] ?? "" };
}

/**
 * The booking-field view of an account. This is the authoritative source for
 * what the account "knows" — never mix it with booking state, or a value the
 * user typed for this booking would be misrepresented as stored on the account.
 */
export function accountFieldValues(user: BookingAccountProfile | null): BookingUserFields {
  if (!user) return { ...EMPTY_BOOKING_USER_FIELDS };
  return {
    legalName: user.legal_name?.trim() ?? "",
    siret: user.siret?.trim() ?? "",
    rna: user.rna?.trim() ?? "",
    ...(() => {
      const firstName = user.first_name?.trim() ?? "";
      const lastName = user.last_name?.trim() ?? "";
      return firstName || lastName ? { firstName, lastName } : splitDisplayName(user.name ?? "");
    })(),
    userEmail: user.email?.trim() ?? "",
    userPhone: user.phone?.trim() ?? "",
    bandName: user.band_name?.trim() ?? "",
    instagramAccounts: user.instagram_accounts?.trim() ?? "",
    billingAddress: user.address_line1?.trim() ?? "",
    billingPostalCode: user.postal_code?.trim() ?? "",
    billingCity: user.city?.trim() ?? "",
  };
}

export function accountClientType(user: BookingAccountProfile | null): ClientType {
  return isClientType(user?.client_type) ? user.client_type : DEFAULT_CLIENT_TYPE;
}

export type BookingFieldStatus = "filled" | "invalid" | "missing";

/**
 * Classify every booking field against the ACCOUNT ONLY.
 *
 * Three states matter:
 *   - `filled`  → the account holds a usable value; show it read-only.
 *   - `invalid` → the account holds a value that fails the booking's own format
 *                 rules (e.g. a phone stored as "+33612345678"). It must be
 *                 rendered as an editable, pre-filled input with the reason
 *                 visible, otherwise the confirm button silently no-ops.
 *   - `missing` → genuinely absent from the account; ask for it.
 *
 * Deriving this from the account and not from live booking state is what stops
 * an in-progress edit from re-classifying (and unmounting) its own input.
 */
export function computeAccountFieldStatus(
  user: BookingAccountProfile | null,
): Record<BookingFieldKey, BookingFieldStatus> {
  const values = accountFieldValues(user);
  const status = {} as Record<BookingFieldKey, BookingFieldStatus>;
  for (const key of BOOKING_FIELD_KEYS) {
    const value = values[key];
    if (!value) {
      status[key] = "missing";
    } else if (!isValidBookingFieldValue(key, value)) {
      status[key] = "invalid";
    } else {
      status[key] = "filled";
    }
  }
  return status;
}

/** True when an account-owned field has drifted from the booking state. */
export function accountFieldsDrifted(
  fields: BookingUserFields,
  user: BookingAccountProfile,
): boolean {
  const account = accountFieldValues(user);
  const status = computeAccountFieldStatus(user);
  return BOOKING_FIELD_KEYS.some((key) => status[key] === "filled" && fields[key] !== account[key]);
}

// ---------------------------------------------------------------------------
// Gate — what blocks the confirm action, and why
// ---------------------------------------------------------------------------

export interface BookingFieldIssue {
  key: BookingFieldKey | "clientType";
  label: string;
  status: "missing" | "invalid";
  /** Ready-to-display French reason. */
  reason: string;
}

/**
 * Every reason the confirm action is blocked, in stable field order. Drives
 * both the disabled state and the message that names the offending fields —
 * one source, so the button and the explanation can never disagree.
 */
export function getBookingFieldIssues(fields: BookingUserFields, clientType: ClientType | null): BookingFieldIssue[] {
  if (!clientType) return [{ key: "clientType", label: "Type de client", status: "missing", reason: "Choisissez votre type de client" }];
  const issues: BookingFieldIssue[] = [];
  const visibleFields = getVisibleBookingFields(clientType);
  const requiredFields = getRequiredBookingFields(clientType);
  for (const key of visibleFields) {
    const value = (fields[key] ?? "").trim();
    const required = requiredFields.includes(key);
    if (!value) {
      if (required) {
        issues.push({
          key,
          label: bookingFieldLabel(key, clientType),
          status: "missing",
          reason: bookingFieldRequiredHint(key, clientType),
        });
      }
      continue;
    }
    if (!isValidBookingFieldValue(key, value)) {
      issues.push({
        key,
        label: bookingFieldLabel(key, clientType),
        status: "invalid",
        reason: BOOKING_FIELD_FORMAT_HINTS[key] ?? `${bookingFieldLabel(key, clientType)} est invalide`,
      });
    }
  }
  return issues;
}

/** Required fields with no value at all, in stable order. */
function missingRequiredFields(fields: BookingUserFields, clientType: ClientType): BookingFieldKey[] {
  return getRequiredBookingFields(clientType).filter((key) => !fields[key].trim());
}

/** True when nothing blocks the confirm action. */
// ---------------------------------------------------------------------------
// Server side — resolve, then validate
// ---------------------------------------------------------------------------

/** The `user` block as posted to `POST /api/bookings`. */
export interface BookingUserBody {
  clientType?: string | null;
  legalName?: string | null;
  siret?: string | null;
  rna?: string | null;
  instagramAccounts?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  bandName?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

export interface ResolvedBookingUser {
  clientType: ClientType;
  legalName: string;
  siret: string;
  rna: string;
  instagramAccounts: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bandName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
}

export function resolvedDisplayName(resolved: Pick<ResolvedBookingUser, "firstName" | "lastName">): string {
  return `${resolved.firstName} ${resolved.lastName}`.trim();
}

const RESOLVED_KEY_BY_FIELD: Record<BookingFieldKey, keyof ResolvedBookingUser> = {
  legalName: "legalName",
  siret: "siret",
  rna: "rna",
  firstName: "firstName",
  lastName: "lastName",
  userEmail: "email",
  userPhone: "phone",
  bandName: "bandName",
  instagramAccounts: "instagramAccounts",
  billingAddress: "addressLine1",
  billingPostalCode: "postalCode",
  billingCity: "city",
};

/** Booking-field view of a resolved server-side user block. */
function resolvedToFields(resolved: ResolvedBookingUser): BookingUserFields {
  const fields = {} as BookingUserFields;
  for (const key of BOOKING_FIELD_KEYS) {
    fields[key] = resolved[RESOLVED_KEY_BY_FIELD[key]] ?? "";
  }
  return fields;
}

function pruneResolvedBookingUser(resolved: ResolvedBookingUser): ResolvedBookingUser {
  const fields = pruneToClientType(resolvedToFields(resolved), resolved.clientType);
  return {
    clientType: resolved.clientType,
    ...Object.fromEntries(BOOKING_FIELD_KEYS.map((key) => [RESOLVED_KEY_BY_FIELD[key], fields[key]])),
  } as ResolvedBookingUser;
}

const trim = (value: string | null | undefined): string => value?.trim() ?? "";
const normalizeIfValid = (value: string, valid: (value: string) => boolean, normalize: (value: string) => string): string => valid(value) ? normalize(value) : value;

/** null = a value was posted but is not a recognised client type. */
export function resolveClientType(
  posted: string | null | undefined,
  sessionUser: BookingAccountProfile | null,
): ClientType | null {
  const value = posted?.trim();
  if (value) return isClientType(value) ? value : null;
  return accountClientType(sessionUser);
}

/**
 * Resolve the effective user block: what the client posted, falling back to the
 * authenticated session's stored profile field by field.
 *
 * Resolving before validating keeps the endpoint independent of client state —
 * a client-side regression that drops a field cannot 400 a paying customer whose
 * account already holds that value. For guests (`sessionUser === null`) this is
 * a pure normalisation of the body, so guest behaviour is unchanged.
 *
 * Name and email are identity, so the session is authoritative; clientType is
 * per-booking intent, so the body is authoritative — a director may book a
 * personal session, and the backfilled account value must never override it.
 * Email is resolved from the session first: for an authenticated client the
 * session identity is authoritative and the body must never redirect it.
 */
export function resolveBookingIdentity(
  body: BookingUserBody | null | undefined,
  sessionUser: BookingAccountProfile | null,
  clientType: ClientType,
): ResolvedBookingUser {
  const posted = body ?? {};
  if (!sessionUser) {
    return pruneResolvedBookingUser({
      clientType,
      legalName: trim(posted.legalName),
      siret: normalizeIfValid(trim(posted.siret), isValidSiret, normalizeSiret),
      rna: normalizeIfValid(trim(posted.rna), isValidRna, normalizeRna),
      instagramAccounts: trim(posted.instagramAccounts),
      firstName: trim(posted.firstName) || splitDisplayName(posted.name ?? "").firstName,
      lastName: trim(posted.lastName) || splitDisplayName(posted.name ?? "").lastName,
      email: trim(posted.email).toLowerCase(),
      phone: trim(posted.phone),
      bandName: trim(posted.bandName),
      addressLine1: trim(posted.addressLine1),
      postalCode: trim(posted.postalCode),
      city: trim(posted.city),
    });
  }
  const account = accountFieldValues(sessionUser);
  return pruneResolvedBookingUser({
    clientType,
    legalName: trim(posted.legalName) || account.legalName,
    siret: normalizeIfValid(trim(posted.siret) || account.siret, isValidSiret, normalizeSiret),
    rna: normalizeIfValid(trim(posted.rna) || account.rna, isValidRna, normalizeRna),
    instagramAccounts: trim(posted.instagramAccounts) || account.instagramAccounts,
    // Session identity wins for the name: `users.name` is NOT NULL, so it is
    // always at least as good as a body value that may carry stale state.
    firstName: account.firstName || trim(posted.firstName) || splitDisplayName(posted.name ?? "").firstName,
    lastName: account.lastName || trim(posted.lastName) || splitDisplayName(posted.name ?? "").lastName,
    // Session email wins only when the account holds a *usable* one. A NULL or
    // malformed account email is the case where the body may supply a
    // replacement — otherwise the form would offer a correction that this
    // function discards and `validateBookingUserFields` then rejects forever.
    // The caller must run a uniqueness check before persisting it.
    email: (isValidEmail(account.userEmail)
      ? account.userEmail
      : trim(posted.email) || account.userEmail
    ).toLowerCase(),
    phone: trim(posted.phone) || account.userPhone,
    bandName: trim(posted.bandName) || account.bandName,
    addressLine1: trim(posted.addressLine1) || account.billingAddress,
    postalCode: trim(posted.postalCode) || account.billingPostalCode,
    city: trim(posted.city) || account.billingCity,
  });
}

export const CGV_NOT_ACCEPTED_ERROR = "Veuillez accepter les conditions générales de vente.";
export const CGV_NOT_ACCEPTED_CODE = "cgv-not-accepted";

/** Public POST /api/bookings requires an explicit `acceptedCgv: true`. */
export function isAcceptedCgv(value: unknown): value is true {
  return value === true;
}

export type BookingUserValidation =
  | { ok: true }
  | { ok: false; error: string; fields: BookingFieldKey[] };

/**
 * Server-side gate over the resolved block: required fields depend on type,
 * plus an email that parses. Format strictness for phone and postal code stays
 * client-side on purpose — the server must not start rejecting accounts whose
 * stored phone predates this flow's 10-digit rule. The entreprise SIRET is the
 * exception: it is required on a legal invoice and has no legacy corpus.
 */
export function validateBookingUserFields(resolved: ResolvedBookingUser): BookingUserValidation {
  const fields = resolvedToFields(resolved);
  const missing = missingRequiredFields(fields, resolved.clientType);
  if (missing.length > 0) {
    const labels = missing.map((key) => key === "siret" || key === "rna" ? key.toUpperCase() : bookingFieldLabel(key, resolved.clientType).toLowerCase()).join(", ");
    return {
      ok: false,
      error: `Merci de renseigner : ${labels}.`,
      fields: missing,
    };
  }
  if (!isValidEmail(resolved.email)) {
    return { ok: false, error: "Adresse email invalide.", fields: ["userEmail"] };
  }
  if (resolved.clientType === "entreprise" && !isValidSiret(resolved.siret)) {
    return { ok: false, error: "Le SIRET est invalide.", fields: ["siret"] };
  }
  return { ok: true };
}
