"use client";

import { ChevronLeft, PackageCheck, Package, Check, ShoppingCart, X } from "lucide-react";
import { EquipmentSelector, type EquipmentAvailability } from "@/components/booking/EquipmentSelector";
import { StickyBookingCTA } from "@/components/booking/StickyBookingCTA";
import { TaxBreakdown } from "@/components/common/TaxBreakdown";
import { calculateEquipmentPrice, formatDate, formatDuration, formatPrice, TIME_SLOTS, STUDIOS, type CompletedBooking, type EquipmentSelection, type GroupType, type StudioId } from "@/lib/booking";
import { calculatePrice } from "@/lib/pricing";
import type { PricingData } from "@/lib/pricing";

interface Props {
  state: { selectedDate: Date | null; startTime: string | null; endTime: string | null; studioId: StudioId | null; groupType: GroupType | null; equipment: EquipmentSelection[]; cart: CompletedBooking[]; duplicateError: string | null };
  pricingData: PricingData | null | undefined;
  pricingError: string | null;
  refetchPricing: () => void;
  availableEquipment: Array<{ id: string; name: string; maxPerSession: number; pricingType: "hourly" | "session"; sessionPricing: number[] | null; pricePerHour: number }>;
  equipmentLoading: boolean;
  equipmentAvailability: Record<string, EquipmentAvailability> | undefined;
  equipmentClampMessage: string | null;
  cartTotal: number;
  updateEquipment: (equipment: EquipmentSelection[]) => void;
  getEquipmentName: (id: string) => string;
  onConfirm: () => void;
  onBack: () => void;
}

const RECAP_GROUP_LABELS: Record<GroupType, string> = { solo: "Solo / Prof particulier", duo: "Duo", group: "Groupe (3+)" };

export function BookingOptionsStep({ state, pricingData, pricingError, refetchPricing, availableEquipment, equipmentLoading, equipmentAvailability, equipmentClampMessage, cartTotal, updateEquipment, getEquipmentName, onConfirm, onBack }: Props) {
    if (!state.selectedDate || !state.startTime || !state.endTime || !state.studioId) return null;

    const grid = pricingData?.grid;
    const studio = STUDIOS[state.studioId as StudioId];
    const gt = (state.groupType || "group") as GroupType;
    const priceResult = grid
      ? calculatePrice(grid, state.studioId as StudioId, gt, state.selectedDate, state.startTime, state.endTime)
      : { total: 0, breakdown: [] };
    const total = priceResult.total;
    const duration = formatDuration(state.startTime, state.endTime);
    const startIdx = TIME_SLOTS.indexOf(state.startTime);
    let endIdx = TIME_SLOTS.indexOf(state.endTime);
    if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
    const durationH = (endIdx - startIdx) * 0.5;
    const equipmentPrice = calculateEquipmentPrice(state.equipment, durationH, availableEquipment);
    const grandTotal = total + equipmentPrice;

    // Price breakdown: off-peak vs peak hours
    const offPeakSlots = priceResult.breakdown.filter((s) => !s.isPeak);
    const peakSlots = priceResult.breakdown.filter((s) => s.isPeak);
    const offPeakHours = offPeakSlots.length * 0.5;
    const peakHours = peakSlots.length * 0.5;
    const offPeakRate = offPeakSlots.length > 0 ? offPeakSlots[0].rate : 0;
    const peakRate = peakSlots.length > 0 ? peakSlots[0].rate : 0;
    const anyRate = priceResult.breakdown.length > 0 ? priceResult.breakdown[0].rate : 0;
    const offPeakSubtotal = offPeakHours * offPeakRate;
    const peakSubtotal = peakHours * peakRate;
    // Two-band view when both off-peak and peak slots exist with differing rates.
    const hasPeakPricing = offPeakSlots.length > 0 && peakSlots.length > 0 && offPeakRate !== peakRate;
    // Whether this studio/group-type distinguishes peak vs off-peak AT ALL
    // (grid-driven) — when it does but the booking spans a single band, the
    // flat line still names the band. When rates are equal, naming the band
    // would be meaningless.
    const bandRates = grid?.[state.studioId as StudioId]?.[gt];
    const hasBandDistinction = bandRates ? bandRates.peak !== bandRates.offPeak : false;
    // French-style compact durations: 2 → "2h", 1.5 → "1h30", 0.5 → "30min".
    const formatBandDuration = (hours: number): string => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      if (m === 0) return `${h}h`;
      if (h === 0) return `${m}min`;
      return `${h}h${String(m).padStart(2, "0")}`;
    };

    const handleConfirmRecap = () => {
      onConfirm();
    };

    return (
      <div className="flex flex-col gap-6">
        {/* Step header */}
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 shrink-0 rounded-full p-2 transition-colors hover:bg-white/15"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold">Personnalisez votre session</h2>
            <p className="mt-1 text-sm text-white/50">
              Ajoutez du matériel si besoin, puis vérifiez le total avant d'ajouter au panier.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start lg:gap-8">
          {/* Left column: passive reassurance, then the actionable add-ons */}
          <div className="flex min-w-0 flex-col gap-6">
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <PackageCheck className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-white/80">Inclus dans votre réservation</h3>
                <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Sans surcoût
                </span>
              </div>
              {/* Chip cloud instead of one row per item: same passive
                  reassurance in ~3 lines instead of 7 on mobile. Chips are
                  non-interactive (no hover, no button) so they don't read as
                  actionable next to the equipment steppers below. */}
              <div className="flex flex-wrap gap-2">
                {["Batterie (sans crash)", "Sono", "Amplis guitare", "Amplis basse", "4 micros", "Pupitres", "Pied synthé"].map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70"
                  >
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-semibold">Options supplémentaires</h3>
                <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Optionnel
                </span>
              </div>
              <EquipmentSelector
                equipment={state.equipment}
                onChange={updateEquipment}
                durationHours={durationH}
                availableEquipment={availableEquipment}
                loading={equipmentLoading}
                availability={equipmentAvailability}
                clampMessage={equipmentClampMessage}
              />
            </section>
          </div>

          {/* Right column: the decision surface — sticky on desktop so the
              total and add-to-cart CTA stay in view while the options list grows */}
          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8">
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white/80">Récapitulatif</h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Formule</span>
                  <span className="font-medium">{RECAP_GROUP_LABELS[gt]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Studio</span>
                  <span className="font-medium">{studio.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Date</span>
                  <span className="font-medium capitalize">{formatDate(state.selectedDate!, "short")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Horaire</span>
                  <span className="font-medium">{state.startTime} - {state.endTime} ({duration})</span>
                </div>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3 space-y-1.5 text-sm">
                {pricingError ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5">
                    <span className="text-sm text-red-300">Impossible de charger les tarifs.</span>
                    <button
                      type="button"
                      onClick={refetchPricing}
                      className="shrink-0 rounded-md border border-red-400/40 px-2.5 py-1 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : !grid ? (
                  <div className="space-y-2" aria-busy="true" aria-label="Chargement des tarifs">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                      <div className="h-5 w-16 animate-pulse rounded bg-white/10" />
                      <div className="h-6 w-20 animate-pulse rounded bg-white/10" />
                    </div>
                  </div>
                ) : (
                  <>
                    {hasPeakPricing ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Heure creuse — {formatBandDuration(offPeakHours)} × {offPeakRate}€ TTC/h</span>
                          <span>{formatPrice(offPeakSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Heure pleine — {formatBandDuration(peakHours)} × {peakRate}€ TTC/h</span>
                          <span>{formatPrice(peakSubtotal)}</span>
                        </div>
                      </>
                    ) : hasBandDistinction ? (
                      <div className="flex items-center justify-between">
                        {peakSlots.length > 0 ? (
                          <>
                            <span className="text-white/60">Heure pleine — {formatBandDuration(durationH)} × {anyRate}€ TTC/h</span>
                            <span>{formatPrice(total)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-white/60">Heure creuse — {formatBandDuration(durationH)} × {anyRate}€ TTC/h</span>
                            <span>{formatPrice(total)}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">{formatBandDuration(durationH)} × {anyRate}€ TTC/h</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    )}

                    {state.equipment.filter(e => e.quantity > 0).map(e => (
                      <div key={e.id} className="flex items-center justify-between">
                        <span className="text-white/60">
                          {getEquipmentName(e.id)} ×{e.quantity}
                        </span>
                        <span>{formatPrice(calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH, availableEquipment))}</span>
                      </div>
                    ))}

                    <div className="mt-1 space-y-1.5 border-t border-white/10 pt-2">
                      <TaxBreakdown ttc={grandTotal} />
                    </div>
                    <div className="flex items-baseline justify-between rounded-lg border border-primary/25 bg-primary/10 px-3 py-3">
                      <span className="font-semibold">Total TTC</span>
                      <span className="text-2xl font-bold tabular-nums text-primary">{formatPrice(grandTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {state.cart.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <ShoppingCart className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-white/70">
                  {state.cart.length} réservation{state.cart.length > 1 ? "s" : ""} déjà dans le panier ·{" "}
                  <span className="font-semibold text-white">{formatPrice(cartTotal)}</span>
                </span>
              </div>
            )}

            {state.duplicateError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3">
                <X className="h-5 w-5 shrink-0 text-red-400" />
                <span className="text-sm font-medium text-red-300">{state.duplicateError}</span>
              </div>
            )}

            <button
              onClick={handleConfirmRecap}
              disabled={!grid}
              className="hidden w-full rounded-xl bg-primary py-4 text-lg font-semibold text-black shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none lg:block"
            >
              {grid ? `Ajouter au panier – ${formatPrice(grandTotal)}` : pricingError ? "Tarifs indisponibles" : "Chargement des tarifs…"}
            </button>
          </div>
        </div>

        <StickyBookingCTA
          studioPrice={total}
          equipmentPrice={equipmentPrice}
          onConfirm={handleConfirmRecap}
          disabled={!grid}
          buttonText="Ajouter au panier"
          priceLoading={!grid && !pricingError}
        />
      </div>
    );
}
