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
});
