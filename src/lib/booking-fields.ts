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

// ---------------------------------------------------------------------------
// Field identity
// ---------------------------------------------------------------------------

export type BookingFieldKey =
  | "userName"
  | "userEmail"
  | "userPhone"
  | "bandName"
  | "billingAddress"
  | "billingPostalCode"
  | "billingCity";

/** Every coordonnées field, in display order. */
export const BOOKING_FIELD_KEYS: readonly BookingFieldKey[] = [
  "userName",
  "userEmail",
  "userPhone",
  "bandName",
  "billingAddress",
  "billingPostalCode",
  "billingCity",
] as const;

/**
 * The six fields a booking cannot be completed without. `bandName` is the only
 * optional field. The client gate and `POST /api/bookings` both derive their
 * requirements from this list.
 */
export const REQUIRED_BOOKING_FIELDS: readonly BookingFieldKey[] = [
  "userName",
  "userEmail",
  "userPhone",
  "billingAddress",
  "billingPostalCode",
  "billingCity",
] as const;

/** User-facing French labels, reused by the form and by error messages. */
export const BOOKING_FIELD_LABELS: Record<BookingFieldKey, string> = {
  userName: "Prénom et nom",
  userEmail: "Email",
  userPhone: "Téléphone",
  bandName: "Nom du groupe / Raison sociale",
  billingAddress: "Adresse de facturation",
  billingPostalCode: "Code postal",
  billingCity: "Ville",
};

export type BookingUserFields = Record<BookingFieldKey, string>;

const EMPTY_BOOKING_USER_FIELDS: BookingUserFields = {
  userName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  billingAddress: "",
  billingPostalCode: "",
  billingCity: "",
};

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
    default:
      return true;
  }
}

/** Why a value fails its format check, in French, for direct display. */
export const BOOKING_FIELD_FORMAT_HINTS: Partial<Record<BookingFieldKey, string>> = {
  userEmail: "L'email est invalide",
  userPhone: "Le numéro de téléphone doit contenir 10 chiffres",
  billingPostalCode: "Le code postal doit contenir 5 chiffres",
};

/**
 * Why a required value is missing, in French, for direct display. Written out
 * per field rather than composed from the label: `${label} est obligatoire`
 * produces ungrammatical French ("Prénom et nom est obligatoire", "Ville est
 * obligatoire") because the labels carry no article.
 */
const BOOKING_FIELD_REQUIRED_HINTS: Record<Exclude<BookingFieldKey, "bandName">, string> = {
  userName: "Le prénom et le nom sont obligatoires",
  userEmail: "L'email est obligatoire",
  userPhone: "Le numéro de téléphone est obligatoire",
  billingAddress: "L'adresse de facturation est obligatoire",
  billingPostalCode: "Le code postal est obligatoire",
  billingCity: "La ville est obligatoire",
};

// ---------------------------------------------------------------------------
// Account profile → booking fields
// ---------------------------------------------------------------------------

/**
 * Structural shape of a client account as far as the booking flow cares.
 * Matches both `ClientProfile` (client) and `ClientUser` (server session).
 */
export interface BookingAccountProfile {
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
}

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

/**
 * The booking-field view of an account. This is the authoritative source for
 * what the account "knows" — never mix it with booking state, or a value the
 * user typed for this booking would be misrepresented as stored on the account.
 */
export function accountFieldValues(user: BookingAccountProfile | null): BookingUserFields {
  if (!user) return { ...EMPTY_BOOKING_USER_FIELDS };
  return {
    userName: deriveDisplayName(user),
    userEmail: user.email?.trim() ?? "",
    userPhone: user.phone?.trim() ?? "",
    bandName: user.band_name?.trim() ?? "",
    billingAddress: user.address_line1?.trim() ?? "",
    billingPostalCode: user.postal_code?.trim() ?? "",
    billingCity: user.city?.trim() ?? "",
  };
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
  key: BookingFieldKey;
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
export function getBookingFieldIssues(fields: BookingUserFields): BookingFieldIssue[] {
  const issues: BookingFieldIssue[] = [];
  for (const key of BOOKING_FIELD_KEYS) {
    const value = (fields[key] ?? "").trim();
    const required = REQUIRED_BOOKING_FIELDS.includes(key);
    if (!value) {
      if (required && key !== "bandName") {
        issues.push({
          key,
          label: BOOKING_FIELD_LABELS[key],
          status: "missing",
          reason: BOOKING_FIELD_REQUIRED_HINTS[key],
        });
      }
      continue;
    }
    if (!isValidBookingFieldValue(key, value)) {
      issues.push({
        key,
        label: BOOKING_FIELD_LABELS[key],
        status: "invalid",
        reason: BOOKING_FIELD_FORMAT_HINTS[key] ?? `${BOOKING_FIELD_LABELS[key]} est invalide`,
      });
    }
  }
  return issues;
}

/** Required fields with no value at all, in stable order. */
function missingRequiredFields(fields: BookingUserFields): BookingFieldKey[] {
  return REQUIRED_BOOKING_FIELDS.filter((key) => !(fields[key] ?? "").trim());
}

/** True when nothing blocks the confirm action. */
// ---------------------------------------------------------------------------
// Server side — resolve, then validate
// ---------------------------------------------------------------------------

/** The `user` block as posted to `POST /api/bookings`. */
export interface BookingUserBody {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  bandName?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

export interface ResolvedBookingUser {
  name: string;
  email: string;
  phone: string;
  bandName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
}

const RESOLVED_KEY_BY_FIELD: Record<BookingFieldKey, keyof ResolvedBookingUser> = {
  userName: "name",
  userEmail: "email",
  userPhone: "phone",
  bandName: "bandName",
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

const trim = (value: string | null | undefined): string => value?.trim() ?? "";

/**
 * Resolve the effective user block: what the client posted, falling back to the
 * authenticated session's stored profile field by field.
 *
 * Resolving before validating keeps the endpoint independent of client state —
 * a client-side regression that drops a field cannot 400 a paying customer whose
 * account already holds that value. For guests (`sessionUser === null`) this is
 * a pure normalisation of the body, so guest behaviour is unchanged.
 *
 * Email is resolved from the session first: for an authenticated client the
 * session identity is authoritative and the body must never redirect it.
 */
export function resolveBookingIdentity(
  body: BookingUserBody | null | undefined,
  sessionUser: BookingAccountProfile | null,
): ResolvedBookingUser {
  const posted = body ?? {};
  if (!sessionUser) {
    return {
      name: trim(posted.name),
      email: trim(posted.email).toLowerCase(),
      phone: trim(posted.phone),
      bandName: trim(posted.bandName),
      addressLine1: trim(posted.addressLine1),
      postalCode: trim(posted.postalCode),
      city: trim(posted.city),
    };
  }
  const account = accountFieldValues(sessionUser);
  return {
    // Session identity wins for the name: `users.name` is NOT NULL, so it is
    // always at least as good as a body value that may carry stale state.
    name: account.userName || trim(posted.name),
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
  };
}

export type BookingUserValidation =
  | { ok: true }
  | { ok: false; error: string; fields: BookingFieldKey[] };

/**
 * Server-side gate over the resolved block: all six required fields present,
 * plus an email that parses. Format strictness for phone and postal code stays
 * client-side on purpose — the server must not start rejecting accounts whose
 * stored phone predates this flow's 10-digit rule.
 */
export function validateBookingUserFields(resolved: ResolvedBookingUser): BookingUserValidation {
  const fields = resolvedToFields(resolved);
  const missing = missingRequiredFields(fields);
  if (missing.length > 0) {
    const labels = missing.map((key) => BOOKING_FIELD_LABELS[key].toLowerCase()).join(", ");
    return {
      ok: false,
      error: `Merci de renseigner : ${labels}.`,
      fields: missing,
    };
  }
  if (!isValidEmail(resolved.email)) {
    return { ok: false, error: "Adresse email invalide.", fields: ["userEmail"] };
  }
  return { ok: true };
}
