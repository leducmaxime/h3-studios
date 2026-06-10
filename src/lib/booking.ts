import { formatDateISO, getParisDateISO } from "./utils";

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

export interface PriceSlot {
  time: string;
  isPeak: boolean;
  rate: number;
}

export interface EquipmentSelection {
  id: EquipmentId;
  quantity: number;
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

export interface BookingState {
  step: 0 | 1 | 2 | 3 | 4 | 5;
  selectedDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  studioId: StudioId | null;
  groupType: GroupType | null;
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
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
    name: "La Scène",
    size: "42m²",
    description: "Avec une hauteur de 3,50m et une superficie de 42m², notre studio propose une scène intimiste avec sa rampe d'éclairage. Convenant à tous styles musicaux, ce lieu chaleureux et fonctionnel saura répondre à vos besoins.",
    features: ["Scène", "Éclairage", "Écran géant", "Vidéoprojecteur"],
    image: "/images/studios/scene-1.webp",
  },
  "le-podium": {
    id: "le-podium",
    name: "Le Podium",
    size: "35m²",
    description: "Conçu pour la répétition, cet espace de 35m² offre un cadre simple et fonctionnel, idéal pour vos sessions musicales, en groupe ou en solo. Cette salle est également adapté aux enseignants souhaitant donner des cours à un ou plusieurs élèves.",
    features: ["Compact", "Fonctionnel", "Cours"],
    image: "/images/studios/podium-1.webp",
  },
};

export const PRICING: Record<StudioId, Record<GroupType, { offPeak: number; peak: number }>> = {
  "la-scene": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 18, peak: 22 },
  },
  "le-podium": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 15, peak: 18 },
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

/** Get the closing time for a studio on a given date */
export function getStudioClosingTime(studioId: StudioId, date: Date): string {
  const dayOfWeek = date.getDay();
  return STUDIO_HOURS[studioId][dayOfWeek].close;
}

/** Get bookable time slots for a specific studio on a given date */
export function getStudioTimeSlots(studioId: StudioId, date: Date): string[] {
  const dayOfWeek = date.getDay();
  const hours = STUDIO_HOURS[studioId][dayOfWeek];
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
 * Get the list of studios that can accommodate a specific slot for the given group type.
 * For solo/duo: studio must be open and strictly free.
 * For group: studio must be open and either free OR occupied by solo/duo that can be
 * displaced to the other studio (other studio must be strictly free and open).
 */
export function getAvailableStudiosForSlot(
  time: string,
  groupType: GroupType,
  occupancy: Set<OccupancyInfo>,
  date: Date
): StudioId[] {
  const details = getSlotDetails(time, occupancy, date);
  const available: StudioId[] = [];

  for (const studio of details) {
    if (!studio.isOpen) continue;
    if (!studio.occupant) {
      available.push(studio.studioId);
    } else if (
      groupType === "group" &&
      studio.occupant.groupType !== "group" &&
      studio.occupant.groupType !== "blocked"
    ) {
      const otherStudio = details.find(
        (d) => d.studioId !== studio.studioId
      )!;
      if (otherStudio.isOpen && !otherStudio.occupant) {
        available.push(studio.studioId);
      }
    }
  }

  return available;
}

/**
 * Unified per-slot availability check.
 * With studioFilter: checks that specific studio.
 * Without studioFilter: checks if ANY studio has the slot available.
 */
export function isSlotAvailable(
  time: string,
  groupType: GroupType,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): boolean {
  const availableStudios = getAvailableStudiosForSlot(
    time,
    groupType,
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
  groupType: GroupType,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): boolean {
  return !isSlotAvailable(time, groupType, occupancy, date, studioFilter);
}

/**
 * Check if a time range can be booked in a single studio for the given group type.
 * Returns the studioId if bookable, or {bookable:false} if not.
 * This is the SINGLE SOURCE OF TRUTH for range validity.
 */
export function isRangeBookable(
  startTime: string,
  endTime: string,
  groupType: GroupType,
  occupancy: Set<OccupancyInfo>,
  date: Date,
  studioFilter?: StudioId
): { bookable: boolean; studioId?: StudioId } {
  const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIdx = ALL_TIME_SLOTS.length;

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
        groupType,
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

  let freeCount = 0;
  for (let i = slotIdx; i < visibleSlots.length; i++) {
    if (isSlotOccupied(visibleSlots[i])) break;
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

export function getSlotRate(
  studioId: StudioId,
  groupType: GroupType,
  date: Date,
  time: string
): number {
  const isPeak = isPeakTime(date, time);
  return PRICING[studioId][groupType][isPeak ? "peak" : "offPeak"];
}

export function calculatePrice(
  studioId: StudioId,
  groupType: GroupType,
  date: Date,
  startTime: string,
  endTime: string
): { total: number; breakdown: PriceSlot[] } {
  const startIndex = ALL_TIME_SLOTS.indexOf(startTime);
  let endIndex = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIndex = ALL_TIME_SLOTS.length;

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return { total: 0, breakdown: [] };
  }

  const breakdown: PriceSlot[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const time = ALL_TIME_SLOTS[i];
    const isPeak = isPeakTime(date, time);
    const rate = PRICING[studioId][groupType][isPeak ? "peak" : "offPeak"];
    breakdown.push({ time, isPeak, rate });
  }

  const total = breakdown.reduce(
    (sum, slot) => sum + (slot.rate * SLOT_DURATION_MINUTES) / 60,
    0
  );

  return { total, breakdown };
}

export function formatDuration(startTime: string, endTime: string): string {
  const startIndex = ALL_TIME_SLOTS.indexOf(startTime);
  let endIndex = ALL_TIME_SLOTS.indexOf(endTime);
  if (endTime === "00:00") endIndex = ALL_TIME_SLOTS.length;

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
    const [hours, minutes] = time.split(":").map(Number);
    const dt = new Date(d);
    dt.setHours(hours, minutes, 0, 0);
    return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
DTSTART:${dtStart}
DTEND:${dtEnd}
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
    const [hours, minutes] = time.split(":").map(Number);
    const dt = new Date(d);
    dt.setHours(hours, minutes, 0, 0);
    return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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

// localStorage helpers
const STORAGE_KEY = "h3-studios-user-prefs";

export interface UserPreferences {
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  lastVisit: string;
}

export function saveUserPreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadUserPreferences();
    const updated = { ...existing, ...prefs, lastVisit: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

export function loadUserPreferences(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
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
