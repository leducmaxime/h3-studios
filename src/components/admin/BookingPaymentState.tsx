import * as React from "react";
import { CheckCircle2, Clock, AlertTriangle, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/tax";

/**
 * Statut de règlement d'une réservation — source unique de vérité visuelle.
 *
 * Dérivé uniquement du solde restant signé (`remaining`) :
 *   - remaining > 0   → "due"    (reste à payer, partiel ou total)
 *   - remaining ≈ 0   → "paid"   (soldé)
 *   - remaining < 0   → "credit" (avoir / trop-perçu)
 *
 * Ce module ne calcule rien : `remaining` doit toujours provenir des helpers
 * existants (`getBookingAmountDue`, le solde du grand livre, ou la colonne
 * `remaining` déjà calculée côté serveur). Le cas `keep_balance_due` (solde
 * conservé après annulation) n'est pas un état visuel distinct : c'est
 * l'appelant qui décide, comme aujourd'hui, s'il doit afficher ce composant
 * pour une réservation annulée (`isKeepBalanceDue` / `bookingAllowsCollection`).
 */
export type PaymentSettlement = "paid" | "due" | "credit";

const SETTLEMENT_EPSILON = 0.005;

export function getPaymentSettlement(remaining: number): PaymentSettlement {
  if (remaining < -SETTLEMENT_EPSILON) return "credit";
  if (remaining > SETTLEMENT_EPSILON) return "due";
  return "paid";
}

/** Libellé unique par état — un seul mot de vocabulaire par statut, partout. */
export function paymentSettlementLabel(remaining: number): string {
  const state = getPaymentSettlement(remaining);
  if (state === "paid") return "Soldé";
  if (state === "credit") return `Avoir ${formatPrice(Math.abs(remaining))}`;
  return `Reste ${formatPrice(remaining)}`;
}

export interface PaymentSettlementTone {
  bg: string;
  text: string;
  border: string;
  dot: string;
  /** Combinaison bg + text + border, prête pour une `Badge`. */
  badge: string;
}

// Classes Tailwind écrites en toutes lettres (jamais composées dynamiquement :
// le scanner JIT de Tailwind exige des chaînes littérales pour générer le CSS).
const TONE: Record<PaymentSettlement, PaymentSettlementTone> = {
  paid: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  due: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  credit: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

/** Ton "en retard" — solde dû déjà passé échéance (recouvrement). Remplace l'ambre par du rouge. */
const URGENT_DUE_TONE: PaymentSettlementTone = TONE.credit;

/**
 * Expose les classes de couleur brutes (sans libellé ni pastille), pour les
 * endroits qui composent leur propre mise en page — ex. faire correspondre
 * exactement la taille de police du prix total ("Total TTC 120€ TTC" en
 * `text-xl font-bold`, "Reste 40€ TTC" à la même taille juste en dessous),
 * ou teinter un bloc entier (chip de calendrier) plutôt qu'un badge.
 */
export function getPaymentSettlementTone(
  remaining: number,
  opts?: { urgent?: boolean },
): PaymentSettlementTone {
  const state = getPaymentSettlement(remaining);
  return opts?.urgent && state === "due" ? URGENT_DUE_TONE : TONE[state];
}

export interface BookingPaymentStateProps {
  /** Solde restant signé (négatif = avoir / trop-perçu). */
  remaining: number;
  /**
   * "badge" (défaut) — pastille icône + libellé : listes, dialogues, en-têtes de détail.
   * "text"  — montant coloré nu, sans pastille : colonnes "Reste" dédiées, recouvrement.
   * "dot"   — puce de couleur seule, sans texte : chips denses (calendrier).
   */
  variant?: "badge" | "text" | "dot";
  /** Densité visuelle : "sm" pour tableaux denses / chips, "md" (défaut) pour cartes et dialogues. */
  size?: "sm" | "md";
  /** Force le ton "en retard" (rouge) pour un solde dû, au lieu de l'ambre standard. */
  urgent?: boolean;
  /** Force l'affichage (true) ou le masquage (false) de l'icône. Par défaut : visible en taille "md" seulement. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Affiche le statut de règlement d'une réservation avec la même importance
 * visuelle que le prix total : couleur, poids et position portent l'info,
 * sans jamais dépendre uniquement d'un petit badge secondaire.
 */
export function BookingPaymentState({
  remaining,
  variant = "badge",
  size = "md",
  urgent = false,
  showIcon,
  className,
}: BookingPaymentStateProps) {
  const state = getPaymentSettlement(remaining);
  const tone = urgent && state === "due" ? URGENT_DUE_TONE : TONE[state];
  const label = paymentSettlementLabel(remaining);

  if (variant === "dot") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "inline-block shrink-0 rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          tone.dot,
          className,
        )}
      />
    );
  }

  if (variant === "text") {
    return (
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone.text,
          size === "sm" ? "text-xs" : "text-sm",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  const shouldShowIcon = showIcon ?? size === "md";
  const Icon = state === "paid" ? CheckCircle2 : state === "credit" ? Undo2 : urgent ? AlertTriangle : Clock;

  return (
    <Badge
      className={cn(
        tone.badge,
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs",
        className,
      )}
    >
      {shouldShowIcon && <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />}
      {label}
    </Badge>
  );
}
