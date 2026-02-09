"use client";

import { formatPrice } from "@/lib/booking";

interface StickyBookingCTAProps {
  studioPrice: number;
  equipmentPrice: number;
  onConfirm: () => void;
  disabled?: boolean;
  buttonText?: string;
}

export function StickyBookingCTA({
  studioPrice,
  equipmentPrice,
  onConfirm,
  disabled = false,
  buttonText = "Confirmer",
}: StickyBookingCTAProps) {
  const total = studioPrice + equipmentPrice;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            {equipmentPrice > 0 ? (
              <>
                <span className="text-xs text-white/60">
                  Studio {formatPrice(studioPrice)} + Options {formatPrice(equipmentPrice)}
                </span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-white/60">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </>
            )}
          </div>

          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`
              shrink-0 rounded-lg px-6 py-3 font-semibold transition-all
              ${disabled
                ? "cursor-not-allowed bg-white/10 text-white/50"
                : "bg-primary text-black hover:bg-primary/90 active:scale-[0.98]"
              }
            `}
          >
            {buttonText} – {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
