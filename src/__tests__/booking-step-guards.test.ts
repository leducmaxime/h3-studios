import { describe, expect, it } from "vitest";
import { applyGoBack, applyStepGuards, hasSlotSelection } from "@/components/booking/useBookingWithRouter";

const selection = { selectedDate: new Date("2026-08-20"), startTime: "10:00", endTime: "11:00", studioId: "la-scene" as const };
const base = { step: "options" as const, ...selection, groupType: "solo" as const, equipment: [{ id: "mic", quantity: 1 }], cart: [], isAddingNew: false, bookingRef: null, paymentMethod: null };

describe("booking step guards", () => {
  it("recognizes only a complete slot selection", () => {
    expect(hasSlotSelection(selection)).toBe(true);
    expect(hasSlotSelection({ ...selection, endTime: null })).toBe(false);
  });

  it("checks cart lock before slot completeness", () => {
    expect(applyStepGuards({ cart: [{} as never], isAddingNew: false, groupType: null, hasSlotSelection: false, targetStep: "options" })).toEqual({ step: "panier", isRedirect: true });
  });

  /**
   * confirmBooking() moves to panier WITHOUT clearing the slot selection, so a
   * confirmed booking still satisfies hasSlotSelection. The cart lock — not the
   * selection guard — is what prevents editing a booking already in the cart.
   */
  it("keeps the cart lock ahead of a still-complete selection after add-to-cart", () => {
    expect(applyStepGuards({ cart: [{} as never], isAddingNew: false, groupType: "solo", hasSlotSelection: true, targetStep: "options" })).toEqual({ step: "panier", isRedirect: true });
  });

  it("lifts the cart lock while adding another booking", () => {
    expect(applyStepGuards({ cart: [{} as never], isAddingNew: true, groupType: "solo", hasSlotSelection: true, targetStep: "options" })).toEqual({ step: "options", isRedirect: false });
  });

  it("guards options by group then selection", () => {
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: null, hasSlotSelection: true, targetStep: "options" }).step).toBe("groupe");
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: "solo", hasSlotSelection: false, targetStep: "options" }).step).toBe("creneau");
  });

  it("allows options once group and selection are complete", () => {
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: "solo", hasSlotSelection: true, targetStep: "options" })).toEqual({ step: "options", isRedirect: false });
  });

  it("keeps the pre-existing guards intact", () => {
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: null, hasSlotSelection: false, targetStep: "creneau" }).step).toBe("groupe");
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: "solo", hasSlotSelection: true, targetStep: "panier" }).step).toBe("groupe");
    expect(applyStepGuards({ cart: [], isAddingNew: false, groupType: "solo", hasSlotSelection: true, targetStep: "coordonnees" }).step).toBe("groupe");
    expect(applyStepGuards({ cart: [{} as never], isAddingNew: false, groupType: "solo", hasSlotSelection: true, targetStep: "termine" }).step).toBe("groupe");
  });

  it("backs from options without clearing the selection, then clears it on the second press", () => {
    const first = applyGoBack(base);
    expect(first.step).toBe("creneau");
    expect(first.equipment).toHaveLength(1);
    const second = applyGoBack({ ...first, step: "creneau" });
    expect(second.selectedDate).toBeNull();
    expect(second.equipment).toEqual([]);
  });

  it("backs from creneau without a date to groupe and clears group", () => {
    const result = applyGoBack({ ...base, step: "creneau", selectedDate: null, startTime: null, endTime: null, studioId: null });
    expect(result.step).toBe("groupe");
    expect(result.groupType).toBeNull();
  });

  it("keeps panier as a back dead-end and preserves other back paths", () => {
    expect(applyGoBack({ ...base, step: "panier" }).step).toBe("panier");
    expect(applyGoBack({ ...base, step: "coordonnees" }).step).toBe("panier");
    expect(applyGoBack({ ...base, step: "paiement" }).step).toBe("coordonnees");
  });
});
