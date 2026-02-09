"use client";

import { Check, Calendar, Download, Plus, ShoppingCart, Apple } from "lucide-react";
import {
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type EquipmentSelection,
  STUDIOS,
  EQUIPMENT,
  calculatePrice,
  calculateEquipmentPrice,
  formatPrice,
  formatDate,
  formatDuration,
  TIME_SLOTS,
  generateICS,
  downloadICS,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
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
  const duration = formatDuration(startTime, endTime);
  
  const latestBooking = cart[cart.length - 1];
  const equipment = latestBooking?.equipment || [];
  const equipmentPrice = latestBooking?.equipmentPrice || 0;
  const slotTotal = latestBooking?.price || 0;
  const studioPrice = slotTotal - equipmentPrice;

  const handleDownloadICS = () => {
    const ics = generateICS(date, startTime, endTime, studio.name, bookingRef);
    downloadICS(ics, `h3-studios-${bookingRef}.ics`);
  };

  const handleAddToGoogle = () => {
    const url = generateGoogleCalendarUrl(date, startTime, endTime, studio.name, bookingRef);
    window.open(url, "_blank");
  };

  const handleAddToOutlook = () => {
    const url = generateOutlookCalendarUrl(date, startTime, endTime, studio.name, bookingRef);
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
        <ShoppingCart className="h-10 w-10 text-primary" />
      </div>

      <div>
        <h2 className="text-2xl font-bold">Créneau ajouté au panier</h2>
        <p className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-amber-400 text-sm">
          ⚠️ Finalisez votre réservation pour la confirmer
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-white/20 bg-black p-6 text-left">
        <div className="mb-4 text-center">
          <span className="text-sm text-white/60">Récapitulatif du créneau</span>
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
            <span className="font-medium">
              {groupType === "group" ? studio.name : "Selon disponibilité"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Nom</span>
            <span className="font-medium">{userName}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">{groupType === "group" ? "Studio" : "Répétition"}</span>
              <span className="font-medium">{formatPrice(studioPrice)}</span>
            </div>
            {equipment.length > 0 && equipmentPrice > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Options suppl.</span>
                  <span className="font-medium">{formatPrice(equipmentPrice)}</span>
                </div>
                <div className="space-y-0.5 pl-2 text-xs text-white/50">
                  {equipment.filter(e => e.quantity > 0).map(e => (
                    <div key={e.id} className="flex justify-between">
                      <span>{EQUIPMENT[e.id]?.name || e.id} ×{e.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="font-semibold">Prix du créneau</span>
              <span className="text-xl font-bold text-primary">{formatPrice(slotTotal)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs font-medium text-white/70">Adresse</p>
          <p className="text-sm">3 Rue de la Grande Ceinture</p>
          <p className="text-sm">94370 Sucy-en-Brie</p>
        </div>
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

      <div className="flex w-full max-w-md flex-col gap-3">
        <button
          onClick={onCheckout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
        >
          Finaliser la réservation → {formatPrice(cartTotal)}
        </button>
        <button
          onClick={onAddAnother}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-sm transition-colors hover:bg-white/5"
        >
          <Plus className="h-4 w-4" />
          Ajouter un autre créneau
        </button>
      </div>
    </div>
  );
}
