"use client";

import { CheckCircle2, Calendar, Download, ExternalLink, ChevronLeft, CreditCard, Banknote } from "lucide-react";
import {
  STUDIOS,
  EQUIPMENT,
  formatDate,
  formatDuration,
  formatPrice,
  generateICS,
  downloadICS,
  type CompletedBooking,
} from "@/lib/booking";

interface FinalCheckoutProps {
  cart: CompletedBooking[];
  total: number;
  onNewBooking: () => void;
  onBack: () => void;
  onProceedToPayment?: () => void;
  showPaymentButton?: boolean;
}

export function FinalCheckout({ cart, total, onNewBooking, onBack, onProceedToPayment, showPaymentButton }: FinalCheckoutProps) {
  const isPending = cart[0]?.paymentStatus === "pending";
  const isPaid = cart[0]?.paymentStatus === "paid";
  const handleDownloadAll = () => {
    cart.forEach((booking) => {
      const ics = generateICS(
        booking.date,
        booking.startTime,
        booking.endTime,
        STUDIOS[booking.studioId].name,
        booking.bookingRef
      );
      downloadICS(ics, `h3-studios-${booking.bookingRef}.ics`);
    });
  };

  const handleAddToGoogleCalendar = (booking: CompletedBooking) => {
    const startDate = new Date(booking.date);
    const [startHours, startMinutes] = booking.startTime.split(":").map(Number);
    startDate.setHours(startHours, startMinutes, 0, 0);

    const endDate = new Date(booking.date);
    const [endHours, endMinutes] = booking.endTime.split(":").map(Number);
    endDate.setHours(endHours, endMinutes, 0, 0);

    const formatGoogleDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `Répétition - ${STUDIOS[booking.studioId].name}`,
      dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
      details: `Réservation ${booking.bookingRef} chez H3 Studios`,
      location: "3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie",
    });

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mb-4 inline-flex rounded-full bg-green-500/20 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h3 className="mb-2 text-2xl font-bold">
          {showPaymentButton ? "Récapitulatif de votre commande" : "Réservations confirmées !"}
        </h3>
        <p className="text-white/60">
          {cart.length} réservation{cart.length > 1 ? "s" : ""}
          {!showPaymentButton && (isPaid ? " • Payé en ligne" : " • Paiement sur place")}
        </p>
      </div>

      <div className="space-y-3">
        {cart.map((booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="font-semibold">
                  {booking.groupType === "group" ? STUDIOS[booking.studioId].name : "Répétition"}
                </h4>
                <p className="text-sm text-primary">Réf: {booking.bookingRef}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold text-primary">{formatPrice(booking.price)}</span>
                {!showPaymentButton && (
                  booking.paymentStatus === "paid" ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                      <CreditCard className="h-3 w-3" />
                      Payé
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                      <Banknote className="h-3 w-3" />
                      À régler sur place
                    </span>
                  )
                )}
              </div>
            </div>
            
            {booking.equipmentPrice > 0 && (
              <div className="mb-3 text-xs text-white/60">
                Options suppl. : {booking.equipment.filter(e => e.quantity > 0).map(e => 
                  `${EQUIPMENT[e.id]?.name || e.id} ×${e.quantity}`
                ).join(", ")} ({formatPrice(booking.equipmentPrice)})
              </div>
            )}
            {booking.promoDiscount > 0 && (
              <div className="mb-3 text-xs text-green-400">
                Code promo {booking.promoCode} : -{formatPrice(booking.promoDiscount)}
              </div>
            )}

            <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(booking.date, "long")} • {booking.startTime} - {booking.endTime} ({formatDuration(booking.startTime, booking.endTime)})
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const ics = generateICS(
                    booking.date,
                    booking.startTime,
                    booking.endTime,
                    STUDIOS[booking.studioId].name,
                    booking.bookingRef
                  );
                  downloadICS(ics, `h3-studios-${booking.bookingRef}.ics`);
                }}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
              >
                <Download className="h-3 w-3" />
                .ics
              </button>
              <button
                onClick={() => handleAddToGoogleCalendar(booking)}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
              >
                <ExternalLink className="h-3 w-3" />
                Google
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-primary/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg">
            {showPaymentButton ? "Total" : (isPaid ? "Total payé" : "Total à régler sur place")}
          </span>
          <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
        </div>
      </div>

      {cart.length > 1 && (
        <button
          onClick={handleDownloadAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 transition-colors hover:bg-white/5"
        >
          <Download className="h-5 w-5" />
          Télécharger tous les .ics
        </button>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-3 transition-colors hover:bg-white/5"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </button>
        {showPaymentButton && onProceedToPayment ? (
          <button
            onClick={onProceedToPayment}
            className="flex-1 rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
          >
            Procéder au paiement
          </button>
        ) : (
          <button
            onClick={onCheckout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
          >
            Finaliser les réservations → {formatPrice(cartTotal)}
          </button>
        )}
      </div>

      <p className="text-center text-sm text-white/50">
        {showPaymentButton 
          ? "Vous pourrez choisir de payer en ligne ou sur place à l'étape suivante"
          : `Un email de confirmation vous sera envoyé à ${cart[0]?.userEmail}`
        }
      </p>
    </div>
  );
}
