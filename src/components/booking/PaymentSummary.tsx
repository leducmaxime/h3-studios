"use client";

import { CalendarDays, Clock3, MapPin, ReceiptText, Sparkles, Tag } from "lucide-react";
import { type CompletedBooking, formatDate, sortBookingsByStart, STUDIOS } from "@/lib/booking";
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

export function PaymentSummary({ cart, total, subtotal, promoCode, promoDiscount, loyaltyDiscount = 0, displayPrices = {}, userEmail }: PaymentSummaryProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.09] to-white/[0.04] shadow-[0_18px_55px_-30px_rgba(45,212,191,0.55)]" aria-labelledby="payment-summary-title">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"><ReceiptText className="h-5 w-5" aria-hidden="true" /></span>
          <div><h4 id="payment-summary-title" className="font-semibold text-white">Récapitulatif</h4><p className="text-xs text-white/50">{cart.length} réservation{cart.length > 1 ? "s" : ""}</p></div>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/55">TTC</span>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Vos prestations</p>
        {sortBookingsByStart(cart).map((booking) => {
          const sessionPrice = displayPrices[booking.id] ?? booking.price;
          return <div key={booking.id} className="rounded-xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-semibold text-white">{STUDIOS[booking.studioId].name}</p><div className="mt-2 grid gap-1 text-xs text-white/55 sm:grid-cols-2 sm:gap-x-4"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary/80" />{formatDate(booking.date, "long")}</span><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary/80" />{booking.startTime} – {booking.endTime}</span></div></div>
              <Price amount={sessionPrice} className="shrink-0 font-semibold text-white" />
            </div>
            <div className="mt-3 space-y-1.5 border-t border-white/[0.08] pt-2.5 text-xs"><div className="flex items-center justify-between text-white/55"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Session studio</span><Price amount={Math.max(0, sessionPrice - (booking.equipmentPrice || 0))} /></div>{(booking.equipmentPrice || 0) > 0 && <div className="flex items-center justify-between text-white/55"><span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Options équipement</span><Price amount={booking.equipmentPrice} /></div>}</div>
          </div>;
        })}
      </div>
      <div className="border-t border-white/10 px-4 py-4 sm:px-5"><div className="space-y-2 text-sm"><div className="flex items-center justify-between text-white/60"><span>Sous-total</span><Price amount={subtotal} /></div>{promoDiscount > 0 && <div className="flex items-center justify-between text-emerald-300"><span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Réduction{promoCode ? ` (${promoCode})` : ""}</span><span>−<Price amount={promoDiscount} /></span></div>}{loyaltyDiscount > 0 && <div className="flex items-center justify-between text-emerald-300"><span>Remise fidélité</span><span>−<Price amount={loyaltyDiscount} /></span></div>}<div className="border-t border-white/[0.08] pt-2"><TaxBreakdown ttc={total} /></div></div><div className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-black"><div><p className="text-xs font-semibold uppercase tracking-wider opacity-65">Montant à régler</p><p className="font-bold">Total TTC</p></div><Price amount={total} bare className="text-2xl font-bold sm:text-3xl" /></div>{userEmail && <p className="mt-3 text-center text-xs text-white/40">Un reçu sera envoyé à {userEmail}</p>}</div>
    </section>
  );
}
