"use client";

import { formatPrice } from "@/lib/booking";

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

  return (
    <div
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
            w-full rounded-lg px-6 py-3 font-semibold transition-all
            ${disabled
              ? "cursor-not-allowed bg-white/15 text-white/50"
              : "bg-primary text-black hover:bg-primary/90 active:scale-[0.98]"
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
            showPrice ? `${buttonText} – ${formatPrice(total)}` : buttonText
          )}
        </button>
      </div>
    </div>
  );
}
