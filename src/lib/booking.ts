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
}

export const EQUIPMENT: Record<EquipmentId, Equipment> = {
  cymbal: { id: "cymbal", name: "Cymbale crash", pricePerHour: 1, maxPerSession: 3 },
  mic: { id: "mic", name: "Micro supplémentaire", pricePerHour: 1, maxPerSession: 3 },
  instrument: { id: "instrument", name: "Instrument (guitare, basse...)", pricePerHour: 2, maxPerSession: 5 },
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
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

export const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30",
];

export const CLOSING_TIME = "22:00";

export const SLOT_DURATION_MINUTES = 30;
export const MIN_BOOKING_SLOTS = 2;

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
  const startIndex = TIME_SLOTS.indexOf(startTime);
  let endIndex = TIME_SLOTS.indexOf(endTime);
  if (endIndex === -1 && endTime === CLOSING_TIME) endIndex = TIME_SLOTS.length;
  
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return { total: 0, breakdown: [] };
  }

  const breakdown: PriceSlot[] = [];
  
  for (let i = startIndex; i < endIndex; i++) {
    const time = TIME_SLOTS[i];
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
  const startIndex = TIME_SLOTS.indexOf(startTime);
  let endIndex = TIME_SLOTS.indexOf(endTime);
  if (endIndex === -1 && endTime === CLOSING_TIME) endIndex = TIME_SLOTS.length;
  
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

  const isSlotAvailable = (time: string) => {
    if (studioFilter) {
      return !availability.has(`${studioFilter}-${time}`);
    }
    return (
      !availability.has(`la-scene-${time}`) ||
      !availability.has(`le-podium-${time}`)
    );
  };

  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const time = TIME_SLOTS[i];
    const available = isSlotAvailable(time);

    if (available && rangeStart === null) {
      rangeStart = time;
    } else if (!available && rangeStart !== null) {
      const endTime = TIME_SLOTS[i];
      ranges.push(formatTimeRange(rangeStart, endTime));
      rangeStart = null;
    }
  }

  if (rangeStart !== null) {
    ranges.push(formatTimeRange(rangeStart, "22:30"));
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
  
  for (let i = 0; i < numBooked; i++) {
    const startIdx = Math.floor(random(TIME_SLOTS.length - 4));
    const duration = Math.floor(random(4)) + 2;
    
    for (let j = 0; j < duration && startIdx + j < TIME_SLOTS.length; j++) {
      if (random(1) > 0.5) {
        booked.add(`la-scene-${TIME_SLOTS[startIdx + j]}`);
      } else {
        booked.add(`le-podium-${TIME_SLOTS[startIdx + j]}`);
      }
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
  const startIdx = TIME_SLOTS.indexOf(requestedStart);
  const endIdx = TIME_SLOTS.indexOf(requestedEnd);
  const duration = endIdx - startIdx;

  // 1. Try other studio same time
  const otherStudio: StudioId = unavailableStudio === "la-scene" ? "le-podium" : "la-scene";
  let otherStudioAvailable = true;
  for (let i = startIdx; i < endIdx; i++) {
    if (availability.has(`${otherStudio}-${TIME_SLOTS[i]}`)) {
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
    for (let offset = -4; offset <= 4; offset++) {
      if (offset === 0) continue;
      const newStartIdx = startIdx + offset;
      const newEndIdx = newStartIdx + duration;
      if (newStartIdx < 0 || newEndIdx > TIME_SLOTS.length) continue;

      let slotAvailable = true;
      for (let i = newStartIdx; i < newEndIdx; i++) {
        if (availability.has(`${studio}-${TIME_SLOTS[i]}`)) {
          slotAvailable = false;
          break;
        }
      }
      if (slotAvailable) {
        alternatives.push({
          date: requestedDate,
          startTime: TIME_SLOTS[newStartIdx],
          endTime: TIME_SLOTS[newEndIdx],
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
    return total + eq.pricePerHour * item.quantity * durationHours;
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
