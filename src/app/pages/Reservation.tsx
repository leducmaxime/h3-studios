"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { useBookingWithRouter } from "@/components/booking/useBookingWithRouter";
import { FlowChoice } from "@/components/booking/FlowChoice";
import { WeekCalendar } from "@/components/booking/WeekCalendar";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";
import { StudioPicker } from "@/components/booking/StudioPicker";
import { GroupTypeToggle } from "@/components/booking/GroupTypeToggle";
import { StudioCard } from "@/components/booking/StudioCard";
import { BookingForm } from "@/components/booking/BookingForm";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { FinalCheckout } from "@/components/booking/FinalCheckout";
import { CartSummary } from "@/components/booking/CartSummary";
import { ProgressIndicator } from "@/components/booking/ProgressIndicator";
import { PaymentChoice } from "@/components/booking/PaymentChoice";
import { StripeRedirect } from "@/components/booking/StripeRedirect";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { formatDate, formatDuration, STUDIOS, TIME_SLOTS, PRICING, type StudioId, type GroupType } from "@/lib/booking";

const GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo/Prof particulier",
  duo: "Duo",
  group: "Groupe",
};

function formatShortDate(date: Date): string {
  const day = date.toLocaleDateString("fr-FR", { weekday: "short" });
  const dayNum = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day} ${dayNum}/${month}`;
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
    updateUserInfo,
    updateEquipment,
    confirmBooking,
    addAnotherBooking,
    goToCheckout,
    goToPayment,
    removeFromCart,
    resetBooking,
    goBack,
    navigateToStep,
    selectPaymentMethod,
    processPayment,
  } = useBookingWithRouter(step);

  const durationHours = state.startTime && state.endTime
    ? (TIME_SLOTS.indexOf(state.endTime) - TIME_SLOTS.indexOf(state.startTime)) * 0.5
    : 0;

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="text-center font-blanka text-3xl md:text-5xl">
        RESERVATION
      </div>
      
      <div className="w-full max-w-[900px] px-4">
        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

          <div className="relative p-4 sm:p-6 md:p-8">
            {state.step !== 0 && state.step < 5 && state.flow && (
              <div className="mb-4">
                <ProgressIndicator
                  currentStep={state.step}
                  totalSteps={4}
                  flow={state.flow}
                />
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  {state.groupType && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {GROUP_LABELS[state.groupType as GroupType]}
                    </span>
                  )}
                  {state.studioId && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {STUDIOS[state.studioId as StudioId].name}
                    </span>
                  )}
                  {state.selectedDate && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {formatShortDate(state.selectedDate)}
                    </span>
                  )}
                  {state.startTime && state.endTime && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {state.startTime} - {state.endTime}
                    </span>
                  )}
                </div>
              </div>
            )}

            {state.step === 0 && (
              <div className="flex flex-col gap-6">
                <GroupTypeToggle
                  value={state.groupType}
                  onChange={setGroupType}
                />
                <FlowChoice onSelect={selectFlow} disabled={!state.groupType} />
              </div>
            )}

            {state.flow === "time-first" && (
              <>
                {state.step === 1 && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goBack}
                        className="rounded-full p-2 transition-colors hover:bg-white/10"
                        aria-label="Retour"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <p className="text-white/70">Choisissez une date pour votre répétition</p>
                    </div>
                    <WeekCalendar
                      selectedDate={state.selectedDate}
                      onSelectDate={selectDate}
                      studioFilter={null}
                    />
                  </div>
                )}

                {state.step === 2 && state.selectedDate && (
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
                    groupType={state.groupType || "group"}
                  />
                )}

                {state.step === 3 && state.selectedDate && state.startTime && state.endTime && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goBack}
                        className="rounded-full p-2 transition-colors hover:bg-white/10"
                        aria-label="Retour"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <p className="text-sm text-white/60">
                          {formatDate(state.selectedDate, "short")} • {state.startTime} - {state.endTime} ({formatDuration(state.startTime, state.endTime)})
                        </p>
                      </div>
                    </div>

                    {(state.groupType === "solo" || state.groupType === "duo") ? (
                      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/20 bg-white/5 p-6 text-center">
                        <p className="text-white/70">
                          Le choix du studio se fera selon la disponibilité, priorité aux groupes.
                        </p>
                        <button
                          onClick={() => selectStudio("la-scene")}
                          className="rounded-lg bg-primary px-6 py-3 font-semibold text-black transition-all hover:bg-primary/90"
                        >
                          Continuer
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="mb-3 block text-sm font-medium text-white/70">
                          Choisissez votre studio
                        </span>
                        <div className="grid gap-4 md:grid-cols-2">
                          {(["la-scene", "le-podium"] as StudioId[]).map((studioId) => (
                            <StudioCard
                              key={studioId}
                              studioId={studioId}
                              date={state.selectedDate!}
                              startTime={state.startTime!}
                              endTime={state.endTime!}
                              groupType={state.groupType || "group"}
                              availability={availability}
                              onSelect={() => selectStudio(studioId)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {state.flow === "studio-first" && (
              <>
                {state.step === 1 && (
                  <StudioPicker
                    onSelect={selectStudioFirst}
                    onBack={goBack}
                    groupType={state.groupType || "group"}
                  />
                )}

                {state.step === 2 && state.studioId && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goBack}
                        className="rounded-full p-2 transition-colors hover:bg-white/10"
                        aria-label="Retour"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <p className="text-sm text-white/60">
                          Studio: {STUDIOS[state.studioId as StudioId].name}
                        </p>
                      </div>
                    </div>
                    <p className="text-white/70">Choisissez une date</p>
                    <WeekCalendar
                      selectedDate={state.selectedDate}
                      onSelectDate={selectDate}
                      studioFilter={state.studioId}
                    />
                  </div>
                )}

                {state.step === 3 && state.selectedDate && state.studioId && (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={goBack}
                        className="rounded-full p-2 transition-colors hover:bg-white/10"
                        aria-label="Retour"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <p className="text-sm text-white/60">
                          {STUDIOS[state.studioId as StudioId].name} • {formatDate(state.selectedDate, "short")}
                        </p>
                      </div>
                    </div>

                    <TimeSlotPicker
                      date={state.selectedDate}
                      availability={availability}
                      startTime={state.startTime}
                      endTime={state.endTime}
                      onSelectRange={selectTimeRange}
                      onClear={clearTimeRange}
                      onConfirm={confirmTimeSelection}
                      onBack={() => {}}
                      canConfirm={canProceedToStudio}
                      studioFilter={state.studioId}
                      hideHeader
                      groupType={state.groupType || "group"}
                    />
                  </div>
                )}
              </>
            )}

            {state.step === 4 &&
              state.selectedDate &&
              state.startTime &&
              state.endTime &&
              state.studioId && (
                <BookingForm
                  date={state.selectedDate}
                  startTime={state.startTime}
                  endTime={state.endTime}
                  studioId={state.studioId}
                  groupType={state.groupType || "group"}
                  userName={state.userName}
                  userEmail={state.userEmail}
                  userPhone={state.userPhone}
                  bandName={state.bandName}
                  billingAddress={state.billingAddress}
                  billingPostalCode={state.billingPostalCode}
                  billingCity={state.billingCity}
                  equipment={state.equipment}
                  onUpdateField={updateUserInfo}
                  onUpdateEquipment={updateEquipment}
                  onConfirm={confirmBooking}
                  onBack={goBack}
                  canConfirm={canConfirmBooking}
                />
              )}

            {state.step === 5 &&
              state.selectedDate &&
              state.startTime &&
              state.endTime &&
              state.studioId &&
              state.bookingRef && (
                <BookingConfirmation
                  date={state.selectedDate}
                  startTime={state.startTime}
                  endTime={state.endTime}
                  studioId={state.studioId}
                  groupType={state.groupType || "group"}
                  userName={state.userName}
                  userEmail={state.userEmail}
                  bookingRef={state.bookingRef}
                  cart={state.cart}
                  cartTotal={cartTotal}
                  onAddAnother={addAnotherBooking}
                  onCheckout={goToCheckout}
                />
              )}

            {state.step === 6 && state.cart.length > 0 && (
              <FinalCheckout
                cart={state.cart}
                total={cartTotal}
                onNewBooking={resetBooking}
                onBack={goBack}
                onProceedToPayment={goToPayment}
                showPaymentButton
              />
            )}

            {state.step === 7 && state.cart.length > 0 && (
              <PaymentChoice
                cart={state.cart}
                total={cartTotal}
                onSelectMethod={selectPaymentMethod}
                onBack={goBack}
              />
            )}

            {state.step === 8 && (
              <StripeRedirect
                cart={state.cart}
                total={cartTotal}
                userName={state.userName}
                userEmail={state.userEmail}
                onBack={goBack}
              />
            )}

            {state.step === 9 && (
              <FinalCheckout
                cart={state.cart}
                total={cartTotal}
                onNewBooking={resetBooking}
                onBack={goBack}
              />
            )}

            {state.step > 0 && state.step < 5 && state.cart.length > 0 && (
              <CartSummary
                cart={state.cart}
                total={cartTotal}
                onRemove={removeFromCart}
                onCheckout={goToCheckout}
              />
            )}
          </div>
        </div>
      </div>

      {state.step === 0 && (
        <p className="mt-4 text-center text-sm text-white/50">
          Les tarifs varient selon l'heure (après 18h) et le jour (week-end).
          Économisez jusqu'à 20% en réservant avant 18h en semaine !
        </p>
      )}

      {state.step === 1 && state.flow && (
        <p className="mt-4 text-center text-sm text-white/50">
          Les créneaux en jaune sont en tarif soir, week-end & jour férié
        </p>
      )}

      {state.step > 0 && state.step < 9 && (
        <button
          onClick={resetBooking}
          className="mt-2 flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <RotateCcw className="h-4 w-4" />
          Annuler et recommencer
        </button>
      )}
    </div>
  );
}
