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
import { ChevronLeft, ChevronRight, Plus, RotateCcw, ShoppingCart, X, Check, Wifi, TrainFront, MapPin } from "lucide-react";
import { EquipmentSelector } from "@/components/booking/EquipmentSelector";
import { PromoCodeInput } from "@/components/booking/PromoCodeInput";
import { StickyBookingCTA } from "@/components/booking/StickyBookingCTA";
import { formatDate, formatDuration, formatPrice, calculatePrice, calculateEquipmentPrice, EQUIPMENT, STUDIOS, TIME_SLOTS, PRICING, type StudioId, type GroupType } from "@/lib/booking";

const GROUP_LABELS: Record<GroupType, string> = {
  solo: "Solo/Prof particulier",
  duo: "Duo",
  group: "Groupe",
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
    updateUserInfo,
    updateEquipment,
    applyPromo,
    removePromo,
    goToRecap,
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
    ? ((() => {
        let endIdx = TIME_SLOTS.indexOf(state.endTime);
        if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
        return (endIdx - TIME_SLOTS.indexOf(state.startTime)) * 0.5;
      })())
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
            {state.step <= 8 && (
              <div className="mb-4">
                <ProgressIndicator
                  currentStep={state.step}
                  totalSteps={8}
                  flow={state.flow || "time-first"}
                  skipStudio={state.flow === "time-first" && (state.groupType === "solo" || state.groupType === "duo")}
                  onStepClick={navigateToStep}
                />
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                  {state.step > 0 && state.groupType && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {GROUP_LABELS[state.groupType as GroupType]}
                    </span>
                  )}
                  {/* Studio pill: show after the step where studio is chosen */}
                  {state.studioId && state.groupType === "group" && (
                    state.flow === "studio-first"
                      ? state.step > 1
                      : state.step > 2
                  ) && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {STUDIOS[state.studioId as StudioId].name}
                    </span>
                  )}
                  {/* Date + time pills: show after the merged date+time step */}
                  {state.selectedDate && (
                    state.flow === "studio-first"
                      ? state.step > 2
                      : state.step > 1
                  ) && (
                    <span className="rounded-full bg-primary/20 px-3 py-1 font-medium text-primary">
                      {formatShortDate(state.selectedDate)}
                    </span>
                  )}
                  {state.startTime && state.endTime && (
                    state.flow === "studio-first"
                      ? state.step > 2
                      : state.step > 1
                  ) && (
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
                <FlowChoice onSelect={selectFlow} disabled={!state.groupType} groupType={state.groupType} />
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
                             Studio: {STUDIOS[state.studioId as StudioId].name}
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
                const subtotal = total + equipmentPrice;
                const promoDiscount = state.appliedPromo ? state.promoDiscount : 0;
                const grandTotal = Math.max(0, subtotal - promoDiscount);
                const groupLabels: Record<GroupType, string> = {
                  solo: "Solo / Prof particulier",
                  duo: "Duo",
                  group: "Groupe (3+)",
                };
                return (
                  <div className="flex flex-col gap-6 pb-24 md:pb-0">
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
                                  <span>{EQUIPMENT[e.id]?.name || e.id} ×{e.quantity}</span>
                                  <span>{formatPrice(calculateEquipmentPrice([{id: e.id, quantity: e.quantity}], durationH))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {promoDiscount > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>Réduction ({state.appliedPromo?.code})</span>
                            <span className="font-medium">-{formatPrice(promoDiscount)}</span>
                          </div>
                        )}
                        <div className="mt-3 flex justify-between border-t border-primary/30 pt-3">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <PromoCodeInput
                      total={subtotal}
                      appliedPromo={state.appliedPromo}
                      onApply={applyPromo}
                      onRemove={removePromo}
                    />

                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                      <p className="font-medium text-white/80">Conditions</p>
                      <ul className="mt-1 space-y-0.5">
                        <li>• Paiement en ligne ou sur place (CB ou espèces)</li>
                        <li>• Annulation gratuite jusqu&apos;à 48h avant</li>
                        <li>• En cas de besoin : 06 13 44 08 75 ou contact@h3-studios.fr</li>
                      </ul>
                    </div>

                    {state.cart.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center gap-2 text-sm">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <span className="font-medium text-white/80">
                            {state.cart.length} créneau{state.cart.length > 1 ? "x" : ""} déjà dans le panier ({formatPrice(cartTotal)})
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={confirmBooking}
                      className="hidden w-full rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-all hover:bg-primary/90 md:block"
                    >
                      {state.cart.length > 0
                        ? `Ajouter au panier - ${formatPrice(grandTotal)}`
                        : `Confirmer - ${formatPrice(grandTotal)}`}
                    </button>

                    <StickyBookingCTA
                      studioPrice={total}
                      equipmentPrice={equipmentPrice}
                      onConfirm={confirmBooking}
                      disabled={false}
                      buttonText={state.cart.length > 0 ? "Ajouter au panier" : "Confirmer"}
                    />
                  </div>
                );
              })()}

            {state.step === 4 && !state.selectedDate && state.cart.length > 0 && (
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="h-8 w-8 text-green-400" />
                </div>

                <div className="text-center">
                  <h3 className="text-xl font-bold">Récapitulatif de votre commande</h3>
                  <p className="mt-1 text-sm text-white/60">
                    {state.cart.length} réservation{state.cart.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="w-full space-y-3">
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
                      {booking.equipmentPrice > 0 && (
                        <p className="mt-1 text-xs text-white/40">
                          + options : {formatPrice(booking.equipmentPrice)}
                        </p>
                      )}
                      {booking.promoDiscount > 0 && (
                        <p className="mt-1 text-xs text-green-400">
                          Réduction ({booking.promoCode}) : -{formatPrice(booking.promoDiscount)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="w-full rounded-xl bg-primary/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">{formatPrice(cartTotal)}</span>
                  </div>
                </div>

                <p className="text-center text-xs text-white/50">
                  Vous pourrez choisir de payer en ligne ou sur place à l&apos;étape suivante
                </p>

                <div className="flex w-full flex-col gap-3">
                  <button
                    onClick={goToPayment}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-lg font-semibold text-black transition-colors hover:bg-primary/90"
                  >
                    Procéder au paiement
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={addAnotherBooking}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-sm transition-colors hover:bg-white/5"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un autre créneau
                  </button>
                </div>
              </div>
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


          </div>
        </div>
      </div>

      {((state.flow === "time-first" && state.step === 1) || (state.flow === "studio-first" && state.step === 2)) && state.groupType === "group" && (
        <p className="mt-4 text-center text-sm font-medium text-primary/80">
          Les tarifs varient selon l'heure (après 18h) et le jour (weekend &
          jour férié). Économisez jusqu'à 20% en réservant avant 18h en semaine
          !
        </p>
      )}

      {state.step > 0 && state.step < 9 && (
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
