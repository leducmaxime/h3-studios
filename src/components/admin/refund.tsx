"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/booking";
import { getBookingAmountDue, parseAmountInput } from "@/lib/booking-totals";
import type { DbBooking, DbPayment } from "@/lib/db-types";
import type { RefundChannel, RefundFailureCode, RefundOutcome } from "@/lib/refunds";
import { paymentMethodLabel } from "@/lib/labels";

// ─── Types & helpers ─────────────────────────────────────────────────────────

/** Ligne de paiement enrichie des colonnes calculées côté SQL. */
export type PaymentRefundInfo = DbPayment & {
  allocated?: number;
  refundable?: number;
  refundable_amount?: number | null;
};

export const REFUND_FAILURE_CODE_LABELS: Record<RefundFailureCode, string> = {
  payment_not_found: "Paiement introuvable",
  not_card: "Paiement hors carte",
  not_collected: "Paiement non encaissé",
  no_stripe_reference: "Référence Stripe manquante",
  stripe_not_configured: "Stripe non configuré",
  amount_invalid: "Montant invalide",
  amount_exceeds_refundable: "Montant supérieur au solde remboursable",
  idempotency_conflict: "Demande déjà utilisée pour un autre remboursement",
  stripe_error: "Erreur Stripe",
  stripe_unconfirmed: "Non confirmé par Stripe",
  ledger_write_failed: "Remboursement accepté, enregistrement à relancer",
  already_applied: "Déjà enregistré",
};

export const STRIPE_REFUND_STATUS_LABELS: Record<"pending" | "requires_action" | "succeeded" | "failed" | "canceled", string> = {
  pending: "en cours de traitement",
  requires_action: "action requise (coordonnées bancaires)",
  succeeded: "effectué",
  failed: "échoué",
  canceled: "annulé",
};

const round2 = (v: number) => Math.round(v * 100) / 100;

export function hasStripeReference(p: PaymentRefundInfo): boolean {
  return !!p.external_ref?.startsWith("cs_");
}

/** Un paiement est remboursable via Stripe : carte + référence session + solde. */
export function isStripeRefundable(p: PaymentRefundInfo): boolean {
  return (
    p.method === "card" &&
    hasStripeReference(p) &&
    p.status === "settled" &&
    p.amount > 0.005 &&
    refundableCap(p) > 0.004
  );
}

/**
 * Plafond de remboursement sur l'allocation de la réservation ciblée.
 */
export function refundableCap(p: PaymentRefundInfo): number {
  return Math.max(0, round2(p.refundable ?? p.refundable_amount ?? 0));
}

function centsLte(a: number, b: number): boolean {
  return Math.round(a * 100) <= Math.round(b * 100);
}

// ─── Choix du canal de remboursement ──────────────────────────────────────────
//
// Une seule question, posée partout de la même façon : « comment l'argent
// est-il rendu ? ». L'option Stripe n'apparaît que si le paiement est
// remboursable via Stripe ; l'option « déjà remboursé depuis Stripe » n'a de
// sens que sur un paiement carte. Les autres canaux (espèces, virement,
// chèque) sont toujours proposés : rendre la main à l'utilisateur plutôt que
// de deviner à sa place comment il a réellement remboursé le client.

export interface RefundChannelOption {
  channel: RefundChannel;
  label: string;
  description: string;
  icon: typeof CreditCard;
}

export function refundChannelOptions(p: PaymentRefundInfo): RefundChannelOption[] {
  const options: RefundChannelOption[] = [];
  if (isStripeRefundable(p)) {
    options.push({
      channel: "stripe",
      label: "Remboursement Stripe",
      description: "L'argent est renvoyé automatiquement sur la carte du client.",
      icon: CreditCard,
    });
  }
  options.push(
    {
      channel: "cash",
      label: "Espèces",
      description: "Vous rendez l'argent en main propre.",
      icon: Banknote,
    },
    {
      channel: "transfer",
      label: "Virement",
      description: "Vous faites le virement depuis votre banque.",
      icon: Landmark,
    },
    {
      channel: "check",
      label: "Chèque",
      description: "Vous envoyez un chèque au client.",
      icon: FileText,
    },
  );
  if (p.method === "card") {
    options.push({
      channel: "card",
      label: "Déjà remboursé depuis Stripe",
      description: "Le remboursement a été fait directement dans le Dashboard Stripe.",
      icon: ExternalLink,
    });
  }
  return options;
}

function channelHint(channel: RefundChannel): string {
  switch (channel) {
    case "stripe":
      return "Le remboursement est demandé à Stripe. Le paiement ne sera affiché comme remboursé qu'après confirmation.";
    case "card":
      return "Vous enregistrez un remboursement déjà effectué. Aucune nouvelle demande n'est envoyée à Stripe.";
    default:
      return "Vous rendez l'argent vous-même : cet écran ne fait que l'enregistrer dans les comptes.";
  }
}

/** Contexte additionnel par code d'échec — le message serveur prime toujours. */
function failureHint(outcome: RefundOutcome): string | null {
  switch (outcome.code) {
    case "already_applied":
      return "Ne relancez pas la même demande : ce remboursement est déjà enregistré. Vérifiez le solde remboursable du paiement.";
    case "stripe_unconfirmed":
      return outcome.stripeRefundStatus === "requires_action"
        ? "Le montant est réservé chez Stripe et déjà déduit du solde remboursable."
        : "Aucun montant n'a été enregistré : le remboursement peut être relancé.";
    case "ledger_write_failed":
      return "Le remboursement existe chez Stripe. Relancez l'opération pour l'enregistrer ici : la demande sera reconnue, pas doublée.";
    case "no_stripe_reference":
      return "Ce paiement carte ne pourra pas être remboursé depuis l'application.";
    case "not_card":
      return "Seuls les paiements carte sont remboursés via Stripe.";
    case "amount_exceeds_refundable":
      return "Le solde remboursable a peut-être changé : actualisez avant de relancer.";
    case "idempotency_conflict":
      return "Rien n'a été enregistré. Fermez cette fenêtre et rouvrez-la pour repartir sur une demande propre.";
    default:
      return null;
  }
}

function RefundErrorBlock({ outcome }: { outcome: RefundOutcome }) {
  const hint = failureHint(outcome);
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
      <p className="font-medium text-red-300">
        {outcome.message || "Le remboursement a été refusé."}
      </p>
      {outcome.code && (
        <p className="mt-0.5 text-xs text-red-400/80">
          {REFUND_FAILURE_CODE_LABELS[outcome.code] ?? outcome.code}
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-zinc-400">{hint}</p>}
      {outcome.stripeRefundId && (
        <p className="mt-1.5 font-mono text-xs text-zinc-500">
          Référence Stripe : {outcome.stripeRefundId}
        </p>
      )}
    </div>
  );
}

function UnattributedWarning({ amount }: { amount: number }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p className="text-xs text-amber-300">
        {formatPrice(amount)} ont déjà été remboursés sur ce paiement en dehors de
        l&apos;application (Dashboard Stripe). Vérifiez le solde avant toute nouvelle demande.
      </p>
    </div>
  );
}

// ─── Annulation avec choix délibéré de remboursement ─────────────────────────

interface RefundBatchResult {
  refunded: number;
  outcomes: RefundOutcome[];
  errors: RefundOutcome[];
}

export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingId,
  bookingRef,
  onSettled,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingRef: string;
  /** Appelé après chaque annulation réussie (le parent rafraîchit ses données). */
  onSettled: () => void;
  contentClassName?: string;
}) {
  const [mode, setMode] = useState<"none" | "refund" | null>(null);
  // Sous-choix « Sans remboursement » : que devient le solde restant dû.
  // « waive » = dette annulée, « keep » = paiement toujours dû.
  const [balanceChoice, setBalanceChoice] = useState<"waive" | "keep" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [payments, setPayments] = useState<PaymentRefundInfo[]>([]);
  const [ledgerBalance, setLedgerBalance] = useState<number | null>(null);
  const [booking, setBooking] = useState<DbBooking | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, RefundChannel>>({});
  const [requestIds, setRequestIds] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundBatchResult | null>(null);
  // Instantané de l'identité de la réservation pris à l'ouverture : le parent
  // peut vider sa sélection dans onSettled (ex. calendrier), le bilan final
  // doit malgré tout afficher la référence et un lien valide vers la fiche.
  const [snapshot, setSnapshot] = useState<{ id: string; ref: string }>({
    id: "",
    ref: "",
  });

  // Chargement frais des paiements à chaque ouverture : le préremplissage
  // repose sur refundable_amount, qui peut avoir changé depuis l'affichage.
  useEffect(() => {
    if (!open || !bookingId) return;
    setSnapshot({ id: bookingId, ref: bookingRef });
    setMode(null);
    setBalanceChoice(null);
    setReason("");
    setAmounts({});
    setChannels({});
    setRequestIds({});
    setInlineError(null);
    setResult(null);
    setSubmitting(false);
    setBooking(null);
    setLedgerBalance(null);
    setLoadingPayments(true);
    fetch(`/api/admin/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const json = raw as { success: boolean; data?: DbBooking };
        if (json.success && json.data) setBooking(json.data);
      })
      .catch(() => toast.error("Erreur lors du chargement de la réservation"));
    fetch(`/api/admin/bookings/${bookingId}/payments`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const json = raw as { success: boolean; data?: PaymentRefundInfo[] | { balance: number; movements: PaymentRefundInfo[] } };
        if (json.success && json.data) {
          const movements = Array.isArray(json.data) ? json.data : json.data.movements;
          setLedgerBalance(Array.isArray(json.data) ? null : json.data.balance);
          setPayments(movements);
          const prefill: Record<string, string> = {};
          const channelDefaults: Record<string, RefundChannel> = {};
          const reqIds: Record<string, string> = {};
          for (const p of movements) {
            reqIds[p.id] = crypto.randomUUID();
            if (p.status === "settled" && p.amount > 0.005 && refundableCap(p) > 0.004) {
              prefill[p.id] = refundableCap(p).toFixed(2).replace(".", ",");
              channelDefaults[p.id] = isStripeRefundable(p) ? "stripe" : "cash";
            }
          }
          setAmounts(prefill);
          setChannels(channelDefaults);
          setRequestIds(reqIds);
        }
      })
      .catch(() => toast.error("Erreur lors du chargement des paiements"))
      .finally(() => setLoadingPayments(false));
  }, [open, bookingId, bookingRef]);

  const collected = payments.filter((p) => p.status === "settled" && p.amount > 0.005);
  const refundableRows = collected.filter((p) => refundableCap(p) > 0.004);
  const blockedRows = collected.filter((p) => refundableCap(p) <= 0.004);
  const refundableTotal = round2(
    refundableRows.reduce((s, p) => s + refundableCap(p), 0),
  );

  function blockedReason(_p: PaymentRefundInfo): string {
    return "Le solde remboursable de ce paiement est épuisé.";
  }

  function rowInvalid(p: PaymentRefundInfo): boolean {
    const raw = (amounts[p.id] ?? "").trim();
    if (raw === "") return false; // ligne exclue du remboursement
    const value = parseAmountInput(raw);
    return !Number.isFinite(value) || value <= 0 || !centsLte(value, refundableCap(p));
  }

  const selectedRefunds = refundableRows
    .map((p) => ({ p, value: parseAmountInput(amounts[p.id] ?? "") }))
    .filter(({ value }) => Number.isFinite(value) && value > 0)
    .map(({ p, value }) => ({
      paymentId: p.id,
      amount: value,
      channel: channels[p.id] ?? "cash",
      requestId: requestIds[p.id],
    }));
  const refundTotal = round2(selectedRefunds.reduce((s, r) => s + r.amount, 0));
  const anyInvalid = refundableRows.some(rowInvalid);

  // Solde restant dû (null tant que la réservation n'est pas chargée) : s'il
  // est positif, « Sans remboursement » exige un sous-choix explicite.
  const remaining = ledgerBalance ?? (booking
    ? round2(getBookingAmountDue(booking) - payments
      .filter((payment) => payment.status === "settled")
      .reduce((sum, payment) => sum + payment.amount, 0))
    : null);
  const balanceChoiceRequired = remaining !== null && remaining > 0;

  const canConfirm =
    !submitting &&
    (mode === "none"
      ? remaining !== null && (!balanceChoiceRequired || balanceChoice !== null)
      : mode === "refund" && selectedRefunds.length > 0 && !anyInvalid);

  async function handleConfirm() {
    if (!mode || !canConfirm || !snapshot.id) return;
    setSubmitting(true);
    setInlineError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${snapshot.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
          refundMode: mode,
          ...(mode === "none" && balanceChoiceRequired
            ? { keepBalanceDue: balanceChoice === "keep" }
            : {}),
          ...(mode === "refund" ? { refunds: selectedRefunds } : {}),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { refund?: RefundBatchResult };
        error?: string;
      };
      if (!res.ok || !json.success) {
        setInlineError(json.error || "Erreur lors de l'annulation");
        return;
      }
      onSettled();
      const refund = json.data?.refund;
      if (!refund) {
        toast.success("Réservation annulée");
        onOpenChange(false);
        return;
      }
      if (refund.errors.length === 0) {
        // Tous les outcomes sont ok, mais un already_applied confirme 0 € :
        // ne pas annoncer un montant remboursé qui n'a pas eu lieu.
        if (refund.refunded <= 0) {
          toast.success("Réservation annulée — aucun nouveau remboursement enregistré");
          onOpenChange(false);
          return;
        }
        const anyPending = refund.outcomes.some(
          (o) => o.ok && o.stripeRefundStatus === "pending",
        );
        toast.success(
          anyPending
            ? `Réservation annulée — remboursement de ${formatPrice(refund.refunded)} accepté par Stripe, en cours de traitement`
            : `Réservation annulée — ${formatPrice(refund.refunded)} remboursés`,
        );
        onOpenChange(false);
        return;
      }
      // La réservation est annulée mais au moins un remboursement a échoué :
      // on bascule sur le bilan plutôt que de fermer sur un simple toast.
      setResult(refund);
    } catch {
      setInlineError(
        "Erreur réseau — la réservation a peut-être été annulée malgré tout. Vérifiez son statut avant de relancer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const choiceClass = (selected: boolean) =>
    `rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      selected
        ? "border-primary bg-primary/10"
        : "border-zinc-700 bg-zinc-800/40 enabled:hover:border-zinc-500"
    }`;

  // Choix « rembourser » impossible : la carte est désactivée et dit pourquoi,
  // plutôt qu'un bouton de confirmation muet.
  const refundUnavailable = !loadingPayments && refundableTotal <= 0;
  const refundUnavailableReason =
    collected.length === 0
      ? "Aucun paiement encaissé sur cette réservation."
      : "Aucun paiement remboursable sur cette réservation.";

  const unattributedTotal = result
    ? round2(result.outcomes.reduce((s, o) => s + (o.unattributedAmount ?? 0), 0))
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent
        className={contentClassName ?? "border-zinc-800 bg-zinc-900 lg:max-w-lg max-h-[85vh] overflow-y-auto"}
      >
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Réservation annulée
              </DialogTitle>
              <DialogDescription>
                La réservation <strong>{snapshot.ref}</strong> est bien annulée.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {result.refunded > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium text-emerald-300">
                    Remboursement accepté par Stripe : {formatPrice(result.refunded)}
                  </p>
                  {result.outcomes.some(
                    (o) => o.ok && o.stripeRefundStatus === "pending",
                  ) && (
                    <p className="mt-1 text-xs text-emerald-400/80">
                      Stripe traite le remboursement : le règlement par la banque
                      peut prendre quelques jours.
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-zinc-300">
                {result.refunded > 0
                  ? result.errors.length === 1
                    ? "Un autre remboursement n'a pas abouti :"
                    : "D'autres remboursements n'ont pas abouti :"
                  : result.errors.length === 1
                    ? "Le remboursement demandé n'a pas abouti :"
                    : "Les remboursements demandés n'ont pas abouti :"}
              </p>
              {result.errors.map((e, i) => (
                <RefundErrorBlock key={i} outcome={e} />
              ))}
              {unattributedTotal > 0 && (
                <UnattributedWarning amount={unattributedTotal} />
              )}
              <p className="text-xs text-zinc-500">
                Le remboursement peut être relancé depuis la fiche de la
                réservation, dans la section Paiement.
              </p>
            </div>
            <DialogFooter>
              <a
                href={`/admin/bookings/${snapshot.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-medium transition-colors hover:bg-zinc-800"
              >
                Ouvrir la fiche
              </a>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Annuler la réservation</DialogTitle>
              <DialogDescription>
                La réservation <strong>{snapshot.ref}</strong> sera définitivement
                annulée. Choisissez ce qu&apos;il advient des paiements encaissés.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Choix délibéré — aucune option présélectionnée */}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("none");
                    setBalanceChoice(null);
                  }}
                  disabled={submitting}
                  className={choiceClass(mode === "none")}
                >
                  <Wallet className="mb-2 h-5 w-5 text-zinc-400" />
                  <p className="text-sm font-semibold">Sans remboursement</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Les montants encaissés restent acquis au studio.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("refund");
                    setBalanceChoice(null);
                  }}
                  disabled={submitting || refundUnavailable}
                  className={choiceClass(mode === "refund")}
                >
                  <Undo2 className="mb-2 h-5 w-5 text-zinc-400" />
                  <p className="text-sm font-semibold">Avec remboursement</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Pour chaque paiement, par Stripe ou remis à la main.
                    {!loadingPayments && refundableTotal > 0 && (
                      <span className="mt-0.5 block font-medium text-zinc-300">
                        {formatPrice(refundableTotal)} remboursables
                      </span>
                    )}
                    {refundUnavailable && (
                      <span className="mt-0.5 block text-zinc-500">
                        {refundUnavailableReason}
                      </span>
                    )}
                  </p>
                </button>
              </div>

              {/* Sous-choix « Sans remboursement » quand un solde reste dû —
                  aucune option présélectionnée */}
              {mode === "none" && balanceChoiceRequired && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">
                    Que devient le solde restant de{" "}
                    <span className="font-medium text-zinc-300">
                      {formatPrice(remaining)}
                    </span>{" "}
                    ?
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setBalanceChoice("waive")}
                      disabled={submitting}
                      className={choiceClass(balanceChoice === "waive")}
                    >
                      <p className="text-sm font-semibold">Dette annulée</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Le solde n&apos;est plus dû.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceChoice("keep")}
                      disabled={submitting}
                      className={choiceClass(balanceChoice === "keep")}
                    >
                      <p className="text-sm font-semibold">Paiement dû</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Le solde de {formatPrice(remaining)} reste dû.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {mode === "refund" && (
                <div className="space-y-2">
                  {loadingPayments ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    </div>
                  ) : collected.length === 0 ? (
                    <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 p-3 text-sm text-zinc-400">
                      Aucun paiement encaissé sur cette réservation : rien à
                      rembourser.
                    </p>
                  ) : (
                    <>
                      {refundableRows.map((p) => {
                        const hasAmount = (amounts[p.id] ?? "").trim() !== "";
                        const options = refundChannelOptions(p);
                        return (
                          <div
                            key={p.id}
                            className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {paymentMethodLabel(p.method)} ·{" "}
                                  {formatPrice(p.amount)}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  Remboursable : {formatPrice(refundableCap(p))}
                                </p>
                              </div>
                              <div className="w-28 shrink-0">
                                <Input
                                  value={amounts[p.id] ?? ""}
                                  onChange={(e) =>
                                    setAmounts((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  inputMode="decimal"
                                  disabled={submitting}
                                  aria-label={`Montant à rembourser pour le paiement de ${formatPrice(p.amount)}`}
                                  className="h-9 border-zinc-700 bg-zinc-900 text-right"
                                />
                              </div>
                            </div>
                            {rowInvalid(p) && (
                              <p className="mt-1.5 text-xs text-red-400">
                                Maximum {formatPrice(refundableCap(p))}
                              </p>
                            )}
                            {hasAmount && !rowInvalid(p) && (
                              <div className="mt-2">
                                <select
                                  value={channels[p.id] ?? options[0]?.channel}
                                  onChange={(e) =>
                                    setChannels((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value as RefundChannel,
                                    }))
                                  }
                                  disabled={submitting}
                                  aria-label={`Comment l'argent est rendu pour le paiement de ${formatPrice(p.amount)}`}
                                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-primary focus:outline-none"
                                >
                                  {options.map((opt) => (
                                    <option key={opt.channel} value={opt.channel}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {refundableRows.length === 0 && (
                        <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 p-3 text-sm text-zinc-400">
                          Aucun paiement remboursable sur cette réservation.
                        </p>
                      )}
                      {blockedRows.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-zinc-800/60 bg-zinc-800/10 p-3"
                        >
                          <p className="text-sm text-zinc-400">
                            {paymentMethodLabel(p.method)} ·{" "}
                            {formatPrice(p.amount)}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {blockedReason(p)}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-zinc-400">Motif (optionnel)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Raison de l'annulation..."
                  disabled={submitting}
                  className="border-zinc-700 bg-zinc-800"
                />
              </div>

              {inlineError && (
                <p className="text-sm text-red-400">{inlineError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="border-zinc-700"
              >
                Retour
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "refund"
                  ? `Annuler et rembourser${refundTotal > 0 ? ` ${formatPrice(refundTotal)}` : ""}`
                  : mode === "none"
                    ? balanceChoice === "keep"
                      ? `Annuler — paiement dû (${formatPrice(remaining ?? 0)})`
                      : "Annuler sans rembourser"
                    : "Confirmer l'annulation"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Remboursement après coup (fiche réservation / page Paiements) ────────────

export function RefundPaymentDialog({
  payment,
  bookingId,
  bookingOptions,
  open,
  onOpenChange,
  onSettled,
}: {
  payment: PaymentRefundInfo | null;
  bookingId: string | null;
  bookingOptions?: Array<{ id: string; ref: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé après chaque réponse du serveur (le parent rafraîchit ses données). */
  onSettled: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<RefundChannel | null>(null);
  const [requestId, setRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<RefundOutcome | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  // Après un échec, le serveur renvoie refundableAfter : c'est la valeur la
  // plus fraîche (la réconciliation a pu déplacer le plafond).
  const [capOverride, setCapOverride] = useState<number | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(bookingId);

  const cap = payment ? (capOverride ?? refundableCap(payment)) : 0;
  const channelOptions = payment ? refundChannelOptions(payment) : [];

  useEffect(() => {
    if (open && payment) {
      setAmount(refundableCap(payment).toFixed(2).replace(".", ","));
      // Stripe reste le choix naturel quand il est proposé ; sinon aucune
      // présélection — comment l'argent a été rendu n'est jamais évident.
      setChannel(isStripeRefundable(payment) ? "stripe" : null);
      // Une seule clé d'idempotence par ouverture de dialogue, réutilisée à
      // chaque tentative : c'est elle qui empêche un double-clic de créer
      // deux remboursements.
      setRequestId(crypto.randomUUID());
      setSubmitting(false);
      setFailure(null);
      setFallbackError(null);
      setCapOverride(null);
      setSelectedBookingId(bookingId);
    }
  }, [open, payment, bookingId]);

  const parsed = parseAmountInput(amount);
  const isValid =
    Number.isFinite(parsed) && parsed > 0 && centsLte(parsed, cap);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment || !selectedBookingId || !channel || !isValid || submitting) return;
    setSubmitting(true);
    setFailure(null);
    setFallbackError(null);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedBookingId,
          amount: parsed,
          channel,
          requestId,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: Partial<RefundOutcome> & { refundedAmount?: number };
        error?: string;
        code?: RefundFailureCode;
        outcome?: RefundOutcome;
      };
      onSettled();
      if (!res.ok || !json.success) {
        if (json.outcome) {
          setFailure(json.outcome);
          if (Number.isFinite(json.outcome.refundableAfter)) {
            setCapOverride(round2(json.outcome.refundableAfter));
          }
        } else {
          setFallbackError(json.error || "Échec du remboursement");
        }
        return;
      }
      const refundedAmount = json.data?.refundedAmount ?? parsed;
      const stripeStatus = json.data?.stripeRefundStatus;
      if (channel === "stripe" && stripeStatus === "pending") {
        toast.success(
          `Remboursement de ${formatPrice(refundedAmount)} accepté par Stripe — en cours de traitement`,
        );
      } else if (channel === "stripe") {
        toast.success(
          `Remboursement de ${formatPrice(refundedAmount)} confirmé par Stripe`,
        );
      } else {
        toast.success(`Remboursement de ${formatPrice(refundedAmount)} enregistré`);
      }
      onOpenChange(false);
    } catch {
      setFallbackError(
        "Erreur réseau — vérifiez l'état du paiement avant de relancer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="border-zinc-800 bg-zinc-900 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rembourser le paiement</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                {paymentMethodLabel(payment.method)} ·{" "}
                {formatPrice(payment.amount)}
                <br />
                Solde remboursable :{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(cap)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Comment l&apos;argent est-il rendu ?</Label>
            <div className="space-y-1.5">
              {channelOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = channel === opt.channel;
                return (
                  <button
                    key={opt.channel}
                    type="button"
                    onClick={() => setChannel(opt.channel)}
                    disabled={submitting}
                    className={`flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-500"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-zinc-400"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-100">{opt.label}</span>
                      <span className="block text-xs text-zinc-500">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {channel && (
            <p className="text-xs text-zinc-500">{channelHint(channel)}</p>
          )}

          {bookingOptions && bookingOptions.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="refund-booking">Réservation</Label>
              <select
                id="refund-booking"
                value={selectedBookingId ?? ""}
                onChange={(e) => setSelectedBookingId(e.target.value || null)}
                disabled={submitting}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              >
                <option value="">Choisir une réservation</option>
                {bookingOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.ref}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="refund-payment-amount">
              Montant à rembourser (€ TTC)
            </Label>
            <Input
              id="refund-payment-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              disabled={submitting}
              className="border-zinc-700 bg-zinc-800"
            />
            {amount.trim() !== "" && !isValid && (
              <p className="text-xs text-red-400">
                Montant invalide (maximum {formatPrice(cap)})
              </p>
            )}
          </div>

          {failure && (
            <div className="space-y-2">
              <RefundErrorBlock outcome={failure} />
              {(failure.unattributedAmount ?? 0) > 0 && (
                <UnattributedWarning amount={failure.unattributedAmount!} />
              )}
            </div>
          )}
          {fallbackError && (
            <p className="text-sm text-red-400">{fallbackError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="border-zinc-700"
            >
              Retour
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!selectedBookingId || !channel || !isValid || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {channel === "stripe" ? "Demander le remboursement" : "Enregistrer le remboursement"}
              {isValid ? ` · ${formatPrice(parsed)}` : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Annulation d'un encaissement jamais reçu ────────────────────────────────
//
// Un mouvement « pending » sur place a été saisi mais l'argent n'a en réalité
// jamais été encaissé (erreur de saisie, client qui ne s'est pas présenté au
// paiement…). Il n'y a rien à rembourser puisque rien n'a été pris : on retire
// simplement la ligne du solde de la réservation.

export function VoidPaymentDialog({
  payment,
  open,
  onOpenChange,
  onSettled,
}: {
  payment: Pick<DbPayment, "id" | "amount" | "method"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé après chaque réponse du serveur (le parent rafraîchit ses données). */
  onSettled: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    if (!payment || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/void`, {
        method: "PUT",
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      onSettled();
      if (!res.ok || !json.success) {
        setError(json.error || "Erreur lors de l'annulation de la ligne");
        return;
      }
      toast.success("Ligne annulée");
      onOpenChange(false);
    } catch {
      setError("Erreur réseau — vérifiez l'état du paiement avant de relancer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Annuler cette ligne</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                Cet encaissement de{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(payment.amount)}
                </span>{" "}
                ({paymentMethodLabel(payment.method)}) n&apos;a jamais eu lieu.
                La ligne sera retirée du solde de la réservation.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-zinc-700"
          >
            Retour
          </Button>
          <Button variant="outline" onClick={handleConfirm} disabled={submitting} className="border-zinc-700 text-zinc-300">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
            Annuler cette ligne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
