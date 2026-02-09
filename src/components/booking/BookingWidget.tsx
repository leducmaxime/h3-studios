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
import { EquipmentSelector } from "./EquipmentSelector";
import { StickyBookingCTA } from "./StickyBookingCTA";
import { formatDate, formatDuration, formatPrice, calculatePrice, calculateEquipmentPrice, STUDIOS, TIME_SLOTS, type StudioId, type GroupType } from "@/lib/booking";

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
    goToRecap,
    confirmBooking,
    addAnotherBooking,
    goToCheckout,
    removeFromCart,
    resetBooking,
    goBack,
    setStep,
  } = useBooking();

  const durationHours = state.startTime && state.endTime
    ? (TIME_SLOTS.indexOf(state.endTime) - TIME_SLOTS.indexOf(state.startTime)) * 0.5
    : 0;

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

        <div className="relative p-4 sm:p-6 md:p-8">
          {state.step < 6 && (
            <div className="mb-2">
              <ProgressIndicator
                currentStep={state.step}
                totalSteps={6}
                flow={state.flow || "time-first"}
                onStepClick={(step) => setStep(step as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)}
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

                  {(state.groupType === "solo" || state.groupType === "duo") ? (
                    <button
                      onClick={() => selectStudio("la-scene")}
                      className="w-full rounded-lg bg-primary py-3 font-semibold text-black transition-all hover:bg-primary/90"
                    >
                      Continuer
                    </button>
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
                      {state.groupType === "group" && (
                        <p className="text-sm text-white/60">
                          Studio: {STUDIOS[state.studioId].name}
                        </p>
                      )}
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
                        {state.groupType === "group" ? `${STUDIOS[state.studioId].name} • ` : ""}{formatDate(state.selectedDate, "short")}
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
                additionalInfo={state.additionalInfo}
                onUpdateField={updateUserInfo}
                onContinue={goToRecap}
                onBack={goBack}
                canContinue={canConfirmBooking}
              />
            )}

          {state.step === 5 &&
            state.selectedDate &&
            state.startTime &&
            state.endTime &&
            state.studioId && (() => {
              const studio = STUDIOS[state.studioId as StudioId];
              const gt = (state.groupType || "group") as GroupType;
              const { total } = calculatePrice(state.studioId as StudioId, gt, state.selectedDate!, state.startTime!, state.endTime!);
              const duration = formatDuration(state.startTime!, state.endTime!);
              const startIdx = TIME_SLOTS.indexOf(state.startTime!);
              const endIdx = TIME_SLOTS.indexOf(state.endTime!);
              const durationH = (endIdx - startIdx) * 0.5;
              const equipmentPrice = calculateEquipmentPrice(state.equipment, durationH);
              const grandTotal = total + equipmentPrice;
              const groupLabels: Record<GroupType, string> = {
                solo: "Solo / Prof particulier",
                duo: "Duo",
                group: "Groupe (3+)",
              };
              return (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={goBack}
                      className="rounded-full p-2 transition-colors hover:bg-white/10"
                      aria-label="Retour"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-lg font-semibold">Récapitulatif & options</h3>
                  </div>

                  <EquipmentSelector
                    equipment={state.equipment}
                    onChange={updateEquipment}
                    durationHours={durationH}
                  />

                  <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
                    <div className="mb-3 text-sm font-semibold text-primary">Récapitulatif</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-white/70">Date</span>
                        <span className="font-medium capitalize">{formatDate(state.selectedDate!, "short")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Horaire</span>
                        <span className="font-medium">
                          {state.startTime} - {state.endTime} ({duration})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Studio</span>
                        <span className="font-medium">
                          {gt === "group" ? studio.name : "Selon disponibilité"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Formule</span>
                        <span className="font-medium">{groupLabels[gt]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">{gt === "group" ? "Studio" : "Répétition"}</span>
                        <span className="font-medium">{formatPrice(total)}</span>
                      </div>
                      {equipmentPrice > 0 && (
                        <div className="flex justify-between">
                          <span className="text-white/70">Équipements</span>
                          <span className="font-medium">{formatPrice(equipmentPrice)}</span>
                        </div>
                      )}
                      <div className="mt-3 flex justify-between border-t border-primary/30 pt-3">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                    <p className="font-medium text-white/80">Conditions</p>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Paiement sur place (CB, espèces)</li>
                      <li>• Annulation gratuite jusqu&apos;à 24h avant</li>
                      <li>• Retard de plus de 15min = créneau annulé</li>
                    </ul>
                  </div>

                  <button
                    onClick={confirmBooking}
                    className="w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-all hover:bg-primary/90"
                  >
                    Confirmer - {formatPrice(grandTotal)}
                  </button>
                </div>
              );
            })()}

          {state.step === 6 &&
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

          {state.step === 7 && (
            <FinalCheckout
              cart={state.cart}
              total={cartTotal}
              onNewBooking={resetBooking}
              onBack={goBack}
            />
          )}

          {state.step > 0 && state.step < 6 && state.cart.length > 0 && (
            <CartSummary
              cart={state.cart}
              total={cartTotal}
              onRemove={removeFromCart}
              onCheckout={goToCheckout}
            />
          )}
        </div>
      </div>

      {(state.step === 1 || state.step === 2) && state.groupType === "group" && (
        <p className="mt-4 text-center text-sm font-medium text-primary/80">
          Les tarifs varient selon l'heure (après 18h) et le jour (weekend &
          jour férié). Économisez jusqu'à 20% en réservant avant 18h en semaine
          !
        </p>
      )}
    </div>
  );
}
