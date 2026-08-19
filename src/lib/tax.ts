/** TVA française standard. Les montants stockés restent TTC. */
export const VAT_RATE = 0.2;
export const VAT_PERCENT = 20;

export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** HT = arrondi(TTC / 1,20, 2 décimales). */
export function ttcToHt(ttc: number): number {
  return roundCents(ttc / (1 + VAT_RATE));
}

/** TVA = TTC − HT pour que la somme tombe juste. */
export function vatFromTtc(ttc: number): number {
  const normalized = roundCents(ttc);
  return roundCents(normalized - ttcToHt(normalized));
}

export function splitTtc(ttc: number): { ht: number; vat: number; ttc: number } {
  const normalized = roundCents(ttc);
  const ht = ttcToHt(normalized);
  return { ht, vat: roundCents(normalized - ht), ttc: normalized };
}

/** Format euro sans mention fiscale : `10€`, `10,50€`. */
export function formatEuro(amount: number): string {
  return amount % 1 === 0 ? `${amount}€` : `${amount.toFixed(2).replace(".", ",")}€`;
}

export type FormatPriceOptions = {
  /** Sans suffixe TTC — pour HT, TVA, ou un libellé qui porte déjà la mention. */
  bare?: boolean;
};

/** Format d'affichage par défaut : `10€ TTC`, `10,50€ TTC`. */
export function formatPrice(amount: number, opts?: FormatPriceOptions): string {
  const formatted = formatEuro(amount);
  return opts?.bare ? formatted : `${formatted} TTC`;
}

export function formatTaxBreakdown(ttc: number): { ht: string; vat: string; ttc: string } {
  const parts = splitTtc(ttc);
  return {
    ht: formatEuro(parts.ht),
    vat: formatEuro(parts.vat),
    ttc: formatPrice(parts.ttc),
  };
}
