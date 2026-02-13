"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem("h3-splash-seen");
    
    if (!hasSeenSplash) {
      setIsVisible(true);
      
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 2500);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        sessionStorage.setItem("h3-splash-seen", "true");
      }, 3000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src="/images/logo.png"
        alt="H3 Studios"
        className="h-24 w-24 animate-spin"
        style={{ animationDuration: "2s" }}
      />
    </div>
  );
}
