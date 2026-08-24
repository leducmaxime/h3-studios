"use client";

import { Gift } from "lucide-react";
import { Price } from "@/components/common/Price";

export interface LoyaltyData {
  configured: boolean;
  type: "percentage" | "fixed" | null;
  value: number;
  threshold: number;
  counter: number;
  remainingToNextAward: number;
  isDue: boolean;
}

export function LoyaltyGauge({ loyalty }: { loyalty: LoyaltyData }) {
  const reward = loyalty.type === "fixed"
    ? <Price amount={loyalty.value} />
    : `-${loyalty.value.toLocaleString("fr-FR")}%`;
  const progress = loyalty.isDue
    ? 100
    : Math.min(100, Math.round((loyalty.counter / loyalty.threshold) * 100));

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Gift className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-white">Fidélité</h2>
      </div>
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Remise fidélité</span>
          <span className="font-semibold text-white">{reward}</span>
        </div>
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{loyalty.counter} / {loyalty.threshold} réservations</span>
            {loyalty.isDue && <span className="text-emerald-400">Seuil atteint</span>}
          </div>
        </div>
        {loyalty.isDue ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Votre remise fidélité de {reward} est disponible : elle s'appliquera automatiquement à votre prochaine réservation.
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            Plus que {loyalty.remainingToNextAward} réservation{loyalty.remainingToNextAward > 1 ? "s" : ""} terminée{loyalty.remainingToNextAward > 1 ? "s" : ""} avant d'obtenir votre remise fidélité de {reward}.
          </div>
        )}
      </div>
    </section>
  );
}
