"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  type BookingState,
  type BookingFlow,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type EquipmentSelection,
  type PaymentMethod,
  type PromoCode,
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
  appliedPromo: PromoCode | null;
  promoDiscount: number;
}

const STEP_URL_MAP: Record<number, string> = {
  0: "",
  1: "creneau",
  2: "studio",
  3: "coordonnees",
  4: "recapitulatif",
  5: "confirmation",
  6: "panier",
  7: "paiement-choix",
  8: "paiement",
  9: "termine",
};

const URL_STEP_MAP: Record<string, number> = {
  "": 0,
  "creneau": 1,
  "studio": 2,
  "coordonnees": 3,
  "recapitulatif": 4,
  "confirmation": 5,
  "panier": 6,
  "paiement-choix": 7,
  "paiement": 8,
  "termine": 9,
};

const BOOKING_STORAGE_KEY = "h3-studios-booking-state";

interface SerializedBookingState extends Omit<ExtendedBookingState, "selectedDate" | "cart"> {
  selectedDate: string | null;
  cart: Array<Omit<CompletedBooking, "date"> & { date: string }>;
}

function serializeState(state: ExtendedBookingState): SerializedBookingState {
  return {
    ...state,
    selectedDate: state.selectedDate ? state.selectedDate.toISOString() : null,
    cart: state.cart.map((booking) => ({
      ...booking,
      date: booking.date.toISOString(),
    })),
  };
}

function deserializeState(serialized: SerializedBookingState): ExtendedBookingState {
  return {
    ...initialState,
    ...serialized,
    selectedDate: serialized.selectedDate ? new Date(serialized.selectedDate) : null,
    cart: serialized.cart.map((booking) => ({
      ...booking,
      date: new Date(booking.date),
    })),
  };
}

function saveBookingState(state: ExtendedBookingState): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = serializeState(state);
    localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // localStorage not available
  }
}

function loadBookingState(): ExtendedBookingState | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as SerializedBookingState;
    return deserializeState(parsed);
  } catch {
    return null;
  }
}

function clearBookingState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BOOKING_STORAGE_KEY);
  } catch {
    // localStorage not available
  }
}

function getStepFromUrl(urlStep: string | undefined): number {
  if (!urlStep) return 0;
  return URL_STEP_MAP[urlStep] ?? 0;
}

function navigateToUrl(step: number, flow: BookingFlow | null) {
  const stepSlug = STEP_URL_MAP[step];
  let url = "/reservation";
  if (stepSlug) {
    url = `/reservation/${stepSlug}`;
  }
  if (typeof window !== "undefined" && window.location.pathname !== url) {
    window.history.pushState({}, "", url);
  }
}

function isUserInfoComplete(s: ExtendedBookingState): boolean {
  return (
    s.userName.trim() !== "" &&
    s.userEmail.trim() !== "" &&
    s.userPhone.trim() !== "" &&
    s.billingAddress.trim() !== "" &&
    s.billingPostalCode.trim() !== "" &&
    s.billingCity.trim() !== ""
  );
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
  appliedPromo: null,
  promoDiscount: 0,
};

export function useBookingWithRouter(urlStep?: string) {
  const initialStep = getStepFromUrl(urlStep);
  const [state, setState] = useState<ExtendedBookingState>({
    ...initialState,
    step: initialStep as BookingState["step"],
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isHydrated) return;
    
    const savedState = loadBookingState();
    const prefs = loadUserPreferences();
    
    if (savedState) {
      const urlStepNum = getStepFromUrl(urlStep);
      const restoredState = {
        ...savedState,
        step: (urlStepNum > 0 ? urlStepNum : savedState.step) as BookingState["step"],
      };
      
      if (prefs) {
        restoredState.userName = prefs.userName || restoredState.userName;
        restoredState.userEmail = prefs.userEmail || restoredState.userEmail;
        restoredState.userPhone = prefs.userPhone || restoredState.userPhone;
        restoredState.bandName = prefs.bandName || restoredState.bandName;
      }
      
      setState(restoredState);
    } else if (prefs) {
      setState((s) => ({
        ...s,
        userName: prefs.userName || "",
        userEmail: prefs.userEmail || "",
        userPhone: prefs.userPhone || "",
        bandName: prefs.bandName || "",
      }));
    }
    
    setIsHydrated(true);
  }, [isHydrated, urlStep]);

  useEffect(() => {
    if (!isHydrated) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveBookingState(state);
  }, [state, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    navigateToUrl(state.step, state.flow);
  }, [state.step, state.flow, isHydrated]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.step]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handlePopState = () => {
      const path = window.location.pathname;
      const stepMatch = path.match(/\/reservation\/?(.*)$/);
      const urlStepStr = stepMatch ? stepMatch[1] : "";
      const newStep = getStepFromUrl(urlStepStr || undefined);
      
      setState((s) => ({ ...s, step: newStep as BookingState["step"] }));
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setStep = useCallback((step: BookingState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const navigateToStep = useCallback((step: number) => {
    setState((s) => ({ ...s, step: step as BookingState["step"] }));
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
            const nextStep = isUserInfoComplete(s) ? 4 : 3;
            return { ...s, studioId: studio, step: nextStep };
          }
          return { ...s, step: 2 };
        }
        const nextStep = isUserInfoComplete(s) ? 4 : 3;
        return { ...s, step: nextStep };
      }
      return s;
    });
  }, []);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => ({ ...s, groupType }));
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => {
      const nextStep = isUserInfoComplete(s) ? 4 : 3;
      return { ...s, studioId, step: nextStep };
    });
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

  const applyPromo = useCallback((promo: PromoCode, discount: number) => {
    setState((s) => ({ ...s, appliedPromo: promo, promoDiscount: discount }));
  }, []);

  const removePromo = useCallback(() => {
    setState((s) => ({ ...s, appliedPromo: null, promoDiscount: 0 }));
  }, []);

  const goToRecap = useCallback(() => {
    setState((s) => ({ ...s, step: 4 }));
  }, []);

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

      const finalPrice = pricing.total + equipmentPrice;

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
        price: finalPrice,
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
        step: 4,
        selectedDate: null,
        startTime: null,
        endTime: null,
        studioId: null,
        equipment: [],
        appliedPromo: null,
        promoDiscount: 0,
      };
    });
  }, []);

  const selectPaymentMethod = useCallback((method: PaymentMethod) => {
    setState((s) => {
      if (method === "card") {
        return { ...s, paymentMethod: method, step: 8 };
      }
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "cash" as PaymentMethod,
        paymentStatus: "pay-on-site" as const,
      }));
      return { ...s, paymentMethod: method, cart: updatedCart, step: 9 };
    });
  }, []);

  const processPayment = useCallback(() => {
    setState((s) => {
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "card" as PaymentMethod,
        paymentStatus: "paid" as const,
      }));
      return { ...s, cart: updatedCart, step: 9 };
    });
  }, []);

  const addAnotherBooking = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedDate: null,
      startTime: null,
      endTime: null,
      studioId: null,
      groupType: "group",
      bookingRef: null,
      step: 1,
    }));
  }, []);

  const goToCheckout = useCallback(() => {
    setState((s) => ({ ...s, step: 6 }));
  }, []);

  const goToPayment = useCallback(() => {
    setState((s) => ({ ...s, step: 7 }));
  }, []);

  const removeFromCart = useCallback((bookingId: string) => {
    setState((s) => ({
      ...s,
      cart: s.cart.filter((b) => b.id !== bookingId),
    }));
  }, []);

  const resetBooking = useCallback(() => {
    clearBookingState();
    setState(initialState);
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === 0) return s;
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

      if (s.step === 4) {
        // If no active selection (cart-only view after confirmation), go back to step 0
        if (!s.selectedDate) return { ...initialState, cart: s.cart };
        // If user info is complete (step 3 was skipped), go back to step before step 3
        if (isUserInfoComplete(s)) {
          if (s.flow === "time-first") {
            if (s.groupType === "solo" || s.groupType === "duo") {
              return { ...s, step: 1, studioId: null };
            }
            return { ...s, step: 2 };
          }
          // studio-first: go back to time selection (step 2)
          return { ...s, step: 2, startTime: null, endTime: null };
        }
        return { ...s, step: 3 };
      }
      if (s.step === 6) return { ...s, step: 4 };
      if (s.step === 7) return { ...s, step: 4, paymentMethod: null };
      if (s.step === 8) return { ...s, step: 7, paymentMethod: null };
      if (s.step === 9) return { ...s, step: 7 };
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
    navigateToStep,
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
    selectPaymentMethod,
    processPayment,
  };
}

export type UseBookingWithRouterReturn = ReturnType<typeof useBookingWithRouter>;
