"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Price } from "@/components/common/Price";

interface StickyBookingCTAProps {
  studioPrice: number;
  equipmentPrice: number;
  onConfirm: () => void;
  disabled?: boolean;
  buttonText?: string;
  /** When true, prices are replaced by skeleton bars (tariffs still loading) */
  priceLoading?: boolean;
  showPrice?: boolean;
}

export function StickyBookingCTA({
  studioPrice,
  equipmentPrice,
  onConfirm,
  disabled = false,
  buttonText = "Confirmer",
  priceLoading = false,
  showPrice = true,
}: StickyBookingCTAProps) {
  const total = studioPrice + equipmentPrice;

  // This app server-renders "use client" components, so `document` is
  // undefined during SSR. Only portal into document.body once mounted on
  // the client — the server pass (and the very first client render, before
  // hydration effects fire) returns null instead.
  const [mounted, setMounted] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reserve real scroll room for the bar at the true end of the document
  // (after the site footer, which lives outside this component's tree in
  // MainLayout) so nothing ends up permanently hidden behind it. Measuring
  // the bar's own rendered height (rather than a hardcoded constant) keeps
  // this correct if the content wraps to two lines, and naturally collapses
  // to 0 on desktop where `lg:hidden` makes the bar's offsetHeight 0.
  useEffect(() => {
    if (!mounted) return;
    const el = barRef.current;
    if (!el) return;

    const updateClearance = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    updateClearance();

    const resizeObserver = new ResizeObserver(updateClearance);
    resizeObserver.observe(el);
    window.addEventListener("resize", updateClearance);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateClearance);
      document.body.style.paddingBottom = "";
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        animation: "slideUp 0.3s ease-out forwards",
      }}
    >
      <style>
        {`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>

      <div className="border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-lg">
        <button
          onClick={onConfirm}
          disabled={disabled}
          aria-busy={priceLoading}
          className={`
            w-full rounded-xl px-6 py-3 font-semibold transition-all
            ${disabled
              ? "cursor-not-allowed bg-white/15 text-white/50"
              : "bg-primary text-black shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.99]"
            }
          `}
        >
          {priceLoading ? (
            <span className="inline-flex items-center justify-center">
              {buttonText}
              <span aria-hidden="true" className="ml-1.5 inline-flex items-center gap-1.5">
                <span>–</span>
                <span className="inline-block h-4 w-14 rounded bg-current motion-safe:animate-pulse" />
              </span>
            </span>
          ) : (
            showPrice ? <>{buttonText} – <Price amount={total} /></> : buttonText
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}
