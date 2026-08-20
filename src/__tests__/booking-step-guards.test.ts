import { describe, expect, it } from "vitest";
import {
  applyClearTimeRange,
  applyGoBack,
  applySelectDate,
  applySetGroupType,
  applyStepGuards,
  deserializeState,
  hasSlotSelection,
} from "@/components/booking/useBookingWithRouter";

const selection = { selectedDate: new Date("2026-08-20"), startTime: "10:00", endTime: "11:00", studioId: "la-scene" as const };
const base = { step: "options" as const, ...selection, groupType: "solo" as const, equipment: [{ id: "mic", quantity: 1 }], cart: [], isAddingNew: false, bookingRef: null, paymentMethod: null };

describe("booking step guards", () => {
  it("recognizes only a complete slot selection", () => {
    expect(hasSlotSelection(selection)).toBe(true);
    expect(hasSlotSelection({ ...selection, endTime: null })).toBe(false);
    expect(hasSlotSelection({ ...selection, selectedDate: null })).toBe(false);
    expect(hasSlotSelection({ ...selection, studioId: null })).toBe(false);
  });

  it("preserves the selection and equipment when the same date is selected again", () => {
    const result = applySelectDate(base, new Date("2026-08-20T10:00:00Z"));
    expect(result).toBe(base);
  });

  it("resets a changed date without clearing equipment", () => {
    const result = applySelectDate(base, new Date("2026-08-21T12:00:00Z"));
    expect(result.selectedDate).toEqual(new Date("2026-08-21T12:00:00Z"));
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
    expect(result.equipment).toEqual(base.equipment);
  });

  it("clears a time range without clearing equipment", () => {
    const result = applyClearTimeRange(base);
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
    expect(result.studioId).toBeNull();
    expect(result.equipment).toEqual(base.equipment);
  });

  it("clears equipment when the group type is changed", () => {
    expect(applySetGroupType(base, "duo")).toMatchObject({ groupType: "duo", step: "creneau", equipment: [] });
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

  it("cancels add-another from groupe back to the cart", () => {
    const result = applyGoBack({ ...base, step: "groupe", isAddingNew: true, cart: [{} as never] });
    expect(result).toMatchObject({ step: "panier", isAddingNew: false, groupType: null, equipment: [] });
  });

  it("converges every guard input to a fixed point", () => {
    const steps = ["groupe", "creneau", "options", "panier", "coordonnees", "paiement", "termine"] as const;
    for (const targetStep of steps) {
      for (const cart of [[], [{} as never]]) {
        for (const isAddingNew of [false, true]) {
          for (const groupType of [null, "solo"] as const) {
            for (const selected of [false, true]) {
              let current = targetStep;
              const seen = new Set<string>();
              for (let hop = 0; hop < 8; hop++) {
                expect(seen.has(current)).toBe(false);
                seen.add(current);
                const next = applyStepGuards({ cart, isAddingNew, groupType, hasSlotSelection: selected, targetStep: current }).step;
                if (next === current) break;
                current = next;
                expect(hop).toBeLessThan(7);
              }
              const fixed = applyStepGuards({ cart, isAddingNew, groupType, hasSlotSelection: selected, targetStep: current }).step;
              expect(fixed).toBe(current);
            }
          }
        }
      }
    }
  });

  it("deserializes a pre-options persisted booking without losing equipment", () => {
    const oldBlob = {
      step: "creneau",
      selectedDate: "2026-08-20T10:00:00.000Z",
      startTime: "10:00",
      endTime: "11:00",
      studioId: "la-scene",
      groupType: "solo",
      equipment: [{ id: "mic", quantity: 1 }],
      cart: [],
    } as unknown as Parameters<typeof deserializeState>[0];
    const restored = deserializeState(oldBlob);
    expect(restored.step).toBe("creneau");
    expect(restored.equipment).toEqual(oldBlob.equipment);
    expect(restored.selectedDate).toEqual(new Date("2026-08-20T10:00:00.000Z"));
  });
});
