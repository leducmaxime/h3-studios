"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  User,
  CreditCard,
  Box,
  Shield,
  Calendar,
  Clock,
  Eye,
  Loader2,
  X,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import {
  REFUND_FAILURE_CODE_LABELS,
  STRIPE_REFUND_STATUS_LABELS,
} from "@/components/admin/refund";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ApiAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: string | null;
  performed_by: string;
  admin_name?: string | null;
  booking_ref?: string | null;
  user_email?: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  success: boolean;
  data: {
    data: ApiAuditLog[];
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ENTITY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  booking: { label: "Réservation", icon: Calendar, color: "text-blue-400" },
  user: { label: "Client", icon: User, color: "text-emerald-400" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-amber-400" },
  payments: { label: "Paiement", icon: CreditCard, color: "text-amber-400" },
  setting: { label: "Paramètre", icon: Shield, color: "text-purple-400" },
  settings: { label: "Paramètre", icon: Shield, color: "text-purple-400" },
  promo: { label: "Code promo", icon: FileText, color: "text-pink-400" },
  equipment: { label: "Équipement", icon: Box, color: "text-cyan-400" },
  pricing: { label: "Tarif", icon: FileText, color: "text-orange-400" },
  blocked_slot: { label: "Créneau bloqué", icon: Clock, color: "text-red-400" },
  opening_hours: { label: "Horaires", icon: Clock, color: "text-teal-400" },
  admin_user: { label: "Compte admin", icon: Shield, color: "text-violet-400" },
  instagram: { label: "Instagram", icon: FileText, color: "text-fuchsia-400" },
  reviews: { label: "Avis Google", icon: FileText, color: "text-yellow-400" },
};

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Création", variant: "default" },
  "create-range": { label: "Création (plage)", variant: "default" },
  update: { label: "Modification", variant: "secondary" },
  delete: { label: "Suppression", variant: "destructive" },
  "bulk-delete": { label: "Suppression groupée", variant: "destructive" },
  cancel: { label: "Annulation", variant: "destructive" },
  "no-show": { label: "Absent", variant: "destructive" },
  complete: { label: "Terminée", variant: "default" },
  "mark-paid": { label: "Payé", variant: "default" },
  refund: { label: "Remboursement", variant: "destructive" },
  "refund-failed": { label: "Remboursement échoué", variant: "destructive" },
  "refund-stripe-accepted": { label: "Remboursement accepté (Stripe)", variant: "secondary" },
  "refund-reconciled": { label: "Rapprochement Stripe", variant: "secondary" },
  block: { label: "Blocage", variant: "destructive" },
  unblock: { label: "Déblocage", variant: "default" },
  merge: { label: "Fusion", variant: "secondary" },
  reschedule: { label: "Replanification", variant: "secondary" },
  "batch-update": { label: "Mise à jour groupée", variant: "secondary" },
  sync: { label: "Synchronisation", variant: "secondary" },
  update_token: { label: "Jeton mis à jour", variant: "secondary" },
  role_update: { label: "Changement de rôle", variant: "secondary" },
  activate: { label: "Activation", variant: "default" },
  deactivate: { label: "Désactivation", variant: "destructive" },
  "change-password": { label: "Mot de passe", variant: "secondary" },
};

function getEntityConfig(entityType: string) {
  return ENTITY_CONFIG[entityType] || { label: entityType, icon: FileText, color: "text-zinc-400" };
}

function getActionConfig(action: string) {
  return ACTION_LABELS[action] || { label: action, variant: "outline" as const };
}

function parseChanges(changesStr: string | null): unknown {
  if (!changesStr) return null;
  try {
    return JSON.parse(changesStr);
  } catch {
    return changesStr;
  }
}

function formatJsonPretty(data: unknown): string {
  if (data === null || data === undefined) return "Aucun détail";
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

// ─── Human-readable summaries ─────────────────────────────────────────────────
// The audit payloads are internal keys/values; this layer turns them into
// plain French an administrator can read without technical knowledge.

const STUDIO_LABELS: Record<string, string> = {
  "la-scene": "La Scène",
  "le-podium": "Le Podium",
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  "no-show": "Absence (no-show)",
  pending: "En attente",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Payé",
  pending: "En attente",
  "pay-on-site": "Paiement sur place",
  refunded: "Remboursé",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  cash: "Espèces",
  transfer: "Virement",
  check: "Chèque",
};

const ROLE_LABELS: Record<string, string> = {
  "super-admin": "Super administrateur",
  operator: "Opérateur",
};

const SETTING_KEY_LABELS: Record<string, string> = {
  maintenance_mode: "Mode maintenance",
  "materiel.v1": "Liste de matériel",
  public_holidays: "Jours fériés",
  peak_start_hour: "Début des heures pleines",
};

const FIELD_LABELS: Record<string, string> = {
  booking_ref: "Référence",
  studio_id: "Studio",
  date: "Date",
  date_from: "Du",
  date_to: "Au",
  start_time: "Début",
  end_time: "Fin",
  group_type: "Formule",
  status: "Statut",
  payment_status: "Paiement",
  reason: "Raison",
  amount: "Montant",
  method: "Moyen de paiement",
  name: "Nom",
  email: "E-mail",
  phone: "Téléphone",
  band_name: "Groupe",
  role: "Rôle",
  blocked: "Bloqué",
  is_active: "Actif",
  count: "Nombre",
  code: "Code",
  type: "Type",
  value: "Valeur",
  key: "Paramètre",
  notes: "Notes",
  total_price: "Prix total",
  promo_code: "Code promo",
  promo_discount: "Réduction",
  whole_day: "Journée entière",
  price_per_half_hour: "Tarif (30 min)",
  equipment_id: "Identifiant équipement",
  price: "Prix",
};

type ChangeObj = Record<string, unknown>;

function asChangeObj(changes: unknown): ChangeObj {
  return changes !== null && typeof changes === "object" && !Array.isArray(changes)
    ? (changes as ChangeObj)
    : {};
}

/** "2026-08-10" → "10 août 2026" (Paris-local reading of a date-only value). */
function formatDay(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function money(value: unknown): string | null {
  const n = Number(value);
  return Number.isFinite(n) ? formatPrice(n) : null;
}

/** Map a stored value to readable French according to its key. */
function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} élément(s)` : "—";
  const str = String(value);
  switch (key) {
    case "studio_id":
      return STUDIO_LABELS[str] ?? str;
    case "group_type":
      return GROUP_TYPE_LABELS[str] ?? str;
    case "status":
      return BOOKING_STATUS_LABELS[str] ?? str;
    case "payment_status":
      return PAYMENT_STATUS_LABELS[str] ?? str;
    case "method":
    case "previousMethod":
      return PAYMENT_METHOD_LABELS[str] ?? str;
    case "role":
      return ROLE_LABELS[str] ?? str;
    case "type":
      return str === "percentage" ? "Pourcentage" : str === "fixed" ? "Montant fixe" : str;
    case "date":
    case "date_from":
    case "date_to":
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? formatDay(str) : str;
    case "amount":
    case "previousAmount":
    case "total":
    case "price":
    case "total_price":
    case "promo_discount":
    case "price_per_half_hour": {
      const m = money(value);
      return m ?? str;
    }
    default:
      return str;
  }
}

/** Generic fallback: labeled lines for every known/unknown stored key. */
function genericFieldLines(obj: ChangeObj): string[] {
  return Object.entries(obj)
    .filter(([k]) => k !== "ids" && k !== "mergedIds") // internal id lists stay in technical data
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k} : ${formatFieldValue(k, v)}`);
}

/**
 * Promo rules in clear French — used by promo:create (all rules present) and
 * promo:update (only changed fields present). Unknown keys still fall through
 * to the generic fallback in summarizeLog.
 */
function promoRuleLines(obj: ChangeObj, isUpdate: boolean): string[] {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(obj, k);
  const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
  const lines: (string | null | undefined | false)[] = [];

  lines.push(str("code") && `Code : ${str("code")}`);

  const type = str("type");
  if (type === "percentage" && obj.value !== undefined) {
    lines.push(`Réduction : ${String(obj.value)} %`);
  } else if (type === "fixed" && money(obj.value)) {
    lines.push(`Réduction : ${money(obj.value)}`);
  } else if (obj.value !== undefined && money(obj.value)) {
    lines.push(`Réduction : ${money(obj.value)}`);
  } else if (type) {
    lines.push(`Type de réduction : ${type === "percentage" ? "Pourcentage" : "Montant fixe"}`);
  }

  if (has("min_total")) {
    const m = Number(obj.min_total);
    lines.push(
      Number.isFinite(m) ? (m > 0 ? `Montant minimum : ${formatPrice(m)}` : "Montant minimum : aucun") : null
    );
  }

  if (has("max_usage")) {
    lines.push(
      obj.max_usage === null
        ? "Utilisations : sans limite"
        : Number.isFinite(Number(obj.max_usage))
          ? `Utilisations : limité à ${Number(obj.max_usage)}`
          : null
    );
  }

  if (has("expires_at")) {
    const exp = str("expires_at");
    lines.push(exp ? `Valable jusqu'au : ${formatDay(exp)}` : isUpdate ? "Date d'expiration : supprimée" : null);
  }

  if (typeof obj.is_active === "boolean" || obj.is_active === 0 || obj.is_active === 1) {
    lines.push(`Statut : ${obj.is_active ? "Actif" : "Désactivé"}`);
  }

  if (has("round_mode")) {
    const rm = str("round_mode");
    if (rm === "down" || rm === "up") {
      const step = money(obj.round_value);
      lines.push(
        `Règle d'arrondi : ${rm === "down" ? "Arrondir aux 50 centimes" : "Arrondir aux 50 centimes au dessus"}${step ? ` (pas de ${step})` : ""}`
      );
    } else if (isUpdate && rm === "none") {
      lines.push("Règle d'arrondi : Sans arrondi");
    }
  }

  return lines.filter((l): l is string => typeof l === "string" && l.length > 0);
}

/**
 * Build a human-readable summary (one string per line) for an audit row.
 * Covers every action/entity payload the app actually emits; unknown shapes
 * fall back to labeled generic lines, never raw code.
 */
function summarizeLog(log: ApiAuditLog): string[] {
  const obj = asChangeObj(parseChanges(log.changes));
  const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
  const num = (k: string) => (typeof obj[k] === "number" ? (obj[k] as number) : undefined);
  const compact = (lines: (string | number | null | undefined | false)[]): string[] =>
    lines.filter((l): l is string => typeof l === "string" && l.length > 0);

  const studio = str("studio_id") ? (STUDIO_LABELS[str("studio_id")!] ?? str("studio_id")!) : undefined;
  const day = str("date") ? formatDay(str("date")!) : undefined;
  const session =
    day && str("start_time")
      ? `le ${day} de ${str("start_time")} à ${str("end_time") ?? "?"}`
      : undefined;

  switch (`${log.entity_type}:${log.action}`) {
    // ─── Réservations ───
    case "booking:create":
      return compact([
        str("booking_ref") && `Référence : ${str("booking_ref")}`,
        studio && `Studio : ${studio}`,
        session && `Séance : ${session}`,
      ]);
    case "booking:update": {
      const lines = genericFieldLines(obj);
      return lines.length > 0 ? lines : ["Modification de la réservation."];
    }
    case "booking:cancel":
      return compact([str("reason") && `Raison : ${str("reason")}`]);
    case "booking:no-show":
      return ["Le client ne s'est pas présenté (absence)."];
    case "booking:complete":
      return ["La réservation est marquée comme terminée."];
    case "booking:mark-paid":
      return compact([
        money(obj.amount) && `Montant encaissé : ${money(obj.amount)}`,
        str("method") && `Moyen de paiement : ${PAYMENT_METHOD_LABELS[str("method")!] ?? str("method")}`,
      ]);
    case "booking:bulk-delete":
      return [`${num("bookingsDeleted") ?? "?"} réservation(s) orpheline(s) supprimée(s).`];

    // ─── Paiements ───
    case "payment:create":
      return compact([
        money(obj.amount) && `Montant : ${money(obj.amount)}`,
        str("method") && `Moyen de paiement : ${PAYMENT_METHOD_LABELS[str("method")!] ?? str("method")}`,
      ]);
    case "payment:mark-paid":
      return ["Paiement marqué comme payé."];
    case "payment:refund":
      return compact([
        money(obj.amount) && `Montant remboursé : ${money(obj.amount)}`,
        money(obj.total) && `Total remboursé à ce jour : ${money(obj.total)}`,
        str("stripe_refund_status") &&
          `Statut Stripe : ${STRIPE_REFUND_STATUS_LABELS[str("stripe_refund_status")!] ?? str("stripe_refund_status")}`,
        str("reason") && `Motif : ${str("reason")}`,
      ]);
    case "payment:refund-failed":
      return compact([
        str("message"),
        str("code") && `Cause : ${REFUND_FAILURE_CODE_LABELS[str("code")!] ?? str("code")}`,
      ]);
    case "payment:refund-stripe-accepted":
      return compact([
        money(obj.amount) && `Montant : ${money(obj.amount)}`,
        str("stripe_refund_status") &&
          `Stripe a accepté le remboursement (statut : ${STRIPE_REFUND_STATUS_LABELS[str("stripe_refund_status")!] ?? str("stripe_refund_status")}).`,
        str("stripe_refund_id") && `Référence Stripe : ${str("stripe_refund_id")}`,
      ]);
    case "payment:refund-reconciled": {
      const reconciledIds = Array.isArray(obj.stripe_refund_ids) ? obj.stripe_refund_ids.length : 0;
      return compact([
        reconciledIds > 0
          ? `${reconciledIds} remboursement(s) rapproché(s) depuis Stripe.`
          : "Rapprochement avec Stripe.",
        money(obj.refunded_before) && money(obj.refunded_after) &&
          `Montant remboursé enregistré : ${money(obj.refunded_before)} → ${money(obj.refunded_after)}`,
      ]);
    }
    case "payment:update":
      return compact([
        money(obj.previousAmount) && money(obj.amount) &&
          `Montant : ${money(obj.previousAmount)} → ${money(obj.amount)}`,
        str("previousMethod") && str("method") &&
          `Moyen de paiement : ${PAYMENT_METHOD_LABELS[str("previousMethod")!] ?? str("previousMethod")} → ${PAYMENT_METHOD_LABELS[str("method")!] ?? str("method")}`,
      ]);
    case "payment:delete":
      return compact([money(obj.amount) && `Paiement de ${money(obj.amount)} supprimé.`]);

    // ─── Clients ───
    case "user:create":
      return compact([str("name") && `Nom : ${str("name")}`, str("email") && `E-mail : ${str("email")}`]);
    case "user:update": {
      const lines = genericFieldLines(obj);
      return lines.length > 0 ? lines : ["Modification de la fiche client."];
    }
    case "user:block":
      return ["Le compte client a été bloqué."];
    case "user:unblock":
      return ["Le compte client a été débloqué."];
    case "user:merge": {
      const emails = Array.isArray(obj.mergedEmails) ? (obj.mergedEmails as unknown[]).map(String) : [];
      const count = Array.isArray(obj.mergedIds) ? obj.mergedIds.length : emails.length;
      return compact([
        `${count || "?"} compte(s) fusionné(s) dans cette fiche.`,
        emails.length > 0 && `E-mails fusionnés : ${emails.join(", ")}`,
      ]);
    }

    // ─── Créneaux bloqués ───
    case "blocked_slot:create":
    case "blocked_slot:create-range": {
      const from = str("date_from") ? formatDay(str("date_from")!) : undefined;
      const to = str("date_to") ? formatDay(str("date_to")!) : undefined;
      const period = from && to && from !== to ? `Du ${from} au ${to}` : from ? `Le ${from}` : undefined;
      const hours =
        obj.whole_day === true
          ? "Journée entière"
          : str("start_time")
            ? `De ${str("start_time")} à ${str("end_time") ?? "?"}`
            : undefined;
      return compact([
        `Studio : ${studio ?? "Les deux studios"}`,
        period,
        hours,
        num("count") && num("count")! > 1 && `${num("count")} créneau(x) bloqué(s)`,
        str("reason") && `Raison : ${str("reason")}`,
      ]);
    }
    case "blocked_slot:delete":
      return ["Créneau débloqué."];

    // ─── Paramètres / tarifs / équipements / promos / horaires ───
    case "setting:create":
    case "setting:update": {
      const key = str("key") ?? log.entity_id;
      return compact([
        `Paramètre : ${SETTING_KEY_LABELS[key] ?? key}`,
        obj.value !== undefined && `Nouvelle valeur : ${formatSettingValue(key, obj.value)}`,
        obj.previous_value !== undefined && obj.previous_value !== null &&
          `Ancienne valeur : ${formatSettingValue(key, obj.previous_value)}`,
      ]);
    }
    case "pricing:update":
      return compact([money(obj.price_per_half_hour) && `Nouveau tarif : ${money(obj.price_per_half_hour)} / 30 min`]);
    case "equipment:create":
      return compact([str("name") && `Nom : ${str("name")}`]);
    case "equipment:update": {
      const lines = genericFieldLines(obj);
      return lines.length > 0 ? lines : ["Modification de l'équipement."];
    }
    case "equipment:delete":
      return ["Équipement supprimé."];
    case "promo:create": {
      const lines = promoRuleLines(obj, false);
      return lines.length > 0 ? lines : ["Création d'un code promo."];
    }
    case "promo:update": {
      const lines = promoRuleLines(obj, true);
      if (lines.length > 0) return lines;
      const generic = genericFieldLines(obj);
      return generic.length > 0 ? generic : ["Modification du code promo."];
    }
    case "promo:delete":
      return ["Code promo supprimé."];
    case "opening_hours:batch-update":
      return compact([num("count") && `${num("count")} horaire(s) d'ouverture mis à jour.`]);

    // ─── Comptes administrateurs ───
    case "admin_user:create":
      return compact([
        str("name") && `Nom : ${str("name")}`,
        str("email") && `E-mail : ${str("email")}`,
        str("role") && `Rôle : ${ROLE_LABELS[str("role")!] ?? str("role")}`,
      ]);
    case "admin_user:role_update":
      return compact([str("role") && `Nouveau rôle : ${ROLE_LABELS[str("role")!] ?? str("role")}`]);
    case "admin_user:delete":
      return ["Compte administrateur supprimé."];
    case "admin_user:activate":
      return ["Compte administrateur activé."];
    case "admin_user:deactivate":
      return ["Compte administrateur désactivé."];
    case "admin_user:change-password":
      return ["Mot de passe du compte administrateur modifié."];

    // ─── Intégrations ───
    case "instagram:sync":
      return compact([num("count") !== undefined && `${num("count")} publication(s) Instagram synchronisée(s).`]);
    case "settings:update_token":
      return ["Jeton d'accès Instagram mis à jour."];
    case "reviews:sync":
      return compact([
        num("reviewsCount") !== undefined && `${num("reviewsCount")} avis Google synchronisés.`,
        num("averageRating") !== undefined && `Note moyenne : ${num("averageRating")}/5`,
      ]);

    default: {
      const lines = genericFieldLines(obj);
      return lines.length > 0 ? lines : ["Aucun détail disponible."];
    }
  }
}

/** Setting values: booleans become Activé/Désactivé, hours stay readable. */
function formatSettingValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Activé" : "Désactivé";
  if (key === "peak_start_hour" && Number.isFinite(Number(value))) return `${Number(value)}h`;
  if (typeof value === "object" && value !== null) return "Voir données techniques";
  return String(value);
}

/** Identity lines for the table's entity cell — never a raw internal id first. */
function getIdentityLines(log: ApiAuditLog): string[] {
  const lines: string[] = [];
  if ((log.entity_type === "booking" || log.entity_type === "payment" || log.entity_type === "payments")) {
    lines.push(log.booking_ref ? `Réf. ${log.booking_ref}` : log.entity_type === "booking" ? "Réservation supprimée" : "Référence indisponible");
  }
  if ((log.entity_type === "booking" || log.entity_type === "user") && log.user_email) {
    lines.push(`Client : ${log.user_email}`);
  }
  if (log.entity_type === "user" && !log.user_email) {
    lines.push("Compte supprimé");
  }
  return lines;
}

/** Actor display: admin name when known, plain fallback for the literal "admin". */
function getActorLabel(log: ApiAuditLog): string {
  if (log.admin_name) return log.admin_name;
  return log.performed_by === "admin" ? "Administrateur" : log.performed_by;
}
// ─── Detail Dialog ──────────────────────────────────────────────────────────────

function AuditDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: ApiAuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const entityCfg = getEntityConfig(log.entity_type);
  const actionCfg = getActionConfig(log.action);
  const changes = parseChanges(log.changes);
  const summaryLines = summarizeLog(log);
  const EntityIcon = entityCfg.icon;
  const isBookingLike = log.entity_type === "booking" || log.entity_type === "payment" || log.entity_type === "payments";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900 lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EntityIcon className={`h-5 w-5 ${entityCfg.color}`} />
            Détail de l&apos;action
          </DialogTitle>
          <DialogDescription>
            {actionCfg.label} — {entityCfg.label.toLowerCase()} — {formatDateTime(log.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Entité</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-zinc-700">
                  {entityCfg.label}
                </Badge>
                {isBookingLike && log.booking_ref ? (
                  <span className="text-xs text-zinc-300">Réf. {log.booking_ref}</span>
                ) : (
                  <span className="font-mono text-xs text-zinc-500">{log.entity_id}</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Action</p>
              <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Réalisé par</p>
              <p className="font-medium text-zinc-200">{getActorLabel(log)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Date</p>
              <p className="font-medium text-zinc-200">{formatDateTime(log.created_at)}</p>
            </div>
            {log.user_email && (
              <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="mb-1 text-xs text-zinc-500">Client</p>
                <p className="break-all font-medium text-zinc-200">{log.user_email}</p>
              </div>
            )}
          </div>

          {/* Résumé lisible */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">Résumé</p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
                {summaryLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Données brutes — support/debug uniquement */}
          <details className="group rounded-lg border border-zinc-800 bg-zinc-950">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300">
              Données techniques
            </summary>
            <div className="max-h-72 overflow-auto border-t border-zinc-800 p-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-400">
                {formatJsonPretty(changes)}
              </pre>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AdminAuditLog() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 30;

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<ApiAuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // New filter states
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (entityTypeFilter !== "all") params.set("entity_type", entityTypeFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (adminFilter !== "all") params.set("admin_id", adminFilter);
      if (dateFrom) params.set("from_date", dateFrom);
      if (dateTo) params.set("to_date", dateTo);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const json = (await res.json()) as AuditLogsResponse;
      if (json.success) {
        setLogs(json.data.data);
        setTotal(json.data.total);
        // Extract unique admins with display names from the logs
        const adminMap = new Map<string, string>();
        for (const log of json.data.data) {
          if (!adminMap.has(log.performed_by)) {
            adminMap.set(
              log.performed_by,
              log.admin_name || (log.performed_by === "admin" ? "Administrateur" : log.performed_by)
            );
          }
        }
        const adminList = Array.from(adminMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAdmins(adminList);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  }, [page, entityTypeFilter, actionFilter, adminFilter, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityTypeFilter, actionFilter, adminFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Client-side search on identity fields, actor, content
  const filteredLogs = searchQuery
    ? logs.filter((log) => {
        const q = searchQuery.toLowerCase();
        return (
          log.entity_id.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.performed_by.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          (log.booking_ref && log.booking_ref.toLowerCase().includes(q)) ||
          (log.user_email && log.user_email.toLowerCase().includes(q)) ||
          (log.admin_name && log.admin_name.toLowerCase().includes(q)) ||
          (log.changes && log.changes.toLowerCase().includes(q))
        );
      })
    : logs;

  const totalPages = Math.ceil(total / perPage);
  const hasActiveFilters =
    entityTypeFilter !== "all" ||
    actionFilter !== "all" ||
    adminFilter !== "all" ||
    dateFrom ||
    dateTo;

  function clearFilters() {
    setEntityTypeFilter("all");
    setActionFilter("all");
    setAdminFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setSortBy("date");
    setSortOrder("desc");
    setPage(1);
  }

  function openDetail(log: ApiAuditLog) {
    setSelectedLog(log);
    setDetailOpen(true);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
          <p className="text-zinc-400">
            {total} entrée(s) — Historique complet des actions
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Type</option>
            <option value="booking">Réservation</option>
            <option value="user">Client</option>
            <option value="payment">Paiement</option>
            <option value="setting">Paramètre</option>
            <option value="promo">Code promo</option>
            <option value="equipment">Équipement</option>
            <option value="pricing">Tarif</option>
            <option value="blocked_slot">Créneau bloqué</option>
            <option value="opening_hours">Horaires</option>
            <option value="admin_user">Compte admin</option>
            <option value="instagram">Instagram</option>
            <option value="reviews">Avis Google</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Action</option>
            <option value="create">Création</option>
            <option value="create-range">Création (plage)</option>
            <option value="update">Modification</option>
            <option value="delete">Suppression</option>
            <option value="bulk-delete">Suppression groupée</option>
            <option value="cancel">Annulation</option>
            <option value="no-show">Absent</option>
            <option value="complete">Terminée</option>
            <option value="mark-paid">Payé</option>
            <option value="refund">Remboursement</option>
            <option value="refund-failed">Remboursement échoué</option>
            <option value="refund-stripe-accepted">Remboursement accepté (Stripe)</option>
            <option value="refund-reconciled">Rapprochement Stripe</option>
            <option value="block">Blocage</option>
            <option value="unblock">Déblocage</option>
            <option value="merge">Fusion</option>
            <option value="reschedule">Replanification</option>
            <option value="batch-update">Mise à jour groupée</option>
            <option value="sync">Synchronisation</option>
            <option value="update_token">Jeton mis à jour</option>
            <option value="role_update">Changement de rôle</option>
            <option value="activate">Activation</option>
            <option value="deactivate">Désactivation</option>
            <option value="change-password">Mot de passe</option>
          </select>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
          >
            <option value="all">Admin</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 text-xs focus:border-primary focus:outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 text-xs focus:border-primary focus:outline-none"
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 shrink-0 px-2 text-[10px] text-zinc-400 hover:text-white"
            >
              <X className="mr-1 h-3 w-3" />
              Effacer
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-zinc-500">Tri</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
            >
              <option value="date">Date</option>
              <option value="action">Action</option>
              <option value="entity_type">Entité</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
            >
              <option value="desc">↓</option>
              <option value="asc">↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "date") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("date");
                        setSortOrder("desc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Date {sortBy === "date" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "admin") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("admin");
                        setSortOrder("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Utilisateur {sortBy === "admin" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "action") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("action");
                        setSortOrder("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Action {sortBy === "action" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Entité
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Détails
                </th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredLogs.map((log) => {
                const entityCfg = getEntityConfig(log.entity_type);
                const actionCfg = getActionConfig(log.action);
                const EntityIcon = entityCfg.icon;
                const summaryLines = summarizeLog(log);
                const identityLines = getIdentityLines(log);
                return (
                  <tr
                    key={log.id}
                    className="group cursor-pointer bg-zinc-900/50 transition-colors hover:bg-zinc-800/50"
                    onClick={() => openDetail(log)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{formatDateShort(log.created_at)}</p>
                        <p className="text-xs text-zinc-500">{formatTime(log.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-300">{getActorLabel(log)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EntityIcon className={`h-4 w-4 shrink-0 ${entityCfg.color}`} />
                        <div>
                          <p className="text-sm">{entityCfg.label}</p>
                          {identityLines.length > 0 ? (
                            identityLines.map((line, i) => (
                              <p key={i} className={`text-xs ${i === 0 ? "text-zinc-400" : "text-zinc-500"}`}>
                                {line}
                              </p>
                            ))
                          ) : (
                            <p className="font-mono text-xs text-zinc-600">{log.entity_id}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate text-xs text-zinc-400">
                        {summaryLines[0] ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(log);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Voir détails</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                    <p>Aucune entrée trouvée</p>
                    {hasActiveFilters && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearFilters}
                        className="mt-2 text-primary"
                      >
                        Réinitialiser les filtres
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Page {page} sur {totalPages} — {total} entrée(s)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <AuditDetailDialog
        log={selectedLog}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
