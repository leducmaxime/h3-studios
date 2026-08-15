/**
 * Libellés français partagés — source unique de vérité.
 *
 * Toute valeur brute stockée en base (type de groupe, studio, statut de
 * réservation, méthode et statut de paiement) doit passer par ce module avant
 * d'être affichée. Les accesseurs ne retombent jamais sur la valeur brute :
 * une valeur inconnue rend `UNKNOWN_LABEL` ("—"), ce qui garantit qu'aucune
 * chaîne technique anglaise n'atteint une surface visible par l'utilisateur
 * (interface admin, exports CSV/PDF, e-mails, espace client).
 *
 * Ce module est une feuille : il n'importe que des *types*, jamais de valeurs,
 * afin de rester importable depuis le worker comme depuis le client.
 */

import type {
  BookingStatus,
  DbPaymentStatus,
  GroupType,
  PaymentStatus,
  StudioId,
} from "./db-types";
import type { DisplayPaymentStatus } from "./booking-totals";

/** Rendu lorsqu'une valeur ne correspond à aucun libellé connu. */
export const UNKNOWN_LABEL = "—";

// ─── Types de groupe ──────────────────────────────────────────────────────────

/** Forme courte, pour les tableaux et badges de l'admin. */
export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

/** Forme longue, pour les surfaces client (e-mails, récapitulatifs, espace client). */
export const GROUP_TYPE_LABELS_LONG: Record<GroupType, string> = {
  solo: "Solo / Prof particulier",
  duo: "Duo",
  group: "Groupe (3+)",
};

export function groupTypeLabel(
  value: GroupType | (string & {}) | null | undefined,
  opts?: { long?: boolean }
): string {
  const map = opts?.long ? GROUP_TYPE_LABELS_LONG : GROUP_TYPE_LABELS;
  return map[value as GroupType] ?? UNKNOWN_LABEL;
}

// ─── Studios ──────────────────────────────────────────────────────────────────

export const STUDIO_LABELS: Record<StudioId, string> = {
  "la-scene": "La Scène",
  "le-podium": "Le Podium",
};

/** Variante compacte pour les puces et grilles denses (7 colonnes, `text-[11px]`). */
export const STUDIO_LABELS_SHORT: Record<StudioId, string> = {
  "la-scene": "Scène",
  "le-podium": "Podium",
};

export function studioLabel(value: StudioId | (string & {}) | null | undefined): string {
  return STUDIO_LABELS[value as StudioId] ?? UNKNOWN_LABEL;
}

export function studioLabelShort(value: StudioId | (string & {}) | null | undefined): string {
  return STUDIO_LABELS_SHORT[value as StudioId] ?? UNKNOWN_LABEL;
}

// ─── Statuts de réservation ───────────────────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  "no-show": "Absent",
};

/**
 * `pending` n'existe pas dans la contrainte CHECK des réservations : seule une
 * entrée historique du journal d'audit peut encore porter cette valeur, et la
 * masquer détruirait la fidélité de l'audit.
 */
export function bookingStatusLabel(
  value: BookingStatus | (string & {}) | null | undefined
): string {
  if (value === "pending") return "En attente";
  return BOOKING_STATUS_LABELS[value as BookingStatus] ?? UNKNOWN_LABEL;
}

// ─── Méthodes de paiement ─────────────────────────────────────────────────────

/**
 * `check` et `cheque` coexistent en base (alias hérité) et rendent le même
 * libellé.
 */
export type PaymentMethodKey = "card" | "cash" | "transfer" | "check" | "cheque";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  card: "Carte bancaire",
  cash: "Espèces",
  transfer: "Virement",
  check: "Chèque",
  cheque: "Chèque",
};

/** Variante compacte pour les colonnes et légendes de graphiques étroites. */
export const PAYMENT_METHOD_LABELS_SHORT: Record<PaymentMethodKey, string> = {
  card: "CB",
  cash: "Espèces",
  transfer: "Virement",
  check: "Chèque",
  cheque: "Chèque",
};

export function paymentMethodLabel(
  value: PaymentMethodKey | (string & {}) | null | undefined
): string {
  return PAYMENT_METHOD_LABELS[value as PaymentMethodKey] ?? UNKNOWN_LABEL;
}

export function paymentMethodLabelShort(
  value: PaymentMethodKey | (string & {}) | null | undefined
): string {
  return PAYMENT_METHOD_LABELS_SHORT[value as PaymentMethodKey] ?? UNKNOWN_LABEL;
}

// ─── Statut de paiement porté par la réservation ──────────────────────────────

export const BOOKING_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  "pay-on-site": "Sur place",
};

export function bookingPaymentStatusLabel(
  value: PaymentStatus | (string & {}) | null | undefined
): string {
  return BOOKING_PAYMENT_STATUS_LABELS[value as PaymentStatus] ?? UNKNOWN_LABEL;
}

// ─── Statut d'une ligne du grand livre `payments` ─────────────────────────────

export const PAYMENT_RECORD_STATUS_LABELS: Record<DbPaymentStatus, string> = {
  pending: "En attente",
  paid: "Payé",
  refunded: "Remboursé",
  "partial-refund": "Remboursé partiel",
};

export function paymentRecordStatusLabel(
  value: DbPaymentStatus | (string & {}) | null | undefined
): string {
  return PAYMENT_RECORD_STATUS_LABELS[value as DbPaymentStatus] ?? UNKNOWN_LABEL;
}

// ─── Statut de paiement dérivé (affichage réservation) ────────────────────────

export const DISPLAY_PAYMENT_STATUS_LABELS: Record<DisplayPaymentStatus, string> = {
  paid: "Payé",
  pending: "En attente",
  "pay-on-site": "Reste à payer",
  cancelled: "Annulée",
  "paid-before-cancel": "Payée avant annulation",
  refunded: "Remboursé",
};

export function displayPaymentStatusLabel(
  value: DisplayPaymentStatus | null | undefined
): string {
  return value == null ? UNKNOWN_LABEL : DISPLAY_PAYMENT_STATUS_LABELS[value] ?? UNKNOWN_LABEL;
}

// ─── Nature du paiement ───────────────────────────────────────────────────────

export type PaymentTypeKey = "on-site" | "online";

export const PAYMENT_TYPE_LABELS: Record<PaymentTypeKey, string> = {
  "on-site": "Sur place",
  online: "En ligne",
};

export function paymentTypeLabel(
  value: PaymentTypeKey | (string & {}) | null | undefined
): string {
  return PAYMENT_TYPE_LABELS[value as PaymentTypeKey] ?? UNKNOWN_LABEL;
}

// ─── Rôles administrateur ─────────────────────────────────────────────────────

export type AdminRoleKey = "super-admin" | "operator";

export const ADMIN_ROLE_LABELS: Record<AdminRoleKey, string> = {
  "super-admin": "Super administrateur",
  operator: "Opérateur",
};

export function adminRoleLabel(
  value: AdminRoleKey | (string & {}) | null | undefined
): string {
  return ADMIN_ROLE_LABELS[value as AdminRoleKey] ?? UNKNOWN_LABEL;
}
