/**
 * Contrat de données de la page publique /tarifs.
 *
 * La page est rendue côté serveur avec ces données (pas de fetch client) afin
 * que les tarifs restent présents dans le HTML pour le SEO et qu'aucun état de
 * chargement ne clignote. La source de vérité est la configuration admin :
 * table `pricing` (via `buildPricingGridAsOf`), table `equipment`, et le
 * réglage `peak_start_hour`.
 *
 * Les montants sont tous en euros TTC.
 */

/** Type de groupe tel que stocké en base. */
export type TarifsGroupType = "solo" | "duo" | "group";

/** Prix horaires TTC d'un type de groupe, heure creuse et heure pleine. */
export interface TarifsRate {
  /** Prix TTC par heure hors heure pleine. */
  offPeak: number;
  /** Prix TTC par heure en heure pleine (soir, week-end, jours fériés). */
  peak: number;
}

/** Grille d'un studio : un tarif par type de groupe. */
export interface TarifsStudio {
  /** Identifiant base, ex. "la-scene". */
  studioId: string;
  /** Nom affichable, ex. "La Scène". */
  studioName: string;
  /**
   * Tarifs par type de groupe. Une entrée peut manquer si l'admin n'a pas
   * configuré ce couple studio × type : l'UI doit alors omettre la ligne
   * plutôt qu'afficher 0.
   */
  rates: Partial<Record<TarifsGroupType, TarifsRate>>;
}

/** Une location proposée, telle que configurée dans l'admin Équipements. */
export interface TarifsEquipment {
  /** equipment_id, ex. "mic". */
  id: string;
  /** Nom affichable configuré en admin, ex. "Micro supplémentaire". */
  name: string;
  /** Mode de tarification configuré en admin. */
  pricingType: "session" | "hourly";
  /**
   * Tarif par séance : `sessionPricing[n - 1]` est le total TTC cumulé pour
   * `n` unités — ce n'est PAS un prix unitaire. Exemple `[3, 5, 6, 6]` :
   * 3 € pour 1 unité, 5 € pour 2, 6 € pour 3 ou 4 (la 4ᵉ est offerte).
   * `null` quand `pricingType === "hourly"`.
   */
  sessionPricing: number[] | null;
  /** Prix TTC par heure et par unité, utilisé seulement si `pricingType === "hourly"`. */
  pricePerHour: number;
  /** Quantité maximale réservable par séance. */
  maxPerSession: number;
}

/** Données complètes injectées dans la page /tarifs. */
export interface TarifsData {
  /** Grille tarifaire, dans l'ordre d'affichage souhaité. */
  studios: TarifsStudio[];
  /**
   * Heure de bascule vers le tarif heure pleine (réglage `peak_start_hour`,
   * 18 par défaut). Sert à libeller « Avant 18h » / « Après 18h ».
   */
  peakStartHour: number;
  /** Locations disponibles, triées par nom. */
  equipment: TarifsEquipment[];
}
