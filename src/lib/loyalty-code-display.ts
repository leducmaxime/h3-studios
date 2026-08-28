// ─── Codes fidélité — vocabulaire partagé entre Pricing.tsx et UserDetail.tsx ─
//
// Les deux pages admin affichent des listes de codes promo fidélité
// (générés automatiquement, un par palier atteint). Un gérant doit lire le
// même badge, la même couleur et le même libellé qu'il regarde l'onglet
// "Codes Promo" global ou la fiche d'un client précis : ce module centralise
// ce vocabulaire pour que les deux pages ne divergent jamais.

import { type DbPromoCode } from "@/lib/db-types";
import { isPromoCodeExpired } from "@/lib/utils";

export type LoyaltyCodeStatus = "used" | "expired" | "valid";

export function getLoyaltyCodeStatus(promo: DbPromoCode, todayISO: string): LoyaltyCodeStatus {
  if (promo.used_at) return "used";
  if (isPromoCodeExpired(promo.expires_at, todayISO)) return "expired";
  return "valid";
}

export function loyaltyStatusBadgeProps(status: LoyaltyCodeStatus): { label: string; className: string } {
  switch (status) {
    case "used":
      return { label: "Utilisé", className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
    case "expired":
      return { label: "Expiré", className: "bg-red-500/15 text-red-400 border-red-500/30" };
    case "valid":
      return { label: "Valable", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  }
}

/**
 * Montant seul, sans mention de portée. La colonne `scope` continue de régir
 * le calcul (`first_booking` pour les pourcentages, `cart` pour les montants
 * fixes) mais n'est plus affichée, ni ici ni dans l'email envoyé au client.
 */
export function formatLoyaltyDiscount(promo: DbPromoCode): string {
  return promo.type === "percentage" ? `-${promo.value} %` : `-${promo.value}€ TTC`;
}

/**
 * Un code ne mérite un bouton de renvoi que s'il a encore une chance
 * d'aboutir : ni utilisé, ni expiré, ni désactivé. Le serveur revalide
 * intégralement ces conditions (source de vérité) ; ce prédicat sert
 * uniquement côté UI à ne pas afficher une action vouée à échouer plutôt
 * que de l'afficher grisée.
 */
export function isLoyaltyCodeResendable(promo: DbPromoCode, todayISO: string): boolean {
  if (promo.used_at) return false;
  if (isPromoCodeExpired(promo.expires_at, todayISO)) return false;
  if (promo.is_active !== 1) return false;
  return true;
}
