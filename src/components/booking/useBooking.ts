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
  loadUserPreferences,
  saveUserPreferences,
  TIME_SLOTS,
} from "@/lib/booking";

interface ExtendedBookingState extends BookingState {
  equipment: EquipmentSelection[];
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
};

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
    setState((s) => {
      if (s.flow === "time-first") {
        return {
          ...s,
          selectedDate: date,
          startTime: null,
          endTime: null,
          step: 2,
        };
      }
      return {
        ...s,
        selectedDate: date,
        startTime: null,
        endTime: null,
        step: 3,
      };
    });
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
          // Solo/duo skip studio selection entirely
          if (s.groupType === "solo" || s.groupType === "duo") {
            return { ...s, studioId: "la-scene", step: 4 };
          }
          return { ...s, step: 3 };
        }
        return { ...s, step: 4 };
      }
      return s;
    });
  }, []);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => ({ ...s, groupType }));
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => ({ ...s, studioId, step: 4 }));
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
    setState((s) => ({ ...s, step: 5 }));
  }, []);

  const confirmBooking = useCallback(() => {
    setState((s) => {
      if (!s.selectedDate || !s.startTime || !s.endTime || !s.studioId || !s.groupType) return s;

      const pricing = calculatePrice(s.studioId, s.groupType, s.selectedDate, s.startTime, s.endTime);
      const bookingRef = generateBookingRef();
      
      const startIdx = TIME_SLOTS.indexOf(s.startTime);
      const endIdx = TIME_SLOTS.indexOf(s.endTime);
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
        paymentMethod: "cash",
        paymentStatus: "pending",
      };

      return {
        ...s,
        bookingRef,
        cart: [...s.cart, newBooking],
        step: 6,
        equipment: [],
      };
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
    setState((s) => ({ ...s, step: 7 }));
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
      if (s.step === 0) return s;
      if (s.step === 1) return { ...s, step: 0, flow: null };

      if (s.flow === "time-first") {
        if (s.step === 2) return { ...s, step: 1, selectedDate: null, startTime: null, endTime: null };
        if (s.step === 3) return { ...s, step: 2, studioId: null };
        // Solo/duo skip step 3, go back to step 2
        if (s.step === 4 && (s.groupType === "solo" || s.groupType === "duo")) {
          return { ...s, step: 2, studioId: null };
        }
        if (s.step === 4) return { ...s, step: 3 };
      } else {
        if (s.step === 2) return { ...s, step: 1, studioId: null, selectedDate: null };
        if (s.step === 3) return { ...s, step: 2, startTime: null, endTime: null };
        if (s.step === 4) return { ...s, step: 3 };
      }

      if (s.step === 5) return { ...s, step: 4 };
      if (s.step === 6) return { ...s, step: 5 };
      if (s.step === 7) return { ...s, step: 6 };
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
    const endIdx = TIME_SLOTS.indexOf(state.endTime);
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
    goToCheckout,
    removeFromCart,
    resetBooking,
    goBack,
  };
}

export type UseBookingReturn = ReturnType<typeof useBooking>;
