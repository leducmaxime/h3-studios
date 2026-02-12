"use client";

import { useEffect, useRef } from "react";

import { ScrollUp } from "@/components/common/ScrollUp";
import { useBookingWithRouter } from "@/components/booking/useBookingWithRouter";
import { FlowChoice } from "@/components/booking/FlowChoice";
import { WeekCalendar } from "@/components/booking/WeekCalendar";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";
import { StudioPicker } from "@/components/booking/StudioPicker";
import { GroupTypeToggle } from "@/components/booking/GroupTypeToggle";
import { StudioCard } from "@/components/booking/StudioCard";
import { BookingForm } from "@/components/booking/BookingForm";
import { FinalCheckout } from "@/components/booking/FinalCheckout";

import { ProgressIndicator } from "@/components/booking/ProgressIndicator";
import { PaymentChoice } from "@/components/booking/PaymentChoice";
import { StripeRedirect } from "@/components/booking/StripeRedirect";
import { ChevronLeft, Plus, RotateCcw, ShoppingCart, X, Wifi, TrainFront, MapPin, Check } from "lucide-react";
import { EquipmentSelector } from "@/components/booking/EquipmentSelector";
import { PromoCodeInput } from "@/components/booking/PromoCodeInput";
import { StickyBookingCTA } from "@/components/booking/StickyBookingCTA";
import { formatDate, formatDuration, formatPrice, calculatePrice, calculateEquipmentPrice, EQUIPMENT, STUDIOS, TIME_SLOTS, type StudioId, type GroupType } from "@/lib/booking";

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
    availability,
    pricing,
    cartTotal,
    canProceedToStudio,
    canConfirmBooking,
    selectFlow,
    selectDate,
    selectStudioFirst,
    selectTimeRange,
    clearTimeRange,
    confirmTimeSelection,
    setGroupType,
    selectStudio,
    clearStudioSelection,
    updateUserInfo,
    updateEquipment,
    applyPromo,
    removePromo,
    confirmBooking,
    addAnotherBooking,
    goToPaymentChoice,
    goToPaymentFromCoordonnees,
    goToCart,
    removeFromCart,
    resetBooking,
    goBack,
    navigateToStep,
    selectPaymentMethod,
    processPayment,
  } = useBookingWithRouter(step);

  // Scroll to top on every step change (scroll container is #root, not document)
  useEffect(() => {
    document.getElementById("root")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step]);

  // Refs for auto-scroll within unified booking step
  const timeSlotRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const recapRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Auto-scroll when date is selected (time slots appear)
  useEffect(() => {
    if (state.step === 1 && state.selectedDate && !state.startTime) {
      scrollToRef(timeSlotRef);
    }
  }, [state.step, state.selectedDate, state.startTime]);

  // Auto-scroll when time is confirmed (studio picker appears for group time-first)
  useEffect(() => {
    if (state.step === 1 && state.startTime && state.endTime && !state.studioId && state.flow === "time-first" && state.groupType === "group") {
      scrollToRef(studioRef);
    }
  }, [state.step, state.startTime, state.endTime, state.studioId, state.flow, state.groupType]);

  // Auto-scroll when studio is selected (recap appears) — time-first group
  useEffect(() => {
    if (state.step === 1 && state.studioId && state.startTime && state.endTime) {
      scrollToRef(recapRef);
    }
  }, [state.step, state.studioId, state.startTime, state.endTime]);

  // Auto-scroll for studio-first: when studio selected, scroll to date picker
  useEffect(() => {
    if (state.step === 1 && state.flow === "studio-first" && state.studioId && !state.selectedDate) {
      scrollToRef(dateRef);
    }
  }, [state.step, state.flow, state.studioId, state.selectedDate]);

  const durationHours = state.startTime && state.endTime
    ? ((() => {
        let endIdx = TIME_SLOTS.indexOf(state.endTime);
        if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
        return (endIdx - TIME_SLOTS.indexOf(state.startTime)) * 0.5;
      })())
    : 0;

  // Show cart banner when adding a new booking and cart has items (only on booking steps 0-1)
  const showCartBanner = state.isAddingNew && state.cart.length > 0 && state.step <= 1;

  // Inline recap + options block, shown after studio is selected (within the same step)
  const renderRecapSection = () => {
    if (!state.selectedDate || !state.startTime || !state.endTime || !state.studioId) return null;

    const studio = STUDIOS[state.studioId as StudioId];
    const gt = (state.groupType || "group") as GroupType;
    const priceResult = calculatePrice(state.studioId as StudioId, gt, state.selectedDate, state.startTime, state.endTime);
    const total = priceResult.total;
    const duration = formatDuration(state.startTime, state.endTime);
    const startIdx = TIME_SLOTS.indexOf(state.startTime);
    let endIdx = TIME_SLOTS.indexOf(state.endTime);
    if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
    const durationH = (endIdx - startIdx) * 0.5;
    const equipmentPrice = calculateEquipmentPrice(state.equipment, durationH);
    const grandTotal = total + equipmentPrice;

    // Price breakdown: off-peak vs peak hours
    const offPeakSlots = priceResult.breakdown.filter((s) => !s.isPeak);
    const peakSlots = priceResult.breakdown.filter((s) => s.isPeak);
    const offPeakHours = offPeakSlots.length * 0.5;
    const peakHours = peakSlots.length * 0.5;
    const offPeakRate = offPeakSlots.length > 0 ? offPeakSlots[0].rate : 0;
    const peakRate = peakSlots.length > 0 ? peakSlots[0].rate : 0;
    const offPeakSubtotal = offPeakHours * offPeakRate;
    const peakSubtotal = peakHours * peakRate;
    const hasPeakPricing = gt === "group";

    const handleConfirmRecap = () => {
      confirmBooking();
    };

    return (
      <div className="flex flex-col gap-5 pb-24 md:pb-0">
        <div className="mt-2 border-t border-white/10 pt-5">
          <h4 className="mb-3 text-sm font-semibold text-white/80">Options supplémentaires</h4>
          <EquipmentSelector
            equipment={state.equipment}
            onChange={updateEquipment}
            durationHours={durationH}
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
                <span className="text-white/60">{durationH}h x {offPeakRate}€/h</span>
                <span>{formatPrice(total)}</span>
              </div>
            )}

            {state.equipment.filter(e => e.quantity > 0).map(e => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="text-white/60">
                  {EQUIPMENT[e.id]?.name || e.id} x{e.quantity}
                </span>
                <span>{formatPrice(calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH))}</span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>

        {state.cart.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="font-medium text-white/80">
                {state.cart.length} réservation{state.cart.length > 1 ? "s" : ""} déjà dans le panier ({formatPrice(cartTotal)})
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleConfirmRecap}
          className="hidden w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-all hover:bg-primary/90 md:block"
        >
          Ajouter au panier - {formatPrice(grandTotal)}
        </button>

        <StickyBookingCTA
          studioPrice={total}
          equipmentPrice={equipmentPrice}
          onConfirm={handleConfirmRecap}
          disabled={false}
          buttonText="Ajouter au panier"
        />
      </div>
    );
  };

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="text-center font-blanka text-3xl md:text-5xl">
        RESERVATION
      </div>
      
      <div className="w-full max-w-[900px] px-4">
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

        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

          <div className="relative p-4 sm:p-6 md:p-8">
            {state.step <= 8 && (
              <div className="mb-4">
                <ProgressIndicator
                  currentStep={state.step}
                  totalSteps={5}
                  flow={state.flow || "time-first"}
                  skipStudio={state.flow === "time-first" && (state.groupType === "solo" || state.groupType === "duo")}
                  onStepClick={navigateToStep}
                  cartLocked={state.cart.length > 0 && !state.isAddingNew}
                />
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  {state.step === 1 && state.groupType && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {GROUP_LABELS[state.groupType as GroupType]}
                    </span>
                  )}
                  {/* Studio pill: show on booking step only */}
                  {state.studioId && state.step === 1 && state.groupType === "group" && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {STUDIOS[state.studioId as StudioId].name}
                    </span>
                  )}
                  {/* Date + time pills */}
                  {state.selectedDate && state.step === 1 && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {formatShortDate(state.selectedDate)}
                    </span>
                  )}
                  {state.startTime && state.endTime && state.step === 1 && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {state.startTime} - {state.endTime}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Step 0: Group type + Flow choice */}
            {state.step === 0 && (
              <div className="flex flex-col gap-6">
                <GroupTypeToggle
                  value={state.groupType}
                  onChange={setGroupType}
                />
                <FlowChoice onSelect={selectFlow} disabled={!state.groupType} groupType={state.groupType} />
              </div>
            )}

            {/* Step 1: Unified booking step — Time-first flow */}
            {state.step === 1 && state.flow === "time-first" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={goBack}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                    aria-label="Retour"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="text-white/70">
                    {!state.selectedDate
                      ? "Choisissez une date pour votre répétition"
                      : !state.startTime
                        ? "Choisissez votre créneau"
                        : state.groupType === "group" && !state.studioId
                          ? "Choisissez votre studio"
                          : "Récapitulatif de votre réservation"}
                  </p>
                </div>

                {/* Date picker */}
                <WeekCalendar
                  selectedDate={state.selectedDate}
                  onSelectDate={selectDate}
                  studioFilter={null}
                />

                {/* Time slot picker — appears after date selection */}
                {state.selectedDate && (
                  <div ref={timeSlotRef}>
                    <TimeSlotPicker
                      date={state.selectedDate}
                      availability={availability}
                      startTime={state.startTime}
                      endTime={state.endTime}
                      onSelectRange={selectTimeRange}
                      onClear={clearTimeRange}
                      onConfirm={confirmTimeSelection}
                      onBack={goBack}
                      canConfirm={canProceedToStudio}
                      hideHeader
                      groupType={state.groupType || "group"}
                    />
                  </div>
                )}

                {/* Studio picker — appears after time selection (group only) */}
                {state.startTime && state.endTime && state.groupType === "group" && (
                  <div ref={studioRef}>
                    <span className="mb-3 block text-sm font-medium text-white/70">
                      Choisissez votre studio
                    </span>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(["la-scene", "le-podium"] as StudioId[]).map((sid) => (
                        <StudioCard
                          key={sid}
                          studioId={sid}
                          date={state.selectedDate!}
                          startTime={state.startTime!}
                          endTime={state.endTime!}
                          groupType={state.groupType || "group"}
                          availability={availability}
                          onSelect={() => selectStudio(sid)}
                        />
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-white/50">
                      <span className="flex items-center gap-1.5">
                        <Wifi className="h-3.5 w-3.5 text-primary/70" />
                        Wifi gratuit
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TrainFront className="h-3.5 w-3.5 text-primary/70" />
                        A deux pas du RER A
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary/70" />
                        20 min de Paris
                      </span>
                    </div>
                  </div>
                )}

                {/* Recap — appears after studio selection (or auto-assign for solo/duo) */}
                {state.studioId && state.startTime && state.endTime && (
                  <div ref={recapRef}>
                    {renderRecapSection()}
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Unified booking step — Studio-first flow */}
            {state.step === 1 && state.flow === "studio-first" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={goBack}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                    aria-label="Retour"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="text-white/70">
                    {!state.studioId
                      ? "Choisissez votre studio"
                      : !state.selectedDate
                        ? "Choisissez une date pour votre répétition"
                        : !state.startTime
                          ? "Choisissez votre créneau"
                          : "Récapitulatif de votre réservation"}
                  </p>
                </div>

                {/* Studio section — picker OR selected studio card */}
                {state.studioId ? (
                  <div className="rounded-xl border-2 border-primary bg-primary/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                          <Check className="h-5 w-5 text-black" />
                        </div>
                        <div>
                          <p className="text-sm text-white/60">Studio sélectionné</p>
                          <p className="text-lg font-semibold">{STUDIOS[state.studioId as StudioId].name}</p>
                        </div>
                      </div>
                      <button
                        onClick={clearStudioSelection}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        Changer
                      </button>
                    </div>
                  </div>
                ) : (
                  <StudioPicker
                    onSelect={selectStudioFirst}
                    onBack={goBack}
                    groupType={state.groupType || "group"}
                    hideHeader
                  />
                )}

                {/* Date picker — appears after studio selection */}
                {state.studioId && (
                  <div ref={dateRef}>
                    <span className="mb-3 block text-sm font-medium text-white/70">
                      Choisissez une date
                    </span>
                    <WeekCalendar
                      selectedDate={state.selectedDate}
                      onSelectDate={selectDate}
                      studioFilter={state.studioId}
                    />
                  </div>
                )}

                {/* Time slot picker — appears after date selection */}
                {state.studioId && state.selectedDate && (
                  <div ref={timeSlotRef}>
                    <TimeSlotPicker
                      date={state.selectedDate}
                      availability={availability}
                      startTime={state.startTime}
                      endTime={state.endTime}
                      onSelectRange={selectTimeRange}
                      onClear={clearTimeRange}
                      onConfirm={confirmTimeSelection}
                      onBack={goBack}
                      canConfirm={canProceedToStudio}
                      studioFilter={state.studioId}
                      hideHeader
                      groupType={state.groupType || "group"}
                    />
                  </div>
                )}

                {/* Recap — appears after time selection */}
                {state.studioId && state.selectedDate && state.startTime && state.endTime && (
                  <div ref={recapRef}>
                    {renderRecapSection()}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Coordonnées (after cart, before payment) */}
            {state.step === 3 && (
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
                  onUpdateField={updateUserInfo}
                  onContinue={goToPaymentFromCoordonnees}
                  onBack={goBack}
                  canContinue={canConfirmBooking}
                />
              )}

            {/* Step 5: Cart page */}
            {state.step === 5 && (
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
                      {state.cart.map((booking) => (
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
                                {formatPrice(booking.price)}
                              </span>
                              <button
                                onClick={() => removeFromCart(booking.id)}
                                className="rounded-full p-1 transition-colors hover:bg-white/10"
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
                                const durationH = (parseInt(booking.endTime) - parseInt(booking.startTime)) / 100;
                                const eqPrice = calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH);
                                return (
                                  <p key={e.id} className="text-xs text-white/40">
                                    + {EQUIPMENT[e.id]?.name || e.id} ×{e.quantity} : {formatPrice(eqPrice)}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
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
                        onClick={goToPaymentChoice}
                        className="w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
                      >
                        Valider et payer - {formatPrice(Math.max(0, cartTotal - state.promoDiscount))}
                      </button>
                      <button
                        onClick={addAnotherBooking}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-sm transition-colors hover:bg-white/5"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une autre réservation
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 6: Payment choice */}
            {state.step === 6 && (
              <PaymentChoice
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                onSelectMethod={selectPaymentMethod}
                onBack={goBack}
              />
            )}

            {/* Step 7: Stripe payment */}
            {state.step === 7 && (
              <StripeRedirect
                cart={state.cart}
                total={Math.max(0, cartTotal - state.promoDiscount)}
                userName={state.userName}
                userEmail={state.userEmail}
                onBack={goBack}
              />
            )}

            {/* Step 8: Done */}
            {state.step === 8 && (
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

      {state.step === 1 && state.groupType === "group" && !state.studioId && (
        <p className="mt-4 text-center text-sm font-medium text-primary/80">
          Les tarifs varient selon l'heure (après 18h) et le jour (weekend &
          jour férié). Économisez jusqu'à 20% en réservant avant 18h en semaine
          !
        </p>
      )}

      {state.step > 0 && state.step < 8 && (
        <button
          onClick={resetBooking}
          className="mt-4 flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Annuler et recommencer
        </button>
      )}
    </div>
  );
}
