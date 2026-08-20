import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_LABELS,
  STORED_PAYMENT_STATUS_LABELS,
  CLIENT_DISPLAY_PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_FAQ_HREF,
  BOOKING_STATUS_LABELS,
  DISPLAY_PAYMENT_STATUS_LABELS,
  GROUP_TYPE_LABELS,
  GROUP_TYPE_LABELS_LONG,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_LABELS_SHORT,
  PAYMENT_RECORD_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  STUDIO_LABELS,
  STUDIO_LABELS_SHORT,
  adminRoleLabel,
  storedPaymentStatusLabel,
  clientDisplayPaymentStatusLabel,
  bookingStatusLabel,
  displayPaymentStatusLabel,
  groupTypeLabel,
  paymentMethodLabel,
  paymentMethodLabelShort,
  paymentRecordStatusLabel,
  paymentTypeLabel,
  studioLabel,
  studioLabelShort,
} from "@/lib/labels";

describe("libellés français partagés", () => {
  it("conserve le contenu complet de chaque map exportée", () => {
    expect(GROUP_TYPE_LABELS).toEqual({ solo: "Solo", duo: "Duo", group: "Groupe" });
    expect(GROUP_TYPE_LABELS_LONG).toEqual({ solo: "Solo / Prof particulier", duo: "Duo", group: "Groupe (3+)" });
    expect(STUDIO_LABELS).toEqual({ "la-scene": "La Scène", "le-podium": "Le Podium" });
    expect(STUDIO_LABELS_SHORT).toEqual({ "la-scene": "Scène", "le-podium": "Podium" });
    expect(BOOKING_STATUS_LABELS).toEqual({ confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée", "no-show": "Absent" });
    expect(PAYMENT_METHOD_LABELS).toEqual({ card: "Carte bancaire", cash: "Espèces", transfer: "Virement", check: "Chèque", cheque: "Chèque" });
    expect(PAYMENT_METHOD_LABELS_SHORT).toEqual({ card: "CB", cash: "Espèces", transfer: "Virement", check: "Chèque", cheque: "Chèque" });
    expect(STORED_PAYMENT_STATUS_LABELS).toEqual({ pending: "En attente", paid: "Payé", "pay-on-site": "Paiement sur place" });
    expect(PAYMENT_RECORD_STATUS_LABELS).toEqual({ pending: "En attente", paid: "Payé", refunded: "Remboursé", "partial-refund": "Remboursé partiel" });
    expect(DISPLAY_PAYMENT_STATUS_LABELS).toEqual({ paid: "Payé", pending: "En attente", "pay-on-site": "Reste à payer", cancelled: "Annulée", "paid-before-cancel": "Payée avant annulation", refunded: "Remboursement effectué" });
    expect(PAYMENT_TYPE_LABELS).toEqual({ "on-site": "Sur place", online: "En ligne" });
    expect(ADMIN_ROLE_LABELS).toEqual({ "super-admin": "Super administrateur", operator: "Opérateur" });
  });

  it("ne restitue jamais une valeur brute inconnue", () => {
    const accessors = [
      groupTypeLabel,
      studioLabel,
      studioLabelShort,
      bookingStatusLabel,
      paymentMethodLabel,
      paymentMethodLabelShort,
      storedPaymentStatusLabel,
      clientDisplayPaymentStatusLabel,
      paymentRecordStatusLabel,
      displayPaymentStatusLabel,
      paymentTypeLabel,
      adminRoleLabel,
    ];
    for (const accessor of accessors) {
      for (const value of [null, undefined, "", "unknown"] as const) {
        expect(accessor(value as never)).toBe("—");
      }
    }
  });

  it("utilise la formulation client et le lien FAQ dédiés", () => {
    expect(CLIENT_DISPLAY_PAYMENT_STATUS_LABELS["paid-before-cancel"]).toBe("Non remboursable, voir FAQ");
    expect(clientDisplayPaymentStatusLabel("paid-before-cancel")).toBe("Non remboursable, voir FAQ");
    expect(clientDisplayPaymentStatusLabel("refunded")).toBe("Remboursement effectué");
    expect(clientDisplayPaymentStatusLabel("pay-on-site")).toBe("Reste à payer");
    expect(clientDisplayPaymentStatusLabel(null)).toBe("—");
    // Glossaire stocké et vocabulaire de badge distincts volontairement.
    expect(STORED_PAYMENT_STATUS_LABELS["pay-on-site"]).not.toBe(DISPLAY_PAYMENT_STATUS_LABELS["pay-on-site"]);
    expect(PAYMENT_STATUS_FAQ_HREF).toBe("/a-propos#faq-annulation");
  });

  it("gère les alias et variantes de copie attendus", () => {
    expect(paymentMethodLabel("cheque")).toBe("Chèque");
    expect(paymentMethodLabel("check")).toBe("Chèque");
    expect(groupTypeLabel("group")).toBe("Groupe");
    expect(groupTypeLabel("group", { long: true })).toBe("Groupe (3+)");
    expect(bookingStatusLabel("pending")).toBe("En attente");
  });
});
