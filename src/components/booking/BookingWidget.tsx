"use client";

import { ChevronLeft, ShoppingCart, Plus, X } from "lucide-react";
import { useBooking } from "./useBooking";
import { FlowChoice } from "./FlowChoice";
import { WeekCalendar } from "./WeekCalendar";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { StudioPicker } from "./StudioPicker";
import { GroupTypeToggle } from "./GroupTypeToggle";
import { StudioCard } from "./StudioCard";
import { BookingForm } from "./BookingForm";
import { FinalCheckout } from "./FinalCheckout";
import { PaymentChoice } from "./PaymentChoice";
import { StripeRedirect } from "./StripeRedirect";
import { ProgressIndicator } from "./ProgressIndicator";
import { EquipmentSelector } from "./EquipmentSelector";
import { formatDate, formatDuration, formatPrice, calculatePrice, calculateEquipmentPrice, EQUIPMENT, STUDIOS, TIME_SLOTS, type StudioId, type GroupType } from "@/lib/booking";

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
    goToPaymentChoice,
    goToCart,
    selectPaymentMethod,
    processPayment,
    removeFromCart,
    resetBooking,
    goBack,
    setStep,
  } = useBooking();

  const durationHours = state.startTime && state.endTime
    ? ((() => {
        let endIdx = TIME_SLOTS.indexOf(state.endTime);
        if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
        return (endIdx - TIME_SLOTS.indexOf(state.startTime)) * 0.5;
      })())
    : 0;

  // Show cart banner when adding a new booking and cart has items
  const showCartBanner = state.isAddingNew && state.cart.length > 0 && state.step <= 4;

  return (
    <div className="w-full">
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
          {state.step <= 5 && (
            <div className="mb-2">
              <ProgressIndicator
                currentStep={state.step}
                totalSteps={5}
                flow={state.flow || "time-first"}
                onStepClick={(step) => setStep(step as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)}
              />
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

          {/* Steps 1-2: Time-first flow */}
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
                    <p className="text-white/70">
                      {!state.selectedDate
                        ? "Choisissez une date pour votre répétition"
                        : "Choisissez votre créneau"}
                    </p>
                  </div>
                  <WeekCalendar
                    selectedDate={state.selectedDate}
                    onSelectDate={selectDate}
                    studioFilter={null}
                  />
                  {state.selectedDate && (
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
                  )}
                </div>
              )}

              {state.step === 2 && state.selectedDate && state.startTime && state.endTime && (
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

          {/* Steps 1-2: Studio-first flow */}
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
                      <p className="text-white/70">
                        {!state.selectedDate
                          ? "Choisissez une date pour votre répétition"
                          : "Choisissez votre créneau"}
                      </p>
                    </div>
                  </div>
                  <WeekCalendar
                    selectedDate={state.selectedDate}
                    onSelectDate={selectDate}
                    studioFilter={state.studioId}
                  />
                  {state.selectedDate && (
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
                  )}
                </div>
              )}
            </>
          )}

          {/* Step 3: Coordonnées */}
          {state.step === 3 &&
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

          {/* Step 4: Récap & options */}
          {state.step === 4 &&
            state.selectedDate &&
            state.startTime &&
            state.endTime &&
            state.studioId && (() => {
              const studio = STUDIOS[state.studioId as StudioId];
              const gt = (state.groupType || "group") as GroupType;
              const { total } = calculatePrice(state.studioId as StudioId, gt, state.selectedDate!, state.startTime!, state.endTime!);
              const duration = formatDuration(state.startTime!, state.endTime!);
              const startIdx = TIME_SLOTS.indexOf(state.startTime!);
              let endIdx = TIME_SLOTS.indexOf(state.endTime!);
              if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
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
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-white/70">Options suppl.</span>
                            <span className="font-medium">{formatPrice(equipmentPrice)}</span>
                          </div>
                          <div className="space-y-0.5 pl-2 text-xs text-white/50">
                            {state.equipment.filter(e => e.quantity > 0).map(e => (
                              <div key={e.id} className="flex justify-between">
                                <span>{EQUIPMENT[e.id]?.name || e.id} x{e.quantity}</span>
                                <span>{formatPrice(calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH))}</span>
                              </div>
                            ))}
                          </div>
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
                      <li>• Paiement en ligne ou sur place (CB ou espèces)</li>
                      <li>• Annulation gratuite jusqu&apos;à 48h avant</li>
                      <li>• En cas de besoin : 06 13 44 08 75 ou contact@h3-studios.fr</li>
                    </ul>
                  </div>

                  <button
                    onClick={confirmBooking}
                    className="w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-all hover:bg-primary/90"
                  >
                    Ajouter au panier - {formatPrice(grandTotal)}
                  </button>
                </div>
              );
            })()}

          {/* Step 5: Cart page */}
          {state.step === 5 && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={goBack}
                  className="rounded-full p-2 transition-colors hover:bg-white/10"
                  aria-label="Retour"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Votre panier</h3>
                </div>
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
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {booking.groupType === "group" ? STUDIOS[booking.studioId].name : "Répétition"}
                          </div>
                          <div className="text-sm text-white/60">
                            {formatDate(booking.date, "short")} • {booking.startTime} - {booking.endTime} ({formatDuration(booking.startTime, booking.endTime)})
                          </div>
                          {booking.equipmentPrice > 0 && (
                            <div className="mt-1 text-xs text-white/40">
                              Options : {booking.equipment.filter(e => e.quantity > 0).map(e =>
                                `${EQUIPMENT[e.id]?.name || e.id} x${e.quantity}`
                              ).join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-primary">{formatPrice(booking.price)}</span>
                          <button
                            onClick={() => removeFromCart(booking.id)}
                            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
                            aria-label="Supprimer"
                          >
                            <X className="h-4 w-4 text-white/60" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-primary/10 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold text-primary">{formatPrice(cartTotal)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={goToPaymentChoice}
                      className="w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
                    >
                      Valider et payer - {formatPrice(cartTotal)}
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
              total={cartTotal}
              onSelectMethod={selectPaymentMethod}
              onBack={goBack}
            />
          )}

          {/* Step 7: Payment (Stripe) */}
          {state.step === 7 && (
            <StripeRedirect
              cart={state.cart}
              total={cartTotal}
              userName={state.userName}
              userEmail={state.userEmail}
              onBack={goBack}
            />
          )}

          {/* Step 8: Done */}
          {state.step === 8 && (
            <FinalCheckout
              cart={state.cart}
              total={cartTotal}
              onNewBooking={resetBooking}
              onBack={goBack}
            />
          )}
        </div>
      </div>

      {((state.flow === "time-first" && state.step === 1) || (state.flow === "studio-first" && state.step === 2)) && state.groupType === "group" && (
        <p className="mt-4 text-center text-sm font-medium text-primary/80">
          Les tarifs varient selon l'heure (après 18h) et le jour (weekend &
          jour férié). Économisez jusqu'à 20% en réservant avant 18h en semaine
          !
        </p>
      )}
    </div>
  );
}
