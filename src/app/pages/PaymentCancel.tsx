"use client";

import { useState, useEffect } from "react";

import { XCircle, ArrowLeft, RefreshCw, Phone } from "lucide-react";

export function PaymentCancel() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <div className={`w-full max-w-[600px] px-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <div className="relative overflow-hidden rounded-2xl border-4 border-yellow-500 bg-black/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent" />

          <div className="relative p-6 sm:p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/20">
                <XCircle className="h-12 w-12 text-yellow-500" />
              </div>
            </div>

            <h1 className="mb-2 font-blanka text-2xl sm:text-3xl text-yellow-400">
              PAIEMENT ANNULÉ
            </h1>
            
            <p className="mb-6 text-white/70">
              Votre paiement a été annulé. Aucun montant n'a été débité.
            </p>

            <div className="mb-6 rounded-lg bg-white/5 border border-white/10 p-4">
              <p className="text-sm text-white/60">
                Votre panier a été conservé. Vous pouvez reprendre votre réservation 
                là où vous l'avez laissée ou commencer une nouvelle réservation.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="/reservation/payment"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="h-5 w-5" />
                Réessayer le paiement
              </a>
              
              <a
                href="/reservation"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
                Modifier ma réservation
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-white/50 mb-3">
                Un problème avec le paiement ?
              </p>
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Phone className="h-4 w-4" />
                <span>01 45 90 XX XX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
