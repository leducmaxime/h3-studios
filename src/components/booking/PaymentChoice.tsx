"use client";

import { CreditCard, Banknote } from "lucide-react";
import { formatPrice, type CompletedBooking, type PaymentMethod } from "@/lib/booking";
import { TaxBreakdown } from "@/components/common/TaxBreakdown";

export type { PaymentMethod };

interface PaymentChoiceProps {
  cart: CompletedBooking[];
  total: number;
  subtotal: number;
  promoCode?: string;
  promoDiscount: number;
  onSelectMethod: (method: PaymentMethod) => void;
  onBack: () => void;
  acceptedCgv: boolean;
  onAcceptedCgvChange: (accepted: boolean) => void;
  isFree: boolean;
  isSubmitting?: boolean;
  onConfirmFree: () => void;
  allowOnSitePayment?: boolean;
}

export function PaymentChoice({
  cart,
  total,
  subtotal,
  promoCode,
  promoDiscount,
  onSelectMethod,
  acceptedCgv,
  onAcceptedCgvChange,
  isFree,
  isSubmitting = false,
  onConfirmFree,
  allowOnSitePayment = true,
}: PaymentChoiceProps) {
  const actionsDisabled = !acceptedCgv || isSubmitting;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-xl font-bold lg:text-2xl">
          {isFree ? "Confirmer la réservation" : "Comment souhaitez-vous payer ?"}
        </h3>
        <p className="mt-2 text-sm text-white/60 lg:text-base">
          {cart.length} réservation{cart.length > 1 ? "s" : ""} • Total : {formatPrice(total)}
          {isFree && " — aucun paiement n'est requis"}
        </p>
      </div>

      <div className="space-y-2">
        {promoDiscount > 0 && (
          <>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Sous-total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-green-400">
              <span>Réduction ({promoCode})</span>
              <span>-{formatPrice(promoDiscount)}</span>
            </div>
          </>
        )}
        <TaxBreakdown ttc={total} />
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Total TTC</span>
          <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-white/5 p-4 lg:p-5">
        <label htmlFor="acceptCgv" className="flex cursor-pointer items-start gap-3">
          <input
            id="acceptCgv"
            type="checkbox"
            checked={acceptedCgv}
            onChange={(e) => onAcceptedCgvChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 accent-primary"
          />
          <span className="text-sm font-medium text-white/90">
            J'accepte les{" "}
            <a
              href="/conditions-de-vente"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              conditions générales de vente
            </a>{" "}
            <span className="text-primary">*</span>
          </span>
        </label>
        {!acceptedCgv && (
          <p className="mt-2 pl-7 text-xs text-white/50">Cochez la case pour continuer.</p>
        )}
      </div>

      {isFree ? (
        <button
          onClick={onConfirmFree}
          disabled={actionsDisabled}
          className={`w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-black transition-all lg:py-4 lg:text-lg ${
            actionsDisabled
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-primary/90"
          }`}
        >
          Confirmer la réservation
        </button>
      ) : (
        <div className={`grid gap-3 lg:gap-4${allowOnSitePayment ? " lg:grid-cols-2" : ""}`}>
          <button
            onClick={() => onSelectMethod("card")}
            disabled={actionsDisabled}
            className={`group relative flex flex-col gap-3 rounded-xl border-2 border-primary/50 bg-primary/10 p-4 text-left transition-all lg:gap-4 lg:p-6 ${
              actionsDisabled
                ? "cursor-not-allowed opacity-40"
                : "hover:border-primary hover:bg-primary/20"
            }`}
          >
            {allowOnSitePayment && (
              <div className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-black lg:-top-3 lg:right-4 lg:px-3 lg:py-1 lg:text-xs">
                Recommandé
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 lg:h-12 lg:w-12">
                <CreditCard className="h-5 w-5 text-primary lg:h-6 lg:w-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold lg:text-lg">Payez en ligne</h4>
                <p className="text-xs text-white/50 lg:text-sm">Paiement sécurisé</p>
              </div>
            </div>

            <div className="mt-auto pt-3 lg:pt-4">
              <span className={`inline-block rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-black transition-all lg:px-4 lg:py-2 lg:text-base ${
                actionsDisabled ? "" : "group-hover:bg-primary/90"
              }`}>
                Payer {formatPrice(total)} →
              </span>
            </div>
          </button>

          {allowOnSitePayment && (
            <button
              onClick={() => onSelectMethod("cash")}
              disabled={actionsDisabled}
              className={`group flex flex-col gap-3 rounded-xl border-2 border-white/20 bg-white/15 p-4 text-left transition-all lg:gap-4 lg:p-6 ${
                actionsDisabled
                  ? "cursor-not-allowed opacity-40"
                  : "hover:border-white/40 hover:bg-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 lg:h-12 lg:w-12">
                  <Banknote className="h-5 w-5 text-white/70 lg:h-6 lg:w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold lg:text-lg">Payer sur place</h4>
                  <p className="text-xs text-white/50 lg:text-sm">Espèces ou CB</p>
                </div>
              </div>

              <div className="mt-auto pt-3 lg:pt-4">
                <span className={`inline-block rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white/70 transition-all lg:px-4 lg:py-2 lg:text-base ${
                  actionsDisabled ? "" : "group-hover:border-white/50 group-hover:text-white"
                }`}>
                  Réserver sans payer
                </span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
