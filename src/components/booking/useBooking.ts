"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { formatDateISO } from "@/lib/utils";
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
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mergedAvailability = useMemo(() => {
    if (!state.selectedDate) return availability;

    const merged = new Set(availability);
    const selectedDateStr = state.selectedDate.toDateString();

    for (const booking of state.cart) {
      if (booking.date.toDateString() === selectedDateStr) {
        const startIdx = TIME_SLOTS.indexOf(booking.startTime);
        let endIdx = TIME_SLOTS.indexOf(booking.endTime);
        if (endIdx === -1 && booking.endTime === "00:00") endIdx = TIME_SLOTS.length;
        for (let i = startIdx; i < endIdx; i++) {
          merged.add(`${booking.studioId}-${TIME_SLOTS[i]}`);
        }
      }
    }

    return merged;
  }, [availability, state.cart, state.selectedDate]);

  useEffect(() => {
    if (!state.selectedDate) return;
    const dateStr = formatDateISO(state.selectedDate);
    fetch(`/api/availability?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        const json = data as { success: boolean; data: string[] };
        if (json.success && Array.isArray(json.data)) {
          setAvailability(new Set(json.data));
        }
      })
      .catch(console.error);
  }, [state.selectedDate]);

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
          if (s.groupType === "solo" || s.groupType === "duo") {
            const studio = assignStudioForSoloDuo(s.selectedDate!, s.startTime, s.endTime, mergedAvailability);
            return { ...s, studioId: studio, step: 3 };
          }
          return { ...s, step: 2 };
        }
        return { ...s, step: 3 };
      }
      return s;
    });
  }, [mergedAvailability]);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => {
      if (groupType === "solo" || groupType === "duo") {
        return { ...s, groupType, flow: "time-first", step: 1 };
      }
      return { ...s, groupType };
    });
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

  /** From cart page: proceed to coordonnées (step 3) before payment */
  const goToPaymentChoice = useCallback(() => {
    setState((s) => ({ ...s, step: 3 }));
  }, []);

  /** From coordonnées: proceed to payment choice (step 6) */
  const goToPaymentFromCoordonnees = useCallback(() => {
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

  const selectPaymentMethod = useCallback(async (method: PaymentMethod) => {
    if (isSubmitting) return;
    
    // Only submit to API if paying on site (cash)
    // For card, we proceed to Stripe redirect (step 7) which will handle payment intent
    // But we might want to create the booking as pending first?
    // Current api/payment/create flow seems to expect bookings to exist or creates session with metadata.
    // Let's stick to: create bookings in DB first for both methods.
    
    setIsSubmitting(true);

    try {
      // Create bookings in DB
      for (const booking of state.cart) {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingRef: booking.bookingRef,
            user: {
              name: booking.userName,
              email: booking.userEmail,
              phone: booking.userPhone,
              bandName: booking.bandName,
            },
            studioId: booking.studioId,
            date: formatDateISO(booking.date),
            startTime: booking.startTime,
            endTime: booking.endTime,
            groupType: booking.groupType,
            equipment: booking.equipment,
            equipmentPrice: booking.equipmentPrice,
            price: booking.price,
            paymentMethod: method,
            paymentStatus: method === "card" ? "pending_payment" : "pay-on-site",
            promoCode: booking.promoCode,
            promoDiscount: booking.promoDiscount,
          }),
        });
        const json = await res.json() as { success: boolean; error?: string };
        if (!json.success) throw new Error(json.error);
      }

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
    } catch (err) {
      alert("Erreur lors de la réservation: " + err);
    } finally {
      setIsSubmitting(false);
    }
  }, [state.cart, isSubmitting]);

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
        if (s.flow === "time-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null };
        }
        const isSoloDuo = s.groupType === "solo" || s.groupType === "duo";
        return { ...s, step: 0, flow: null, groupType: isSoloDuo ? null : s.groupType };
      }

      if (s.flow === "time-first") {
        if (s.step === 2) return { ...s, step: 1, studioId: null };
      } else { // studio-first
        if (s.step === 2) {
          if (s.selectedDate) {
            return { ...s, selectedDate: null, startTime: null, endTime: null };
          }
          return { ...s, step: 1, studioId: null, selectedDate: null };
        }
      }

      if (s.step === 3) return { ...s, step: 5 };
      if (s.step === 5) return s;
      if (s.step === 6) return { ...s, step: 3, paymentMethod: null };
      if (s.step === 7) return { ...s, step: 6, paymentMethod: null };
      if (s.step === 8) return { ...s, step: 6 };
      return s;
    });
  }, []);

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
    availability: mergedAvailability,
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
    goToPaymentFromCoordonnees,
    goToCart,
    selectPaymentMethod,
    processPayment,
    removeFromCart,
    resetBooking,
    goBack,
  };
}

export type UseBookingReturn = ReturnType<typeof useBooking>;
