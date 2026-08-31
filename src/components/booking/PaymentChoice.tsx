"use client";

import { CreditCard, Banknote, Loader2 } from "lucide-react";
import { type CompletedBooking, type PaymentMethod } from "@/lib/booking";
import { Price } from "@/components/common/Price";
import { PaymentSummary } from "@/components/booking/PaymentSummary";

export type { PaymentMethod };

interface PaymentChoiceProps {
  cart: CompletedBooking[];
  total: number;
  subtotal: number;
  promoCode?: string;
  promoDiscount: number;
  loyaltyDiscount?: number;
  onSelectMethod: (method: PaymentMethod) => void;
  acceptedCgv: boolean;
  onAcceptedCgvChange: (accepted: boolean) => void;
  isFree: boolean;
  isSubmitting?: boolean;
  onConfirmFree: () => void;
  allowOnSitePayment?: boolean;
  displayPrices?: Record<string, number>;
}

export function PaymentChoice({
  cart,
  total,
  subtotal,
  promoCode,
  promoDiscount,
  loyaltyDiscount = 0,
  onSelectMethod,
  acceptedCgv,
  onAcceptedCgvChange,
  isFree,
  isSubmitting = false,
  onConfirmFree,
  allowOnSitePayment = true,
  displayPrices = {},
}: PaymentChoiceProps) {
  const actionsDisabled = !acceptedCgv || isSubmitting;
  const submittingLabel = (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Réservation en cours…
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-xl font-bold lg:text-2xl">
          {isFree ? "Confirmer la réservation" : "Comment souhaitez-vous payer ?"}
        </h3>
        <p className="mt-2 text-sm text-white/70 lg:text-base">
          {cart.length} réservation{cart.length > 1 ? "s" : ""} • choisissez votre mode de règlement
          {isFree && " — aucun paiement n'est requis"}
        </p>
      </div>

      <PaymentSummary cart={cart} total={total} subtotal={subtotal} promoCode={promoCode} promoDiscount={promoDiscount} loyaltyDiscount={loyaltyDiscount} displayPrices={displayPrices} />
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
          type="button"
          onClick={onConfirmFree}
          disabled={actionsDisabled}
          className={`w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-black transition-all lg:py-4 lg:text-lg ${
            isSubmitting
              ? "cursor-wait opacity-100 shadow-lg shadow-primary/25"
              : actionsDisabled
              ? "cursor-not-allowed opacity-40"
              : "opacity-100 shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.99]"
          }`}
        >
          {isSubmitting ? submittingLabel : "Confirmer la réservation"}
        </button>
      ) : (
        <div className={`grid gap-3 lg:gap-4${allowOnSitePayment ? " lg:grid-cols-2" : ""}`}>
          <button
            type="button"
            onClick={() => onSelectMethod("card")}
            disabled={actionsDisabled}
            aria-busy={isSubmitting}
            className={`group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all lg:gap-4 lg:p-6 ${
              isSubmitting
                ? "cursor-wait border-primary/50 bg-primary/10 opacity-100"
                : actionsDisabled
                ? "cursor-not-allowed border-primary/30 bg-primary/5 opacity-40"
                : "border-primary bg-primary/15 opacity-100 shadow-[0_12px_40px_-18px_rgba(255,222,89,0.55)] hover:-translate-y-0.5 hover:bg-primary/25 hover:shadow-[0_16px_44px_-18px_rgba(255,222,89,0.7)]"
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
                <p className="text-xs text-white/70 lg:text-sm">Paiement sécurisé</p>
              </div>
            </div>

            <div className="mt-auto pt-3 lg:pt-4">
              <span className={`inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-black transition-all lg:px-4 lg:py-3 lg:text-base ${
                isSubmitting ? "shadow-lg shadow-primary/30" : actionsDisabled ? "" : "shadow-lg shadow-primary/35 group-hover:bg-primary/90 group-hover:shadow-primary/50"
              }`}>
                {isSubmitting ? submittingLabel : <>Payer <Price amount={total} /> →</>}
              </span>
            </div>
          </button>

          {allowOnSitePayment && (
            <button
              type="button"
              onClick={() => onSelectMethod("cash")}
              disabled={actionsDisabled}
              aria-busy={isSubmitting}
              className={`group flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all lg:gap-4 lg:p-6 ${
                isSubmitting
                  ? "cursor-wait border-white/35 bg-white/10 opacity-100"
                  : actionsDisabled
                  ? "cursor-not-allowed border-white/15 bg-white/5 opacity-40"
                  : "border-white/60 bg-white/10 opacity-100 shadow-lg shadow-black/20 hover:-translate-y-0.5 hover:border-white hover:bg-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 lg:h-12 lg:w-12">
                  <Banknote className="h-5 w-5 text-white lg:h-6 lg:w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white lg:text-lg">Payer sur place</h4>
                  <p className="text-xs text-white/70 lg:text-sm">Espèces ou CB</p>
                </div>
              </div>

              <div className="mt-auto pt-3 lg:pt-4">
                <span className={`inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-all lg:px-4 lg:py-3 lg:text-base ${
                  isSubmitting
                    ? "border border-white/50 bg-white/15 text-white"
                    : actionsDisabled
                      ? "border border-white/50 bg-white/10 text-white"
                      : "bg-white text-black shadow-lg shadow-black/25 group-hover:bg-white/90"
                }`}>
                  {isSubmitting ? submittingLabel : "Réserver sans payer"}
                </span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
