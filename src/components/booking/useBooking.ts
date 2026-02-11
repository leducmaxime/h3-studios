"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  type BookingState,
  type BookingFlow,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type EquipmentSelection,
  type PaymentMethod,
  calculatePrice,
  calculateEquipmentPrice,
  generateBookingRef,
  generateMockAvailability,
  assignStudioForSoloDuo,
  loadUserPreferences,
  saveUserPreferences,
  TIME_SLOTS,
} from "@/lib/booking";

interface ExtendedBookingState extends BookingState {
  equipment: EquipmentSelection[];
  /** Tracks whether we're adding a new booking (vs reviewing cart) */
  isAddingNew: boolean;
}

const initialState: ExtendedBookingState = {
  flow: null,
  step: 0,
  selectedDate: null,
  startTime: null,
  endTime: null,
  studioId: null,
  groupType: null,
  userName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  billingAddress: "",
  billingPostalCode: "",
  billingCity: "",
  additionalInfo: "",
  bookingRef: null,
  cart: [],
  equipment: [],
  paymentMethod: null,
  isAddingNew: false,
};

/**
 * Step flow:
 * 0: GroupType + FlowChoice
 * 1: Date (WeekCalendar) or Studio (studio-first)
 * 2: Time+Studio or Date+Time (depending on flow)
 * 3: Coordonnées (BookingForm)
 * 4: Récap & options (Equipment + summary) → confirmBooking → cart
 * 5: Panier (CartPage) — add another or proceed
 * 6: Choix de paiement (PaymentChoice)
 * 7: Paiement (Stripe/Mock)
 * 8: Terminé (FinalCheckout)
 */
export function useBooking() {
  const [state, setState] = useState<ExtendedBookingState>(initialState);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (prefsLoaded) return;
    const prefs = loadUserPreferences();
    if (prefs) {
      setState((s) => ({
        ...s,
        userName: prefs.userName || "",
        userEmail: prefs.userEmail || "",
        userPhone: prefs.userPhone || "",
        bandName: prefs.bandName || "",
      }));
    }
    setPrefsLoaded(true);
  }, [prefsLoaded]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.step]);

  const setStep = useCallback((step: BookingState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const selectFlow = useCallback((flow: BookingFlow) => {
    setState((s) => ({
      ...s,
      flow,
      step: 1,
    }));
  }, []);

  const selectDate = useCallback((date: Date) => {
    setState((s) => ({
      ...s,
      selectedDate: date,
      startTime: null,
      endTime: null,
    }));
  }, []);

  const selectStudioFirst = useCallback((studioId: StudioId) => {
    setState((s) => ({
      ...s,
      studioId,
      step: 2,
    }));
  }, []);

  const selectTimeRange = useCallback((startTime: string, endTime: string) => {
    setState((s) => ({ ...s, startTime, endTime }));
  }, []);

  const clearTimeRange = useCallback(() => {
    setState((s) => ({ ...s, startTime: null, endTime: null }));
  }, []);

  const confirmTimeSelection = useCallback(() => {
    setState((s) => {
      if (s.startTime && s.endTime) {
        if (s.flow === "time-first") {
          // Solo/duo skip studio selection — auto-assign based on availability
          if (s.groupType === "solo" || s.groupType === "duo") {
            const avail = s.selectedDate ? generateMockAvailability(s.selectedDate) : new Set<string>();
            const studio = assignStudioForSoloDuo(s.selectedDate!, s.startTime, s.endTime, avail);
            return { ...s, studioId: studio, step: 3 };
          }
          return { ...s, step: 2 };
        }
        return { ...s, step: 3 };
      }
      return s;
    });
  }, []);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => ({ ...s, groupType }));
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => ({ ...s, studioId, step: 3 }));
  }, []);

  const updateUserInfo = useCallback(
    (field: "userName" | "userEmail" | "userPhone" | "bandName" | "billingAddress" | "billingPostalCode" | "billingCity" | "additionalInfo", value: string) => {
      setState((s) => ({ ...s, [field]: value }));
      if (field === "userName" || field === "userEmail" || field === "userPhone" || field === "bandName") {
        saveUserPreferences({ [field]: value });
      }
    },
    []
  );

  const updateEquipment = useCallback((equipment: EquipmentSelection[]) => {
    setState((s) => ({ ...s, equipment }));
  }, []);

  const goToRecap = useCallback(() => {
    setState((s) => ({ ...s, step: 4 }));
  }, []);

  /** Adds current booking to cart and goes to cart page (step 5) */
  const confirmBooking = useCallback(() => {
    setState((s) => {
      if (!s.selectedDate || !s.startTime || !s.endTime || !s.studioId || !s.groupType) return s;

      const pricing = calculatePrice(s.studioId, s.groupType, s.selectedDate, s.startTime, s.endTime);
      const bookingRef = generateBookingRef();
      
      const startIdx = TIME_SLOTS.indexOf(s.startTime);
      let endIdx = TIME_SLOTS.indexOf(s.endTime);
      if (endIdx === -1 && s.endTime === "00:00") endIdx = TIME_SLOTS.length;
      const durationHours = (endIdx - startIdx) * 0.5;
      const equipmentPrice = calculateEquipmentPrice(s.equipment, durationHours);

      const newBooking: CompletedBooking = {
        id: crypto.randomUUID(),
        date: s.selectedDate,
        startTime: s.startTime,
        endTime: s.endTime,
        studioId: s.studioId,
        groupType: s.groupType,
        userName: s.userName,
        userEmail: s.userEmail,
        userPhone: s.userPhone,
        bandName: s.bandName,
        bookingRef,
        price: pricing.total + equipmentPrice,
        equipment: s.equipment,
        equipmentPrice,
        promoCode: null,
        promoDiscount: 0,
        paymentMethod: "cash",
        paymentStatus: "pending",
      };

      return {
        ...s,
        bookingRef,
        cart: [...s.cart, newBooking],
        step: 5,
        equipment: [],
        isAddingNew: false,
      };
    });
  }, []);

  /** From cart page: start adding a new booking (reset booking fields, keep cart + user info) */
  const addAnotherBooking = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedDate: null,
      startTime: null,
      endTime: null,
      studioId: null,
      groupType: null,
      flow: null,
      bookingRef: null,
      equipment: [],
      step: 0,
      isAddingNew: true,
    }));
  }, []);

  /** From cart page: proceed to payment choice (step 6) */
  const goToPaymentChoice = useCallback(() => {
    setState((s) => ({ ...s, step: 6 }));
  }, []);

  /** Cancel current new booking and go back to cart */
  const goToCart = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedDate: null,
      startTime: null,
      endTime: null,
      studioId: null,
      groupType: null,
      flow: null,
      bookingRef: null,
      equipment: [],
      step: 5,
      isAddingNew: false,
    }));
  }, []);

  const selectPaymentMethod = useCallback((method: PaymentMethod) => {
    setState((s) => {
      if (method === "card") {
        return { ...s, paymentMethod: method, step: 7 };
      }
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "cash" as PaymentMethod,
        paymentStatus: "pay-on-site" as const,
      }));
      return { ...s, paymentMethod: method, cart: updatedCart, step: 8 };
    });
  }, []);

  const processPayment = useCallback(() => {
    setState((s) => {
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "card" as PaymentMethod,
        paymentStatus: "paid" as const,
      }));
      return { ...s, cart: updatedCart, step: 8 };
    });
  }, []);

  const removeFromCart = useCallback((bookingId: string) => {
    setState((s) => ({
      ...s,
      cart: s.cart.filter((b) => b.id !== bookingId),
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(initialState);
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === 0) {
        // If adding new from cart, go back to cart
        if (s.isAddingNew && s.cart.length > 0) {
          return {
            ...s,
            selectedDate: null,
            startTime: null,
            endTime: null,
            studioId: null,
            groupType: null,
            flow: null,
            bookingRef: null,
            equipment: [],
            step: 5,
            isAddingNew: false,
          };
        }
        return s;
      }
      if (s.step === 1) {
        // If we have a date selected (in merged date+time step), clear it first
        if (s.flow === "time-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null };
        }
        return { ...s, step: 0, flow: null };
      }

      if (s.flow === "time-first") {
        if (s.step === 2) return { ...s, step: 1, studioId: null };
        if (s.step === 3 && (s.groupType === "solo" || s.groupType === "duo")) {
          return { ...s, step: 1, studioId: null };
        }
        if (s.step === 3) return { ...s, step: 2 };
      } else { // studio-first
        if (s.step === 2) {
          // If we have a date selected (in merged date+time step), clear it first
          if (s.selectedDate) {
            return { ...s, selectedDate: null, startTime: null, endTime: null };
          }
          return { ...s, step: 1, studioId: null, selectedDate: null };
        }
        if (s.step === 3) return { ...s, step: 2, startTime: null, endTime: null };
      }

      if (s.step === 4) return { ...s, step: 3 };
      // Step 5 (cart): locked — cannot go back from cart (use "Ajouter une autre réservation" instead)
      if (s.step === 5) return s;
      // Step 6 (payment choice): go back to cart
      if (s.step === 6) return { ...s, step: 5, paymentMethod: null };
      // Step 7 (payment): go back to payment choice
      if (s.step === 7) return { ...s, step: 6, paymentMethod: null };
      // Step 8 (done): go back to payment choice
      if (s.step === 8) return { ...s, step: 6 };
      return s;
    });
  }, []);

  const availability = useMemo(() => {
    if (!state.selectedDate) return new Set<string>();
    return generateMockAvailability(state.selectedDate);
  }, [state.selectedDate]);

  const pricing = useMemo(() => {
    if (!state.studioId || !state.selectedDate || !state.startTime || !state.endTime || !state.groupType) {
      return null;
    }
    const basePrice = calculatePrice(
      state.studioId,
      state.groupType,
      state.selectedDate,
      state.startTime,
      state.endTime
    );
    
    const startIdx = TIME_SLOTS.indexOf(state.startTime);
    let endIdx = TIME_SLOTS.indexOf(state.endTime);
    if (endIdx === -1 && state.endTime === "00:00") endIdx = TIME_SLOTS.length;
    const durationHours = (endIdx - startIdx) * 0.5;
    const equipmentPrice = calculateEquipmentPrice(state.equipment, durationHours);
    
    return {
      ...basePrice,
      equipmentPrice,
      grandTotal: basePrice.total + equipmentPrice,
    };
  }, [state.studioId, state.groupType, state.selectedDate, state.startTime, state.endTime, state.equipment]);

  const cartTotal = useMemo(() => {
    return state.cart.reduce((sum, booking) => sum + booking.price, 0);
  }, [state.cart]);

  const canProceedToStudio = state.startTime !== null && state.endTime !== null;
  const canConfirmBooking =
    state.userName.trim() !== "" &&
    state.userEmail.trim() !== "" &&
    state.userPhone.trim() !== "" &&
    state.billingAddress.trim() !== "" &&
    state.billingPostalCode.trim() !== "" &&
    state.billingCity.trim() !== "";

  return {
    state,
    availability,
    pricing,
    cartTotal,
    canProceedToStudio,
    canConfirmBooking,
    setStep,
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
  };
}

export type UseBookingReturn = ReturnType<typeof useBooking>;
