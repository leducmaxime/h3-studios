"use client";

import { Plus, Minus, Gift } from "lucide-react";
import {
  EQUIPMENT,
  type EquipmentSelection,
  type EquipmentId,
  formatPrice,
} from "@/lib/booking";

interface EquipmentSelectorProps {
  equipment: EquipmentSelection[];
  onChange: (equipment: EquipmentSelection[]) => void;
  durationHours: number;
}

const EQUIPMENT_LIST = Object.values(EQUIPMENT);

function getQuantity(equipment: EquipmentSelection[], id: EquipmentId): number {
  const item = equipment.find((e) => e.id === id);
  return item?.quantity ?? 0;
}

function updateQuantity(
  equipment: EquipmentSelection[],
  id: EquipmentId,
  quantity: number
): EquipmentSelection[] {
  const existing = equipment.filter((e) => e.id !== id);
  if (quantity > 0) {
    return [...existing, { id, quantity }];
  }
  return existing;
}

export function EquipmentSelector({
  equipment,
  onChange,
  durationHours,
}: EquipmentSelectorProps) {
  const handleIncrement = (id: EquipmentId, max: number) => {
    const current = getQuantity(equipment, id);
    if (current < max) {
      onChange(updateQuantity(equipment, id, current + 1));
    }
  };

  const handleDecrement = (id: EquipmentId) => {
    const current = getQuantity(equipment, id);
    if (current > 0) {
      onChange(updateQuantity(equipment, id, current - 1));
    }
  };

  const totalCost = equipment.reduce((sum, item) => {
    const eq = EQUIPMENT[item.id];
    if (eq.pricingType === "session" && eq.sessionPricing) {
      const price = eq.sessionPricing[item.quantity - 1] || 0;
      return sum + price;
    } else {
      return sum + eq.pricePerHour * item.quantity * durationHours;
    }
  }, 0);

  return (
    <div className="rounded-xl border border-white/20 bg-white/5 p-4">
      <span className="mb-3 block text-sm font-medium text-white/70">
        Options supplémentaires
      </span>

      <p className="mb-4 text-xs font-medium text-primary">
        Compris dans votre réservation : Batterie (sans crash), sono, amplis guitare, amplis basse, 4 micros, pupitres, pied synthé
      </p>

      <div className="flex flex-col gap-3">
        {EQUIPMENT_LIST.map((eq) => {
          const quantity = getQuantity(equipment, eq.id);
          let subtotal = 0;
          let priceDisplay = "";

          if (eq.pricingType === "session" && eq.sessionPricing) {
            subtotal = quantity > 0 ? eq.sessionPricing[quantity - 1] : 0;
            // Affichage spécial pour les micros
            if (eq.id === "mic") {
              if (quantity === 0) {
                priceDisplay = "à partir de 3€ par séance (tarif dégressif)";
              } else if (quantity === 4) {
                priceDisplay = `${subtotal}€/séance (4ème offert !)`;
              } else {
                priceDisplay = `${subtotal}€/séance (tarif dégressif)`;
              }
            } else {
              priceDisplay = `${subtotal}€/séance`;
            }
          } else {
            subtotal = eq.pricePerHour * quantity * durationHours;
            priceDisplay = `+${eq.pricePerHour}€/h`;
          }

          const isFourthMicFree = eq.id === "mic" && quantity === 4;

          return (
            <div
              key={eq.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">
                  {eq.name}
                </span>
                <span className="text-xs text-white/50">
                  {priceDisplay}
                </span>
                {isFourthMicFree && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Gift className="h-3 w-3" />
                    Cadeau ! Le 4ème micro est offert
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {quantity > 0 && subtotal > 0 && (
                  <span className="text-xs text-primary">
                    {formatPrice(subtotal)}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDecrement(eq.id)}
                    disabled={quantity === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                    aria-label={`Retirer ${eq.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>

                  <span className="w-6 text-center text-sm font-medium tabular-nums">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleIncrement(eq.id, eq.maxPerSession)}
                    disabled={quantity >= eq.maxPerSession}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                    aria-label={`Ajouter ${eq.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalCost > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-sm text-white/70">Total équipement</span>
          <span className="font-semibold text-primary">
            {formatPrice(totalCost)}
          </span>
        </div>
      )}
    </div>
  );
}
