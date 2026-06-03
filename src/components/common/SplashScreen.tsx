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
      }, 1200);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        sessionStorage.setItem("h3-splash-seen", "true");
      }, 2000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-all duration-700 ease-in-out ${
        isFading ? "opacity-0 scale-150 blur-xl" : "opacity-100 scale-100 blur-0"
      }`}
      style={{ willChange: "transform, opacity" }}
    >
      <img
        src="/images/logo.webp"
        alt="H3 Studios"
        width={96}
        height={96}
        decoding="async"
        className="h-24 w-24"
        style={{
          animation: "spin 1s ease-out forwards",
          willChange: "transform",
        }}
      />
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg) translateZ(0);
          }
          to {
            transform: rotate(360deg) translateZ(0);
          }
        }
      `}</style>
    </div>
  );
}
