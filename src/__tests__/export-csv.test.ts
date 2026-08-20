import { describe, expect, it } from "vitest";
import { buildBookingsCSV, buildUsersCSV } from "@/lib/export";
import type { DbBooking, DbUser } from "@/lib/db-types";

const booking = (overrides: Partial<DbBooking> = {}) => ({
  booking_ref: "H3-1", user_name: "Alice", user_email: "alice@example.com", user_band_name: "User Band",
  band_name: "The Band", client_type: "particulier", legal_name: null, siret: null, rna: null, instagram_accounts: null,
  studio_id: "la-scene", date: "2026-08-20", start_time: "21:30", end_time: "00:00", group_type: "group",
  status: "confirmed", equipment: JSON.stringify([{ id: "mic", name: "Micro", quantity: 2 }, { id: "piano", name: "Piano", quantity: 1 }]),
  equipment_price: 12, total_price: 100, promo_discount: 10, payment_status: "paid",
  ...overrides,
} as unknown as DbBooking);

const user = (overrides: Partial<DbUser> = {}) => ({
  name: "Alice", email: "alice@example.com", phone: "0798765432", client_type: "particulier", legal_name: null,
  siret: null, rna: null, instagram_accounts: null, band_name: "The Band", total_bookings: 2, total_spent: 100,
  total_cancellations: 1, total_minutes: 150, total_bookings_la_scene: 3, total_bookings_le_podium: 1,
  total_equipment: 12, total_discounts: 5, is_blocked: 0, ...overrides,
} as unknown as DbUser);

/** Parse une ligne CSV en respectant les champs cités (`"a,b"`). */
function parseRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

describe("CSV builders", () => {
  it("handles durations crossing midnight", () => {
    const rows = buildBookingsCSV([booking(), booking({ start_time: "10:00", end_time: "12:00" })]).split("\n");
    expect(rows[1].split(",")[12]).toBe("2.5");
    expect(rows[2].split(",")[12]).toBe("2.0");
  });

  it("exports group names and types with fallback", () => {
    const rows = buildBookingsCSV([booking(), booking({ band_name: null })]).split("\n");
    const header = rows[0].split(",");
    expect(header).toContain("Nom du groupe");
    expect(header).toContain("Type de groupe");
    expect(header).not.toContain("Groupe");
    expect(rows[1].split(",")[13]).toBe("The Band");
    expect(rows[1].split(",")[14]).toBe("Groupe");
    expect(rows[2].split(",")[13]).toBe("User Band");
  });

  it("exports options and gross/net amounts", () => {
    const row = buildBookingsCSV([booking()]).split("\n")[1].split(",");
    expect(row[16]).toBe("Micro ×2 ; Piano ×1");
    expect(row[17]).toBe("12.00");
    expect(row[18]).toBe("100.00");
    expect(row[19]).toBe("90.00");
  });

  it("quotes values containing a comma without shifting columns", () => {
    const rows = buildBookingsCSV([booking({
      user_name: "Dupont, Jean",
      equipment: JSON.stringify([{ id: "amp", name: "Ampli, 100W", quantity: 1 }]),
    })]).split("\n");
    const header = parseRow(rows[0]);
    const row = parseRow(rows[1]);
    expect(row).toHaveLength(header.length);
    expect(row[header.indexOf("Client")]).toBe("Dupont, Jean");
    expect(row[header.indexOf("Options")]).toBe("Ampli, 100W ×1");
    expect(row[header.indexOf("Montant total TTC (EUR)")]).toBe("100.00");
  });

  it("keeps the clamped net at zero when the discount exceeds the total", () => {
    const rows = buildBookingsCSV([booking({ total_price: 5, promo_discount: 10 })]).split("\n");
    const header = parseRow(rows[0]);
    const row = parseRow(rows[1]);
    expect(row[header.indexOf("Montant total TTC (EUR)")]).toBe("5.00");
    expect(row[header.indexOf("Remise TTC (EUR)")]).toBe("10.00");
    expect(row[header.indexOf("Montant dû TTC (EUR)")]).toBe("0.00");
  });

  it("formats phones as safe text", () => {
    const rows = buildUsersCSV([
      user(),
      user({ phone: "  " }),
      user({ phone: "+33612345678" }),
      user({ phone: "01.23.45.67.89" }),
      user({ phone: "N/A" }),
    ]).split("\n");
    const phoneIndex = parseRow(rows[0]).indexOf("Téléphone");
    const cell = (i: number) => parseRow(rows[i])[phoneIndex];

    expect(cell(1)).toBe("07 98 76 54 32");
    expect(cell(2)).toBe("—");
    expect(cell(3)).toBe("+33 6 12 34 56 78");
    expect(cell(4)).toBe("01 23 45 67 89");
    expect(cell(5)).toBe("N/A");

    // Aucun numéro ne doit être une formule ni une suite de chiffres nue
    // (un tableur la convertirait en nombre et perdrait le zéro initial).
    for (const i of [1, 3, 4]) {
      expect(cell(i)).not.toMatch(/^=/);
      expect(cell(i)).not.toMatch(/^\d+$/);
    }
  });

  it("exports aggregate user metrics", () => {
    const rows = buildUsersCSV([user(), user({ total_bookings_la_scene: 0, total_bookings_le_podium: 0 })]);
    const [header, row, zero] = rows.split("\n").map((line) => line.split(","));
    expect(header).toEqual(expect.arrayContaining(["Annulations", "Heures réservées", "% La Scène", "% Le Podium", "Panier moyen TTC (EUR)", "Total options TTC (EUR)", "Total remises TTC (EUR)"]));
    expect(row[header.indexOf("Heures réservées")]).toBe("2.5");
    expect(row[header.indexOf("% La Scène")]).toBe("75.0");
    expect(row[header.indexOf("% Le Podium")]).toBe("25.0");
    expect(row[header.indexOf("Panier moyen TTC (EUR)")]).toBe("50.00");
    expect(zero[header.indexOf("% La Scène")]).toBe("0.0");
    expect(zero[header.indexOf("% Le Podium")]).toBe("0.0");
  });
});
