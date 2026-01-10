"use client";

import { ChevronLeft } from "lucide-react";
import { useBooking } from "./useBooking";
import { WeekCalendar } from "./WeekCalendar";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { GroupTypeToggle } from "./GroupTypeToggle";
import { StudioCard } from "./StudioCard";
import { BookingForm } from "./BookingForm";
import { BookingConfirmation } from "./BookingConfirmation";
import { formatDate, formatDuration, type StudioId } from "@/lib/booking";

export function BookingWidget() {
  const {
    state,
    availability,
    canProceedToStudio,
    canConfirmBooking,
    selectDate,
    selectTimeRange,
    clearTimeRange,
    confirmTimeSelection,
    setGroupType,
    selectStudio,
    updateUserInfo,
    confirmBooking,
    resetBooking,
    goBack,
  } = useBooking();

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        
        <div className="relative p-4 sm:p-6 md:p-8">
          {state.step !== 5 && (
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="font-blanka text-xl sm:text-2xl">
                  RÉSERVATION EN LIGNE
                </h2>
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <span className={state.step >= 1 ? "text-primary" : ""}>1</span>
                  <span>/</span>
                  <span className={state.step >= 2 ? "text-primary" : ""}>2</span>
                  <span>/</span>
                  <span className={state.step >= 3 ? "text-primary" : ""}>3</span>
                  <span>/</span>
                  <span className={state.step >= 4 ? "text-primary" : ""}>4</span>
                </div>
              </div>
              
              <div className="mt-4 flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      state.step >= step ? "bg-primary" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {state.step === 1 && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <p className="text-white/70">Choisissez une date pour votre répétition</p>
              </div>
              <WeekCalendar
                selectedDate={state.selectedDate}
                onSelectDate={selectDate}
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
                      groupType={state.groupType}
                      availability={availability}
                      onSelect={() => selectStudio(studioId)}
                    />
                  ))}
                </div>
              </div>
            </div>
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
                groupType={state.groupType}
                userName={state.userName}
                userEmail={state.userEmail}
                userPhone={state.userPhone}
                bandName={state.bandName}
                onUpdateField={updateUserInfo}
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
                groupType={state.groupType}
                userName={state.userName}
                userEmail={state.userEmail}
                bookingRef={state.bookingRef}
                onNewBooking={resetBooking}
              />
            )}
        </div>
      </div>

      {state.step === 1 && (
        <p className="mt-4 text-center text-sm text-white/50">
          💡 Les tarifs varient selon l'heure (après 18h) et le jour (week-end).
          Économisez jusqu'à 20% en réservant avant 18h en semaine !
        </p>
      )}
    </div>
  );
}
