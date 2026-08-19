import { describe, expect, it } from "vitest";
import { buildCancellationEmailHtml, buildEmailHtml } from "@/lib/email";

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

  it("mentions the remaining amount only when keepBalanceDue", () => {
    const due = buildCancellationEmailHtml({
      bookingRef: "H3-46",
      studioId: "la-scene",
      date: "2026-08-20",
      startTime: "18:00",
      endTime: "20:00",
      userName: "Estelle",
      userEmail: "estelle@example.com",
      keepBalanceDue: true,
      remaining: 103,
    });
    expect(due).toContain("Réservation annulée");
    expect(due).toContain("H3-46");
    expect(due).toContain("103");
    expect(due).toContain("reste intégralement dû");

    const waived = buildCancellationEmailHtml({
      bookingRef: "H3-46",
      studioId: "la-scene",
      date: "2026-08-20",
      startTime: "18:00",
      endTime: "20:00",
      userName: "Estelle",
      userEmail: "estelle@example.com",
      keepBalanceDue: false,
      remaining: 103,
    });
    expect(waived).toContain("Aucun montant n'est dû");
    expect(waived).not.toContain("reste intégralement dû");
  });
});
