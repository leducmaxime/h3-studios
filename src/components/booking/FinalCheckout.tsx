"use client";

import { CheckCircle2, Calendar, Download, ExternalLink, CreditCard, Banknote, UserCheck, MailCheck } from "lucide-react";
import {
  STUDIOS,
  formatDate,
  formatDuration,
  formatPrice,
  generateICS,
  downloadICS,
  generateGoogleCalendarUrl,
  sortBookingsByStart,
  type CompletedBooking,
} from "@/lib/booking";
import { useEquipment } from "./useEquipment";

interface FinalCheckoutProps {
  cart: CompletedBooking[];
  total: number;
  onNewBooking: () => void;
  /** Account outcome of the booking submission (guest checkout flow) */
  accountStatus?: string | null;
  /** Per-booking recomputed prices for line-item consistency with total */
  displayPrices?: Record<string, number>;
  /** Réduction aggregée du panier confirmée par le serveur (une seule ligne). */
  promoCode?: string | null;
  promoDiscount?: number;
}

const LINE_DISPLAY_PRICES_DEFAULT: Record<string, number> = {};

export function FinalCheckout({ cart, total, onNewBooking, accountStatus, displayPrices = LINE_DISPLAY_PRICES_DEFAULT, promoCode = null, promoDiscount = 0 }: FinalCheckoutProps) {
  const { getEquipmentName } = useEquipment();
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
    const url = generateGoogleCalendarUrl(
      booking.date,
      booking.startTime,
      booking.endTime,
      STUDIOS[booking.studioId].name,
      booking.bookingRef
    );
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="mb-4 inline-flex rounded-full bg-green-500/20 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h3 className="mb-2 text-2xl font-bold">
          {cart.length === 1 ? "Réservation confirmée !" : "Réservations confirmées !"}
        </h3>
        <p className="text-white/60">
          {cart.length} réservation{cart.length > 1 ? "s" : ""}
          {isPaid ? " • Payé en ligne" : " • Paiement sur place"}
        </p>
      </div>

      {accountStatus === "created" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-white/85">
            Votre compte a été créé — vous êtes connecté. Retrouvez vos réservations dans <a href="/mon-compte" className="font-medium text-primary underline underline-offset-2">votre espace</a>.
          </p>
        </div>
      )}
      {accountStatus === "activation-email-sent" && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
            <MailCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-white/85">
            Vérifiez votre boîte mail : un email vous permet de définir votre mot de passe pour activer votre compte.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sortBookingsByStart(cart).map((booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-white/10 bg-white/15 p-4"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="font-semibold">
                  {STUDIOS[booking.studioId].name}
                </h4>
                <p className="text-sm text-primary">Réf: {booking.bookingRef}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold text-primary">{formatPrice(displayPrices[booking.id] ?? booking.price)}</span>
                {booking.paymentStatus === "paid" ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                    <CreditCard className="h-3 w-3" />
                    Payé
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">
                    <Banknote className="h-3 w-3" />
                    À régler sur place
                  </span>
                )}
              </div>
            </div>
            
            {booking.equipmentPrice > 0 && (
              <div className="mb-3 text-xs text-white/60">
                Options suppl. : {booking.equipment.filter(e => e.quantity > 0).map(e => 
                  `${getEquipmentName(e.id)} ×${e.quantity}`
                ).join(", ")} ({formatPrice(booking.equipmentPrice)})
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
                className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
              >
                <Download className="h-3 w-3" />
                .ics
              </button>
              <button
                onClick={() => handleAddToGoogleCalendar(booking)}
                className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
              >
                <ExternalLink className="h-3 w-3" />
                Google
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-primary/10 p-4">
        <div className="space-y-1">
          {promoDiscount > 0 && (
            <div className="flex items-center justify-between text-sm text-green-400">
              <span>Réduction{promoCode ? ` (${promoCode})` : ""}</span>
              <span>-{formatPrice(promoDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-lg">
              {isPaid ? "Total payé" : <>Total à régler sur place <span className="whitespace-nowrap">(CB ou espèces)</span></>}
            </span>
            <span className="shrink-0 text-2xl font-bold text-primary">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      {cart.length > 1 && (
        <button
          onClick={handleDownloadAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 transition-colors hover:bg-white/15"
        >
          <Download className="h-5 w-5" />
          Télécharger tous les .ics
        </button>
      )}

      <button
        onClick={onNewBooking}
        className="w-full rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
      >
        Nouvelle réservation
      </button>
    </div>
  );
}
