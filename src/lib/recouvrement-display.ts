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
  const name = bands.length > 1
    ? (person || bands.join(" · "))
    : (bands[0] || person || "Client inconnu");
  return { name, bands, email, phone };
}
