"use client";

import { Plus, Minus, Gift, Info } from "lucide-react";
import {
  type EquipmentSelection,
  type EquipmentId,
  formatPrice,
} from "@/lib/booking";
import { formatSessionPriceDisplay, isQuantityOffered, ordinalFr } from "@/lib/equipment-pricing";

interface ApiEquipment {
  id: string;
  name: string;
  maxPerSession: number;
  pricingType: "hourly" | "session";
  sessionPricing: number[] | null;
  pricePerHour: number;
}

export interface EquipmentAvailability {
  available: number;
  reserved: number;
  reservedOnOtherStudio: number;
  stockTotal: number;
}

interface EquipmentSelectorProps {
  equipment: EquipmentSelection[];
  onChange: (equipment: EquipmentSelection[]) => void;
  durationHours: number;
  availableEquipment: ApiEquipment[];
  /** True while /api/equipment loads — renders skeleton rows. */
  loading?: boolean;
  /**
   * Live stock per equipment id for the selected slot (equipment is shared
   * across both studios). Caps the + stepper at `min(maxPerSession, available)`.
   * Missing ids fall back to maxPerSession only.
   */
  availability?: Record<string, EquipmentAvailability>;
  /**
   * One-line notice shown when the parent reduced quantities after a
   * date/time change. Rendered non-blockingly above the list; the parent
   * clears it.
   */
  clampMessage?: string | null;
  /**
   * True while availability refetches (catalogue already loaded). Keeps the
   * rows in place and dims the reason lines — never swaps in the skeleton.
   */
  availabilityLoading?: boolean;
}

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

function pluralizeUnit(count: string, forms: [string, string]): string {
  return count === "1" ? forms[0] : forms[1];
}

/**
 * Short factual reason shown when stock pressure caps the stepper below
 * maxPerSession. Never names other customers.
 */
function getAvailabilityReason(info: EquipmentAvailability): string {
  if (info.available <= 0) {
    return info.reservedOnOtherStudio > 0
      ? "Plus d'unité disponible sur ce créneau (réservé sur l'autre studio)"
      : "Plus d'unité disponible sur ce créneau";
  }
  if (info.reservedOnOtherStudio > 0) {
    const n = String(info.reservedOnOtherStudio);
    return `${n} ${pluralizeUnit(n, ["unité déjà réservée", "unités déjà réservées"])} sur l'autre studio sur ce créneau`;
  }
  const n = String(info.reserved);
  return `${n} ${pluralizeUnit(n, ["unité déjà réservée", "unités déjà réservées"])} sur ce créneau`;
}

export function EquipmentSelector({
  equipment,
  onChange,
  durationHours,
  availableEquipment,
  loading = false,
  availability,
  clampMessage = null,
  availabilityLoading = false,
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

  const calculateSubtotal = (eq: ApiEquipment, quantity: number): number => {
    if (quantity === 0) return 0;
    if (eq.pricingType === "session" && eq.sessionPricing) {
      return eq.sessionPricing[quantity - 1] || 0;
    } else {
      return eq.pricePerHour * quantity * durationHours;
    }
  };

  const totalCost = equipment.reduce((sum, item) => {
    const eq = availableEquipment.find((e) => e.id === item.id);
    if (!eq) return sum;
    return sum + calculateSubtotal(eq, item.quantity);
  }, 0);

  return (
    <div className="rounded-xl border border-white/20 bg-white/15 p-4">
      {loading ? (
        // Skeleton rows mirror the real row geometry (name + price lines
        // left, stepper right) and the same 1-col / lg:2-col grid, so the
        // card doesn't jump when the list lands.
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-6"
          aria-busy="true"
          aria-label="Chargement des options"
        >
          {[40, 32, 36, 28, 34, 30].map((nameWidth, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <span
                  className="h-3.5 animate-pulse rounded bg-white/10"
                  style={{ width: `${nameWidth * 4}px` }}
                />
                <span className="h-3 w-24 animate-pulse rounded bg-white/10" />
              </div>
              <div className="flex items-center gap-1">
                <span className="h-7 w-7 animate-pulse rounded-md bg-white/10" />
                <span className="w-6" />
                <span className="h-7 w-7 animate-pulse rounded-md bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <>
      {clampMessage && (
        <p
          role="status"
          className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
        >
          <Info className="h-3.5 w-3.5 shrink-0" />
          {clampMessage}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-6">
        {availableEquipment.map((eq) => {
          const quantity = getQuantity(equipment, eq.id);
          const subtotal = calculateSubtotal(eq, quantity);
          const availabilityInfo = availability?.[eq.id];
          const ceiling = Math.min(
            eq.maxPerSession,
            availabilityInfo?.available ?? eq.maxPerSession
          );
          // Stock pressure only surfaces when it actually caps the stepper
          // below the catalogue max — full availability renders as before.
          const reason =
            availabilityInfo && availabilityInfo.available < eq.maxPerSession
              ? getAvailabilityReason(availabilityInfo)
              : null;
          const priceDisplay = formatSessionPriceDisplay(eq, quantity, subtotal);

          const isSelectedUnitOffered = eq.pricingType === "session" && isQuantityOffered(eq.sessionPricing, quantity) && quantity > 0;

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
                {isSelectedUnitOffered && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Gift className="h-3 w-3" />
                    Cadeau ! La {ordinalFr(quantity, { feminine: true })} unité est offerte
                  </span>
                )}
                {reason && (
                  <span
                    className={`text-xs text-amber-300/80 transition-opacity ${
                      availabilityLoading ? "opacity-40" : ""
                    }`}
                  >
                    {reason}
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
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/15"
                    aria-label={`Retirer ${eq.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>

                  <span className="w-6 text-center text-sm font-medium tabular-nums">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleIncrement(eq.id, ceiling)}
                    disabled={quantity >= ceiling}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/15"
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
      </>
      )}

      {!loading && totalCost > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-sm text-white/70">Total options supplémentaires</span>
          <span className="font-semibold text-primary">
            {formatPrice(totalCost)}
          </span>
        </div>
      )}
    </div>
  );
}
