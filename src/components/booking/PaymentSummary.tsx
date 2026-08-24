"use client";

import { ReceiptText, Tag } from "lucide-react";
import { type CompletedBooking } from "@/lib/booking";
import { TaxBreakdown } from "@/components/common/TaxBreakdown";
import { Price } from "@/components/common/Price";

interface PaymentSummaryProps {
  cart: CompletedBooking[];
  total: number;
  subtotal: number;
  promoCode?: string | null;
  promoDiscount: number;
  loyaltyDiscount?: number;
  displayPrices?: Record<string, number>;
  userEmail?: string;
}

export function PaymentSummary({ cart, total, subtotal, promoCode, promoDiscount, loyaltyDiscount = 0, userEmail }: PaymentSummaryProps) {
  const hasDiscount = promoDiscount > 0 || loyaltyDiscount > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.11] via-white/[0.05] to-white/[0.02] shadow-[0_18px_55px_-30px_rgba(45,212,191,0.55)]" aria-labelledby="payment-summary-title">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"><ReceiptText className="h-5 w-5" aria-hidden="true" /></span>
          <div><h4 id="payment-summary-title" className="font-semibold text-white">Montant à régler</h4><p className="text-xs text-white/50">{cart.length} réservation{cart.length > 1 ? "s" : ""}</p></div>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/55">TTC</span>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <div className="space-y-2 text-sm">
          {hasDiscount && <div className="flex items-center justify-between text-white/60"><span>Sous-total</span><Price amount={subtotal} /></div>}
          {promoDiscount > 0 && <div className="flex items-center justify-between text-emerald-300"><span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Réduction{promoCode ? ` (${promoCode})` : ""}</span><span>−<Price amount={promoDiscount} /></span></div>}
          {loyaltyDiscount > 0 && <div className="flex items-center justify-between text-emerald-300"><span>Remise fidélité</span><span>−<Price amount={loyaltyDiscount} /></span></div>}
          <TaxBreakdown ttc={total} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-black shadow-[0_10px_30px_-14px_rgba(45,212,191,0.9)]">
          <p className="font-bold">Total TTC</p>
          <Price amount={total} bare className="text-2xl font-bold sm:text-3xl" />
        </div>
        {userEmail && <p className="mt-3 text-center text-xs text-white/40">Un reçu sera envoyé à {userEmail}</p>}
      </div>
    </section>
  );
}
