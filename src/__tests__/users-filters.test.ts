import { describe, expect, it } from "vitest";
import { buildUserFilterConditions } from "@/lib/db";

describe("buildUserFilterConditions", () => {
  it("filters by the live user client type", () => {
    const result = buildUserFilterConditions({ clientType: "entreprise" });

    expect(result.conditions).toContain("u.client_type = ?");
    expect(result.params).toEqual(["entreprise"]);
  });

  it("does not add a client type condition when omitted", () => {
    const result = buildUserFilterConditions({ isBlocked: true });

    expect(result.conditions).not.toContain("u.client_type = ?");
    expect(result.conditions).toContain("u.is_blocked = ?");
    expect(result.params).toEqual([1]);
  });

  it("combines client type and blocked filters", () => {
    const result = buildUserFilterConditions({ clientType: "association", isBlocked: false });

    expect(result.conditions).toEqual(["u.is_blocked = ?", "u.client_type = ?"]);
    expect(result.params).toEqual([0, "association"]);
  });

  it("filters by loyalty enabled", () => {
    const result = buildUserFilterConditions({ loyaltyEnabled: true });

    expect(result.conditions).toContain("u.loyalty_enabled = ?");
    expect(result.params).toEqual([1]);
  });

  it("filters by loyalty disabled", () => {
    const result = buildUserFilterConditions({ loyaltyEnabled: false });

    expect(result.conditions).toContain("u.loyalty_enabled = ?");
    expect(result.params).toEqual([0]);
  });

  it("does not add a loyalty condition when omitted", () => {
    const result = buildUserFilterConditions({ isBlocked: true });

    expect(result.conditions).not.toContain("u.loyalty_enabled = ?");
  });

  it("searches live identity fields and historical booking band names", () => {
    const result = buildUserFilterConditions({ search: "  La Noirmoutrine  " });

    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0]).toContain("u.name LIKE ?");
    expect(result.conditions[0]).toContain("u.first_name LIKE ?");
    expect(result.conditions[0]).toContain("u.last_name LIKE ?");
    expect(result.conditions[0]).toContain("u.band_name LIKE ?");
    expect(result.conditions[0]).toContain("u.legal_name LIKE ?");
    expect(result.conditions[0]).toContain("EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = u.id AND b.band_name LIKE ?)");
    expect(result.params).toEqual(Array(8).fill("%La Noirmoutrine%"));
  });

  it("ignores blank search terms", () => {
    const result = buildUserFilterConditions({ search: "   " });

    expect(result.conditions).toEqual([]);
    expect(result.params).toEqual([]);
  });
});
