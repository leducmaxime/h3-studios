"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Header } from "@/components/Header/Header";
import { Footer } from "@/components/Footer";
import { SplashScreen } from "@/components/common/SplashScreen";
import { ClientAuthProvider } from "@/lib/client-auth-store";
import { subscribe } from "@/lib/navigation-events";

interface MainLayoutProps {
  children?: React.ReactNode;
}

function useClearBookingOnNavigate() {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => ""
  );

  useEffect(() => {
    if (!pathname) return;
    const isReservationPage = pathname.startsWith("/reservation");
    const isAccountPage = pathname.startsWith("/mon-compte");
    if (!isReservationPage && !isAccountPage) {
      localStorage.removeItem("h3-studios-booking-state");
      localStorage.removeItem("h3-studios-booking-state-v2");
    }
  }, [pathname]);
}

export function MainLayout({ children }: MainLayoutProps) {
  useClearBookingOnNavigate();

  return (
    <ClientAuthProvider>
      <div className="flex min-h-screen flex-col">
        <SplashScreen />
        <Header />
        <main className="container flex grow flex-col">
          {children}
        </main>
        <Footer />
      </div>
    </ClientAuthProvider>
  );
}
