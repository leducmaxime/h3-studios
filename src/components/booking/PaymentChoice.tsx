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
          
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="text-lg font-semibold">Payer maintenant</h4>
              <p className="text-sm text-primary">Carte bancaire</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-400" />
              <span>Créneau garanti et confirmé</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-green-400" />
              <span>Confirmation immédiate par email</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-400" />
              <span>Pas d'attente sur place</span>
            </li>
          </ul>

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

          <ul className="space-y-2 text-sm text-white/50">
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Arrivez 5 min avant pour le paiement</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 text-center text-xs">⚠️</span>
              <span>Créneau libéré si retard {">"} 15 min</span>
            </li>
          </ul>

          <div className="mt-auto pt-4">
            <span className="rounded-lg border border-white/30 px-4 py-2 font-medium text-white/70 transition-all group-hover:border-white/50 group-hover:text-white">
              Réserver sans payer
            </span>
          </div>
        </button>
      </div>

      <button
        onClick={onBack}
        className="mx-auto text-sm text-white/50 hover:text-white"
      >
        ← Retour au récapitulatif
      </button>
    </div>
  );
}
