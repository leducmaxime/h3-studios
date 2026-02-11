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
  /** Tracks whether we're adding a new booking (vs reviewing cart) */
  isAddingNew: boolean;
}

/**
 * Step flow:
 * 0: GroupType + FlowChoice
 * 1: Booking (Date+Time+Studio unified — all on one page)
 * 5: Panier (CartPage) — "Valider et payer" goes to coordonnées
 * 3: Coordonnées (BookingForm) — after cart validation
 * 6: Choix de paiement (PaymentChoice)
 * 7: Paiement (Stripe/Mock)
 * 8: Terminé (FinalCheckout)
 *
 * Cart lock: steps 0-1 are blocked when cart has items (unless isAddingNew).
 */
const STEP_URL_MAP: Record<number, string> = {
  0: "",
  1: "reservation",
  3: "coordonnees",
  5: "panier",
  6: "paiement-choix",
  7: "paiement",
  8: "termine",
};

const URL_STEP_MAP: Record<string, number> = {
  "": 0,
  "reservation": 1,
  "creneau": 1,   // legacy URL compat
  "studio": 1,    // legacy URL compat
  "coordonnees": 3,
  "panier": 5,
  "paiement-choix": 6,
  "paiement": 7,
  "termine": 8,
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

function navigateToUrl(step: number, _flow: BookingFlow | null) {
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
  isAddingNew: false,
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

      // Cart lock: if cart has items and not adding new, block booking steps (0-1)
      if (restoredState.cart.length > 0 && !restoredState.isAddingNew && restoredState.step <= 1) {
        restoredState.step = 5 as BookingState["step"];
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
    // Cart lock: enforce cart URL if cart has items and not adding new (block booking steps 0-1)
    if (state.cart.length > 0 && !state.isAddingNew && state.step <= 1) {
      setState((s) => ({ ...s, step: 5 as BookingState["step"] }));
      return;
    }
    navigateToUrl(state.step, state.flow);
  }, [state.step, state.flow, isHydrated, state.cart.length, state.isAddingNew]);

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
      
      setState((s) => {
        // Cart lock: if cart has items and not adding new, block booking steps (0-1)
        if (s.cart.length > 0 && !s.isAddingNew && newStep <= 1) {
          // Replace URL to cart without adding history entry
          window.history.replaceState({}, "", "/reservation/panier");
          return { ...s, step: 5 as BookingState["step"] };
        }
        return { ...s, step: newStep as BookingState["step"] };
      });
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setStep = useCallback((step: BookingState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const navigateToStep = useCallback((step: number) => {
    setState((s) => {
      // Cart lock: if cart has items and not adding new, block booking steps (0-1)
      if (s.cart.length > 0 && !s.isAddingNew && step <= 1) {
        return { ...s, step: 5 as BookingState["step"] };
      }
      return { ...s, step: step as BookingState["step"] };
    });
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
            return { ...s, studioId: studio };
          }
          // Group: stay on step 1 — studio selection shown inline
          return s;
        }
        // studio-first: stay on step 1 — recap/options shown inline after time selection
        return s;
      }
      return s;
    });
  }, []);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => ({ ...s, groupType }));
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => ({ ...s, studioId }));
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

  /** From cart page: go to coordonnées (step 3) before payment */
  const goToCoordonnees = useCallback(() => {
    setState((s) => ({ ...s, step: 3 }));
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
        step: 5,
        appliedPromo: null,
        promoDiscount: 0,
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
    clearBookingState();
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
        // Progressive back within the unified booking step:
        // studio-first: if date selected, clear date first
        if (s.flow === "studio-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null };
        }
        // studio-first: if studio selected but no date, clear studio
        if (s.flow === "studio-first" && s.studioId) {
          return { ...s, studioId: null, selectedDate: null, startTime: null, endTime: null };
        }
        // time-first: if date selected, clear date first
        if (s.flow === "time-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null, studioId: null };
        }
        return { ...s, step: 0, flow: null };
      }

      // Step 3 (coordonnées, now after cart): go back to cart
      if (s.step === 3) return { ...s, step: 5 };
      // Step 5 (cart): locked — cannot go back from cart
      if (s.step === 5) return s;
      // Step 6 (payment choice): go back to coordonnées
      if (s.step === 6) return { ...s, step: 3, paymentMethod: null };
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
    goToCoordonnees,
    confirmBooking,
    addAnotherBooking,
    goToPaymentChoice,
    goToPaymentFromCoordonnees,
    goToCart,
    removeFromCart,
    resetBooking,
    goBack,
    selectPaymentMethod,
    processPayment,
  };
}

export type UseBookingWithRouterReturn = ReturnType<typeof useBookingWithRouter>;
