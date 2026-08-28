export type LoyaltyDiscountType = "percentage" | "fixed";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateLoyaltyCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `FID-${Array.from(bytes, (byte) => CROCKFORD_ALPHABET[byte % CROCKFORD_ALPHABET.length]).join("")}`;
}

export function addDaysToDateISO(dateISO: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!match) throw new Error(`Invalid date: ${dateISO}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.floor(days)));
  return date.toISOString().slice(0, 10);
}

export function validateLoyaltySettings(input: Record<string, unknown>): { ok: true; value: { loyalty_enabled: number; loyalty_discount_type: string | null; loyalty_discount_value: number; loyalty_threshold: number; loyalty_code_validity_days: number } } | { ok: false; error: string } {
  const enabled = input.loyalty_enabled === true || input.loyalty_enabled === 1 || input.loyalty_enabled === "1";
  const type = input.loyalty_discount_type == null || input.loyalty_discount_type === "" ? null : String(input.loyalty_discount_type);
  // Un champ absent vaut 0 : une requête partielle ne doit pas échouer sur un
  // NaN avec un message parlant d'une valeur « invalide » jamais transmise.
  const value = input.loyalty_discount_value == null || input.loyalty_discount_value === "" ? 0 : Number(input.loyalty_discount_value);
  const threshold = input.loyalty_threshold == null || input.loyalty_threshold === "" ? 0 : Number(input.loyalty_threshold);
  const validityDays = input.loyalty_code_validity_days == null || input.loyalty_code_validity_days === "" ? 60 : Number(input.loyalty_code_validity_days);
  if (type !== null && type !== "percentage" && type !== "fixed") return { ok: false, error: "Le type de remise fidélité est invalide." };
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "La valeur de la remise fidélité est invalide." };
  if (type === "percentage" && value > 100) return { ok: false, error: "Une remise en pourcentage ne peut pas dépasser 100 %." };
  if (!Number.isInteger(threshold) || threshold < 0) return { ok: false, error: "Le seuil de fidélité est invalide." };
  if (!Number.isInteger(validityDays) || validityDays <= 0) return { ok: false, error: "La durée de validité du code fidélité est invalide." };
  if (enabled && (threshold < 1 || value <= 0 || type === null)) return { ok: false, error: "Un programme fidélité actif doit avoir un type, une valeur positive et un seuil supérieur ou égal à 1." };
  return { ok: true, value: { loyalty_enabled: enabled ? 1 : 0, loyalty_discount_type: type, loyalty_discount_value: value || 0, loyalty_threshold: threshold || 0, loyalty_code_validity_days: validityDays } };
}
