/**
 * Display-side resolution of a booking's client identity.
 *
 * Two sources carry the same five values: the `bookings` row holds a SNAPSHOT
 * taken at reservation time, and the `users` row holds the LIVE profile. They
 * disagree whenever a client edits their profile after booking — which is
 * exactly why the snapshot exists.
 *
 * An invoice is a legal document, so it must reprint what was true when the
 * booking was made. Every downstream surface (invoice PDF, admin booking sheet,
 * CSV exports, confirmation email) therefore reads the snapshot first and falls
 * back to the live user ONLY for bookings created before migration 0012, whose
 * `bookings.client_type` is genuinely NULL. That nullability is deliberate:
 * asserting `particulier` on a pre-migration row would fabricate a fact that
 * then gets reprinted on an invoice.
 *
 * Booking rows do not contain billing-address snapshot columns yet. For legacy
 * bookings, legal identity falls back to the live profile, while invoice
 * addresses necessarily remain live-profile values until address snapshots are
 * added in a future migration.
 *
 * The fallback is all-or-nothing on purpose. Mixing a snapshot type with live
 * legal fields would resurrect the cross-type leak that `pruneToClientType`
 * exists to prevent — e.g. stamping a former company's SIRET onto a booking
 * the client deliberately made as a particulier.
 *
 * This module stays React-free and side-effect-free: it is imported by the
 * worker, by the jsPDF invoice builder and by admin pages alike.
 */

import { CLIENT_TYPE_RULES, DEFAULT_CLIENT_TYPE, isClientType, type ClientType } from "./booking-fields";
import type { DbBooking, DbUser } from "./db-types";

/** The snapshot columns added to `bookings` by migration 0012. */
type BookingIdentitySnapshot = Pick<DbBooking,
  "client_type" | "legal_name" | "siret" | "rna" | "instagram_accounts">;

/** The live profile columns added to `users` by migration 0012. */
type UserIdentityProfile = Pick<DbUser,
  "client_type" | "legal_name" | "siret" | "rna" | "instagram_accounts">;
type ClientIdentitySource = Partial<Pick<DbUser,
  "legal_name" | "siret" | "rna" | "instagram_accounts">>;

export interface BookingClientIdentity {
  clientType: ClientType;
  /** French label for display: "Particulier" / "Association" / "Entreprise". */
  clientTypeLabel: string;
  legalName: string;
  siret: string;
  rna: string;
  instagramAccounts: string;
  /** True for association and entreprise — the types that carry a legal identity. */
  isBusiness: boolean;
  /** True when either the booking snapshot or live profile supplied a valid type. */
  resolved: boolean;
}

const text = (value: string | null | undefined): string => value?.trim() ?? "";

function identity(
  clientType: ClientType,
  source: ClientIdentitySource | null | undefined,
  resolved: boolean,
): BookingClientIdentity {
  return {
    clientType,
    clientTypeLabel: CLIENT_TYPE_RULES[clientType].label,
    legalName: text(source?.legal_name),
    siret: text(source?.siret),
    rna: text(source?.rna),
    instagramAccounts: text(source?.instagram_accounts),
    isBusiness: clientType !== "particulier",
    resolved,
  };
}

/**
 * Snapshot-first, live-profile fallback. Pass the booking row and the user row;
 * either may be absent.
 */
export function resolveBookingClientIdentity(
  booking: Partial<BookingIdentitySnapshot> | null | undefined,
  user: Partial<UserIdentityProfile> | null | undefined,
): BookingClientIdentity {
  const snapshotType = booking?.client_type;
  if (isClientType(snapshotType)) return identity(snapshotType, booking, true);

  const liveType = user?.client_type;
  return identity(isClientType(liveType) ? liveType : DEFAULT_CLIENT_TYPE, user, isClientType(liveType));
}

/** The live profile on its own, for surfaces that show a client rather than a booking. */
export function resolveUserClientIdentity(
  user: Partial<UserIdentityProfile> | null | undefined,
): BookingClientIdentity {
  const liveType = user?.client_type;
  return identity(isClientType(liveType) ? liveType : DEFAULT_CLIENT_TYPE, user, isClientType(liveType));
}

/**
 * SIRET grouped the way it is printed on a Kbis: 3-3-3-5. Storage stays
 * normalised to 14 bare digits (see `normalizeSiret`); grouping is purely a
 * render concern. Anything that is not exactly 14 digits is returned untouched,
 * so a legacy or malformed value is shown as-is rather than silently mangled.
 */
export function formatSiret(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}
