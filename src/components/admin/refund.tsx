"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
import { getBookingBalance, parseAmountInput } from "@/lib/booking-totals";
import type { DbBooking, DbPayment } from "@/lib/db-types";
import type { RefundFailureCode, RefundOutcome } from "@/lib/refunds";
import { paymentMethodLabel } from "@/lib/labels";

// ─── Types & helpers ─────────────────────────────────────────────────────────

/** Ligne de paiement enrichie des colonnes calculées côté SQL. */
export type PaymentRefundInfo = DbPayment & {
  refund_reserved_cents?: number;
  refundable_amount?: number | null;
  refund_pending_cents?: number;
};

export const REFUND_FAILURE_CODE_LABELS: Record<RefundFailureCode, string> = {
  payment_not_found: "Paiement introuvable",
  not_card: "Paiement hors carte",
  not_collected: "Paiement non encaissé",
  no_stripe_reference: "Référence Stripe manquante",
  stripe_not_configured: "Stripe non configuré",
  amount_invalid: "Montant invalide",
  amount_exceeds_refundable: "Montant supérieur au solde remboursable",
  stripe_error: "Erreur Stripe",
  stripe_unconfirmed: "Non confirmé par Stripe",
  ledger_write_failed: "Remboursement accepté, enregistrement à relancer",
  reconciled: "Remboursement déjà existant chez Stripe",
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
  return !!p.stripe_event_id?.startsWith("cs_");
}

/** Un paiement est remboursable via Stripe : carte + référence session + solde. */
export function isStripeRefundable(p: PaymentRefundInfo): boolean {
  return (
    p.method === "card" &&
    hasStripeReference(p) &&
    (p.status === "paid" || p.status === "partial-refund") &&
    (p.refundable_amount ?? 0) > 0.004
  );
}

/**
 * Plafond de remboursement. Pour la carte : refundable_amount calculé en SQL
 * (amount − remboursements engagés chez Stripe). Hors carte : solde du grand
 * livre local (amount − refunded_amount).
 */
export function refundableCap(p: PaymentRefundInfo): number {
  if (p.method === "card") return Math.max(0, round2(p.refundable_amount ?? 0));
  return Math.max(0, round2(p.amount - p.refunded_amount));
}

function centsLte(a: number, b: number): boolean {
  return Math.round(a * 100) <= Math.round(b * 100);
}

/** Contexte additionnel par code d'échec — le message serveur prime toujours. */
function failureHint(outcome: RefundOutcome): string | null {
  switch (outcome.code) {
    case "reconciled":
      return "Ne relancez pas la même demande : vérifiez d'abord le solde remboursable du paiement.";
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
  const [booking, setBooking] = useState<DbBooking | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
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
    setInlineError(null);
    setResult(null);
    setSubmitting(false);
    setBooking(null);
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
        const json = raw as { success: boolean; data?: PaymentRefundInfo[] };
        if (json.success && json.data) {
          setPayments(json.data);
          const prefill: Record<string, string> = {};
          for (const p of json.data) {
            if (isStripeRefundable(p)) {
              prefill[p.id] = refundableCap(p).toFixed(2).replace(".", ",");
            }
          }
          setAmounts(prefill);
        }
      })
      .catch(() => toast.error("Erreur lors du chargement des paiements"))
      .finally(() => setLoadingPayments(false));
  }, [open, bookingId, bookingRef]);

  const collected = payments.filter(
    (p) => p.status === "paid" || p.status === "partial-refund",
  );
  const refundableRows = collected.filter(isStripeRefundable);
  const blockedRows = collected.filter((p) => !isStripeRefundable(p));
  const refundableTotal = round2(
    refundableRows.reduce((s, p) => s + refundableCap(p), 0),
  );

  function blockedReason(p: PaymentRefundInfo): string {
    if (p.method === "card" && !hasStripeReference(p)) {
      return "Aucune référence Stripe exploitable : ce paiement ne peut pas être remboursé depuis l'application.";
    }
    if (p.method === "card") {
      return "Le solde remboursable de ce paiement est épuisé.";
    }
    return "Non remboursé lors de l'annulation. Un remboursement reste possible depuis la fiche.";
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
    .map(({ p, value }) => ({ paymentId: p.id, amount: value }));
  const refundTotal = round2(selectedRefunds.reduce((s, r) => s + r.amount, 0));
  const anyInvalid = refundableRows.some(rowInvalid);

  // Solde restant dû (null tant que la réservation n'est pas chargée) : s'il
  // est positif, « Sans remboursement » exige un sous-choix explicite.
  const remaining = booking ? getBookingBalance(booking, payments) : null;
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
      : "Aucun paiement carte remboursable via Stripe.";

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
        className={contentClassName ?? "border-zinc-800 bg-zinc-900 lg:max-w-lg"}
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
                    Les paiements carte sont remboursés via Stripe.
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
                      {refundableRows.map((p) => (
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
                                {p.refunded_amount > 0 &&
                                  `dont ${formatPrice(p.refunded_amount)} déjà remboursés · `}
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
                        </div>
                      ))}
                      {refundableRows.length === 0 && (
                        <p className="rounded-lg border border-zinc-800 bg-zinc-800/20 p-3 text-sm text-zinc-400">
                          Aucun paiement carte remboursable via Stripe sur cette
                          réservation.
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
  open,
  onOpenChange,
  onSettled,
}: {
  payment: PaymentRefundInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé après chaque réponse du serveur (le parent rafraîchit ses données). */
  onSettled: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<RefundOutcome | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  // Après un échec, le serveur renvoie refundableAfter : c'est la valeur la
  // plus fraîche (la réconciliation a pu déplacer le plafond).
  const [capOverride, setCapOverride] = useState<number | null>(null);

  const isCard = payment?.method === "card";
  const blockedCard = !!payment && isCard && !hasStripeReference(payment);
  const cap = payment ? (capOverride ?? refundableCap(payment)) : 0;

  useEffect(() => {
    if (open && payment) {
      setAmount(refundableCap(payment).toFixed(2).replace(".", ","));
      setSubmitting(false);
      setFailure(null);
      setFallbackError(null);
      setCapOverride(null);
    }
  }, [open, payment]);

  const parsed = parseAmountInput(amount);
  const isValid =
    Number.isFinite(parsed) && parsed > 0 && centsLte(parsed, cap);

  // Un remboursement requires_action compte dans le plafond (réservé) mais pas
  // dans refunded_amount : l'écart signale une action attendue côté Stripe.
  const reservedBeyondLedger = payment
    ? (payment.refund_reserved_cents ?? 0) > Math.round(payment.refunded_amount * 100)
    : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment || !isValid || submitting) return;
    setSubmitting(true);
    setFailure(null);
    setFallbackError(null);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
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
      if (isCard && stripeStatus === "pending") {
        toast.success(
          `Remboursement de ${formatPrice(refundedAmount)} accepté par Stripe — en cours de traitement`,
        );
      } else if (isCard) {
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
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Rembourser le paiement</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                {paymentMethodLabel(payment.method)} ·{" "}
                {formatPrice(payment.amount)}
                {payment.refunded_amount > 0 && (
                  <> · déjà remboursé : {formatPrice(payment.refunded_amount)}</>
                )}
                <br />
                Solde remboursable :{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(cap)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {blockedCard ? (
          <>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3 text-sm text-zinc-300">
              Ce paiement carte ne peut pas être remboursé depuis
              l&apos;application : aucune référence Stripe exploitable.
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-zinc-700"
              >
                Fermer
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-zinc-500">
              {isCard
                ? "Le remboursement est demandé à Stripe. Le paiement ne sera affiché comme remboursé qu'après confirmation."
                : "Remboursement manuel : l'argent est rendu au client, puis enregistré ici."}
            </p>

            {reservedBeyondLedger && (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-300">
                  Un remboursement précédent attend une action dans le Dashboard
                  Stripe. Son montant est déjà déduit du solde remboursable.
                </p>
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
                autoFocus
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
                disabled={!isValid || submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rembourser{isValid ? ` ${formatPrice(parsed)}` : ""}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
