"use client";

import { Calendar, Download, Plus, ShoppingCart } from "lucide-react";
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
  const durationStr = formatDuration(startTime, endTime);
  
  const startIdx = TIME_SLOTS.indexOf(startTime);
  let endIdx = TIME_SLOTS.indexOf(endTime);
  if (endIdx === -1 && endTime === "00:00") endIdx = TIME_SLOTS.length;
  const durationH = (endIdx - startIdx) * 0.5;
  
  const latestBooking = cart[cart.length - 1];
  const equipment = latestBooking?.equipment || [];
  const equipmentPrice = latestBooking?.equipmentPrice || 0;
  const promoDiscount = latestBooking?.promoDiscount || 0;
  const slotTotal = latestBooking?.price || 0;
  const studioPrice = slotTotal + promoDiscount - equipmentPrice;

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



      <div className="w-full max-w-md rounded-xl border border-white/20 bg-black p-6 text-left">
        <div className="mb-4 text-center">
          <span className="text-sm text-white/60">Récapitulatif de la réservation</span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Date</span>
            <span className="font-medium capitalize">{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Horaire</span>
            <span className="font-medium">
              {startTime} - {endTime} ({durationStr})
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
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <div className="text-xs font-medium text-white/70 mb-2">OPTIONS SUPPLÉMENTAIRES</div>
                {equipment.filter(e => e.quantity > 0).map(e => {
                  const equip = EQUIPMENT[e.id];
                  if (!equip) return null;
                  const equipPrice = calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH);
                  return (
                    <div key={e.id} className="rounded-lg bg-white/5 p-3 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{equip.name}</span>
                        <span className="font-semibold text-primary">{formatPrice(equipPrice)}</span>
                      </div>
                      <div className="text-xs text-white/50">
                        {equip.pricingType === "session"
                          ? `${equip.pricePerHour}€ par séance`
                          : `${equip.pricePerHour}€/h`
                        }
                        {equip.pricingType === "session" && equip.sessionPricing && equip.sessionPricing[e.quantity - 1] !== undefined
                          ? ` • ${e.quantity} unité${e.quantity > 1 ? "s" : ""}`
                          : ` • ${e.quantity} unité${e.quantity > 1 ? "s" : ""}`
                        }
                      </div>
                    </div>
                  );
                })}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm">
                  <span className="font-medium">Total options</span>
                  <span className="font-semibold">{formatPrice(equipmentPrice)}</span>
                </div>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Réduction ({latestBooking?.promoCode})</span>
                <span className="font-medium">-{formatPrice(promoDiscount)}</span>
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
