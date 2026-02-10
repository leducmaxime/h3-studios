"use client";

import { CreditCard, Banknote, ShieldCheck, Clock, Mail } from "lucide-react";
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
        <h3 className="text-2xl font-bold">Comment souhaitez-vous payer ?</h3>
        <p className="mt-2 text-white/60">
          {cart.length} créneau{cart.length > 1 ? "x" : ""} • Total: {formatPrice(total)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => onSelectMethod("card")}
          className="group relative flex flex-col gap-4 rounded-xl border-2 border-primary/50 bg-primary/10 p-6 text-left transition-all hover:border-primary hover:bg-primary/20"
        >
          <div className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-black">
            Recommandé
          </div>
          


          <div className="mt-auto pt-4">
            <span className="rounded-lg bg-primary px-4 py-2 font-semibold text-black transition-all group-hover:bg-primary/90">
              Payer {formatPrice(total)} →
            </span>
          </div>
        </button>

        <button
          onClick={() => onSelectMethod("cash")}
          className="group flex flex-col gap-4 rounded-xl border-2 border-white/20 bg-white/5 p-6 text-left transition-all hover:border-white/40 hover:bg-white/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Banknote className="h-6 w-6 text-white/70" />
            </div>
            <div>
              <h4 className="text-lg font-semibold">Payer sur place</h4>
              <p className="text-sm text-white/50">Espèces ou CB</p>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <span className="rounded-lg border border-white/30 px-4 py-2 font-medium text-white/70 transition-all group-hover:border-white/50 group-hover:text-white">
              Réserver sans payer
            </span>
          </div>
        </button>
        </div>
      </div>
  );
}
