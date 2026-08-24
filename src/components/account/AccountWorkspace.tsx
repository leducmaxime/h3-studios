"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AccountBookings } from "@/components/account/AccountBookings";
import { AccountLoyaltyPanel } from "@/components/account/AccountLoyaltyPanel";
import { AccountMenu } from "@/components/account/AccountMenu";
import { AccountProfileForm } from "@/components/account/AccountProfileForm";
import { accountPageFromPath, type AccountPage } from "@/lib/account-nav";
import { useClientAuth } from "@/lib/client-auth-store";
import { subscribe } from "@/lib/navigation-events";

function useAccountPage(initialPage: AccountPage): AccountPage {
  return useSyncExternalStore(
    subscribe,
    () => accountPageFromPath(window.location.pathname),
    () => initialPage,
  );
}

export function AccountWorkspace({ initialPage }: { initialPage: AccountPage }) {
  const { user, status } = useClientAuth();
  const page = useAccountPage(initialPage);

  useEffect(() => {
    if (status === "ready" && !user) {
      window.location.href = "/mon-compte/connexion";
    }
  }, [status, user]);

  if (status === "loading" || !user) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="text-zinc-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-black px-2 lg:px-4 pt-32 pb-16">
      <div className="container max-w-4xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-4xl lg:text-6xl">Mon compte</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <AccountMenu current={page} />
        </div>
        <div hidden={page !== "reservations"}>
          <AccountBookings />
        </div>
        <div hidden={page !== "profile"}>
          <AccountProfileForm />
        </div>
        <div hidden={page !== "loyalty"}>
          <AccountLoyaltyPanel />
        </div>
      </div>
    </div>
  );
}
