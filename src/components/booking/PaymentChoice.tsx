"use client";

import { CreditCard, Banknote } from "lucide-react";
import { formatPrice, type CompletedBooking, type PaymentMethod } from "@/lib/booking";

export type { PaymentMethod };

interface PaymentChoiceProps {
  cart: CompletedBooking[];
  total: number;
  onSelectMethod: (method: PaymentMethod) => void;
  onBack: () => void;
}

export function PaymentChoice({ cart, total, onSelectMethod, onBack }: PaymentChoiceProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-xl font-bold md:text-2xl">Comment souhaitez-vous payer ?</h3>
        <p className="mt-2 text-sm text-white/60 md:text-base">
          {cart.length} réservation{cart.length > 1 ? "s" : ""} • Total : {formatPrice(total)}
        </p>
      </div>

      <div className="grid gap-3 md:gap-4 md:grid-cols-2">
        <button
          onClick={() => onSelectMethod("card")}
          className="group relative flex flex-col gap-3 rounded-xl border-2 border-primary/50 bg-primary/10 p-4 text-left transition-all hover:border-primary hover:bg-primary/20 md:gap-4 md:p-6"
        >
          <div className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-black md:-top-3 md:right-4 md:px-3 md:py-1 md:text-xs">
            Recommandé
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 md:h-12 md:w-12">
              <CreditCard className="h-5 w-5 text-primary md:h-6 md:w-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold md:text-lg">Payez en ligne</h4>
              <p className="text-xs text-white/50 md:text-sm">Paiement sécurisé</p>
            </div>
          </div>

          <div className="mt-auto pt-3 md:pt-4">
            <span className="inline-block rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-black transition-all group-hover:bg-primary/90 md:px-4 md:py-2 md:text-base">
              Payer {formatPrice(total)} →
            </span>
          </div>
        </button>

         <button
           onClick={() => onSelectMethod("cash")}
           className="group flex flex-col gap-3 rounded-xl border-2 border-white/20 bg-white/5 p-4 text-left transition-all hover:border-white/40 hover:bg-white/10 md:gap-4 md:p-6"
         >
           <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 md:h-12 md:w-12">
               <Banknote className="h-5 w-5 text-white/70 md:h-6 md:w-6" />
             </div>
             <div>
               <h4 className="text-base font-semibold md:text-lg">Payer sur place</h4>
               <p className="text-xs text-white/50 md:text-sm">Espèces ou CB</p>
             </div>
           </div>
 
           <div className="mt-auto pt-3 md:pt-4">
             <span className="inline-block rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white/70 transition-all group-hover:border-white/50 group-hover:text-white md:px-4 md:py-2 md:text-base">
               Réserver sans payer
             </span>
           </div>
         </button>
        </div>
      </div>
  );
}
