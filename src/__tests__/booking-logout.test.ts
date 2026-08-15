import { describe, it, expect } from "vitest";
import { LOGOUT_CLEARED_FIELDS } from "@/components/booking/useBookingWithRouter";

describe("clientLogout state clearing (booking coordinates)", () => {
  it("clears personal/prefill fields and account-creation state", () => {
    const personalKeys = [
      "userName",
      "userEmail",
      "userPhone",
      "bandName",
      "clientType",
      "legalName",
      "siret",
      "rna",
      "instagramAccounts",
      "billingAddress",
      "billingPostalCode",
      "billingCity",
      "createAccount",
      "accountPassword",
      "accountPasswordConfirm",
      "accountStatus",
    ];
    for (const key of personalKeys) {
      expect(key in LOGOUT_CLEARED_FIELDS).toBe(true);
    }
  });

  it("resets cleared fields to empty values (never stale profile data)", () => {
    expect(LOGOUT_CLEARED_FIELDS.clientType).toBe("particulier");
    expect(LOGOUT_CLEARED_FIELDS.userEmail).toBe("");
    expect(LOGOUT_CLEARED_FIELDS.userName).toBe("");
    expect(LOGOUT_CLEARED_FIELDS.billingAddress).toBe("");
    expect(LOGOUT_CLEARED_FIELDS.createAccount).toBe(false);
    expect(LOGOUT_CLEARED_FIELDS.accountStatus).toBeNull();
  });

  it("retains non-personal cart/slot selections for the pending booking", () => {
    const retainedKeys = [
      "cart",
      "step",
      "selectedDate",
      "startTime",
      "endTime",
      "studioId",
      "groupType",
      "appliedPromo",
      "promoDiscount",
      "isAddingNew",
      "bookingRef",
      "equipment",
    ];
    for (const key of retainedKeys) {
      expect(key in LOGOUT_CLEARED_FIELDS).toBe(false);
    }
  });
});
