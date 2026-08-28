import { describe, expect, it } from "vitest";
import {
  buildCancellationEmailHtml,
  buildEmailHtml,
  buildLoyaltyCodeEmailHtml,
  daysUntilDate,
  loyaltyCodeEmailSubject,
  reminderEmailSubject,
  reminderHeading,
  reminderWhenPhrase,
} from "@/lib/email";

const baseEmail = {
  bookingRef: "H3-88",
  studioId: "la-scene",
  date: "2026-08-27",
  startTime: "18:00",
  endTime: "20:00",
  groupType: "group",
  equipment: [],
  equipmentPrice: 0,
  totalPrice: 80,
  paymentMethod: "cash",
  paymentStatus: "pay-on-site",
  userName: "Léa",
  userEmail: "lea@example.com",
  userPhone: "0612345678",
};

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
    expect(output).toContain("https://search.google.com/local/writereview?placeid=ChIJi9IayzcL5kcRKCQIsydm0kA");
    expect(output).toContain("Laisser un avis Google");
    expect(output).toContain("Après votre répétition");
    expect(output).toContain("le plus beau soutien que vous puissiez nous apporter");
    expect(output).toContain("Cela prend moins d'une minute");
  });

  it("shows a Remise line for an admin manual discount without a promo code", () => {
    const output = buildEmailHtml({
      ...baseEmail,
      totalPrice: 60,
      promoDiscount: 20,
    });

    expect(output).toContain("Remise");
    expect(output).toContain("-20€ TTC");
    expect(output).not.toContain("Code promo");
    expect(output).toContain("60€ TTC");
  });

  it("keeps the promo-code label when a code is applied", () => {
    const output = buildEmailHtml({
      ...baseEmail,
      totalPrice: 60,
      promoCode: "H3OFF",
      promoDiscount: 20,
    });

    expect(output).toContain("Code promo");
    expect(output).toContain("H3OFF");
    expect(output).toContain("-20€ TTC");
    expect(output).not.toContain(">Remise<");
  });

  it("shows Remise on a multi-slot confirmation with a manual discount", () => {
    const output = buildEmailHtml({
      ...baseEmail,
      totalPrice: 140,
      promoDiscount: 20,
      allSlots: [
        { ...baseEmail, bookingRef: "H3-88", totalPrice: 80 },
        { ...baseEmail, bookingRef: "H3-89", date: "2026-08-28", totalPrice: 80 },
      ],
    });

    expect(output).toContain("Remise");
    expect(output).toContain("-20€ TTC");
    expect(output).not.toContain("Code promo");
    expect(output).toContain("140€ TTC");
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
    expect(due).not.toContain("writereview");
    expect(waived).not.toContain("writereview");
  });
});

describe("booking reminder copy", () => {
  it("maps calendar offsets to French timing phrases", () => {
    expect(daysUntilDate("2026-08-22", "2026-08-22")).toBe(0);
    expect(daysUntilDate("2026-08-22", "2026-08-23")).toBe(1);
    expect(daysUntilDate("2026-08-22", "2026-08-27")).toBe(5);
    expect(daysUntilDate("2026-08-22", "2026-08-21")).toBe(-1);
    expect(reminderWhenPhrase(0)).toBe("aujourd'hui");
    expect(reminderWhenPhrase(1)).toBe("demain");
    expect(reminderWhenPhrase(5)).toBe("dans 5 jours");
    expect(reminderWhenPhrase(-1)).toBeNull();
    expect(reminderHeading("aujourd'hui")).toBe("Tic, Tac... Votre session approche !");
    expect(reminderHeading("demain")).toBe("Tic, Tac... Votre session approche !");
    expect(reminderHeading("dans 5 jours")).toBe("Tic, Tac... Votre session approche !");
  });

  it("uses the same centered heading for every reminder and keeps the booking details", () => {
    const today = buildEmailHtml({
      ...baseEmail,
      reminder: { whenPhrase: "aujourd'hui", remainingDue: 0 },
    });
    expect(today).toContain("Tic, Tac... Votre session approche !");
    expect(today).toContain('font-weight:600;text-align:center;');
    expect(today).toContain("votre session à H3 Studios est <strong>aujourd'hui</strong>");
    expect(today).toContain("H3-88");
    expect(today).toContain("La Scène");
    expect(today).toContain("18:00 → 20:00");
    expect(today).toContain("Laisser un avis Google");
    expect(today).not.toContain("Type de client");

    const withClientType = buildEmailHtml({
      ...baseEmail,
      clientType: "particulier",
      reminder: { whenPhrase: "demain", remainingDue: 0 },
    });
    expect(withClientType).not.toContain("Type de client");

    const tomorrow = buildEmailHtml({
      ...baseEmail,
      reminder: { whenPhrase: "demain", remainingDue: 0 },
    });
    expect(tomorrow).toContain("Tic, Tac... Votre session approche !");
    expect(tomorrow).toContain("<strong>demain</strong>");

    const later = buildEmailHtml({
      ...baseEmail,
      reminder: { whenPhrase: "dans 5 jours", remainingDue: 0 },
    });
    expect(later).toContain("Tic, Tac... Votre session approche !");
    expect(later).toContain("<strong>dans 5 jours</strong>");
  });

  it("mentions money only when a balance remains", () => {
    const paid = buildEmailHtml({
      ...baseEmail,
      reminder: { whenPhrase: "demain", remainingDue: 0 },
    });
    expect(paid).not.toContain("Reste à payer");
    expect(paid).not.toContain("Mode de paiement");
    expect(paid).not.toContain("Total TTC");
    expect(paid).toContain("writereview");

    const due = buildEmailHtml({
      ...baseEmail,
      reminder: { whenPhrase: "demain", remainingDue: 45 },
    });
    expect(due).toContain("Reste à payer");
    expect(due).toContain("45");
    expect(due).toContain("espèces ou CB");
    expect(due).not.toContain("Mode de paiement");
    expect(due).not.toContain("Total TTC");
  });

  it("builds a timing-aware subject", () => {
    expect(reminderEmailSubject({
      ...baseEmail,
      reminder: { whenPhrase: "aujourd'hui", remainingDue: 0 },
    })).toBe("Rappel — aujourd'hui · 18:00→20:00 — H3 Studios");
    expect(reminderEmailSubject({
      ...baseEmail,
      reminder: { whenPhrase: "dans 5 jours", remainingDue: 0 },
    })).toContain("dans 5 jours");
  });
});

describe("loyalty code email copy", () => {
  const baseLoyalty = {
    clientName: "Estelle",
    clientEmail: "estelle@example.com",
    code: "FID-36SNQFJ7",
    threshold: 2,
    expiresAt: "2026-10-27",
    bookingUrl: "https://h3-studios.fr/reservation",
  };

  const percentage = { ...baseLoyalty, discountType: "percentage" as const, discountValue: 50, scope: "first_booking" as const };
  const fixed = { ...baseLoyalty, discountType: "fixed" as const, discountValue: 10, scope: "cart" as const };

  // Décision produit : la limitation à la 1ʳᵉ séance n'est plus annoncée au
  // client, alors qu'elle reste appliquée au panier. Ce test verrouille
  // l'absence de la mention, pas la règle métier.
  it("n'annonce aucune restriction de portée pour un pourcentage", () => {
    const html = buildLoyaltyCodeEmailHtml(percentage);
    expect(html).not.toMatch(/première/i);
    expect(html).toContain("Saisissez ce code dans votre panier au moment de réserver.");
    expect(html).not.toContain("La remise s'applique");
    expect(loyaltyCodeEmailSubject(percentage)).toBe("Votre code fidélité : -50 %");
  });

  it("ne laisse ni ponctuation orpheline ni paragraphe vide sans libellé de portée", () => {
    const html = buildLoyaltyCodeEmailHtml(percentage);
    const hero = /<!-- Hero: discount value -->[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
    expect(hero).toContain("-50 %");
    expect(hero).not.toMatch(/>\s*<\/p>/);
    expect(html).toContain("vous attend : -50 %, valable jusqu'au");
  });

  it("conserve la portée panier pour un montant fixe", () => {
    const html = buildLoyaltyCodeEmailHtml(fixed);
    expect(html).toContain("sur votre prochaine réservation");
    expect(html).toContain("La remise s'applique sur le total de votre prochaine réservation.");
    expect(loyaltyCodeEmailSubject(fixed)).toBe("Votre code fidélité : -10 € sur votre prochaine réservation");
  });
});
