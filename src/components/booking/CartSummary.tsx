"use client";

import { ShoppingCart, X, ChevronRight } from "lucide-react";
import { STUDIOS, formatDate, formatDuration, formatPrice, type CompletedBooking } from "@/lib/booking";

interface CartSummaryProps {
  cart: CompletedBooking[];
  total: number;
  onRemove: (bookingId: string) => void;
  onCheckout: () => void;
}

export function CartSummary({ cart, total, onRemove, onCheckout }: CartSummaryProps) {
  if (cart.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <span className="font-medium">Panier ({cart.length} réservation{cart.length > 1 ? "s" : ""})</span>
      </div>

      <div className="space-y-2">
        {cart.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between rounded-lg bg-black/30 p-3"
          >
            <div className="flex-1">
              <div className="font-medium">
                {booking.groupType === "group" ? STUDIOS[booking.studioId].name : "Répétition"}
              </div>
              <div className="text-sm text-white/60">
                {formatDate(booking.date, "short")} • {booking.startTime} - {booking.endTime} ({formatDuration(booking.startTime, booking.endTime)})
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-primary">{formatPrice(booking.price)}</span>
              <button
                onClick={() => onRemove(booking.id)}
                className="rounded-full p-1 transition-colors hover:bg-white/10"
                aria-label="Supprimer"
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-lg font-semibold">Total: {formatPrice(total)}</span>
        <button
          onClick={onCheckout}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-black transition-colors hover:bg-primary/90"
        >
          Finaliser
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
