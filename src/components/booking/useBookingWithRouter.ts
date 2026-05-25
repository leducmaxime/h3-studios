"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { formatDateISO } from "@/lib/utils";
import {
  type BookingState,
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
  isRangeBookable,
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
 * 0: GroupType
 * 1: Date & Créneaux booking (Date+Time+Studio unified)
 * 2: Coordonnées (BookingForm)
 * 3: Panier (CartPage)
 * 4: Paiement (PaymentChoice + StripeRedirect)
 * 5: Terminé (FinalCheckout)
 *
 * Cart lock: steps 0-1 are blocked when cart has items (unless isAddingNew).
 */
const STEP_URL_MAP: Record<number, string> = {
  0: "",
  1: "",
  2: "coordonnees",
  3: "panier",
  4: "paiement",
  5: "termine",
};

const URL_STEP_MAP: Record<string, number> = {
  "": 0,
  "reservation": 1,
  "creneau": 1,   // legacy URL compat
  "coordonnees": 2,
  "panier": 3,
  "paiement": 4,
  "paiement-choix": 4,  // legacy URL compat
  "termine": 5,
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

function navigateToUrl(step: number) {
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
  const [minAdvanceHours, setMinAdvanceHours] = useState<number>(0);
  const [minAdvanceCutoffTime, setMinAdvanceCutoffTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientUser, setClientUser] = useState<{
    id: string;
    email: string | null;
    name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    band_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    city: string | null;
  } | null>(null);
  const [clientUserLoading, setClientUserLoading] = useState(true);

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
    fetch(`/api/availability?date=${dateStr}&groupType=${state.groupType || "solo"}`)
      .then((res) => res.json())
      .then((data) => {
        const json = data as { success: boolean; data: { slots: Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>>; minAdvanceHours: number; minAdvanceCutoffTime: string | null } };
        if (json.success && json.data) {
          // Convert new per-studio format to OccupancyInfo set (only occupied slots)
          const occupancy = new Set<OccupancyInfo>();
          for (const [studioId, slots] of Object.entries(json.data.slots)) {
            for (const slot of slots) {
              if (!slot.available) {
                occupancy.add({
                  studioId: studioId as StudioId,
                  time: slot.time,
                  groupType: slot.groupType as GroupType | "blocked" | undefined,
                  bookingId: slot.bookingId,
                });
              }
            }
          }
          setAvailability(occupancy);
          setMinAdvanceHours(json.data.minAdvanceHours ?? 0);
          setMinAdvanceCutoffTime(json.data.minAdvanceCutoffTime ?? null);
        }
      })
      .catch(console.error);
  }, [state.selectedDate]);

  useEffect(() => {
    if (isHydrated) return;

    const savedState = loadBookingState();
    const prefs = loadUserPreferences();

    if (savedState && savedState.step === 5) {
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
        restoredState.step = 3 as BookingState["step"];
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

    fetch("/api/client/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          console.warn("[Booking] /api/client/me returned", res.status);
          return null;
        }
        return res.json() as Promise<{ data?: { id: string; email: string | null; name: string; first_name: string | null; last_name: string | null; phone: string | null; band_name: string | null; address_line1: string | null; address_line2: string | null; postal_code: string | null; city: string | null } }>;
      })
      .then((json) => {
        if (json?.data) {
          const user = json.data;
          setClientUser(user);
          setState((s) => ({
            ...s,
            userName: user.name || s.userName,
            userEmail: user.email || s.userEmail,
            userPhone: user.phone || s.userPhone,
            bandName: user.band_name || s.bandName,
            billingAddress: user.address_line1 || s.billingAddress,
            billingPostalCode: user.postal_code || s.billingPostalCode,
            billingCity: user.city || s.billingCity,
          }));
        } else {
          console.warn("[Booking] /api/client/me: no user data");
        }
        setClientUserLoading(false);
        setIsHydrated(true);
      })
      .catch((err) => {
        console.error("[Booking] /api/client/me error:", err);
        setClientUserLoading(false);
        setIsHydrated(true);
      });
  }, [isHydrated, urlStep]);

  useEffect(() => {
    if (!isHydrated) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (state.step === 5) {
      clearBookingState();
      return;
    }
    saveBookingState(state);
  }, [state, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    // Cart lock: enforce cart URL if cart has items and not adding new (block booking steps 0-1)
    if (state.cart.length > 0 && !state.isAddingNew && state.step <= 1) {
      setState((s) => ({ ...s, step: 3 as BookingState["step"] }));
      return;
    }
    navigateToUrl(state.step);
  }, [state.step, isHydrated, state.cart.length, state.isAddingNew]);

  // Always fetch user data on mount (in case auth state changed since last render)
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/client/me", { credentials: "include" })
      .then((res) => res.ok ? res.json() as Promise<{ data?: unknown }> : null)
      .then((data) => {
        if (data?.data) {
          const u = data.data as { name?: string; email?: string; phone?: string; band_name?: string; address_line1?: string; postal_code?: string; city?: string };
          setState((s) => ({
            ...s,
            userName: u.name || s.userName,
            userEmail: u.email || s.userEmail,
            userPhone: u.phone || s.userPhone,
            bandName: u.band_name || s.bandName,
            billingAddress: u.address_line1 || s.billingAddress,
            billingPostalCode: u.postal_code || s.billingPostalCode,
            billingCity: u.city || s.billingCity,
          }));
        }
      })
      .catch(() => {});
  }, []);

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
          return { ...s, step: 3 as BookingState["step"] };
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
        return { ...s, step: 3 as BookingState["step"] };
      }
      if (step === 0 && (s.groupType === "solo" || s.groupType === "duo")) {
        return { ...s, step: 0 as BookingState["step"], groupType: null, selectedDate: null, startTime: null, endTime: null, studioId: null };
      }
      return { ...s, step: step as BookingState["step"] };
    });
  }, []);

  const selectDate = useCallback((date: Date) => {
    setState((s) => ({
      ...s,
      selectedDate: date,
      startTime: null,
      endTime: null,
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
      if (s.startTime && s.endTime && s.selectedDate && s.groupType) {
        // Unified range validation: ensure the selected range is actually bookable
        const rangeCheck = isRangeBookable(
          s.startTime,
          s.endTime,
          s.groupType,
          mergedAvailability,
          s.selectedDate
        );
        if (!rangeCheck.bookable) {
          // Range is not bookable — reset selection (shouldn't happen if UI is correct)
          return { ...s, startTime: null, endTime: null };
        }
        // If studio not yet selected (solo/duo implicit), use the bookable studio
        if (!s.studioId && rangeCheck.studioId) {
          return { ...s, studioId: rangeCheck.studioId };
        }
        return s;
      }
      return s;
    });
  }, [mergedAvailability]);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => {
      if (groupType === "solo" || groupType === "duo" || groupType === "group") {
        return { ...s, groupType, step: 1, selectedDate: null, startTime: null, endTime: null, studioId: null };
      }
      return { ...s, groupType };
    });
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

  /** From cart page: go to coordonnées (step 2) before payment */
  const goToCoordonnees = useCallback(() => {
    setState((s) => ({ ...s, step: 2 }));
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
        round_mode: null,
        promoDiscount: 0,
        paymentMethod: "cash",
        paymentStatus: "pending",
      };

      success = true;
      return {
        ...s,
        bookingRef,
        cart: [...s.cart, newBooking],
        step: 3,
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
      bookingRef: null,
      equipment: [],
      step: 0,
      isAddingNew: true,
    }));
  }, []);

  /** From cart page: proceed to coordonnées (step 2) before payment */
  const goToPaymentChoice = useCallback(() => {
    setState((s) => ({ ...s, step: 2 }));
  }, []);

  /** From coordonnées: proceed to payment choice (step 6) or skip if free */
  const goToPaymentFromCoordonnees = useCallback(async () => {
    const currentCart = state.cart;
    const cartTotal = currentCart.reduce((sum, b) => sum + b.price, 0);
    const totalPromoDiscount = state.promoDiscount || 0;
    const finalTotal = Math.max(0, cartTotal - totalPromoDiscount);
    
    // If total is 0€ (100% discount), skip payment and create booking directly
    if (finalTotal === 0) {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        const promoCodeToApply = appliedPromoRef.current?.code ?? null;
        let remainingPromo = totalPromoDiscount;
        const allCartRefs = state.cart.map(b => b.bookingRef);
        for (let i = 0; i < state.cart.length; i++) {
          const booking = state.cart[i];
          const bookingPromoDiscount = Math.min(booking.price, remainingPromo);
          remainingPromo -= bookingPromoDiscount;
          const finalPrice = Math.max(0, booking.price - bookingPromoDiscount);
          const res = await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingRef: booking.bookingRef,
              user: {
                name: state.userName,
                email: state.userEmail,
                phone: state.userPhone,
                bandName: state.bandName,
                addressLine1: state.billingAddress,
                postalCode: state.billingPostalCode,
                city: state.billingCity,
              },
              studioId: booking.studioId,
              date: formatDateISO(booking.date),
              startTime: booking.startTime,
              endTime: booking.endTime,
              groupType: booking.groupType,
              equipment: booking.equipment,
              equipmentPrice: booking.equipmentPrice,
              price: finalPrice,
              paymentMethod: "cash",
              paymentStatus: "pay-on-site",
              promoCode: i === 0 ? promoCodeToApply : null,
              round_mode: i === 0 ? appliedPromoRef.current?.round_mode ?? null : null,
              promoDiscount: bookingPromoDiscount,
              notes: state.additionalInfo,
              cartBookingRefs: allCartRefs,
              isLastInCart: i === state.cart.length - 1,
            }),
          });
          const json = await res.json() as { success: boolean; error?: string };
          if (!json.success) throw new Error(json.error);
        }
        setState((s) => {
          const updatedCart = s.cart.map((booking) => ({
            ...booking,
            paymentMethod: "cash" as PaymentMethod,
            paymentStatus: "pay-on-site" as const,
          }));
          return { ...s, paymentMethod: "cash", cart: updatedCart, step: 5 };
        });
      } catch (err) {
        alert("Erreur lors de la réservation: " + err);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setState((s) => ({ ...s, step: 4 }));
    }
  }, [state.cart, state.promoDiscount, state.userName, state.userEmail, state.userPhone, state.bandName, state.additionalInfo, isSubmitting]);

  /** Cancel current new booking and go back to cart */
  const goToCart = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedDate: null,
      startTime: null,
      endTime: null,
      studioId: null,
      groupType: null,
      bookingRef: null,
      equipment: [],
      step: 3,
      isAddingNew: false,
    }));
  }, []);

  const selectPaymentMethod = useCallback(async (method: PaymentMethod) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const promoCodeToApply = appliedPromoRef.current?.code ?? null;
      const totalPromoDiscount = state.promoDiscount || 0;
      let remainingPromo = totalPromoDiscount;
      const allCartRefs = state.cart.map(b => b.bookingRef);
      for (let i = 0; i < state.cart.length; i++) {
        const booking = state.cart[i];
        const bookingPromoDiscount = Math.min(booking.price, remainingPromo);
        remainingPromo -= bookingPromoDiscount;
        const finalPrice = Math.max(0, booking.price - bookingPromoDiscount);
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingRef: booking.bookingRef,
            user: {
              name: state.userName,
              email: state.userEmail,
              phone: state.userPhone,
              bandName: state.bandName,
              addressLine1: state.billingAddress,
              postalCode: state.billingPostalCode,
              city: state.billingCity,
            },
            studioId: booking.studioId,
            date: formatDateISO(booking.date),
            startTime: booking.startTime,
            endTime: booking.endTime,
            groupType: booking.groupType,
            equipment: booking.equipment,
            equipmentPrice: booking.equipmentPrice,
            price: finalPrice,
            paymentMethod: method,
            paymentStatus: method === "card" ? "pending" : "pay-on-site",
            promoCode: i === 0 ? promoCodeToApply : null,
            round_mode: i === 0 ? appliedPromoRef.current?.round_mode ?? null : null,
            promoDiscount: bookingPromoDiscount,
            notes: state.additionalInfo,
            cartBookingRefs: allCartRefs,
            isLastInCart: i === state.cart.length - 1,
          }),
        });
        const json = await res.json() as { success: boolean; error?: string };
        if (!json.success) throw new Error(json.error);
      }

      setState((s) => {
        if (method === "card") {
          return { ...s, paymentMethod: method, step: 4 };
        }
        const updatedCart = s.cart.map((booking) => ({
          ...booking,
          paymentMethod: "cash" as PaymentMethod,
          paymentStatus: "pay-on-site" as const,
        }));
        return { ...s, paymentMethod: method, cart: updatedCart, step: 5 };
      });
    } catch (err) {
      alert("Erreur lors de la réservation: " + err);
    } finally {
      setIsSubmitting(false);
    }
  }, [state.cart, state.promoDiscount, state.userName, state.userEmail, state.userPhone, state.bandName, state.additionalInfo, isSubmitting]);

  const processPayment = useCallback(() => {
    setState((s) => {
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "card" as PaymentMethod,
        paymentStatus: "paid" as const,
      }));
      return { ...s, cart: updatedCart, step: 5 };
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
            bookingRef: null,
            equipment: [],
            step: 3,
            isAddingNew: false,
          };
        }
        return s;
      }
      if (s.step === 1) {
        if (s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null, studioId: null };
        }
        return { ...s, step: 0, groupType: null, selectedDate: null, startTime: null, endTime: null, studioId: null };
      }

      if (s.step === 2) return { ...s, step: 3 };
      if (s.step === 3) return s;
      if (s.step === 4) return { ...s, step: 2, paymentMethod: null };
      if (s.step === 5) return { ...s, step: 4 };
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
    mergedAvailability,
    minAdvanceHours,
    minAdvanceCutoffTime,
    pricing,
    cartTotal,
    canProceedToStudio,
    canConfirmBooking,
    clientUser,
    clientUserLoading,
    setStep,
    navigateToStep,
    selectDate,
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
