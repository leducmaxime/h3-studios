export interface RecouvrementIdentityBooking {
  band_name?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
}

export interface RecouvrementClientIdentity {
  name: string;
  bands: string[];
  email: string | null;
  phone: string | null;
}

export function uniqueBandNames(bookings: RecouvrementIdentityBooking[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const booking of bookings) {
    const name = booking.band_name?.trim() ?? "";
    if (!name) continue;
    const key = name.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function buildClientGroupIdentity(
  bookings: RecouvrementIdentityBooking[],
): RecouvrementClientIdentity {
  const bands = uniqueBandNames(bookings);
  const person = bookings.find((booking) => booking.user_name?.trim())?.user_name?.trim() ?? "";
  const email = bookings.find((booking) => booking.user_email)?.user_email ?? null;
  const phone = bookings.find((booking) => booking.user_phone)?.user_phone ?? null;
  const name = person || bands.join(" · ") || "Client inconnu";
  return { name, bands, email, phone };
}

export const UNGROUPED_BAND_KEY = "";
export const UNGROUPED_BAND_LABEL = "Sans groupe";

export interface RecouvrementBandScope<T> {
  key: string;
  label: string;
  bookings: T[];
  remaining: number;
}

export function bandScopeKey(bandName: string | null | undefined): string {
  return (bandName?.trim() ?? "").toLocaleLowerCase("fr");
}

export function groupBookingsByBand<T extends RecouvrementIdentityBooking & { remaining: number }>(
  bookings: T[],
): RecouvrementBandScope<T>[] {
  const groups = new Map<string, RecouvrementBandScope<T>>();
  for (const booking of bookings) {
    const trimmed = booking.band_name?.trim() ?? "";
    const key = bandScopeKey(trimmed);
    const label = trimmed || UNGROUPED_BAND_LABEL;
    const existing = groups.get(key);
    if (existing) {
      existing.bookings.push(booking);
      existing.remaining += booking.remaining;
      continue;
    }
    groups.set(key, { key, label, bookings: [booking], remaining: booking.remaining });
  }
  return [...groups.values()];
}
