"use client";

import { useState, useCallback, useMemo } from "react";
import {
  type BookingState,
  type StudioId,
  type GroupType,
  calculatePrice,
  generateBookingRef,
  generateMockAvailability,
} from "@/lib/booking";

const initialState: BookingState = {
  step: 1,
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
};

export function useBooking() {
  const [state, setState] = useState<BookingState>(initialState);

  const setStep = useCallback((step: BookingState["step"]) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const selectDate = useCallback((date: Date) => {
    setState((s) => ({
      ...s,
      selectedDate: date,
      startTime: null,
      endTime: null,
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
        return { ...s, step: 3 };
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
    setState((s) => ({
      ...s,
      bookingRef: generateBookingRef(),
      step: 5,
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(initialState);
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === 1) return s;
      if (s.step === 2) return { ...s, step: 1, selectedDate: null, startTime: null, endTime: null };
      if (s.step === 3) return { ...s, step: 2, studioId: null };
      if (s.step === 4) return { ...s, step: 3 };
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

  const canProceedToStudio = state.startTime !== null && state.endTime !== null;
  const canConfirmBooking =
    state.userName.trim() !== "" &&
    state.userEmail.trim() !== "" &&
    state.userPhone.trim() !== "";

  return {
    state,
    availability,
    pricing,
    canProceedToStudio,
    canConfirmBooking,
    setStep,
    selectDate,
    selectTimeRange,
    clearTimeRange,
    confirmTimeSelection,
    setGroupType,
    selectStudio,
    updateUserInfo,
    confirmBooking,
    resetBooking,
    goBack,
  };
}

export type UseBookingReturn = ReturnType<typeof useBooking>;
