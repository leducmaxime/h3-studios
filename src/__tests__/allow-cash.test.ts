import { describe, expect, it } from "vitest";
import { isCashPaymentForbidden, parseAllowCash } from "@/lib/booking";

describe("parseAllowCash", () => {
  it("allows cash unless explicitly disabled", () => {
    expect(parseAllowCash(null)).toBe(true);
    expect(parseAllowCash(undefined)).toBe(true);
    expect(parseAllowCash("")).toBe(true);
    expect(parseAllowCash("true")).toBe(true);
    expect(parseAllowCash("false")).toBe(false);
  });
});

describe("isCashPaymentForbidden", () => {
  it("forbids paid cash when cash is disabled", () => {
    expect(isCashPaymentForbidden("cash", false, 10)).toBe(true);
    expect(isCashPaymentForbidden("cash", false, 0.5)).toBe(true);
    expect(isCashPaymentForbidden("cash", false, 0)).toBe(false);
    expect(isCashPaymentForbidden("cash", false, -1)).toBe(false);
    expect(isCashPaymentForbidden("cash", true, 10)).toBe(false);
    expect(isCashPaymentForbidden("card", false, 10)).toBe(false);
  });
});
