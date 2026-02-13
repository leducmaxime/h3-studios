"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header/Header";
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
    if (!isReservationPage) {
      localStorage.removeItem("h3-studios-booking-state");
    }
  }, [pathname]);
}

export function MainLayout({ children }: MainLayoutProps) {
  useClearBookingOnNavigate();

  return (
    <>
      <SplashScreen />
      <Header />
      <div className="container flex h-full flex-col justify-between">
        {children}
      </div>
    </>
  );
}
