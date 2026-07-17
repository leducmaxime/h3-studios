"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { ScrollUp } from "@/components/common/ScrollUp";
import { useBookingWithRouter } from "@/components/booking/useBookingWithRouter";
import { WeekCalendar } from "@/components/booking/WeekCalendar";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";
import { GroupTypeToggle } from "@/components/booking/GroupTypeToggle";
import { BookingForm } from "@/components/booking/BookingForm";
import { FinalCheckout } from "@/components/booking/FinalCheckout";

import { ProgressIndicator } from "@/components/booking/ProgressIndicator";
import { PaymentChoice } from "@/components/booking/PaymentChoice";
import { StripeRedirect } from "@/components/booking/StripeRedirect";
import { ChevronLeft, Plus, RotateCcw, ShoppingCart, X, Wifi, TrainFront, MapPin, Check, PackageCheck, WrenchIcon } from "lucide-react";
import { EquipmentSelector } from "@/components/booking/EquipmentSelector";
import { PromoCodeInput } from "@/components/booking/PromoCodeInput";
import { StickyBookingCTA } from "@/components/booking/StickyBookingCTA";
import { formatDate, formatDuration, formatPrice, calculateEquipmentPrice, setPublicHolidays, setPeakStartHour, STUDIOS, TIME_SLOTS, slotDurationHours, stepIndex, type BookingStep, type StudioId, type GroupType, type CompletedBooking } from "@/lib/booking";
import { calculatePrice } from "@/lib/pricing";
import { useEquipment } from "@/components/booking/useEquipment";

const GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo/Prof particulier",
  duo: "Duo",
  group: "Groupe",
};

const RECAP_GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo / Prof particulier",
  duo: "Duo",
  group: "Groupe (3+)",
};

function formatShortDate(date: Date): string {
  const dayNum = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = (date.getFullYear() % 100).toString().padStart(2, "0");
  return `${dayNum}/${month}/${year}`;
}

interface ReservationProps {
  step?: string;
}

export function Reservation({ step }: ReservationProps) {
  const {
    state,
    slotsByStudio,
    pricingData,
    pricingLoading,
    pricingError,
    refetchPricing,
    cartTotal,
    canProceedToStudio,
    canConfirmBooking,
    clientUser,
    clientUserLoading,
    clientLogin,
    selectDate,
    selectTimeRange,
    clearTimeRange,
    confirmTimeSelection,
    setGroupType,
    updateUserInfo,
    updateEquipment,
    applyPromo,
    removePromo,
    confirmBooking,
    clearDuplicateError,
    addAnotherBooking,
    goToCoordonnees,
    goToPaymentFromCoordonnees,
    goToCart,
    removeFromCart,
    resetBooking,
    goBack,
    navigateToStep,
    canNavigateToStep,
    selectPaymentMethod,
    processPayment,
    minAdvanceHours,
    minAdvanceCutoffTime,
    todayFullyBlocked,
    maxAdvanceDays,
  } = useBookingWithRouter(step);

  const { equipment: availableEquipment, getEquipmentName } = useEquipment();

  const [isVisible, setIsVisible] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    fetch("/api/status")
      .then(r => r.json() as Promise<{ success: boolean; data: { maintenanceMode: boolean } }>)
      .then(json => { if (json.success) setMaintenanceMode(json.data.maintenanceMode); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/public-holidays")
      .then((r) => r.json() as Promise<{ success: boolean; data: string[] }>)
      .then((json) => { if (json.success) setPublicHolidays(json.data); })
      .catch(() => {});
    fetch("/api/peak-hours")
      .then((r) => r.json() as Promise<{ success: boolean; data: { peakStartHour: number } }>)
      .then((json) => { if (json.success) setPeakStartHour(json.data.peakStartHour); })
      .catch(() => {});
  }, []);

  // Scroll to top on every step change (scroll container is #root, not document)
  useEffect(() => {
    document.getElementById("root")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step]);

  // Refs for auto-scroll within unified booking step
  const timeSlotRef = useRef<HTMLDivElement>(null);
  const recapRef = useRef<HTMLDivElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Auto-scroll when date is selected (time slots appear)
  useEffect(() => {
    if (state.step === "creneau" && state.selectedDate && !state.startTime) {
      scrollToRef(timeSlotRef);
    }
  }, [state.step, state.selectedDate, state.startTime]);

  // Auto-scroll when studio is selected (recap appears)
  useEffect(() => {
    if (state.step === "creneau" && state.studioId && state.startTime && state.endTime) {
      scrollToRef(recapRef);
    }
  }, [state.step, state.studioId, state.startTime, state.endTime]);

  useEffect(() => {
    if (state.duplicateError) {
      clearDuplicateError();
    }
  }, [state.selectedDate, state.startTime, state.endTime, state.studioId]);

  const durationHours = state.startTime && state.endTime
    ? ((() => {
        let endIdx = TIME_SLOTS.indexOf(state.endTime);
        if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
        return (endIdx - TIME_SLOTS.indexOf(state.startTime)) * 0.5;
      })())
    : 0;

  /**
   * Recompute a cart item's time-based price from the pricing grid.
   * Falls back to the stored price when grid is not loaded.
   */
  const recomputeCartItemPrice = useCallback((booking: CompletedBooking): number => {
    const grid = pricingData?.grid;
    if (!grid) return booking.price;
    const timePrice = calculatePrice(
      grid,
      booking.studioId,
      booking.groupType,
      booking.date,
      booking.startTime,
      booking.endTime
    ).total;
    return timePrice + (booking.equipmentPrice || 0);
  }, [pricingData]);

  // Show cart banner when adding a new booking and cart has items (only on booking steps groupe/creneau)
  const showCartBanner = state.isAddingNew && state.cart.length > 0 && (state.step === "groupe" || state.step === "creneau");

  // Inline recap + options block, shown after studio is selected (within the same step)
  const renderRecapSection = () => {
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
    const hasPeakPricing = gt === "group";

    const handleConfirmRecap = () => {
      confirmBooking();
    };

    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-0">
        <div className="rounded-xl border border-primary/40 bg-primary/8 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <PackageCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">Inclus dans votre réservation</span>
            <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">Sans surcoût</span>
          </div>
          <div className="flex flex-wrap gap-1.5 md:flex-nowrap md:overflow-x-auto md:scrollbar-none">
            {["Batterie (sans crash)", "Sono", "Amplis guitare", "Amplis basse", "4 micros", "Pupitres", "Pied synthé"].map((item) => (
              <span key={item} className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/75">
                <Check className="h-3 w-3 shrink-0 text-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 border-t border-white/10 pt-5">
          <h4 className="mb-3 text-sm font-semibold text-white/80">Options supplémentaires</h4>
          <EquipmentSelector
            equipment={state.equipment}
            onChange={updateEquipment}
            durationHours={durationH}
            availableEquipment={availableEquipment}
          />
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
          <h4 className="mb-3 text-sm font-semibold text-white/80">Récapitulatif</h4>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">{gt === "group" ? "Studio" : "Formule"}</span>
              <span className="font-medium">{gt === "group" ? studio.name : RECAP_GROUP_LABELS[gt]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Date</span>
              <span className="font-medium capitalize">{formatDate(state.selectedDate!, "short")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Horaire</span>
              <span className="font-medium">{state.startTime} - {state.endTime} ({duration})</span>
            </div>
            {gt === "group" && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Formule</span>
                <span className="font-medium">{RECAP_GROUP_LABELS[gt]}</span>
              </div>
            )}
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
                    {offPeakHours > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">{offPeakHours}h x {offPeakRate}€/h</span>
                        <span>{formatPrice(offPeakSubtotal)}</span>
                      </div>
                    )}
                    {peakHours > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-primary/70">{peakHours}h x {peakRate}€/h <span className="text-xs">(soir/WE)</span></span>
                        <span className="text-primary">{formatPrice(peakSubtotal)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">{durationH}h x {anyRate}€/h</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                )}

                {state.equipment.filter(e => e.quantity > 0).map(e => (
                  <div key={e.id} className="flex items-center justify-between">
                    <span className="text-white/60">
                      {getEquipmentName(e.id)} x{e.quantity}
                    </span>
                    <span>{formatPrice(calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH, availableEquipment))}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(grandTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {state.cart.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/15 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="font-medium text-white/80">
                {state.cart.length} réservation{state.cart.length > 1 ? "s" : ""} déjà dans le panier ({formatPrice(cartTotal)})
              </span>
            </div>
          </div>
        )}

        {state.duplicateError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3">
            <X className="h-5 w-5 text-red-400" />
            <span className="text-sm font-medium text-red-300">{state.duplicateError}</span>
          </div>
        )}

        <button
          onClick={handleConfirmRecap}
          disabled={!grid}
          className="hidden w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 md:block"
        >
          {grid ? `Ajouter au panier - ${formatPrice(grandTotal)}` : pricingError ? "Tarifs indisponibles" : "Chargement des tarifs…"}
        </button>

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
  };

  if (maintenanceMode) {
    return (
      <div className="flex min-h-fit grow flex-col items-center justify-center gap-6 pb-16 pt-32 text-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <WrenchIcon className="h-10 w-10" />
        </div>
        <h1 className="font-blanka text-3xl md:text-4xl">MAINTENANCE</h1>
        <p className="max-w-md text-zinc-400 leading-relaxed">
          Les réservations en ligne sont temporairement indisponibles. Pour toute réservation, veuillez nous contacter au{" "}
          <a href="tel:0613440875" className="font-semibold text-primary hover:underline">06 13 44 08 75</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-16 pt-32">
      <ScrollUp />
      <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">
          RESERVATION
        </h1>
        <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
      
      <div className={`w-full max-w-none sm:max-w-[900px] -mx-4 sm:mx-0 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
        {/* Cart banner — shown when adding a new booking with items already in cart */}
        {showCartBanner && (
          <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">
                  {state.cart.length} réservation{state.cart.length > 1 ? "s" : ""} dans le panier
                </span>
                <span className="ml-2 text-lg font-bold text-primary">{formatPrice(cartTotal)}</span>
              </div>
            </div>
            <button
              onClick={goToCart}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
            >
              Aller au panier
            </button>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/90 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

          <div className="relative p-4 sm:p-6 md:p-8">
            <div className="mb-4">
                <ProgressIndicator
                  currentStep={state.step}
                  onStepClick={navigateToStep}
                  canNavigateToStep={canNavigateToStep}
                />
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  {state.step === "creneau" && state.groupType && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {GROUP_LABELS[state.groupType as GroupType]}
                    </span>
                  )}
                  {/* Studio pill: show on booking step only */}
                  {state.studioId && state.step === "creneau" && state.groupType === "group" && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {STUDIOS[state.studioId as StudioId].name}
                    </span>
                  )}
                  {/* Date + time pills */}
                  {state.selectedDate && state.step === "creneau" && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {formatShortDate(state.selectedDate)}
                    </span>
                  )}
                  {state.startTime && state.endTime && state.step === "creneau" && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {state.startTime} - {state.endTime}
                    </span>
                  )}
                </div>
              </div>

            {/* Step groupe: Group type */}
            {state.step === "groupe" && (
              <div className="flex flex-col gap-6">
                <GroupTypeToggle
                  value={state.groupType}
                  onChange={setGroupType}
                  minMaxByGroupType={pricingData?.minMaxByGroupType}
                />
              </div>
            )}

            {/* Step creneau: Unified booking step — Date + Créneaux + Studio */}
            {state.step === "creneau" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={goBack}
                    className="rounded-full p-2 transition-colors hover:bg-white/15"
                    aria-label="Retour"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="text-white/70">
                    {!state.selectedDate
                      ? "Choisissez une date"
                      : !state.startTime
                        ? "Choisissez votre créneau horaire"
                        : "Récapitulatif de votre réservation"}
                  </p>
                </div>

                {/* Date picker */}
                <WeekCalendar
                  selectedDate={state.selectedDate}
                  onSelectDate={selectDate}
                  studioFilter={null}
                  groupType={state.groupType}
                  cart={state.cart}
                  maxAdvanceDays={maxAdvanceDays}
                />

                {/* Time slot picker — appears after date selection */}
                {state.selectedDate && (
                  <div ref={timeSlotRef}>
                    <TimeSlotPicker
                      date={state.selectedDate}
                      slotsByStudio={slotsByStudio}
                      startTime={state.startTime}
                      endTime={state.endTime}
                      studioId={state.studioId}
                      onSelectRange={selectTimeRange}
                      onClear={clearTimeRange}
                      onConfirm={confirmTimeSelection}
                      onBack={goBack}
                      canConfirm={canProceedToStudio}
                      hideHeader
                      groupType={state.groupType || "group"}
                      minAdvanceHours={minAdvanceHours}
                      minAdvanceCutoffTime={minAdvanceCutoffTime}
                      todayFullyBlocked={todayFullyBlocked}
                      pricingGrid={pricingData?.grid}
                    />
                  </div>
                )}

                {/* Recap — appears after time selection (studio is implicit from slot) */}
                {state.studioId && state.startTime && state.endTime && (
                  <div ref={recapRef}>
                    {renderRecapSection()}
                  </div>
                )}
              </div>
            )}

            {/* Step coordonnees: Coordonnées (after cart, before payment) */}
            {state.step === "coordonnees" && (
                <BookingForm
                  date={state.cart[0]?.date || new Date()}
                  startTime={state.cart[0]?.startTime || ""}
                  endTime={state.cart[0]?.endTime || ""}
                  studioId={state.cart[0]?.studioId || "la-scene"}
                  groupType={state.cart[0]?.groupType || "group"}
                  userName={state.userName}
                  userEmail={state.userEmail}
                  userPhone={state.userPhone}
                  bandName={state.bandName}
                  billingAddress={state.billingAddress}
                  billingPostalCode={state.billingPostalCode}
                  billingCity={state.billingCity}
                  additionalInfo={state.additionalInfo}
                  createAccount={state.createAccount}
                  accountPassword={state.accountPassword}
                  accountPasswordConfirm={state.accountPasswordConfirm}
                  clientUser={clientUser}
                  clientUserLoading={clientUserLoading}
                  clientLogin={clientLogin}
                  onUpdateField={(fields) => {
                    // The hook exposes a per-field setter — fan the form's
                    // partial update out into updateUserInfo(field, value) calls.
                    for (const [field, value] of Object.entries(fields)) {
                      if (value === undefined) continue;
                      updateUserInfo(field as Parameters<typeof updateUserInfo>[0], value);
                    }
                  }}
                  onContinue={goToPaymentFromCoordonnees}
                  onBack={goBack}
                  canContinue={canConfirmBooking}
                />
              )}

            {/* Step panier: Cart page */}
            {state.step === "panier" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Votre panier</h3>
                </div>

                {state.cart.length === 0 ? (
                  <div className="py-8 text-center">
                    <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-white/20" />
                    <p className="text-white/60">Votre panier est vide</p>
                    <button
                      onClick={addAnotherBooking}
                      className="mt-4 rounded-lg bg-primary px-6 py-3 font-semibold text-black transition-colors hover:bg-primary/90"
                    >
                      Ajouter une réservation
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {state.cart.map((booking) => {
                        const displayPrice = recomputeCartItemPrice(booking);
                        return (
                        <div
                          key={booking.id}
                          className="rounded-xl border border-white/20 bg-black/30 p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">
                                {booking.groupType === "group"
                                  ? STUDIOS[booking.studioId].name
                                  : "Répétition"}
                              </h4>
                              <p className="text-xs text-primary">Réf: {booking.bookingRef}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-primary">
                                {formatPrice(displayPrice)}
                              </span>
                              <button
                                onClick={() => removeFromCart(booking.id)}
                                className="rounded-full p-1 transition-colors hover:bg-white/15"
                                aria-label="Supprimer"
                              >
                                <X className="h-4 w-4 text-white/60" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-white/60">
                            {formatDate(booking.date, "long")} • {booking.startTime} -{" "}
                            {booking.endTime} ({formatDuration(booking.startTime, booking.endTime)})
                          </p>
                           {booking.equipmentPrice > 0 && booking.equipment.length > 0 && (
                             <div className="mt-2 space-y-1">
                               {booking.equipment.filter(e => e.quantity > 0).map(e => {
                                  const eqPrice = calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], slotDurationHours(booking.startTime, booking.endTime), availableEquipment);
                                 return (
                                  <p key={e.id} className="text-xs text-white/40">
                                    + {getEquipmentName(e.id)} ×{e.quantity} : {formatPrice(eqPrice)}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );})}
                    </div>

                    <PromoCodeInput
                      total={cartTotal}
                      appliedPromo={state.appliedPromo}
                      onApply={applyPromo}
                      onRemove={removePromo}
                    />

                    <div className="rounded-xl bg-primary/10 p-4">
                      <div className="space-y-2">
                        {state.promoDiscount > 0 && (
                          <>
                            <div className="flex items-center justify-between text-sm text-white/70">
                              <span>Sous-total</span>
                              <span>{formatPrice(cartTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-green-400">
                              <span>Réduction ({state.appliedPromo?.code})</span>
                              <span>-{formatPrice(state.promoDiscount)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold">Total</span>
                          <span className="text-2xl font-bold text-primary">
                            {formatPrice(Math.max(0, cartTotal - state.promoDiscount))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                          onClick={() => goToCoordonnees()}
                          className="w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
                        >
                          Valider le panier
                      </button>
                      <button
                        onClick={addAnotherBooking}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-sm transition-colors hover:bg-white/15"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une autre réservation
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step paiement: PaymentChoice + StripeRedirect */}
            {state.step === "paiement" && !state.paymentMethod && (
              <PaymentChoice
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                onSelectMethod={selectPaymentMethod}
                onBack={goBack}
              />
            )}
            {state.step === "paiement" && state.paymentMethod === "card" && (
              <StripeRedirect
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                userName={state.userName}
                userEmail={state.userEmail}
                onBack={goBack}
              />
            )}
            {state.step === "paiement" && state.paymentMethod === "cash" && (
              <PaymentChoice
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                onSelectMethod={selectPaymentMethod}
                onBack={goBack}
              />
            )}

            {/* Step termine: Done */}
            {state.step === "termine" && (
              <FinalCheckout
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                onNewBooking={resetBooking}
                onBack={goBack}
              />
            )}

          </div>
        </div>
      </div>

      {state.step === "creneau" && state.groupType === "group" && !state.studioId && (
        <p className="mt-4 text-center text-sm font-medium text-primary/80">
          Les tarifs varient selon l'heure (après 18h) et le jour (weekend &
          jour férié). Économisez jusqu'à 20% en réservant avant 18h en semaine
          !
        </p>
      )}

      {state.step !== "groupe" && state.step !== "termine" && (
        <button
          onClick={resetBooking}
          className="mt-4 flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:bg-white/15 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Annuler et recommencer
        </button>
      )}
    </div>
  );
}
