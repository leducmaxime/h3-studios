"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { formatDateISO } from "@/lib/utils";
import type { PricingData } from "@/lib/pricing";
import { calculatePrice } from "@/lib/pricing";
import { usePricing } from "./usePricing";
import {
  accountFieldValues,
  BOOKING_FIELD_KEYS,
  computeAccountFieldStatus,
  getBookingFieldIssues,
  type BookingFieldIssue,
  type BookingUserFields,
} from "@/lib/booking-fields";
export { deriveDisplayName } from "@/lib/booking-fields";
import {
  BOOKING_STEPS,
  type BookingStep,
  type BookingState,
  type StudioId,
  type GroupType,
  type CompletedBooking,
  type EquipmentSelection,
  type PaymentMethod,
  type PromoCode,
  calculateEquipmentPrice,
  generateBookingRef,
  loadUserPreferences,
  saveUserPreferences,
  clearUserPreferences,
  TIME_SLOTS,
  applyMinAdvance,
} from "@/lib/booking";

// ---------------------------------------------------------------------------
// Pure helper: merge same-date cart bookings into API slot arrays.
// Returns a deep-cloned copy — does not mutate inputs.
// End-exclusive: a cart booking ending at "00:00" flips slots up to "23:30"
// but leaves the "00:00" boundary slot available.
// ---------------------------------------------------------------------------
export type SlotEntry = { time: string; available: boolean; groupType?: string; bookingId?: string };
export type SlotsByStudio = Record<string, SlotEntry[]>;

export function mergeCartIntoSlots(
  apiSlots: SlotsByStudio,
  cart: CompletedBooking[],
  selectedDate: Date | null,
): SlotsByStudio {
  if (!selectedDate || cart.length === 0) return apiSlots;

  const selectedDateStr = selectedDate.toDateString();
  const merged: SlotsByStudio = {};

  // Deep clone each studio's slot array
  for (const [studioId, slots] of Object.entries(apiSlots)) {
    merged[studioId] = slots.map((s) => ({ ...s }));
  }

  for (const booking of cart) {
    if (booking.date.toDateString() !== selectedDateStr) continue;

    const studioSlots = merged[booking.studioId];
    if (!studioSlots) continue;

    const startIdx = TIME_SLOTS.indexOf(booking.startTime);
    let endIdx = TIME_SLOTS.indexOf(booking.endTime);
    // End-exclusive: "00:00" maps to TIME_SLOTS.length (past index 30),
    // so the loop never reaches the "00:00" boundary slot.
    if (endIdx === -1 && booking.endTime === "00:00") endIdx = TIME_SLOTS.length;

    for (let i = startIdx; i < endIdx; i++) {
      const time = TIME_SLOTS[i];
      const slotIdx = studioSlots.findIndex((s) => s.time === time);
      if (slotIdx !== -1) {
        studioSlots[slotIdx] = {
          ...studioSlots[slotIdx],
          available: false,
          groupType: booking.groupType,
        };
      }
    }
  }

  return merged;
}

interface ExtendedBookingState extends BookingState {
  equipment: EquipmentSelection[];
  appliedPromo: PromoCode | null;
  promoDiscount: number;
  isAddingNew: boolean;
  duplicateError: string | null;
  createAccount: boolean;
  accountPassword: string;
  accountPasswordConfirm: string;
  accountStatus: string | null;
  /** Réduction aggregée du panier confirmée par le serveur (dernier POST). */
  confirmedPromoCode: string | null;
  confirmedPromoDiscount: number;
  confirmedNetTotal: number | null;
}

// ---------------------------------------------------------------------------
// Client profile prefill — single source of truth for mapping a logged-in
// ClientUser onto empty booking fields. Shared by the hydration fetch, the
// inline login success path and the focus re-fetch.
// ---------------------------------------------------------------------------
export interface ClientProfile {
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
}

type PrefillFields = Pick<
  ExtendedBookingState,
  "userName" | "userEmail" | "userPhone" | "bandName" | "billingAddress" | "billingPostalCode" | "billingCity"
>;

/**
 * Prefill writes only fields the account holds (`filled`). Those fields are
 * rendered read-only and never as inputs, so prefill can never clobber typed
 * input and no per-identity guard is needed. `invalid` fields are cleared only
 * when state still holds the account's own unusable value; `missing` fields
 * are never touched.
 */
export function applyProfilePrefill(fields: PrefillFields, user: ClientProfile): Partial<PrefillFields> {
  const account = accountFieldValues(user);
  const status = computeAccountFieldStatus(user);
  const next: Partial<PrefillFields> = {};
  for (const key of BOOKING_FIELD_KEYS) {
    if (status[key] === "filled") {
      next[key] = account[key];
    } else if (status[key] === "invalid" && fields[key] === account[key]) {
      next[key] = "";
    }
  }
  return next;
}

/**
 * Slug-based step flow:
 *   groupe → creneau → panier → coordonnees → paiement → termine
 *
 * Guards:
 *   - Cart lock:   cart.length > 0 && !isAddingNew → groupe/creneau → panier
 *   - creneau:     requires groupType, else → groupe
 *   - panier/coordonnees/paiement: require cart.length > 0, else → groupe
 *   - termine:     terminal (direct nav → groupe)
 */

// ---------------------------------------------------------------------------
// Storage – versioned key v2 (slugs), discard old numeric state
// ---------------------------------------------------------------------------
const BOOKING_STORAGE_KEY = "h3-studios-booking-state-v2";
const OLD_BOOKING_STORAGE_KEY = "h3-studios-booking-state";

function discardOldStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OLD_BOOKING_STORAGE_KEY);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// URL ↔ slug helpers (identity mapping — each slug is its own URL)
// ---------------------------------------------------------------------------
const LEGACY_ALIASES: Record<string, BookingStep> = {
  "paiement-choix": "paiement",
};

function resolveStepFromUrl(urlStep: string | undefined): BookingStep {
  if (!urlStep || urlStep === "reservation") return "groupe";
  if (LEGACY_ALIASES[urlStep]) return LEGACY_ALIASES[urlStep];
  if ((BOOKING_STEPS as readonly string[]).includes(urlStep)) return urlStep as BookingStep;
  return "groupe"; // unknown → groupe
}

function navigateToUrl(step: BookingStep, replace = false) {
  const url = `/reservation/${step}`;
  if (typeof window !== "undefined" && window.location.pathname !== url) {
    if (replace) {
      window.history.replaceState({}, "", url);
    } else {
      window.history.pushState({}, "", url);
    }
  }
}

// ---------------------------------------------------------------------------
// Guard logic — pure function, no side-effects
// ---------------------------------------------------------------------------
function applyStepGuards(
  cart: CompletedBooking[],
  isAddingNew: boolean,
  groupType: GroupType | null,
  targetStep: BookingStep,
): { step: BookingStep; isRedirect: boolean } {
  // Cart lock: groupe or creneau → panier
  if (cart.length > 0 && !isAddingNew && (targetStep === "groupe" || targetStep === "creneau")) {
    return { step: "panier", isRedirect: true };
  }
  // Creneau: needs groupType
  if (targetStep === "creneau" && !groupType) {
    return { step: "groupe", isRedirect: true };
  }
  // Panier, coordonnees, paiement: need cart items
  if ((targetStep === "panier" || targetStep === "coordonnees" || targetStep === "paiement") && cart.length === 0) {
    return { step: "groupe", isRedirect: true };
  }
  // Termine: terminal — redirect to groupe
  if (targetStep === "termine") {
    return { step: "groupe", isRedirect: true };
  }
  return { step: targetStep, isRedirect: false };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
interface SerializedBookingState extends Omit<ExtendedBookingState, "selectedDate" | "cart" | "accountPassword" | "accountPasswordConfirm"> {
  selectedDate: string | null;
  cart: Array<Omit<CompletedBooking, "date"> & { date: string }>;
}

function serializeState(state: ExtendedBookingState): SerializedBookingState {
  // Never persist credentials to localStorage (accountStatus is harmless and
  // survives the Stripe redirect so the confirmation banner can render).
  const { accountPassword, accountPasswordConfirm, ...persistable } = state;
  return {
    ...persistable,
    selectedDate: state.selectedDate ? state.selectedDate.toISOString() : null,
    cart: state.cart.map((booking) => ({
      ...booking,
      date: booking.date.toISOString(),
    })),
  };
}

function deserializeState(serialized: SerializedBookingState): ExtendedBookingState {
  // Defensive: drop any credential fields that a previous version may have
  // persisted — they must never round-trip through localStorage.
  const { accountPassword, accountPasswordConfirm, ...safe } = serialized as SerializedBookingState & {
    accountPassword?: string;
    accountPasswordConfirm?: string;
  };
  return {
    ...initialState,
    ...safe,
    step: (BOOKING_STEPS as readonly string[]).includes(serialized.step) ? serialized.step : ("groupe" as BookingStep),
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

// ---------------------------------------------------------------------------
// initialState
// ---------------------------------------------------------------------------
const initialState: ExtendedBookingState = {
  step: "groupe",
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
  createAccount: false,
  accountPassword: "",
  accountPasswordConfirm: "",
  accountStatus: null,
  confirmedPromoCode: null,
  confirmedPromoDiscount: 0,
  confirmedNetTotal: null,
};

/**
 * Champs d'état nettoyés à la déconnexion : données personnelles + état de
 * création de compte. Le panier, les créneaux et le groupe ne sont PAS touchés
 * (données non personnelles conservées pour reprendre la réservation).
 */
export const LOGOUT_CLEARED_FIELDS = {
  userName: "",
  userEmail: "",
  userPhone: "",
  bandName: "",
  billingAddress: "",
  billingPostalCode: "",
  billingCity: "",
  createAccount: false,
  accountPassword: "",
  accountPasswordConfirm: "",
  accountStatus: null,
} as const;

// ===========================================================================
// HOOK
// ===========================================================================
export function useBookingWithRouter(urlStep?: string) {
  const initialStep = resolveStepFromUrl(urlStep);
  const [state, setState] = useState<ExtendedBookingState>({
    ...initialState,
    // Guard the URL-derived step even for the very first render (SSR included):
    // a fresh visitor has no cart/groupType, so deep links land on groupe.
    step: applyStepGuards([], false, null, initialStep).step,
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const isInitialMount = useRef(true);
  const appliedPromoRef = useRef<PromoCode | null>(null);
  useEffect(() => {
    appliedPromoRef.current = state.appliedPromo;
  }, [state.appliedPromo]);
  const [slotsByStudio, setSlotsByStudio] = useState<Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [minAdvanceHours, setMinAdvanceHours] = useState<number>(0);
  const [minAdvanceCutoffTime, setMinAdvanceCutoffTime] = useState<string | null>(null);
  const [todayFullyBlocked, setTodayFullyBlocked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { pricing: pricingData, loading: pricingLoading, error: pricingError, refetch: refetchPricing } = usePricing();
  const [clientUser, setClientUser] = useState<ClientProfile | null>(null);
  const [clientUserLoading, setClientUserLoading] = useState(true);
  // Refs mirroring session/profile knowledge so the focus listener (registered
  // once) always reads fresh values without stale closures.
  const clientUserRef = useRef<ClientProfile | null>(null);
  const lastProfileCheckAtRef = useRef(0);
  useEffect(() => {
    clientUserRef.current = clientUser;
  }, [clientUser]);
  const isHydratedRef = useRef(false);
  useEffect(() => {
    isHydratedRef.current = isHydrated;
  }, [isHydrated]);

  const mergedSlotsByStudio = useMemo(
    () => {
      const merged = mergeCartIntoSlots(slotsByStudio, state.cart, state.selectedDate);
      // Apply min-advance gating for today: slots before cutoff are unavailable.
      // Lexicographic "00:00" < any cutoff — this intentionally marks the
      // midnight END boundary unavailable when a cutoff is active.
      const result: Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>> = {};
      for (const [studioId, slots] of Object.entries(merged)) {
        result[studioId] = applyMinAdvance(slots, minAdvanceCutoffTime, todayFullyBlocked);
      }
      return result;
    },
    [slotsByStudio, state.cart, state.selectedDate, todayFullyBlocked, minAdvanceCutoffTime],
  );

  const availabilityFetchGenRef = useRef(0);
  useEffect(() => {
    if (!state.selectedDate) return;
    const dateStr = formatDateISO(state.selectedDate);
    const gen = ++availabilityFetchGenRef.current;
    // Set synchronously on date change so TimeSlotPicker swaps to its
    // skeleton on the same pass — the previous date's slots never linger
    // and missing data never flashes as all-red slots.
    setSlotsLoading(true);
    fetch(`/api/availability?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (gen !== availabilityFetchGenRef.current) return; // stale guard
        setSlotsLoading(false);
        const json = data as { success: boolean; data: { slots: Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>>; minAdvanceHours: number; minAdvanceCutoffTime: string | null; todayFullyBlocked: boolean } };
        if (json.success && json.data) {
          setSlotsByStudio(json.data.slots);
          setMinAdvanceHours(json.data.minAdvanceHours ?? 0);
          setMinAdvanceCutoffTime(json.data.minAdvanceCutoffTime ?? null);
          setTodayFullyBlocked(json.data.todayFullyBlocked ?? false);
        }
      })
      .catch((err) => {
        // C5: clear the skeleton on error too (gen-guarded) so a failed
        // fetch never leaves an infinite skeleton. Slots keep their
        // previous defensive state — the pre-existing error behavior.
        if (gen === availabilityFetchGenRef.current) setSlotsLoading(false);
        console.error(err);
      });
  }, [state.selectedDate]);

  // -------------------------------------------------------------------------
  // Profile prefill — shared by hydration, inline login and the focus
  // re-fetch (stale-tab/session gap). Filled account values are safely re-synced
  // on every arrival; invalid and missing account fields remain editable.
  // Resolves with the profile (or null) and never rejects.
  // -------------------------------------------------------------------------
  const prefillFromClientProfile = useCallback((): Promise<ClientProfile | null> => {
    return fetch("/api/client/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          console.warn("[Booking] /api/client/me returned", res.status);
          if (res.status === 401 || res.status === 403) {
            setClientUser(null);
            clientUserRef.current = null;
          }
          return null;
        }
        return res.json() as Promise<{ data?: ClientProfile }>;
      })
      .then((json) => {
        if (json?.data) {
          const user = json.data;
          setClientUser(user);
          clientUserRef.current = user;
          setState((s) => ({ ...s, ...applyProfilePrefill(s, user) }));
          return user;
        }
        console.warn("[Booking] /api/client/me: no user data");
        return null;
      })
      .catch((err) => {
        console.error("[Booking] /api/client/me error:", err);
        return null;
      });
  }, []);

  // -------------------------------------------------------------------------
  // Focus re-fetch — closes the stale-tab/session timing gap. A booking tab
  // that mounted before a session existed retries /api/client/me when it
  // regains focus (the session may have been created in another tab). No
  // polling; never overwrites non-empty booking fields.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFocus = () => {
      if (!isHydratedRef.current) return; // let the initial hydration pass finish first
      if (Date.now() - lastProfileCheckAtRef.current < 30_000) return;
      lastProfileCheckAtRef.current = Date.now();
      prefillFromClientProfile();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [prefillFromClientProfile]);

  // -------------------------------------------------------------------------
  // Hydration effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isHydrated) return;

    // Discard old numeric-format storage — do NOT migrate
    discardOldStorage();

    const rawSavedState = loadBookingState();
    const prefs = loadUserPreferences();

    // A saved terminal state is stale (storage is cleared at termine, but be
    // defensive): discard it and fall through to the fresh-visit path so
    // prefs, guards and /api/client/me still run.
    let savedState = rawSavedState;
    if (savedState && savedState.step === "termine") {
      clearBookingState();
      savedState = null;
    }

    if (savedState) {
      const urlStepSlug = resolveStepFromUrl(urlStep);
      // Prefer URL step when present; otherwise keep saved step
      const restoredStep = urlStep ? urlStepSlug : savedState.step;

      const restoredState = {
        ...savedState,
        step: restoredStep,
      };

      if (prefs) {
        restoredState.userName = prefs.userName || restoredState.userName;
        restoredState.userEmail = prefs.userEmail || restoredState.userEmail;
        restoredState.userPhone = prefs.userPhone || restoredState.userPhone;
        restoredState.bandName = prefs.bandName || restoredState.bandName;
      }

      // Apply guards
      const { step: guardedStep, isRedirect } = applyStepGuards(
        restoredState.cart,
        restoredState.isAddingNew,
        restoredState.groupType,
        restoredState.step,
      );
      restoredState.step = guardedStep;

      setState(restoredState);

      if (isRedirect && typeof window !== "undefined") {
        window.history.replaceState({}, "", `/reservation/${guardedStep}`);
      }
    } else {
      // Fresh visit: apply guards to the URL-derived step (deep links to
      // panier/coordonnees/paiement/termine redirect to groupe) and replace
      // the URL so it never points at an unreachable step.
      const urlStepSlug = resolveStepFromUrl(urlStep);
      const { step: guardedStep, isRedirect } = applyStepGuards([], false, null, urlStepSlug);
      setState((s) => ({
        ...s,
        step: guardedStep,
        ...(prefs
          ? {
              userName: prefs.userName || "",
              userEmail: prefs.userEmail || "",
              userPhone: prefs.userPhone || "",
              bandName: prefs.bandName || "",
            }
          : {}),
      }));
      if (isRedirect && typeof window !== "undefined") {
        window.history.replaceState({}, "", `/reservation/${guardedStep}`);
      }
    }

    // Base /reservation → redirect to /reservation/groupe
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path === "/reservation" || path === "/reservation/") {
        window.history.replaceState({}, "", "/reservation/groupe");
      }
    }

    setClientUserLoading(true);
    prefillFromClientProfile().finally(() => {
      lastProfileCheckAtRef.current = Date.now();
      setClientUserLoading(false);
      setIsHydrated(true);
    });
  }, [isHydrated, urlStep, prefillFromClientProfile]);

  // -------------------------------------------------------------------------
  // Persist state to localStorage (skip for termine / initial mount)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isHydrated) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (state.step === "termine") {
      clearBookingState();
      return;
    }
    saveBookingState(state);
  }, [state, isHydrated]);

  // -------------------------------------------------------------------------
  // URL sync effect + reactive guard enforcement
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isHydrated) return;

    // "termine" is a legitimately reached terminal state (payment/cash
    // completion): never guard-redirect away from it here. External entry
    // attempts (direct load, popstate, step clicks) are guarded elsewhere.
    if (state.step === "termine") {
      navigateToUrl("termine");
      return;
    }

    const { step: guardedStep, isRedirect } = applyStepGuards(
      state.cart,
      state.isAddingNew,
      state.groupType,
      state.step,
    );

    if (guardedStep !== state.step) {
      setState((s) => ({ ...s, step: guardedStep }));
      navigateToUrl(guardedStep, true); // replaceState for guard redirects
      return;
    }

    navigateToUrl(state.step);
  }, [state.step, isHydrated, state.cart.length, state.isAddingNew, state.groupType]);

  // Scroll to top on step change
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.step]);

  // -------------------------------------------------------------------------
  // Popstate handler — apply guards with replaceState
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      const path = window.location.pathname;
      const stepMatch = path.match(/\/reservation\/?(.*)$/);
      const urlStepStr = stepMatch ? stepMatch[1] : "";
      const urlStep = resolveStepFromUrl(urlStepStr || undefined);

      setState((s) => {
        // Step "termine" is terminal: back button should reset
        if (s.step === "termine") {
          window.history.replaceState({}, "", "/reservation/groupe");
          return { ...initialState };
        }

        const { step: guardedStep, isRedirect } = applyStepGuards(
          s.cart,
          s.isAddingNew,
          s.groupType,
          urlStep,
        );

        if (isRedirect && guardedStep !== urlStep) {
          window.history.replaceState({}, "", `/reservation/${guardedStep}`);
        }

        return { ...s, step: guardedStep };
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // -------------------------------------------------------------------------
  // Transition helpers
  // -------------------------------------------------------------------------
  const setStep = useCallback((step: BookingStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const navigateToStep = useCallback((targetStep: BookingStep) => {
    setState((s) => {
      // Apply guards
      const { step: guardedStep } = applyStepGuards(
        s.cart, s.isAddingNew, s.groupType, targetStep,
      );

      // Preserve reset behavior for groupe when switching group type —
      // only apply when the guard allowed the navigation (no redirect).
      if (targetStep === "groupe" && guardedStep === targetStep && (s.groupType === "solo" || s.groupType === "duo")) {
        return {
          ...s, step: "groupe", groupType: null,
          selectedDate: null, startTime: null, endTime: null, studioId: null,
        };
      }

      return { ...s, step: guardedStep };
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

  const selectTimeRange = useCallback((startTime: string, endTime: string, studioId: StudioId) => {
    setState((s) => ({ ...s, startTime, endTime, studioId }));
  }, []);

  const clearTimeRange = useCallback(() => {
    setState((s) => ({ ...s, startTime: null, endTime: null, studioId: null }));
  }, []);

  const setGroupType = useCallback((groupType: GroupType | null) => {
    setState((s) => {
      if (groupType === "solo" || groupType === "duo" || groupType === "group") {
        return { ...s, groupType, step: "creneau", selectedDate: null, startTime: null, endTime: null, studioId: null };
      }
      return { ...s, groupType };
    });
  }, []);

  const selectStudio = useCallback((studioId: StudioId) => {
    setState((s) => ({ ...s, studioId }));
  }, []);

  const updateUserInfo = useCallback(
    (fields: Partial<ExtendedBookingState>) => {
      setState((s) => ({ ...s, ...fields }));
      // Save user preferences for relevant fields
      const prefsFields: (keyof import("@/lib/booking").UserPreferences)[] = ["userName", "userEmail", "userPhone", "bandName"];
      const prefs: Partial<import("@/lib/booking").UserPreferences> = {};
      for (const key of prefsFields) {
        if (key in fields) {
          (prefs as Record<string, unknown>)[key] = fields[key as keyof typeof fields];
        }
      }
      if (Object.keys(prefs).length > 0 && !clientUserRef.current) {
        saveUserPreferences(prefs);
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

  /** From cart page: go to coordonnées */
  const goToCoordonnees = useCallback(() => {
    setState((s) => ({ ...s, step: "coordonnees" }));
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

      // Never add a booking without a loaded pricing grid — a 0€ fallback
      // price would desync the displayed total from the server charge.
      const grid = pricingData?.grid;
      if (!grid) {
        return s;
      }
      const pricingResult = calculatePrice(grid, s.studioId, s.groupType, s.selectedDate, s.startTime, s.endTime);
      const bookingRef = generateBookingRef();

      const startIdx = TIME_SLOTS.indexOf(s.startTime);
      let endIdx = TIME_SLOTS.indexOf(s.endTime);
      if (endIdx === -1 && s.endTime === "00:00") endIdx = TIME_SLOTS.length;
      const durationHours = (endIdx - startIdx) * 0.5;
      const equipmentPrice = calculateEquipmentPrice(s.equipment, durationHours);

      const finalPrice = pricingResult.total + equipmentPrice;

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
        step: "panier",
        appliedPromo: null,
        promoDiscount: 0,
        isAddingNew: false,
        duplicateError: null,
      };
    });
    return success;
  }, [isDuplicateBooking, pricingData]);

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
      step: "groupe",
      isAddingNew: true,
    }));
  }, []);

  // -------------------------------------------------------------------------
  // Shared submitCart helper — deduplicates the booking POST loop
  // Used by goToPaymentFromCoordonnees (0€ path) and selectPaymentMethod
  //
  // paymentMethod=null  → "cash" treatment + go to termine (for 0€ total)
  // paymentMethod=cash  → POST + go to termine
  // paymentMethod=card  → POST + stay on paiement
  // -------------------------------------------------------------------------
  const submitCart = useCallback(async (paymentMethod: PaymentMethod | null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const promoCodeToApply = appliedPromoRef.current?.code ?? null;
      const totalPromoDiscount = state.promoDiscount || 0;
      let remainingPromo = totalPromoDiscount;
      const allCartRefs = state.cart.map(b => b.bookingRef);
      const method = paymentMethod || "cash";
      let accountStatus: string | null = null;
      // Réduction aggregée du panier confirmée par le serveur (dernier POST).
      let confirmedPromoCode: string | null = null;
      let confirmedPromoDiscount = 0;
      let confirmedNetTotal: number | null = null;

      for (let i = 0; i < state.cart.length; i++) {
        const booking = state.cart[i];
        const bookingPromoDiscount = Math.min(booking.price, remainingPromo);
        remainingPromo -= bookingPromoDiscount;
        const finalPrice = Math.max(0, booking.price - bookingPromoDiscount);

        // For logged-in users, force the POST email to the session email
        const userEmail = clientUser ? clientUser.email || state.userEmail : state.userEmail;

        const body: Record<string, unknown> = {
          bookingRef: booking.bookingRef,
          user: {
            name: state.userName,
            email: userEmail,
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
          // Send promoCode on the LAST request (server does cart-level recompute)
          promoCode: i === state.cart.length - 1 ? promoCodeToApply : null,
          round_mode: i === state.cart.length - 1 ? appliedPromoRef.current?.round_mode ?? null : null,
          promoDiscount: bookingPromoDiscount,
          notes: state.additionalInfo,
          cartBookingRefs: allCartRefs,
          isLastInCart: i === state.cart.length - 1,
        };

        // Account creation on first booking request only (i === 0)
        if (i === 0 && !clientUser && state.createAccount) {
          body.createAccount = true;
          body.accountPassword = state.accountPassword;
        }

        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json() as { success: boolean; data?: { accountStatus?: string; promoCode?: string | null; promoDiscount?: number; netTotal?: number }; error?: string; code?: string };
        if (!json.success) {
          if (json.code === "account-exists" && clientUser) {
            await prefillFromClientProfile();
            throw new Error("Votre session a expiré. Reconnectez-vous pour finaliser votre réservation.");
          }
          if (json.code === "booking-ref-conflict") {
            throw new Error("Ce créneau a été réservé entre-temps. Retirez-le de votre panier pour continuer.");
          }
          throw new Error(json.error || "Erreur lors de la réservation");
        }

        // Capture accountStatus from the first response
        if (i === 0 && json.data?.accountStatus) {
          accountStatus = json.data.accountStatus;
        }

        // Capture server-confirmed cart-wide promo from the LAST response
        if (i === state.cart.length - 1 && json.data) {
          confirmedPromoCode = typeof json.data.promoCode === "string" ? json.data.promoCode : null;
          confirmedPromoDiscount = Number(json.data.promoDiscount) || 0;
          confirmedNetTotal = typeof json.data.netTotal === "number" ? json.data.netTotal : null;
        }
      }

      // Persist accountStatus + server-confirmed promo in state
      setState((s) => {
        if (method === "card") {
          return {
            ...s,
            accountStatus: accountStatus || s.accountStatus,
            confirmedPromoCode,
            confirmedPromoDiscount,
            confirmedNetTotal: confirmedNetTotal ?? s.confirmedNetTotal,
            paymentMethod: method,
            step: "paiement",
          };
        }
        const updatedCart = s.cart.map((booking) => ({
          ...booking,
          paymentMethod: method as PaymentMethod,
          paymentStatus: "pay-on-site" as const,
        }));
        return {
          ...s,
          accountStatus: accountStatus || s.accountStatus,
          confirmedPromoCode,
          confirmedPromoDiscount,
          confirmedNetTotal: confirmedNetTotal ?? s.confirmedNetTotal,
          paymentMethod: method,
          cart: updatedCart,
          step: "termine",
        };
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur lors de la réservation");
    } finally {
      setIsSubmitting(false);
    }
  }, [state.cart, state.promoDiscount, state.userName, state.userEmail, state.userPhone, state.bandName, state.billingAddress, state.billingPostalCode, state.billingCity, state.additionalInfo, isSubmitting, clientUser, state.createAccount, state.accountPassword, prefillFromClientProfile]);

  /** From coordonnées: proceed to payment choice or skip if free */
  const goToPaymentFromCoordonnees = useCallback(async () => {
    const currentCart = state.cart;
    const cartTotal = currentCart.reduce((sum, b) => sum + b.price, 0);
    const totalPromoDiscount = state.promoDiscount || 0;
    const finalTotal = Math.max(0, cartTotal - totalPromoDiscount);

    if (finalTotal === 0) {
      // 100% discount → skip payment, submit with cash treatment
      await submitCart(null);
    } else {
      setState((s) => ({ ...s, step: "paiement" }));
    }
  }, [state.cart, state.promoDiscount, submitCart]);

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
      step: "panier",
      isAddingNew: false,
    }));
  }, []);

  /** Select payment method → POST bookings, then termine (cash) or stay paiement (card) */
  const selectPaymentMethod = useCallback(async (method: PaymentMethod) => {
    await submitCart(method);
  }, [submitCart]);

  /** Stripe callback: mark cart as paid, go to termine */
  const processPayment = useCallback(() => {
    setState((s) => {
      const updatedCart = s.cart.map((booking) => ({
        ...booking,
        paymentMethod: "card" as PaymentMethod,
        paymentStatus: "paid" as const,
      }));
      return { ...s, cart: updatedCart, step: "termine" };
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

  /** Login a client user in the booking flow. On success, prefill form fields from the account. */
  const clientLogin = useCallback(async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const json = await res.json() as {
        success: boolean;
        data?: ClientProfile;
        error?: string;
      };
      if (!json.success) {
        return { ok: false, error: json.error || "Erreur de connexion" };
      }
      // The login response only carries a subset of the profile — re-fetch
      // /api/client/me for the full record so address/band also prefill.
      const meRes = await fetch("/api/client/me", { credentials: "include" });
      const meJson = (await meRes.json()) as { data?: ClientProfile };
      const user = meJson?.data ?? null;
      if (!user) return { ok: false, error: "Connexion établie mais profil indisponible, réessayez" };
      setClientUser(user);
      clientUserRef.current = user;
      setState((s) => ({ ...s, ...applyProfilePrefill(s, user) }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Erreur réseau" };
    }
  }, []);

  /**
   * Déconnexion du compte client dans le parcours de réservation.
   * Appelle POST /api/client/logout, puis vide localement l'état d'auth et les
   * données de pré-remplissage du profil (nom/email/tél/groupe/adresse) pour
   * permettre une nouvelle connexion ou la création d'un autre compte.
   * Le panier et les créneaux (données non personnelles) sont conservés.
   */
  const clientLogout = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/client/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        return { ok: false, error: "La déconnexion a échoué, veuillez réessayer" };
      }
      clearUserPreferences();
      setClientUser(null);
      clientUserRef.current = null;
      setState((s) => ({ ...s, ...LOGOUT_CLEARED_FIELDS }));
      return { ok: true };
    } catch {
      return { ok: false, error: "Erreur réseau lors de la déconnexion" };
    }
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.step === "groupe") {
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
            step: "panier",
            isAddingNew: false,
          };
        }
        return s;
      }
      if (s.step === "creneau") {
        if (s.selectedDate) {
          return { ...s, selectedDate: null, startTime: null, endTime: null, studioId: null };
        }
        return { ...s, step: "groupe", groupType: null, selectedDate: null, startTime: null, endTime: null, studioId: null };
      }
      if (s.step === "coordonnees") return { ...s, step: "panier" };
      if (s.step === "panier") return s;
      if (s.step === "paiement") return { ...s, step: "coordonnees", paymentMethod: null };
      if (s.step === "termine") return { ...s, step: "paiement" };
      return s;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const pricing = useMemo(() => {
    if (!state.studioId || !state.selectedDate || !state.startTime || !state.endTime || !state.groupType) {
      return null;
    }
    const grid = pricingData?.grid;
    if (!grid) return null;

    const basePrice = calculatePrice(
      grid,
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
  }, [pricingData, state.studioId, state.groupType, state.selectedDate, state.startTime, state.endTime, state.equipment]);

  const cartTotal = useMemo(() => {
    const grid = pricingData?.grid;
    if (!grid) {
      return state.cart.reduce((sum, booking) => sum + booking.price, 0);
    }
    return state.cart.reduce((sum, booking) => {
      const timePrice = calculatePrice(
        grid,
        booking.studioId,
        booking.groupType,
        booking.date,
        booking.startTime,
        booking.endTime
      ).total;
      return sum + timePrice + (booking.equipmentPrice || 0);
    }, 0);
  }, [state.cart, pricingData]);

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  const canProceedToStudio = state.startTime !== null && state.endTime !== null;
  const bookingUserFields = useMemo<BookingUserFields>(() => ({
    userName: state.userName,
    userEmail: state.userEmail,
    userPhone: state.userPhone,
    bandName: state.bandName,
    billingAddress: state.billingAddress,
    billingPostalCode: state.billingPostalCode,
    billingCity: state.billingCity,
  }), [state.userName, state.userEmail, state.userPhone, state.bandName, state.billingAddress, state.billingPostalCode, state.billingCity]);
  const bookingFieldIssues: BookingFieldIssue[] = useMemo(
    () => getBookingFieldIssues(bookingUserFields),
    [bookingUserFields],
  );
  const canConfirmBooking = bookingFieldIssues.length === 0;

  /** Exposed for ProgressIndicator — checks if a slug step is reachable via user click */
  const canNavigateToStep = useCallback((targetStep: BookingStep): boolean => {
    if (targetStep === "paiement" || targetStep === "termine") return false;
    const { isRedirect } = applyStepGuards(
      state.cart, state.isAddingNew, state.groupType, targetStep,
    );
    return !isRedirect;
  }, [state.cart, state.isAddingNew, state.groupType]);

  return {
    state,
    slotsByStudio: mergedSlotsByStudio,
    slotsLoading,
    minAdvanceHours,
    minAdvanceCutoffTime,
    todayFullyBlocked,
    pricing,
    pricingData,
    maxAdvanceDays: pricingData?.maxAdvanceDays ?? 90,
    pricingLoading,
    pricingError,
    refetchPricing,
    cartTotal,
    canProceedToStudio,
    canConfirmBooking,
    bookingFieldIssues,
    submitError,
    clearSubmitError,
    clientUser,
    clientUserLoading,
    setStep,
    navigateToStep,
    canNavigateToStep,
    selectDate,
    selectTimeRange,
    clearTimeRange,
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
    goToPaymentFromCoordonnees,
    goToCart,
    removeFromCart,
    resetBooking,
    goBack,
    selectPaymentMethod,
    processPayment,
    clientLogin,
    clientLogout,
    createAccount: state.createAccount,
    accountPassword: state.accountPassword,
    accountPasswordConfirm: state.accountPasswordConfirm,
    accountStatus: state.accountStatus,
  };
}

export type UseBookingWithRouterReturn = ReturnType<typeof useBookingWithRouter>;
