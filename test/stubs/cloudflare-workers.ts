/**
 * Bouchon de `cloudflare:workers` pour Vitest.
 *
 * Plusieurs modules de `src/lib` importent `env` / `waitUntil` depuis le
 * runtime Cloudflare, spécifieur que Node ne sait pas résoudre. Sans ce
 * bouchon, un test qui importe l'un de ces modules échoue au chargement, ce qui
 * poussait jusqu'ici à recopier la logique dans le test plutôt qu'à tester le
 * vrai code (cf. `auth.test.ts`, qui réimplémente PBKDF2).
 *
 * Aliasé dans `vitest.config.ts`. N'affecte que les tests.
 */
export const env: Record<string, unknown> = {};

export function waitUntil(promise: Promise<unknown>): void {
  // En test, on ne garde pas l'invocation en vie : on absorbe simplement le
  // rejet pour éviter les « unhandled rejection ».
  void Promise.resolve(promise).catch(() => undefined);
}
