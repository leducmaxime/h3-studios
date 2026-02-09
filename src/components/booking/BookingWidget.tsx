"use client";

import { ChevronLeft } from "lucide-react";
import { useBooking } from "./useBooking";
import { FlowChoice } from "./FlowChoice";
import { WeekCalendar } from "./WeekCalendar";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { StudioPicker } from "./StudioPicker";
import { GroupTypeToggle } from "./GroupTypeToggle";
import { StudioCard } from "./StudioCard";
import { BookingForm } from "./BookingForm";
import { BookingConfirmation } from "./BookingConfirmation";
import { FinalCheckout } from "./FinalCheckout";
import { CartSummary } from "./CartSummary";
import { ProgressIndicator } from "./ProgressIndicator";
import { formatDate, formatDuration, STUDIOS, TIME_SLOTS, type StudioId } from "@/lib/booking";

export function BookingWidget() {
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
    removeFromCart,
    resetBooking,
    goBack,
  } = useBooking();

  const durationHours = state.startTime && state.endTime
    ? (TIME_SLOTS.indexOf(state.endTime) - TIME_SLOTS.indexOf(state.startTime)) * 0.5
    : 0;

  const getStepInfo = () => {
    if (state.flow === "time-first") {
      return {
        current: state.step,
        total: 4,
        labels: ["Date", "Créneau", "Studio", "Coordonnées"],
      };
    }
    return {
      current: state.step,
      total: 4,
      labels: ["Studio", "Date", "Créneau", "Coordonnées"],
    };
  };

  const stepInfo = getStepInfo();

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

        <div className="relative p-4 sm:p-6 md:p-8">
          {state.step !== 0 && state.step !== 5 && state.step !== 6 && state.flow && (
            <div className="mb-2">
              <ProgressIndicator
                currentStep={state.step}
                totalSteps={4}
                flow={state.flow}
              />
            </div>
          )}

          {state.step === 0 && (
            <div className="flex flex-col gap-6">
              <FlowChoice onSelect={selectFlow} />
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

                  <GroupTypeToggle
                    value={state.groupType}
                    onChange={setGroupType}
                  />

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
                        Studio: {STUDIOS[state.studioId].name}
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
                        {STUDIOS[state.studioId].name} • {formatDate(state.selectedDate, "short")}
                      </p>
                    </div>
                  </div>

                  <GroupTypeToggle
                    value={state.groupType}
                    onChange={setGroupType}
                  />

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

          {state.step === 6 && (
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
    </div>
  );
}
