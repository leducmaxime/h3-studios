import { formatPrice } from "@/lib/tax";
import { cn } from "@/lib/utils";

/**
 * Mention fiscale subordonnée : taille relative au montant (0.75em) avec un
 * plancher de ~10px pour rester lisible aux plus petites tailles, et vraie
 * opacité réduite (computed `opacity` < 1, pas seulement un alpha de couleur).
 */
const MENTION_CLASSES = "text-[max(10px,0.75em)] opacity-60";

interface PriceMentionProps {
  /** Suffixe d'unité accolé à la mention : "/Heure", "/h", "/séance", … */
  unit?: string;
  className?: string;
}

/**
 * La mention « TTC » (avec son unité éventuelle) seule, dans son propre nœud.
 * L'espace réel avant « TTC » est conservé : copie et lecteurs d'écran
 * restituent « 18€ TTC », jamais « 18€TTC ».
 */
export function PriceMention({ unit, className }: PriceMentionProps) {
  return (
    <span className={cn(MENTION_CLASSES, className)}>
      {" "}TTC{unit}
    </span>
  );
}

interface PriceProps {
  /** Montant TTC en euros. */
  amount: number;
  /** Suffixe d'unité accolé à la mention : "/Heure", "/h", "/séance", … */
  unit?: string;
  /**
   * Sans mention — quand le libellé environnant la porte déjà
   * (ex. « Total TTC » juste à côté du montant).
   */
  bare?: boolean;
  className?: string;
}

/**
 * Montant TTC avec sa mention en annotation subordonnée (issue #39) :
 * le nombre reste dominant, « TTC » (+ l'unité) rend dans un nœud dédié,
 * plus petit et estompé mais toujours lisible — jamais masqué ni retiré.
 * La paire ne se coupe pas (whitespace-nowrap) et reste sur la ligne de base.
 */
export function Price({ amount, unit, bare = false, className }: PriceProps) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span>{formatPrice(amount, { bare: true })}</span>
      {!bare && <PriceMention unit={unit} />}
    </span>
  );
}
