import { describe, expect, it } from "vitest";
import { buildEmailHtml } from "@/lib/email";

describe("buildEmailHtml copy", () => {
  it("uses the current cancellation policy", () => {
    const output = buildEmailHtml({
      bookingRef: "TEST-123",
      studioId: "la-scene",
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:00",
      groupType: "solo",
      equipment: [],
      equipmentPrice: 0,
      totalPrice: 10,
      paymentMethod: "card",
      paymentStatus: "paid",
      userName: "Test",
      userEmail: "test@example.com",
      userPhone: "0612345678",
    });

    expect(output).toContain("Modification / Annulation :");
    expect(output).not.toContain("le créneau vous sera facturé");
    expect(output).toContain("toute annulation effectuée moins de 24 heures avant le début de la réservation est non remboursable");
    expect(output).toContain("Si vous avez choisi le paiement sur place, le montant de la réservation reste intégralement dû");
    expect(output).toContain("06.13.44.08.75");
  });
});
