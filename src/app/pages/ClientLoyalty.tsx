"use client";

import { useEffect, useState } from "react";
import { navigate } from "rwsdk/client";
import { ArrowLeft, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoyaltyGauge, type LoyaltyData } from "@/components/account/LoyaltyGauge";
import { useClientAuth } from "@/lib/client-auth-store";

export function ClientLoyalty() {
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
    return <div className="min-h-[80vh] bg-black flex items-center justify-center"><div className="text-zinc-400">Chargement...</div></div>;
  }

  return (
    <div className="min-h-[80vh] bg-black px-2 lg:px-4 pt-32 pb-16">
      <div className="container max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="font-blanka text-4xl lg:text-6xl">FIDELITE</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        {loyalty ? (
          <LoyaltyGauge loyalty={loyalty} />
        ) : (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-white">Programme de fidélité indisponible</h2>
            <p className="mt-2 text-sm text-zinc-400">Le programme de fidélité n'est pas activé sur votre compte pour le moment.</p>
          </section>
        )}

        <div className="mt-8">
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => navigate("/mon-compte")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à mes réservations
          </Button>
        </div>
      </div>
    </div>
  );
}
