import { formatDateISO, getParisDateISO } from "./utils";
import type { ClientType } from "./booking-fields";
import { STUDIO_LABELS } from "./labels";
import { getOfferedUnits } from "./equipment-pricing";
export { clearUserPreferences, loadUserPreferences, saveUserPreferences, type UserPreferences } from "./user-prefs";

export type StudioId = "la-scene" | "le-podium";
export type GroupType = "solo" | "duo" | "group";
export type EquipmentId = string;
export type PaymentMethod = "card" | "cash";
export type PaymentStatus = "pending" | "paid" | "pay-on-site";

export interface Studio {
  id: StudioId;
  name: string;
  size: string;
  description: string;
  features: string[];
  image: string;
  /** Canonical photo gallery — shared by /les-studios and the booking mini-cards. */
  images: { src: string; alt: string }[];
}

export interface Equipment {
  id: EquipmentId;
  name: string;
  pricePerHour: number;
  maxPerSession: number;
  pricingType: "hourly" | "session";
  sessionPricing?: number[]; // Tarifs par quantité pour tarifs par séance
}

export const EQUIPMENT: Record<EquipmentId, Equipment> = {
  cymbal: { id: "cymbal", name: "Cymbale Crash", pricePerHour: 0, maxPerSession: 2, pricingType: "session", sessionPricing: [3, 5] },
  mic: { id: "mic", name: "Micro supplémentaire", pricePerHour: 2, maxPerSession: 4, pricingType: "session", sessionPricing: [3, 5, 6, 6] }, // 4ème offert (même prix que 3)
  guitar: { id: "guitar", name: "Guitare électrique", pricePerHour: 0, maxPerSession: 3, pricingType: "session", sessionPricing: [3, 6, 9] },
  bass: { id: "bass", name: "Basse", pricePerHour: 0, maxPerSession: 1, pricingType: "session", sessionPricing: [3] },
  piano: { id: "piano", name: "Piano numérique", pricePerHour: 0, maxPerSession: 2, pricingType: "session", sessionPricing: [3, 6] },
};

export interface EquipmentSelection {
  id: EquipmentId;
  quantity: number;
}

export interface BookingEquipmentLine {
  id: string;
  quantity: number;
  name?: string;
  lineTotal?: number;
  offeredUnits?: number[];
}

export function parseBookingEquipmentLines(raw: string | null | undefined | unknown): BookingEquipmentLine[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BookingEquipmentLine[] => {
    if (!item || typeof item !== "object") return [];
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string" || !v.id.trim()) return [];
    const quantity = Number(v.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return [];
    const line: BookingEquipmentLine = { id: v.id, quantity };
    if (typeof v.name === "string" && v.name.trim()) line.name = v.name;
    const total = v.lineTotal !== undefined ? v.lineTotal : v.price;
    if (typeof total === "number" && Number.isFinite(total)) line.lineTotal = total;
    if (Array.isArray(v.offeredUnits) && v.offeredUnits.every((unit) => typeof unit === "number" && Number.isFinite(unit))) {
      line.offeredUnits = v.offeredUnits;
    }
    return [line];
  });
}

function timeToMinutes(time: string): number {
  if (time === "00:00") return 24 * 60;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Whether two half-open time ranges overlap (midnight is treated as 24:00). */
export function timeRangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  const aStartMinutes = timeToMinutes(aStart);
  const aEndMinutes = timeToMinutes(aEnd);
  const bStartMinutes = timeToMinutes(bStart);
  const bEndMinutes = timeToMinutes(bEnd);
  return aStartMinutes < bEndMinutes && aEndMinutes > bStartMinutes;
}

export function computeEquipmentAvailability(input: {
  stockTotal: number;
  equipmentId: string;
  requested: { startTime: string; endTime: string };
  requestedStudioId?: string;
  bookings: Array<{
    startTime: string;
    endTime: string;
    status: string;
    studioId?: string;
    equipment: unknown;
  }>;
  cartItems?: Array<{
    startTime: string;
    endTime: string;
    equipment: unknown;
  }>;
}): {
  reserved: number;
  available: number;
  reservedFromBookings: number;
  reservedFromCart: number;
  reservedOnOtherStudio: number;
} {
  const stockTotal = Number.isFinite(input.stockTotal) && input.stockTotal > 0
    ? input.stockTotal
    : 0;
  const overlapsRequested = (startTime: string, endTime: string) =>
    timeRangesOverlap(startTime, endTime, input.requested.startTime, input.requested.endTime);
  const quantityForEquipment = (equipment: unknown) =>
    parseBookingEquipmentLines(equipment)
      .filter((line) => line.id === input.equipmentId)
      .reduce((sum, line) => sum + line.quantity, 0);

  let reservedFromBookings = 0;
  let reservedOnOtherStudio = 0;
  for (const booking of input.bookings) {
    if (booking.status !== "confirmed" && booking.status !== "completed") continue;
    if (!overlapsRequested(booking.startTime, booking.endTime)) continue;
    const qty = quantityForEquipment(booking.equipment);
    reservedFromBookings += qty;
    if (input.requestedStudioId && booking.studioId && booking.studioId !== input.requestedStudioId) {
      reservedOnOtherStudio += qty;
    }
  }
  const reservedFromCart = (input.cartItems ?? []).reduce((sum, item) => {
    if (!overlapsRequested(item.startTime, item.endTime)) return sum;
    return sum + quantityForEquipment(item.equipment);
  }, 0);
  const reserved = reservedFromBookings + reservedFromCart;
  return {
    reserved,
    available: Math.max(0, stockTotal - reserved),
    reservedFromBookings,
    reservedFromCart,
    reservedOnOtherStudio,
  };
}

export function equipmentLinesTotal(lines: BookingEquipmentLine[]): number | null {
  if (lines.some((line) => typeof line.lineTotal !== "number" || !Number.isFinite(line.lineTotal))) return null;
  return lines.reduce((sum, line) => sum + line.lineTotal!, 0);
}

export type EquipmentNameLookup = (id: string) => string | undefined;
export function resolveEquipmentDisplay(raw: string | null | undefined | unknown, equipmentPrice: number, nameFor?: EquipmentNameLookup): {
  lines: Array<{ id: string; quantity: number; name: string; lineTotal?: number }>;
  showLinePrices: boolean;
  subtotal: number;
} {
  const parsed = parseBookingEquipmentLines(raw);
  const lines = parsed.map(line => ({ ...line, name: line.name || nameFor?.(line.id) || line.id }));
  const subtotal = Number(equipmentPrice) || 0;
  const sum = equipmentLinesTotal(parsed);
  return { lines, showLinePrices: sum !== null && Math.abs(sum - subtotal) <= 0.005, subtotal };
}

export interface CompletedBooking {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  studioId: StudioId;
  groupType: GroupType;
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  bookingRef: string;
  price: number;
  equipment: EquipmentSelection[];
  equipmentPrice: number;
  promoCode: string | null;
  round_mode: "down" | "up" | "none" | null;
  promoDiscount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}
/**
 * Sort booking cart items chronologically by date ascending, then startTime ascending.
 * Returns a NEW array — does not mutate the input.
 */
export function sortBookingsByStart<T extends { date: Date; startTime: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

// --- Promo codes ---
export interface PromoCode {
  code: string;
  type: "percentage" | "fixed";
  value: number; // % or EUR
  description: string;
  minTotal?: number; // Montant minimum pour appliquer
  round_mode?: "down" | "up" | "none";
}
const PROMO_CODES: PromoCode[] = [
  { code: "BIENVENUE", type: "percentage", value: 10, description: "10% de réduction" },
  { code: "H3AMIS", type: "fixed", value: 5, description: "5€ de réduction", minTotal: 15 },
  { code: "ROCK2026", type: "percentage", value: 15, description: "15% de réduction" },
];

export function validatePromoCode(code: string, total: number): { valid: boolean; promo?: PromoCode; error?: string } {
  const normalized = code.trim().toUpperCase();
  const promo = PROMO_CODES.find((p) => p.code === normalized);
  if (!promo) return { valid: false, error: "Code promo invalide" };
  if (promo.minTotal && total < promo.minTotal) {
    return { valid: false, error: `Montant minimum de ${promo.minTotal}€ requis` };
  }
  return { valid: true, promo };
}

export function calculatePromoDiscount(promo: PromoCode, total: number): number {
  if (promo.type === "percentage") {
    return total * promo.value / 100;
  }
  return Math.min(promo.value, total);
}

// Slug-based step model for the booking wizard
export const BOOKING_STEPS = ["groupe","creneau","panier","coordonnees","paiement","termine"] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

/** Compare steps by order in the canonical flow */
export function stepIndex(step: BookingStep): number {
  return BOOKING_STEPS.indexOf(step);
}

export interface BookingState {
  step: BookingStep;
  selectedDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  studioId: StudioId | null;
  groupType: GroupType | null;
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  clientType: ClientType;
  legalName: string;
  siret: string;
  rna: string;
  instagramAccounts: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  additionalInfo: string;
  bookingRef: string | null;
  cart: CompletedBooking[];
  paymentMethod: PaymentMethod | null;
}

export const STUDIOS: Record<StudioId, Studio> = {
  "la-scene": {
    id: "la-scene",
    name: STUDIO_LABELS["la-scene"],
    size: "42m²",
    description: "Avec une hauteur de 3,50m et une superficie de 42m², notre studio propose une scène intimiste avec sa rampe d'éclairage. Convenant à tous styles musicaux, ce lieu chaleureux et fonctionnel saura répondre à vos besoins.",
    features: ["Scène", "Éclairage", "Écran géant", "Vidéoprojecteur"],
    image: "/images/studios/scene-1.webp",
    images: [
      { src: "/images/studios/scene-2.webp", alt: "Studio La Scène - scène avec éclairage professionnel, 42m²" },
      { src: "/images/studios/scene-5.webp", alt: "Studio La Scène H3 Studios - vue d'ensemble de la salle" },
      { src: "/images/studios/scene-3.webp", alt: "Studio La Scène - équipement batterie et amplis" },
      { src: "/images/studios/scene-1.webp", alt: "Studio La Scène Sucy-en-Brie - espace de répétition groupe" },
      { src: "/images/studios/scene-4.webp", alt: "Studio La Scène - sono et matériel professionnel inclus" },
    ],
  },
  "le-podium": {
    id: "le-podium",
    name: STUDIO_LABELS["le-podium"],
    size: "35m²",
    description: "Conçu pour la répétition, cet espace de 35m² offre un cadre simple et fonctionnel, idéal pour vos sessions musicales, en groupe ou en solo. Cette salle est également adapté aux enseignants souhaitant donner des cours à un ou plusieurs élèves.",
    features: ["Compact", "Fonctionnel", "Cours"],
    image: "/images/studios/podium-1.webp",
    images: [
      { src: "/images/studios/podium-2.webp", alt: "Studio Le Podium - salle de répétition 35m², H3 Studios" },
      { src: "/images/studios/podium-1.webp", alt: "Studio Le Podium Sucy-en-Brie - vue d'ensemble" },
      { src: "/images/studios/podium-3.webp", alt: "Studio Le Podium - équipement batterie et amplis inclus" },
      { src: "/images/studios/podium-4.webp", alt: "Studio Le Podium - espace idéal répétitions et cours" },
    ],
  },
};

// All possible 30-min slots across all studios (superset)
export const ALL_TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00",
];

// Per-studio, per-day opening hours
// Day index: 0 = Sunday, 1 = Monday, ... 6 = Saturday
interface StudioHours {
  open: string;
  close: string; // "00:00" means midnight (end of day)
}

export const STUDIO_HOURS: Record<StudioId, Record<number, StudioHours>> = {
  "le-podium": {
    0: { open: "10:00", close: "22:30" }, // Dimanche
    1: { open: "18:00", close: "22:30" }, // Lundi
    2: { open: "10:00", close: "22:30" }, // Mardi
    3: { open: "10:00", close: "22:30" }, // Mercredi
    4: { open: "10:00", close: "22:30" }, // Jeudi
    5: { open: "10:00", close: "22:30" }, // Vendredi
    6: { open: "10:00", close: "22:30" }, // Samedi
  },
  "la-scene": {
    0: { open: "10:00", close: "00:00" }, // Dimanche
    1: { open: "18:00", close: "00:00" }, // Lundi
    2: { open: "10:00", close: "00:00" }, // Mardi
    3: { open: "10:00", close: "00:00" }, // Mercredi
    4: { open: "10:00", close: "00:00" }, // Jeudi
    5: { open: "10:00", close: "00:00" }, // Vendredi
    6: { open: "10:00", close: "00:00" }, // Samedi
  },
};

// DB-driven opening hours: the public booking flow reads this store, which
// mirrors STUDIO_HOURS until setOpeningHours() is called with the DB values
// (client: after /api/pricing loads; worker: per request). This keeps
// getStudioTimeSlots synchronous while making admin opening-hours edits
// effective publicly.
let _openingHours: Record<StudioId, Record<number, StudioHours>> = STUDIO_HOURS;

export function setOpeningHours(hours: Record<string, Record<number, StudioHours>>): void {
  if (hours && typeof hours === "object") {
    _openingHours = { ...STUDIO_HOURS, ...hours } as Record<StudioId, Record<number, StudioHours>>;
  }
}

export function getOpeningHoursForStudio(studioId: StudioId): Record<number, StudioHours> {
  return _openingHours[studioId] || STUDIO_HOURS[studioId];
}

/** Get the closing time for a studio on a given date */
export function getStudioClosingTime(studioId: StudioId, date: Date): string {
  const dayOfWeek = date.getDay();
  return getOpeningHoursForStudio(studioId)[dayOfWeek].close;
}

/** Get bookable time slots for a specific studio on a given date */
export function getStudioTimeSlots(studioId: StudioId, date: Date): string[] {
  const dayOfWeek = date.getDay();
  const hours = getOpeningHoursForStudio(studioId)[dayOfWeek];
  const openIdx = ALL_TIME_SLOTS.indexOf(hours.open);
  const closeIdx = ALL_TIME_SLOTS.indexOf(hours.close);
  if (openIdx === -1 || closeIdx === -1) return [];
  return ALL_TIME_SLOTS.slice(openIdx, closeIdx + 1);
}

/** Get the union of time slots across all studios for a given date (used when no studio is selected yet) */
export function getUnionTimeSlots(date: Date): string[] {
  const slotsScene = getStudioTimeSlots("la-scene", date);
  const slotsPodium = getStudioTimeSlots("le-podium", date);
  const allSlots = new Set([...slotsScene, ...slotsPodium]);
  return ALL_TIME_SLOTS.filter((s) => allSlots.has(s));
}

// Legacy alias — kept for backward compatibility in admin pages
export const TIME_SLOTS = ALL_TIME_SLOTS;

// Legacy alias — max possible closing time
export const CLOSING_TIME = "00:00";

export const SLOT_DURATION_MINUTES = 30;
export const MIN_BOOKING_SLOTS = 2;

/**
 * Returns true when at least `minSlots` consecutive bookable slots exist.
 * The closing-boundary slot (last entry of getStudioTimeSlots, e.g. "00:00"
 * for la-scene / "22:30" for le-podium) is an end-only marker and never
 * counts as a bookable half-hour — without this exclusion a day with only
 * 30min left before closing would be wrongly shown as bookable.
 * Slots before `minAdvanceCutoffTime` (today only) count as unavailable.
 */
export function hasBookableRun(
  slots: string[],
  isAvailable: (time: string) => boolean,
  minSlots: number = MIN_BOOKING_SLOTS,
  minAdvanceCutoffTime?: string | null,
): boolean {
  let consecutive = 0;
  for (const time of slots.slice(0, -1)) {
    if (minAdvanceCutoffTime && time < minAdvanceCutoffTime) {
      consecutive = 0;
      continue;
    }
    consecutive = isAvailable(time) ? consecutive + 1 : 0;
    if (consecutive >= minSlots) return true;
  }
  return false;
}

/** Nombre de créneaux entre deux heures (demi-heures), avec gestion de "00:00" = fin de journée */
export function slotDurationSlots(startTime: string, endTime: string): number {
  const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00" && endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
  if (startIdx === -1 || endIdx === -1) return 0;
  return endIdx - startIdx;
}

/** Durée en heures entre deux créneaux horaires */
export function slotDurationHours(startTime: string, endTime: string): number {
  return slotDurationSlots(startTime, endTime) * 0.5;
}

// Detailed occupancy information
export interface OccupancyInfo {
  studioId: StudioId;
  time: string;
  groupType?: GroupType | "blocked";
  bookingId?: string;
}

// Legacy compatibility: convert old format string to OccupancyInfo
export function parseOccupancy(occupancy: Set<string | OccupancyInfo>): Set<OccupancyInfo> {
  const result = new Set<OccupancyInfo>();
  for (const item of occupancy) {
    if (typeof item === "string") {
      // Legacy format: "studioId-time"
      const [studioId, time] = item.split("-");
      if (studioId && time) {
        result.add({ studioId: studioId as StudioId, time, groupType: "blocked" });
      }
    } else {
      result.add(item);
    }
  }
  return result;
}

// =============================================================================
// UNIFIED AVAILABILITY ENGINE
// Single source of truth for slot/range availability across all components.
// =============================================================================

export interface SlotDetails {
  studioId: StudioId;
  time: string;
  isOpen: boolean;
  occupant: OccupancyInfo | null;
}

/**
 * Get per-studio details for a single time slot.
 */
export function getSlotDetails(
  time: string,
  occupancy: Set<OccupancyInfo>,
  date: Date
): SlotDetails[] {
  return (["la-scene", "le-podium"] as StudioId[]).map((studioId) => {
    const isOpen = getStudioTimeSlots(studioId, date).includes(time);
    const occupant =
      Array.from(occupancy).find(
        (o) => o.studioId === studioId && o.time === time
      ) || null;
    return { studioId, time, isOpen, occupant };
  });
}

/**
 * Get the list of studios that can accommodate a specific slot.
 * A studio is available if it is open and not occupied.
 */
export function getAvailableStudiosForSlot(
  time: string,
  occupancy: Set<OccupancyInfo>,
  date: Date
): StudioId[] {
  const details = getSlotDetails(time, occupancy, date);
  const available: StudioId[] = [];

  for (const studio of details) {
    if (!studio.isOpen) continue;
    if (!studio.occupant) {
      available.push(studio.studioId);
    }
  }

  return available;
}

/**
 * Unified per-slot availability check.
 */
export function isSlotAvailable(
  time: string,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): boolean {
  const availableStudios = getAvailableStudiosForSlot(
    time,
    occupancy,
    date
  );
  if (studioFilter) {
    return availableStudios.includes(studioFilter);
  }
  return availableStudios.length > 0;
}

/**
 * Inverse of isSlotAvailable — for display (red = booked).
 */
export function isSlotBooked(
  time: string,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): boolean {
  return !isSlotAvailable(time, occupancy, date, studioFilter);
}

/**
 * Check if a time range can be booked in a single studio.
 * Returns the studioId if bookable, or {bookable:false} if not.
 * This is the SINGLE SOURCE OF TRUTH for range validity.
 */
export function isRangeBookable(
  startTime: string,
  endTime: string,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): { bookable: boolean; studioId?: StudioId } {
  const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIdx = ALL_TIME_SLOTS.indexOf("00:00");

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { bookable: false };
  }

  const studiosToCheck = studioFilter
    ? [studioFilter]
    : (["la-scene", "le-podium"] as StudioId[]);

  for (const studioId of studiosToCheck) {
    let studioCanBook = true;
    for (let i = startIdx; i < endIdx; i++) {
      const time = ALL_TIME_SLOTS[i];
      const availableStudios = getAvailableStudiosForSlot(
        time,
        occupancy,
        date
      );
      if (!availableStudios.includes(studioId)) {
        studioCanBook = false;
        break;
      }
    }
    if (studioCanBook) {
      return { bookable: true, studioId };
    }
  }

  return { bookable: false };
}

// =============================================================================
// LEGACY / RANGE-LEVEL AVAILABILITY (kept for backward compatibility)
// =============================================================================

/**
 * Check if a slot can be a valid start time.
 * A slot can start if it's not occupied and there are at least
 * MIN_BOOKING_SLOTS (2) available slots from it onward (including itself).
 */
export function canBeStartTime(
  slot: string,
  visibleSlots: string[],
  isSlotOccupied: (slot: string) => boolean
): boolean {
  const slotIdx = visibleSlots.indexOf(slot);
  if (slotIdx === -1) return false;
  if (isSlotOccupied(slot)) return false;

  // Exclude the closing-boundary slot (last entry, e.g. "00:00" / "22:30")
  // from the runway count — it is an end-only marker and does not represent
  // a bookable half-hour. Mirror hasBookableRun exclusion.
  const effectiveSlots = visibleSlots.slice(0, -1);

  let freeCount = 0;
  for (let i = slotIdx; i < effectiveSlots.length; i++) {
    if (isSlotOccupied(effectiveSlots[i])) break;
    freeCount++;
  }

  return freeCount >= MIN_BOOKING_SLOTS;
}

/**
 * Check if endSlot is a valid end time for startSlot.
 * The end slot must come after start, with at least MIN_BOOKING_SLOTS (2) total.
 * All slots strictly between start and end must be free.
 * The end slot itself CAN be occupied (boundary booking).
 * Respects "00:00" as the last possible end time.
 */
export function canBeEndTime(
  startSlot: string,
  endSlot: string,
  visibleSlots: string[],
  isSlotOccupied: (slot: string) => boolean
): boolean {
  const startIdx = visibleSlots.indexOf(startSlot);
  let endIdx = visibleSlots.indexOf(endSlot);

  // "00:00" may not be in visibleSlots but is a valid end time (after last slot)
  if (endSlot === "00:00" && endIdx === -1) {
    endIdx = visibleSlots.length;
  }

  if (startIdx === -1 || endIdx === -1) return false;
  if (endIdx <= startIdx) return false;

  const duration = endIdx - startIdx;
  if (duration < MIN_BOOKING_SLOTS) return false;

  // All slots between start and end (exclusive of start, up to but not including end) must be free
  for (let i = startIdx + 1; i < endIdx; i++) {
    if (i < visibleSlots.length && isSlotOccupied(visibleSlots[i])) return false;
  }

  return true;
}

let _publicHolidays: Set<string> = new Set();
let _peakStartHour = 18;

export function setPublicHolidays(dates: string[]): void {
  _publicHolidays = new Set(dates);
}

export function setPeakStartHour(hour: number): void {
  _peakStartHour = hour;
}

export function getPeakStartHour(): number {
  return _peakStartHour;
}

function dateToParisISO(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).split("/").reverse().join("-");
}

export function isPeakTime(date: Date, time: string): boolean {
  const hour = parseInt(time.split(":")[0], 10);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = _publicHolidays.has(dateToParisISO(date));
  if (hour === 0) return true;
  return hour >= _peakStartHour || isWeekend || isHoliday;
}

export function formatDuration(startTime: string, endTime: string): string {
  const startIndex = ALL_TIME_SLOTS.indexOf(startTime);
  let endIndex = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIndex = ALL_TIME_SLOTS.indexOf("00:00");

  if (startIndex === -1 || endIndex === -1) return "";

  const slots = endIndex - startIndex;
  const totalMinutes = slots * SLOT_DURATION_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

export function formatDate(date: Date, format: "short" | "long" = "long"): string {
  const options: Intl.DateTimeFormatOptions = format === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { weekday: "short", day: "numeric", month: "short" };
  
  return date.toLocaleDateString("fr-FR", options);
}

export function formatPrice(amount: number): string {
  return amount % 1 === 0 ? `${amount}€` : `${amount.toFixed(2).replace(".", ",")}€`;
}

export function generateBookingRef(): string {
  const datePart = getParisDateISO().replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `H3-${datePart}-${randomPart}`;
}

export const DEFAULT_MIN_ADVANCE_HOURS = 2;

/**
 * Compute the minimum-advance cutoff using Paris wall-clock arithmetic on a
 * single calendar day. This is deliberately today-only; callers must decide
 * whether the requested date is today before applying the result.
 */
export function computeMinAdvance(
  now: { hours: number; minutes: number },
  minAdvanceHours: number,
): { cutoffTime: string | null; fullyBlocked: boolean } {
  if (
    !Number.isFinite(now.hours) || now.hours < 0 || now.hours > 23 ||
    !Number.isFinite(now.minutes) || now.minutes < 0 || now.minutes > 59
  ) {
    return { cutoffTime: null, fullyBlocked: true };
  }
  const hours = now.hours;
  const minutes = now.minutes;
  const advance = Number.isFinite(minAdvanceHours) && minAdvanceHours >= 0
    ? minAdvanceHours
    : DEFAULT_MIN_ADVANCE_HOURS;
  const cutoffMinutes = hours * 60 + minutes + advance * 60;
  if (cutoffMinutes >= 24 * 60) {
    return { cutoffTime: null, fullyBlocked: true };
  }
  const cutoffH = Math.floor(cutoffMinutes / 60);
  const cutoffM = cutoffMinutes % 60;
  return {
    cutoffTime: `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`,
    fullyBlocked: false,
  };
}

/** Parse the stored setting, falling back when it is not a finite non-negative number. */
export function parseMinAdvanceHours(
  rawValue: string | null | undefined,
  defaultValue = DEFAULT_MIN_ADVANCE_HOURS,
): number {
  const parsed = Number.parseInt(rawValue || String(defaultValue), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

/** Return whether a same-day start time violates the minimum-advance cutoff. */
export function isMinAdvanceViolation(
  startTime: string,
  cutoffTime: string | null,
  fullyBlocked: boolean,
): boolean {
  if (fullyBlocked) return true;
  if (cutoffTime === null) return false;
  if (!/^\d{2}:\d{2}$/.test(startTime)) return true;
  const [hours, minutes] = startTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    return true;
  }
  const startMinutes = hours * 60 + minutes;
  const [cutoffHours, cutoffMinutes] = cutoffTime.split(":").map(Number);
  return startMinutes < cutoffHours * 60 + cutoffMinutes;
}

/**
 * Apply min-advance gating to an array of slot entries.
 * Slots before the cutoff are marked unavailable.
 * When fullyBlocked is true, every slot is marked unavailable.
 * Lexicographic "00:00" < any cutoff — this intentionally marks the
 * midnight END boundary unavailable when a cutoff is active.
 */
export function applyMinAdvance(
  slots: Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>,
  cutoff: string | null,
  fullyBlocked: boolean,
): Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }> {
  if (!cutoff && !fullyBlocked) return slots;
  return slots.map((s) => {
    if (fullyBlocked) {
      return { ...s, available: false, groupType: s.groupType ?? "blocked" };
    }
    if (cutoff && s.time < cutoff) {
      return { ...s, available: false, groupType: s.groupType ?? "blocked" };
    }
    return s;
  });
}

export function getAvailableRanges(
  availability: Set<string>,
  date: Date,
  studioFilter?: StudioId | null
): string[] {
  const ranges: string[] = [];
  let rangeStart: string | null = null;

  // Use studio-specific slots if filtering by studio, otherwise union
  const slots = studioFilter
    ? getStudioTimeSlots(studioFilter, date)
    : getUnionTimeSlots(date);

  const isSlotAvailable = (time: string) => {
    if (studioFilter) {
      return !availability.has(`${studioFilter}-${time}`);
    }
    return (
      !availability.has(`la-scene-${time}`) ||
      !availability.has(`le-podium-${time}`)
    );
  };

  for (let i = 0; i < slots.length; i++) {
    const time = slots[i];
    const available = isSlotAvailable(time);

    if (available && rangeStart === null) {
      rangeStart = time;
    } else if (!available && rangeStart !== null) {
      ranges.push(formatTimeRange(rangeStart, slots[i]));
      rangeStart = null;
    }
  }

  if (rangeStart !== null) {
    // Close range at studio closing time
    const lastSlot = slots[slots.length - 1];
    const lastSlotIdx = ALL_TIME_SLOTS.indexOf(lastSlot);
    const closingSlot = lastSlotIdx + 1 < ALL_TIME_SLOTS.length
      ? ALL_TIME_SLOTS[lastSlotIdx + 1]
      : "00:00";
    ranges.push(formatTimeRange(rangeStart, closingSlot));
  }

  return ranges;
}

function formatTimeRange(start: string, end: string): string {
  const formatHour = (t: string) => {
    const h = parseInt(t.split(":")[0], 10);
    return `${h}h`;
  };
  return `${formatHour(start)}-${formatHour(end)}`;
}

export function generateICS(
  date: Date,
  startTime: string,
  endTime: string,
  studioName: string,
  bookingRef: string
): string {
  const formatICSDate = (d: Date, time: string): string => {
    const dateStr = getParisDateISO(d).replace(/-/g, "");
    const timeStr = time.replace(":", "") + "00";
    return `${dateStr}T${timeStr}`;
  };

  const dtStart = formatICSDate(date, startTime);
  const dtEnd = formatICSDate(date, endTime);
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//H3 Studios//Reservation//FR
BEGIN:VEVENT
UID:${bookingRef}@h3-studios.fr
DTSTAMP:${now}
DTSTART;TZID=Europe/Paris:${dtStart}
DTEND;TZID=Europe/Paris:${dtEnd}
SUMMARY:Répétition - ${studioName}
DESCRIPTION:Réservation ${bookingRef} chez H3 Studios
LOCATION:3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie
END:VEVENT
END:VCALENDAR`;
}

export function downloadICS(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Calendar URL generators
export function generateGoogleCalendarUrl(
  date: Date,
  startTime: string,
  endTime: string,
  studioName: string,
  bookingRef: string
): string {
  const formatGoogleDate = (d: Date, time: string): string => {
    const dateStr = getParisDateISO(d).replace(/-/g, "");
    const timeStr = time.replace(":", "") + "00";
    return `${dateStr}T${timeStr}`;
  };

  const start = formatGoogleDate(date, startTime);
  const end = formatGoogleDate(date, endTime);
  const title = encodeURIComponent(`Répétition - ${studioName}`);
  const details = encodeURIComponent(`Réservation ${bookingRef} chez H3 Studios`);
  const location = encodeURIComponent("3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}

export function generateOutlookCalendarUrl(
  date: Date,
  startTime: string,
  endTime: string,
  studioName: string,
  bookingRef: string
): string {
  const formatOutlookDate = (d: Date, time: string): string => {
    const [hours, minutes] = time.split(":").map(Number);
    const dt = new Date(d);
    dt.setHours(hours, minutes, 0, 0);
    return dt.toISOString();
  };

  const start = formatOutlookDate(date, startTime);
  const end = formatOutlookDate(date, endTime);
  const title = encodeURIComponent(`Répétition - ${studioName}`);
  const details = encodeURIComponent(`Réservation ${bookingRef} chez H3 Studios`);
  const location = encodeURIComponent("3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie");

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start}&enddt=${end}&body=${details}&location=${location}`;
}

// Alternative slot suggestions
export interface AlternativeSlot {
  date: Date;
  startTime: string;
  endTime: string;
  studioId: StudioId;
  reason: "same-day" | "same-time-other-studio" | "nearby-day";
}

export function findAlternativeSlots(
  requestedDate: Date,
  requestedStart: string,
  requestedEnd: string,
  unavailableStudio: StudioId | null,
  availability: Set<string>
): AlternativeSlot[] {
  const alternatives: AlternativeSlot[] = [];
  const allSlots = getUnionTimeSlots(requestedDate);
  const startIdx = allSlots.indexOf(requestedStart);
  const endIdx = allSlots.indexOf(requestedEnd);
  const duration = endIdx - startIdx;

  // 1. Try other studio same time
  const otherStudio: StudioId = unavailableStudio === "la-scene" ? "le-podium" : "la-scene";
  const otherStudioSlots = getStudioTimeSlots(otherStudio, requestedDate);
  let otherStudioAvailable = true;
  for (let i = startIdx; i < endIdx; i++) {
    const time = allSlots[i];
    if (!otherStudioSlots.includes(time) || availability.has(`${otherStudio}-${time}`)) {
      otherStudioAvailable = false;
      break;
    }
  }
  if (otherStudioAvailable && unavailableStudio) {
    alternatives.push({
      date: requestedDate,
      startTime: requestedStart,
      endTime: requestedEnd,
      studioId: otherStudio,
      reason: "same-time-other-studio",
    });
  }

  // 2. Try nearby times same day (2h before/after)
  const studios: StudioId[] = ["la-scene", "le-podium"];
  for (const studio of studios) {
    const studioSlots = getStudioTimeSlots(studio, requestedDate);
    for (let offset = -4; offset <= 4; offset++) {
      if (offset === 0) continue;
      const newStartIdx = startIdx + offset;
      const newEndIdx = newStartIdx + duration;
      if (newStartIdx < 0 || newEndIdx > allSlots.length) continue;

      let slotAvailable = true;
      for (let i = newStartIdx; i < newEndIdx; i++) {
        const time = allSlots[i];
        if (!studioSlots.includes(time) || availability.has(`${studio}-${time}`)) {
          slotAvailable = false;
          break;
        }
      }
      if (slotAvailable) {
        alternatives.push({
          date: requestedDate,
          startTime: allSlots[newStartIdx],
          endTime: allSlots[newEndIdx],
          studioId: studio,
          reason: "same-day",
        });
        if (alternatives.length >= 5) break;
      }
    }
    if (alternatives.length >= 5) break;
  }

  return alternatives.slice(0, 5);
}

// Equipment price calculation
export function calculateEquipmentPrice(
  equipment: EquipmentSelection[],
  durationHours: number,
  equipmentList?: { id: string; pricingType: string; sessionPricing: number[] | null; pricePerHour: number }[]
): number {
  return equipment.reduce((total, item) => {
    // Try to find in provided list first, fallback to hardcoded EQUIPMENT
    const eq = equipmentList?.find(e => e.id === item.id) || EQUIPMENT[item.id];
    if (!eq) return total;
    if (eq.pricingType === "session" && eq.sessionPricing) {
      // Tarif par séance : utiliser le tableau de tarifs
      const price = eq.sessionPricing[item.quantity - 1] || 0;
      return total + price;
    } else {
      // Tarif horaire standard
      return total + eq.pricePerHour * item.quantity * durationHours;
    }
  }, 0);
}

// ─── Server-authoritative quote (shared by public + admin creation) ─────────
// Single source of truth for price computation on creation. Pure function:
// takes DB rates + settings (peak_start_hour, public_holidays) as inputs, so
// admin creation and the public booking flow cannot diverge on the peak
// threshold or holidays. Reschedules never pass through here — they keep the
// historical price stored on the row.

export interface QuoteEquipmentItem {
  id: string;
  quantity: number;
}

export interface QuoteEquipmentCatalogueItem {
  id: string;
  name: string;
  pricingType: string; // "session" | "hourly"
  sessionPricing: number[] | null;
  pricePerHour: number;
}

export interface BookingQuoteInput {
  studioId: StudioId;
  groupType: GroupType;
  date: string; // ISO yyyy-mm-dd
  startTime: string;
  endTime: string;
  equipment?: QuoteEquipmentItem[];
  peakStartHour: number;
  publicHolidays: string[];
  peakRatePerHalfHour: number; // € / half-hour (already /100)
  offPeakRatePerHalfHour: number; // € / half-hour
  equipmentCatalogue?: QuoteEquipmentCatalogueItem[];
}

export interface BookingQuote {
  basePrice: number;
  equipmentPrice: number;
  totalPrice: number;
  durationHours: number;
  halfHours: number;
  slotBreakdown: Array<{ time: string; isPeak: boolean }>;
  equipmentLines: Array<{ id: string; name: string; quantity: number; lineTotal: number; offeredUnits?: number[] }>;
}

export function computeBookingQuote(input: BookingQuoteInput): BookingQuote {
  const halfHours = slotDurationSlots(input.startTime, input.endTime);
  const durationHours = halfHours * 0.5;

  const startIdx = ALL_TIME_SLOTS.indexOf(input.startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(input.endTime);
  if (input.endTime === "00:00" && endIdx === -1) endIdx = ALL_TIME_SLOTS.length;
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { basePrice: 0, equipmentPrice: 0, totalPrice: 0, durationHours: 0, halfHours: 0, slotBreakdown: [], equipmentLines: [] };
  }

  const dayOfWeek = new Date(input.date + "T00:00:00").getDay();
  const isHoliday = input.publicHolidays.includes(input.date);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let basePrice = 0;
  const slotBreakdown: BookingQuote["slotBreakdown"] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const slot = ALL_TIME_SLOTS[i];
    const hour = parseInt(slot.split(":")[0], 10);
    const isPeak = hour >= input.peakStartHour || isWeekend || isHoliday;
    basePrice += isPeak ? input.peakRatePerHalfHour : input.offPeakRatePerHalfHour;
    slotBreakdown.push({ time: slot, isPeak });
  }

  let equipmentPrice = 0;
  const equipmentLines: BookingQuote["equipmentLines"] = [];
  for (const eq of input.equipment ?? []) {
    const eqData = input.equipmentCatalogue?.find((e) => e.id === eq.id);
    if (eqData && eq.quantity > 0) {
      if (eqData.pricingType === "session" && eqData.sessionPricing) {
        const lineTotal = eqData.sessionPricing[eq.quantity - 1] || 0;
        equipmentPrice += lineTotal;
        // Champ d'affichage uniquement, omis quand aucune unité n'est offerte
        // afin de ne pas alourdir le JSON persisté de chaque réservation.
        const offeredUnits = getOfferedUnits(eqData.sessionPricing, eq.quantity);
        equipmentLines.push({ id: eq.id, name: eqData.name || eq.id, quantity: eq.quantity, lineTotal, ...(offeredUnits.length ? { offeredUnits } : {}) });
      } else {
        const lineTotal = eqData.pricePerHour * eq.quantity * durationHours;
        equipmentPrice += lineTotal;
        equipmentLines.push({ id: eq.id, name: eqData.name || eq.id, quantity: eq.quantity, lineTotal });
      }
    }
  }

  return {
    basePrice,
    equipmentPrice,
    totalPrice: basePrice + equipmentPrice,
    durationHours,
    halfHours,
    slotBreakdown,
    equipmentLines,
  };
}

// Urgency indicator (mock - based on time of day and random factor)
export function getUrgencyIndicator(date: Date, time: string): { viewers: number; recentBookings: number } | null {
  const seed = date.getDate() + date.getMonth() * 31 + parseInt(time.split(":")[0], 10);
  const random = ((seed * 9301 + 49297) % 233280) / 233280;
  
  // Only show urgency for popular times (evenings and weekends)
  if (!isPeakTime(date, time)) return null;
  
  if (random > 0.6) {
    return {
      viewers: Math.floor(random * 5) + 1,
      recentBookings: Math.floor(random * 3),
    };
  }
  return null;
}
