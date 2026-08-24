"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { LoyaltyGauge, type LoyaltyData } from "@/components/account/LoyaltyGauge";
import { useClientAuth } from "@/lib/client-auth-store";

export function AccountLoyaltyPanel() {
  const { user, status } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      window.location.href = "/mon-compte/connexion";
      return;
    }

    fetch("/api/client/loyalty")
      .then((response) => response.ok ? response.json() as Promise<{ success?: boolean; data?: LoyaltyData }> : null)
      .then((result) => setLoyalty(result?.success === true && result.data?.configured === true ? result.data : null))
      .catch(() => setLoyalty(null))
      .finally(() => setLoading(false));
  }, [status, user?.id]);

  if (loading || !user) {
    return <div className="py-16 text-center text-zinc-400">Chargement...</div>;
  }

  return loyalty ? (
    <LoyaltyGauge loyalty={loyalty} />
  ) : (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Gift className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-white">Programme de fidélité indisponible</h2>
      <p className="mt-2 text-sm text-zinc-400">Le programme de fidélité n'est pas activé sur votre compte pour le moment.</p>
    </section>
  );
}
