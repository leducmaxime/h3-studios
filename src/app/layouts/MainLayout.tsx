"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header/Header";
import { Footer } from "@/components/Footer";
import { SplashScreen } from "@/components/common/SplashScreen";

interface MainLayoutProps {
  children?: React.ReactNode;
}

function useClearBookingOnNavigate() {
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPathname(window.location.pathname);

    const handleNavigate = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handleNavigate);

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleNavigate();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleNavigate();
    };

    return () => {
      window.removeEventListener("popstate", handleNavigate);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const isReservationPage = pathname.startsWith("/reservation");
    const isAccountPage = pathname.startsWith("/mon-compte");
    if (!isReservationPage && !isAccountPage) {
      localStorage.removeItem("h3-studios-booking-state");
    }
  }, [pathname]);
}

export function MainLayout({ children }: MainLayoutProps) {
  useClearBookingOnNavigate();

  return (
    <div className="flex grow flex-col justify-between">
      <SplashScreen />
      <Header />
      <main className="container flex grow flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
