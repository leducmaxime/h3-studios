"use client";

import { useState, useCallback, useMemo } from "react";
import {
  type BookingState,
  type BookingFlow,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  calculatePrice,
  generateBookingRef,
  generateMockAvailability,
} from "@/lib/booking";

const initialState: BookingState = {
  flow: null,
  step: 0,
  selectedDate: null,
  startTime: null,
  endTime: null,
  studioId: null,
  groupType: "group",
  userName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  bookingRef: null,
  cart: [],
};

export function useBooking() {
  const [state, setState] = useState<BookingState>(initialState);

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
          return { ...s, step: 3 };
        }
        return { ...s, step: 4 };
      }
      return s;
    });
  }, []);

  const setGroupType = useCallback((groupType: GroupType) => {
    setState((s) => ({ ...s, groupType }));
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => ({ ...s, studioId, step: 4 }));
  }, []);

  const updateUserInfo = useCallback(
    (field: "userName" | "userEmail" | "userPhone" | "bandName", value: string) => {
      setState((s) => ({ ...s, [field]: value }));
    },
    []
  );

  const confirmBooking = useCallback(() => {
    setState((s) => {
      if (!s.selectedDate || !s.startTime || !s.endTime || !s.studioId) return s;

      const pricing = calculatePrice(s.studioId, s.groupType, s.selectedDate, s.startTime, s.endTime);
      const bookingRef = generateBookingRef();

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
        price: pricing.total,
      };

      return {
        ...s,
        bookingRef,
        cart: [...s.cart, newBooking],
        step: 5,
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
    setState((s) => ({ ...s, step: 6 }));
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
        if (s.step === 4) return { ...s, step: 3 };
      } else {
        if (s.step === 2) return { ...s, step: 1, studioId: null, selectedDate: null };
        if (s.step === 3) return { ...s, step: 2, startTime: null, endTime: null };
        if (s.step === 4) return { ...s, step: 3 };
      }

      if (s.step === 6) return { ...s, step: 5 };
      return s;
    });
  }, []);

  const availability = useMemo(() => {
    if (!state.selectedDate) return new Set<string>();
    return generateMockAvailability(state.selectedDate);
  }, [state.selectedDate]);

  const pricing = useMemo(() => {
    if (!state.studioId || !state.selectedDate || !state.startTime || !state.endTime) {
      return null;
    }
    return calculatePrice(
      state.studioId,
      state.groupType,
      state.selectedDate,
      state.startTime,
      state.endTime
    );
  }, [state.studioId, state.groupType, state.selectedDate, state.startTime, state.endTime]);

  const cartTotal = useMemo(() => {
    return state.cart.reduce((sum, booking) => sum + booking.price, 0);
  }, [state.cart]);

  const canProceedToStudio = state.startTime !== null && state.endTime !== null;
  const canConfirmBooking =
    state.userName.trim() !== "" &&
    state.userEmail.trim() !== "" &&
    state.userPhone.trim() !== "";

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
    confirmBooking,
    addAnotherBooking,
    goToCheckout,
    removeFromCart,
    resetBooking,
    goBack,
  };
}

export type UseBookingReturn = ReturnType<typeof useBooking>;
