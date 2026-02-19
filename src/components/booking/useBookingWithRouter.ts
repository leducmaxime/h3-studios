"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { formatDateISO } from "@/lib/utils";
import {
  type BookingState,
  type BookingFlow,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type EquipmentSelection,
  type PaymentMethod,
  type PromoCode,
  type OccupancyInfo,
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
  appliedPromo: PromoCode | null;
  promoDiscount: number;
  isAddingNew: boolean;
  duplicateError: string | null;
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
  1: "",
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
  duplicateError: null,
};

export function useBookingWithRouter(urlStep?: string) {
  const initialStep = getStepFromUrl(urlStep);
  const [state, setState] = useState<ExtendedBookingState>({
    ...initialState,
    step: initialStep as BookingState["step"],
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const isInitialMount = useRef(true);
  const appliedPromoRef = useRef<PromoCode | null>(null);
  appliedPromoRef.current = state.appliedPromo;
  const [availability, setAvailability] = useState<Set<OccupancyInfo>>(new Set());
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
          merged.add({
            studioId: booking.studioId,
            time: TIME_SLOTS[i],
            groupType: booking.groupType,
          });
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
        const json = data as { success: boolean; data: OccupancyInfo[] };
        if (json.success && Array.isArray(json.data)) {
          setAvailability(new Set(json.data));
        }
      })
      .catch(console.error);
  }, [state.selectedDate]);

  useEffect(() => {
    if (isHydrated) return;
    
    const savedState = loadBookingState();
    const prefs = loadUserPreferences();
    
    if (savedState && savedState.step === 8) {
      clearBookingState();
      if (prefs) {
        setState((s) => ({
          ...s,
          userName: prefs.userName || "",
          userEmail: prefs.userEmail || "",
          userPhone: prefs.userPhone || "",
          bandName: prefs.bandName || "",
        }));
      }
      setIsHydrated(true);
      return;
    }
    
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
    if (state.step === 8) {
      clearBookingState();
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
      if (step === 0 && (s.groupType === "solo" || s.groupType === "duo")) {
        return { ...s, step: 0 as BookingState["step"], groupType: null, flow: null, selectedDate: null, startTime: null, endTime: null, studioId: null };
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
          if (s.groupType === "solo" || s.groupType === "duo") {
            const studio = assignStudioForSoloDuo(s.selectedDate!, s.startTime, s.endTime, mergedAvailability);
            return { ...s, studioId: studio };
          }
          return s;
        }
        return s;
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
    setState((s) => ({ ...s, studioId }));
  }, []);

  /** Clear studio selection and dependent fields (for studio-first flow) */
  const clearStudioSelection = useCallback(() => {
    setState((s) => ({ ...s, studioId: null, selectedDate: null, startTime: null, endTime: null }));
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

  const isDuplicateBooking = useCallback((
    cart: CompletedBooking[],
    date: Date,
    startTime: string,
    endTime: string,
    studioId: StudioId,
    groupType: GroupType
  ): boolean => {
    const dateStr = date.toDateString();
    const newStart = TIME_SLOTS.indexOf(startTime);
    let newEnd = TIME_SLOTS.indexOf(endTime);
    if (newEnd === -1 && endTime === "00:00") newEnd = TIME_SLOTS.length;

    const overlappingBookings = cart.filter((booking) => {
      if (booking.date.toDateString() !== dateStr) return false;
      
      const existingStart = TIME_SLOTS.indexOf(booking.startTime);
      let existingEnd = TIME_SLOTS.indexOf(booking.endTime);
      if (existingEnd === -1 && booking.endTime === "00:00") existingEnd = TIME_SLOTS.length;
      
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (overlappingBookings.length === 0) return false;

    return overlappingBookings.some(b => b.studioId === studioId);
  }, []);

  const confirmBooking = useCallback((): boolean => {
    let success = false;
    setState((s) => {
      if (!s.selectedDate || !s.startTime || !s.endTime || !s.studioId || !s.groupType) {
        return s;
      }

      if (isDuplicateBooking(s.cart, s.selectedDate, s.startTime, s.endTime, s.studioId, s.groupType)) {
        return {
          ...s,
          duplicateError: "Ce créneau est déjà dans votre panier",
        };
      }

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

      success = true;
      return {
        ...s,
        bookingRef,
        cart: [...s.cart, newBooking],
        step: 5,
        appliedPromo: null,
        promoDiscount: 0,
        isAddingNew: false,
        duplicateError: null,
      };
    });
    return success;
  }, [isDuplicateBooking]);

  const clearDuplicateError = useCallback(() => {
    setState((s) => ({ ...s, duplicateError: null }));
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
    setIsSubmitting(true);

    try {
      const promoCodeToApply = appliedPromoRef.current?.code ?? null;
      for (let i = 0; i < state.cart.length; i++) {
        const booking = state.cart[i];
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
            paymentStatus: method === "card" ? "pending" : "pay-on-site",
            promoCode: i === 0 ? promoCodeToApply : null,
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
    setState((s) => {
      const newCart = s.cart.filter((b) => b.id !== bookingId);

      return { ...s, cart: newCart, appliedPromo: null, promoDiscount: 0 };
    });
  }, []);

  const resetBooking = useCallback(() => {
    clearBookingState();
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
        if (s.flow === "studio-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null };
        }
        if (s.flow === "studio-first" && s.studioId) {
          return { ...s, studioId: null, selectedDate: null, startTime: null, endTime: null };
        }
        if (s.flow === "time-first" && s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null, studioId: null };
        }
        const isSoloDuo = s.groupType === "solo" || s.groupType === "duo";
        if (isSoloDuo) {
          return { ...s, step: 0, flow: null, groupType: null, selectedDate: null, startTime: null, endTime: null, studioId: null };
        }
        return { ...s, step: 0, flow: null };
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
    navigateToStep,
    selectFlow,
    selectDate,
    selectStudioFirst,
    selectTimeRange,
    clearTimeRange,
    confirmTimeSelection,
    setGroupType,
    selectStudio,
    clearStudioSelection,
    updateUserInfo,
    updateEquipment,
    applyPromo,
    removePromo,
    goToCoordonnees,
    confirmBooking,
    clearDuplicateError,
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
