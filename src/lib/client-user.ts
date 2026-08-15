/**
 * Canonical shape of an authenticated client (customer) account.
 *
 * This module is intentionally types-only: no runtime code, no `"use client"`
 * directive, no imports. It is safe to import from both the Worker and the
 * browser bundle, which is why the shared shape lives here rather than in
 * `client-auth.ts` (server-only, pulls in D1) or `client-auth-store.ts`
 * (client-only).
 *
 * Always import it with `import type` so the reference is erased at build time.
 */
export interface ClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  // Runtime SELECT at src/lib/client-auth.ts:44-45 is extended in phase 2;
  // otherwise logged-in sessions read undefined and fall back to particulier.
  client_type: string | null;
  legal_name: string | null;
  siret: string | null;
  rna: string | null;
  instagram_accounts: string | null;
}
