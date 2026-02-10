export type StudioId = "la-scene" | "le-podium";
export type GroupType = "solo" | "duo" | "group";
export type BookingFlow = "time-first" | "studio-first";
export type EquipmentId = "cymbal" | "mic" | "instrument";
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
  cymbal: { id: "cymbal", name: "2 Cymbales Crash", pricePerHour: 0, maxPerSession: 1, pricingType: "session", sessionPricing: [3] },
  mic: { id: "mic", name: "Micro supplémentaire", pricePerHour: 2, maxPerSession: 4, pricingType: "session", sessionPricing: [3, 5, 6, 6] }, // 4ème offert (même prix que 3)
  instrument: { id: "instrument", name: "Instrument (guitare, basse, piano numérique...)", pricePerHour: 0, maxPerSession: 5, pricingType: "session", sessionPricing: [3, 6, 9, 12, 15] },
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
    return Math.round(total * promo.value / 100);
  }
  return Math.min(promo.value, total);
}

export interface BookingState {
  flow: BookingFlow | null;
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
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
    description: "Scène intimiste avec rampe d'éclairage, écran géant et vidéoprojecteur",
    features: ["Scène", "Éclairage", "Écran géant", "Vidéoprojecteur"],
    image: "/images/studios/scene-1.jpg",
  },
  "le-podium": {
    id: "le-podium",
    name: "Le Podium",
    size: "35m²",
    description: "Espace simple et fonctionnel, idéal pour répétitions et cours",
    features: ["Compact", "Fonctionnel", "Cours"],
    image: "/images/studios/podium-1.jpg",
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
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
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
  // "00:00" means end of day → include all slots up to 23:30
  const closeIdx = hours.close === "00:00"
    ? ALL_TIME_SLOTS.length
    : ALL_TIME_SLOTS.indexOf(hours.close);
  if (openIdx === -1 || closeIdx === -1) return [];
  return ALL_TIME_SLOTS.slice(openIdx, closeIdx);
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
 * Auto-assign studio for solo/duo bookings.
 * Groups have priority — solo/duo gets whatever is left.
 * If the slot extends past Le Podium's closing time, only La Scène is possible.
 */
export function assignStudioForSoloDuo(
  date: Date,
  startTime: string,
  endTime: string,
  availability: Set<string>
): StudioId {
  const podiumSlots = getStudioTimeSlots("le-podium", date);
  const sceneSlots = getStudioTimeSlots("la-scene", date);

  // Collect all slots in the booking range
  const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
  if (endIdx === -1 && endTime === "00:00") endIdx = ALL_TIME_SLOTS.length;
  const bookedRange = ALL_TIME_SLOTS.slice(startIdx, endIdx);

  // Check if Le Podium can even cover this time range (opening hours)
  const podiumCoversRange = bookedRange.every((t) => podiumSlots.includes(t));
  const sceneCoversRange = bookedRange.every((t) => sceneSlots.includes(t));

  // Check if a group already booked one of the studios on this range
  const sceneBooked = bookedRange.some((t) => availability.has(`la-scene-${t}`));
  const podiumBooked = bookedRange.some((t) => availability.has(`le-podium-${t}`));

  // If only one studio covers the range, use that one
  if (!podiumCoversRange && sceneCoversRange) return "la-scene";
  if (!sceneCoversRange && podiumCoversRange) return "le-podium";

  // If a group took La Scène, assign Le Podium (if it covers the range)
  if (sceneBooked && !podiumBooked && podiumCoversRange) return "le-podium";
  // If a group took Le Podium, assign La Scène (if it covers the range)
  if (podiumBooked && !sceneBooked && sceneCoversRange) return "la-scene";

  // Default: La Scène (larger room, open later)
  return "la-scene";
}

export function isPeakTime(date: Date, time: string): boolean {
  const hour = parseInt(time.split(":")[0], 10);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return hour >= 18 || isWeekend;
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
  if (endIndex === -1 && endTime === "00:00") endIndex = ALL_TIME_SLOTS.length;
  
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
  if (endIndex === -1 && endTime === "00:00") endIndex = ALL_TIME_SLOTS.length;
  
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
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `H3-${datePart}-${randomPart}`;
}

export function getAvailableRanges(
  date: Date,
  studioFilter?: StudioId | null
): string[] {
  const availability = generateMockAvailability(date);
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

export function generateMockAvailability(date: Date): Set<string> {
  const booked = new Set<string>();
  const seed = date.getDate() + date.getMonth() * 31;
  const random = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n;
  
  const numBooked = Math.floor(random(8)) + 2;
  const sceneSlots = getStudioTimeSlots("la-scene", date);
  const podiumSlots = getStudioTimeSlots("le-podium", date);
  
  for (let i = 0; i < numBooked; i++) {
    const useScene = random(1) > 0.5;
    const studioSlots = useScene ? sceneSlots : podiumSlots;
    const studioId = useScene ? "la-scene" : "le-podium";
    if (studioSlots.length < 4) continue;
    
    const startIdx = Math.floor(random(studioSlots.length - 4));
    const duration = Math.floor(random(4)) + 2;
    
    for (let j = 0; j < duration && startIdx + j < studioSlots.length; j++) {
      booked.add(`${studioId}-${studioSlots[startIdx + j]}`);
    }
  }
  
  return booked;
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
  durationHours: number
): number {
  return equipment.reduce((total, item) => {
    const eq = EQUIPMENT[item.id];
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
