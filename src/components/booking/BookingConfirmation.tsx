"use client";

import { Check, Calendar, Download, Plus, ShoppingCart } from "lucide-react";
import {
  type StudioId,
  type GroupType,
  type CompletedBooking,
  STUDIOS,
  calculatePrice,
  formatPrice,
  formatDate,
  formatDuration,
  generateICS,
  downloadICS,
} from "@/lib/booking";

interface BookingConfirmationProps {
  date: Date;
  startTime: string;
  endTime: string;
  studioId: StudioId;
  groupType: GroupType;
  userName: string;
  userEmail: string;
  bookingRef: string;
  cart: CompletedBooking[];
  cartTotal: number;
  onAddAnother: () => void;
  onCheckout: () => void;
}

export function BookingConfirmation({
  date,
  startTime,
  endTime,
  studioId,
  groupType,
  userName,
  userEmail,
  bookingRef,
  cart,
  cartTotal,
  onAddAnother,
  onCheckout,
}: BookingConfirmationProps) {
  const studio = STUDIOS[studioId];
  const { total } = calculatePrice(studioId, groupType, date, startTime, endTime);
  const duration = formatDuration(startTime, endTime);

  const handleDownloadICS = () => {
    const ics = generateICS(date, startTime, endTime, studio.name, bookingRef);
    downloadICS(ics, `h3-studios-${bookingRef}.ics`);
  };

  const handleAddToGoogle = () => {
    const formatGoogleDate = (d: Date, time: string): string => {
      const [hours, minutes] = time.split(":").map(Number);
      const dt = new Date(d);
      dt.setHours(hours, minutes, 0, 0);
      return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };

    const start = formatGoogleDate(date, startTime);
    const end = formatGoogleDate(date, endTime);
    const title = encodeURIComponent(`Répétition - ${studio.name}`);
    const details = encodeURIComponent(`Réservation ${bookingRef} chez H3 Studios`);
    const location = encodeURIComponent("3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie");

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
        <Check className="h-10 w-10 text-green-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold">Réservation ajoutée !</h2>
        <p className="mt-1 text-white/60">
          Créneau ajouté au panier
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-primary/50 bg-black p-6 text-left">
        <div className="mb-4 text-center">
          <span className="text-sm text-white/60">Réservation</span>
          <div className="font-mono text-lg font-bold text-primary">{bookingRef}</div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Date</span>
            <span className="font-medium capitalize">{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Horaire</span>
            <span className="font-medium">
              {startTime} - {endTime} ({duration})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Studio</span>
            <span className="font-medium">{studio.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Nom</span>
            <span className="font-medium">{userName}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
            <span className="font-semibold">Prix du créneau</span>
            <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs font-medium text-white/70">Adresse</p>
          <p className="text-sm">3 Rue de la Grande Ceinture</p>
          <p className="text-sm">94370 Sucy-en-Brie</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={handleAddToGoogle}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          <Calendar className="h-4 w-4" />
          Google Calendar
        </button>
        <button
          onClick={handleDownloadICS}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
          Télécharger .ics
        </button>
      </div>

      {cart.length > 0 && (
        <div className="w-full max-w-md rounded-xl bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-medium">{cart.length} créneau{cart.length > 1 ? "x" : ""} dans le panier</span>
            </div>
            <span className="text-lg font-bold text-primary">{formatPrice(cartTotal)}</span>
          </div>
        </div>
      )}

      <div className="flex w-full max-w-md gap-3">
        <button
          onClick={onAddAnother}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 py-3 transition-colors hover:bg-white/5"
        >
          <Plus className="h-4 w-4" />
          Ajouter un créneau
        </button>
        <button
          onClick={onCheckout}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
        >
          <ShoppingCart className="h-4 w-4" />
          Finaliser ({formatPrice(cartTotal)})
        </button>
      </div>
    </div>
  );
}
