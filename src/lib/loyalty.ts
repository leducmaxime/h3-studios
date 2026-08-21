export type LoyaltyDiscountType = "percentage" | "fixed";
export interface LoyaltyConfig { enabled: boolean; type: LoyaltyDiscountType | null; value: number; threshold: number }
export interface LoyaltyProgress {
  configured: boolean; threshold: number;
  pastEligibleBookings: number; awardsGranted: number; earnedAwards: number;
  counter: number; remainingToNextAward: number; isDue: boolean;
}
export type DiscountSource = "manual" | "promo" | "loyalty" | "none";

export function readLoyaltyConfig(row: { loyalty_enabled?: number | null; loyalty_discount_type?: string | null; loyalty_discount_value?: number | null; loyalty_threshold?: number | null }): LoyaltyConfig {
  return { enabled: row.loyalty_enabled === 1, type: row.loyalty_discount_type === "percentage" || row.loyalty_discount_type === "fixed" ? row.loyalty_discount_type : null, value: Number(row.loyalty_discount_value) || 0, threshold: Number(row.loyalty_threshold) || 0 };
}
export function isLoyaltyConfigured(config: LoyaltyConfig): boolean {
  return config.enabled && config.threshold >= 1 && config.value > 0 && (config.type === "percentage" || config.type === "fixed");
}
export function getLoyaltyProgress(config: LoyaltyConfig, pastEligibleBookings: number, awardsGranted: number): LoyaltyProgress {
  const past = Math.max(0, Math.floor(pastEligibleBookings));
  const granted = Math.max(0, Math.floor(awardsGranted));
  const configured = isLoyaltyConfigured(config);
  const threshold = config.threshold;
  const counter = configured ? Math.max(0, past - granted * threshold) : 0;
  const earnedAwards = configured ? Math.floor(past / threshold) : 0;
  return { configured, threshold, pastEligibleBookings: past, awardsGranted: granted, earnedAwards, counter, remainingToNextAward: configured ? Math.max(0, threshold - counter) : 0, isDue: configured && earnedAwards > granted };
}
export function computeLoyaltyDiscount(config: LoyaltyConfig, subtotal: number): number {
  const gross = Math.max(0, Number(subtotal) || 0);
  const raw = config.type === "percentage" ? gross * config.value / 100 : config.type === "fixed" ? config.value : 0;
  return Math.round(Math.min(gross, Math.max(0, raw)) * 100) / 100;
}
export function resolveDiscount(input: { manual?: number; promo?: number; loyalty?: number }, gross: number): { source: DiscountSource; amount: number } {
  const clamp = (v: number) => Math.round(Math.min(Math.max(0, gross), Math.max(0, Number(v) || 0)) * 100) / 100;
  if ((input.manual || 0) > 0) return { source: "manual", amount: clamp(input.manual!) };
  if ((input.promo || 0) > 0) return { source: "promo", amount: clamp(input.promo!) };
  if ((input.loyalty || 0) > 0) return { source: "loyalty", amount: clamp(input.loyalty!) };
  return { source: "none", amount: 0 };
}
export function validateLoyaltySettings(input: Record<string, unknown>): { ok: true; value: { loyalty_enabled: number; loyalty_discount_type: string | null; loyalty_discount_value: number; loyalty_threshold: number } } | { ok: false; error: string } {
  const enabled = input.loyalty_enabled === true || input.loyalty_enabled === 1 || input.loyalty_enabled === "1";
  const type = input.loyalty_discount_type == null || input.loyalty_discount_type === "" ? null : String(input.loyalty_discount_type);
  // Un champ absent vaut 0 : une requête partielle ne doit pas échouer sur un
  // NaN avec un message parlant d'une valeur « invalide » jamais transmise.
  const value = input.loyalty_discount_value == null || input.loyalty_discount_value === "" ? 0 : Number(input.loyalty_discount_value);
  const threshold = input.loyalty_threshold == null || input.loyalty_threshold === "" ? 0 : Number(input.loyalty_threshold);
  if (type !== null && type !== "percentage" && type !== "fixed") return { ok: false, error: "Le type de remise fidélité est invalide." };
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "La valeur de la remise fidélité est invalide." };
  if (type === "percentage" && value > 100) return { ok: false, error: "Une remise en pourcentage ne peut pas dépasser 100 %." };
  if (!Number.isInteger(threshold) || threshold < 0) return { ok: false, error: "Le seuil de fidélité est invalide." };
  if (enabled && (threshold < 1 || value <= 0 || type === null)) return { ok: false, error: "Un programme fidélité actif doit avoir un type, une valeur positive et un seuil supérieur ou égal à 1." };
  return { ok: true, value: { loyalty_enabled: enabled ? 1 : 0, loyalty_discount_type: type, loyalty_discount_value: value || 0, loyalty_threshold: threshold || 0 } };
}
