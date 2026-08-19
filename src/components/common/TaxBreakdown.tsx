import { splitTtc, formatEuro, VAT_PERCENT } from "@/lib/tax";

interface TaxBreakdownProps {
  /** Montant total TTC à ventiler. */
  ttc: number;
}

/**
 * Ventilation légale d'un total TTC : deux lignes discrètes (HT + TVA)
 * à afficher juste au-dessus de la ligne « Total TTC » existante.
 */
export function TaxBreakdown({ ttc }: TaxBreakdownProps) {
  const { ht, vat } = splitTtc(ttc);
  return (
    <>
      <div className="flex items-center justify-between text-sm text-white/60">
        <span>HT</span>
        <span>{formatEuro(ht)}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-white/60">
        <span>TVA {VAT_PERCENT}%</span>
        <span>{formatEuro(vat)}</span>
      </div>
    </>
  );
}
