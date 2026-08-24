"use client";

import { useEffect, useState } from "react";
import { navigate } from "rwsdk/client";
import { CalendarDays, Gift, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/lib/client-auth-store";

export type AccountPage = "reservations" | "profile" | "loyalty";

const NAV_BUTTON =
  "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white";
const NAV_BUTTON_ACTIVE =
  "border-primary/40 bg-primary/10 text-white hover:bg-primary/15 hover:text-white";

export function AccountMenu({ current }: { current: AccountPage }) {
  const { user, status } = useClientAuth();
  const [loyaltyConfigured, setLoyaltyConfigured] = useState(false);

  useEffect(() => {
    if (status === "loading" || !user) {
      setLoyaltyConfigured(false);
      return;
    }
    let active = true;
    fetch("/api/client/loyalty")
      .then(async (response) => {
        if (!response.ok) return false;
        const result = (await response.json()) as { success?: boolean; data?: { configured?: boolean } };
        return result.success === true && result.data?.configured === true;
      })
      .then((configured) => {
        if (active) setLoyaltyConfigured(configured);
      })
      .catch(() => {
        if (active) setLoyaltyConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [status, user?.id]);

  const fullName = [user?.first_name, user?.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const displayName = fullName || user?.name.trim() || "";

  return (
    <div className="mt-4">
      {displayName && (
        <p className="text-sm text-zinc-400 lg:text-base">
          Bonjour <span className="font-medium text-zinc-100">{displayName}</span>
        </p>
      )}
      <nav aria-label="Espace compte" className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <Button
          variant="outline"
          size="sm"
          className={current === "reservations" ? NAV_BUTTON_ACTIVE : NAV_BUTTON}
          aria-current={current === "reservations" ? "page" : undefined}
          onClick={() => navigate("/mon-compte")}
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Mes réservations
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={current === "profile" ? NAV_BUTTON_ACTIVE : NAV_BUTTON}
          aria-current={current === "profile" ? "page" : undefined}
          onClick={() => navigate("/mon-compte/profil")}
        >
          <User className="h-4 w-4 mr-2" />
          Mon profil
        </Button>
        {loyaltyConfigured && (
          <Button
            variant="outline"
            size="sm"
            className={current === "loyalty" ? NAV_BUTTON_ACTIVE : NAV_BUTTON}
            aria-current={current === "loyalty" ? "page" : undefined}
            onClick={() => navigate("/mon-compte/fidelite")}
          >
            <Gift className="h-4 w-4 mr-2" />
            Fidélité
          </Button>
        )}
        <Button
          className="bg-primary text-black hover:bg-primary/90"
          size="sm"
          onClick={() => navigate("/reservation")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle réservation
        </Button>
      </nav>
    </div>
  );
}
