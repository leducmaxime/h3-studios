/** Retourne le tarif cumulé correspondant à une quantité. */
export function priceAtQuantity(prices: number[] | null | undefined, q: number): number {
  return q <= 0 ? 0 : (prices?.[q - 1] ?? 0);
}

/** Indique si l'unité ajoutée à cette quantité est offerte. */
export function isQuantityOffered(prices: number[] | null | undefined, q: number): boolean {
  return priceAtQuantity(prices, q) - priceAtQuantity(prices, q - 1) <= 0;
}

/** Retourne les numéros (à partir de 1) des unités offertes. */
export function getOfferedUnits(prices: number[] | null | undefined, maxQuantity: number): number[] {
  return Array.from({ length: Math.max(0, maxQuantity) }, (_, i) => i + 1)
    .filter((q) => isQuantityOffered(prices, q));
}

/** Indique si le tarif marginal est inférieur au prix de la première unité. */
export function isDegressiveSessionPricing(prices: number[] | null | undefined): boolean {
  return (prices ?? []).some((_, i) =>
    i >= 1 && priceAtQuantity(prices, i + 1) - priceAtQuantity(prices, i) < priceAtQuantity(prices, 1),
  );
}

/** Formate un aperçu des tarifs par quantité, avec les unités offertes. */
export function formatSessionPricingPreview(prices: number[] | null | undefined, maxPerSession?: number): string {
  if (!prices?.length) return "—";
  const max = maxPerSession ?? prices.length;
  return Array.from({ length: Math.max(0, max) }, (_, i) => i + 1)
    .map((q) => `${q}× = ${priceAtQuantity(prices, q)}€${isQuantityOffered(prices, q) ? ` (${offeredUnitsSuffix([q])})` : ""}`)
    .join(", ");
}

/** Formate un ordinal français ("1er"/"1re" puis "2e", "3e", …). */
export function ordinalFr(n: number, opts?: { feminine?: boolean }): string {
  if (n === 1) return opts?.feminine ? "1re" : "1er";
  return `${n}e`;
}

/** Formate le suffixe signalant une ou plusieurs unités offertes. */
export function offeredUnitsSuffix(units: number[]): string {
  const ordinals = units.map((n) => ordinalFr(n));
  if (ordinals.length === 0) return "";
  if (ordinals.length === 1) return `${ordinals[0]} offert`;
  return `${ordinals.slice(0, -1).join(", ")} et ${ordinals[ordinals.length - 1]} offerts`;
}
