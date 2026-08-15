import { describe, expect, it } from "vitest";
import { resolveBookingClientIdentity } from "@/lib/client-identity";

describe("client identity resolution", () => {
  it("leaves a legacy booking unresolved without a user profile", () => {
    const identity = resolveBookingClientIdentity({ client_type: null }, undefined);

    expect(identity.resolved).toBe(false);
    expect(identity.clientType).toBe("particulier");
  });

  it("resolves a post-migration particulier snapshot with empty legal fields", () => {
    const identity = resolveBookingClientIdentity({
      client_type: "particulier",
      legal_name: null,
      siret: null,
      rna: null,
      instagram_accounts: null,
    }, undefined);

    expect(identity.resolved).toBe(true);
    expect(identity.clientType).toBe("particulier");
    expect(identity.legalName).toBe("");
    expect(identity.siret).toBe("");
    expect(identity.rna).toBe("");
    expect(identity.instagramAccounts).toBe("");
  });
});
