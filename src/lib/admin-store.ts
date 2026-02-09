import { type StudioId, type GroupType, type PaymentMethod, type PaymentStatus, type EquipmentSelection, STUDIOS, EQUIPMENT, TIME_SLOTS, calculatePrice, calculateEquipmentPrice } from "./booking";

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no-show";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  bandName: string;
  notes: string;
  isBlocked: boolean;
  totalBookings: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminBooking {
  id: string;
  bookingRef: string;
  userId: string;
  studioId: StudioId;
  date: string;
  startTime: string;
  endTime: string;
  groupType: GroupType;
  status: BookingStatus;
  basePrice: number;
  equipmentPrice: number;
  totalPrice: number;
  equipment: EquipmentSelection[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export interface AdminPayment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: "pending" | "paid" | "refunded" | "partial-refund";
  refundedAmount: number;
  paidAt: Date | null;
  createdAt: Date;
}

export interface BlockedSlot {
  id: string;
  studioId: StudioId | null;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  entityType: "booking" | "user" | "payment";
  entityId: string;
  action: string;
  changes: string;
  performedBy: string;
  createdAt: Date;
}

export interface AdminStore {
  users: AdminUser[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  blockedSlots: BlockedSlot[];
  auditLogs: AuditLog[];
  initialized: boolean;
}

const STORAGE_KEY = "h3-admin-store";

const FIRST_NAMES = ["Marie", "Pierre", "Sophie", "Thomas", "Julie", "Nicolas", "Emma", "Lucas", "Léa", "Hugo", "Camille", "Antoine", "Chloé", "Maxime", "Laura", "Alexandre"];
const LAST_NAMES = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia", "David"];
const BAND_NAMES = ["Les Rockeurs", "Jazz Fusion", "Metal Storm", "Acoustic Dreams", "Electric Souls", "The Groove", "Rhythm Section", "Sound Wave", "Echo Chamber", "Bass Line", "Drum Circle", "Guitar Heroes", "Vocal Harmony", "Blues Brothers", "Funk Masters", ""];

function generateId(): string {
  return crypto.randomUUID();
}

function generateBookingRef(date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `H3-${datePart}-${randomPart}`;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockUsers(count: number): AdminUser[] {
  const users: AdminUser[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const createdDaysAgo = randomInt(1, 365);
    const createdAt = new Date(now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);
    
    users.push({
      id: generateId(),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      name: `${firstName} ${lastName}`,
      phone: `06${randomInt(10000000, 99999999)}`,
      bandName: randomElement(BAND_NAMES),
      notes: "",
      isBlocked: Math.random() < 0.02,
      totalBookings: 0,
      totalSpent: 0,
      createdAt,
      updatedAt: createdAt,
    });
  }
  
  return users;
}

function generateMockBookings(users: AdminUser[], daysBack: number, daysForward: number): { bookings: AdminBooking[]; payments: AdminPayment[] } {
  const bookings: AdminBooking[] = [];
  const payments: AdminPayment[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const studioIds: StudioId[] = ["la-scene", "le-podium"];
  const groupTypes: GroupType[] = ["solo", "duo", "group"];
  const durations = [2, 3, 4, 5, 6];
  
  for (let dayOffset = -daysBack; dayOffset <= daysForward; dayOffset++) {
    const date = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const bookingsPerDay = isWeekend ? randomInt(6, 12) : randomInt(3, 8);
    
    const usedSlots: Map<StudioId, Set<string>> = new Map();
    studioIds.forEach(id => usedSlots.set(id, new Set()));
    
    for (let b = 0; b < bookingsPerDay; b++) {
      const studioId = randomElement(studioIds);
      const groupType = randomElement(groupTypes);
      const duration = randomElement(durations);
      const startIndex = randomInt(0, TIME_SLOTS.length - duration - 1);
      const startTime = TIME_SLOTS[startIndex];
      const endTime = TIME_SLOTS[startIndex + duration] || "00:00";
      
      const studioSlots = usedSlots.get(studioId)!;
      let hasConflict = false;
      for (let i = startIndex; i < startIndex + duration && i < TIME_SLOTS.length; i++) {
        if (studioSlots.has(TIME_SLOTS[i])) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) continue;
      
      for (let i = startIndex; i < startIndex + duration && i < TIME_SLOTS.length; i++) {
        studioSlots.add(TIME_SLOTS[i]);
      }
      
      const user = randomElement(users);
      const pricing = calculatePrice(studioId, groupType, date, startTime, endTime);
      
      const equipment: EquipmentSelection[] = [];
      if (Math.random() < 0.3) {
        const eqTypes: Array<"cymbal" | "mic" | "instrument"> = ["cymbal", "mic", "instrument"];
        const numEquipment = randomInt(1, 2);
        for (let e = 0; e < numEquipment; e++) {
          const eqId = randomElement(eqTypes);
          if (!equipment.find(eq => eq.id === eqId)) {
            equipment.push({ id: eqId, quantity: randomInt(1, 2) });
          }
        }
      }
      
      const durationHours = duration * 0.5;
      const equipmentPrice = calculateEquipmentPrice(equipment, durationHours);
      
      const isPast = date < today;
      const paymentMethod: PaymentMethod = Math.random() < 0.6 ? "card" : "cash";
      
      let status: BookingStatus = "confirmed";
      let paymentStatus: PaymentStatus = paymentMethod === "card" ? "paid" : "pending";
      
      if (isPast) {
        const rand = Math.random();
        if (rand < 0.85) {
          status = "completed";
          paymentStatus = "paid";
        } else if (rand < 0.92) {
          status = "cancelled";
          paymentStatus = paymentMethod === "card" ? "paid" : "pending";
        } else {
          status = "no-show";
          paymentStatus = paymentMethod === "card" ? "paid" : "pending";
        }
      }
      
      const createdAt = new Date(date.getTime() - randomInt(1, 14) * 24 * 60 * 60 * 1000);
      
      const bookingId = generateId();
      const booking: AdminBooking = {
        id: bookingId,
        bookingRef: generateBookingRef(createdAt),
        userId: user.id,
        studioId,
        date: dateStr,
        startTime,
        endTime,
        groupType,
        status,
        basePrice: pricing.total,
        equipmentPrice,
        totalPrice: pricing.total + equipmentPrice,
        equipment,
        paymentMethod,
        paymentStatus,
        notes: "",
        createdAt,
        updatedAt: createdAt,
        cancelledAt: status === "cancelled" ? new Date(createdAt.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000) : null,
        cancelReason: status === "cancelled" ? randomElement(["Empêchement", "Maladie", "Changement de plans", "Autre groupe"]) : null,
      };
      
      bookings.push(booking);
      
      const payment: AdminPayment = {
        id: generateId(),
        bookingId,
        amount: booking.totalPrice,
        method: paymentMethod,
        status: paymentStatus === "paid" ? "paid" : "pending",
        refundedAmount: 0,
        paidAt: paymentStatus === "paid" ? (paymentMethod === "card" ? createdAt : (isPast ? date : null)) : null,
        createdAt,
      };
      
      payments.push(payment);
      
      user.totalBookings++;
      user.totalSpent += booking.totalPrice;
    }
  }
  
  return { bookings, payments };
}

function createInitialStore(): AdminStore {
  const users = generateMockUsers(50);
  const { bookings, payments } = generateMockBookings(users, 30, 14);
  
  return {
    users,
    bookings,
    payments,
    blockedSlots: [],
    auditLogs: [],
    initialized: true,
  };
}

export function loadAdminStore(): AdminStore {
  if (typeof window === "undefined") {
    return createInitialStore();
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const store = createInitialStore();
      saveAdminStore(store);
      return store;
    }
    
    const parsed = JSON.parse(data);
    
    parsed.users = parsed.users.map((u: AdminUser) => ({
      ...u,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    }));
    
    parsed.bookings = parsed.bookings.map((b: AdminBooking) => ({
      ...b,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt),
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : null,
    }));
    
    parsed.payments = parsed.payments.map((p: AdminPayment) => ({
      ...p,
      paidAt: p.paidAt ? new Date(p.paidAt) : null,
      createdAt: new Date(p.createdAt),
    }));
    
    parsed.blockedSlots = parsed.blockedSlots.map((s: BlockedSlot) => ({
      ...s,
      createdAt: new Date(s.createdAt),
    }));
    
    parsed.auditLogs = parsed.auditLogs.map((l: AuditLog) => ({
      ...l,
      createdAt: new Date(l.createdAt),
    }));
    
    return parsed;
  } catch {
    const store = createInitialStore();
    saveAdminStore(store);
    return store;
  }
}

export function saveAdminStore(store: AdminStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    console.error("Failed to save admin store");
  }
}

export function resetAdminStore(): AdminStore {
  const store = createInitialStore();
  saveAdminStore(store);
  return store;
}

export function addAuditLog(
  store: AdminStore,
  entityType: AuditLog["entityType"],
  entityId: string,
  action: string,
  changes: Record<string, unknown>,
  performedBy: string = "admin"
): void {
  store.auditLogs.unshift({
    id: generateId(),
    entityType,
    entityId,
    action,
    changes: JSON.stringify(changes),
    performedBy,
    createdAt: new Date(),
  });
  
  if (store.auditLogs.length > 1000) {
    store.auditLogs = store.auditLogs.slice(0, 1000);
  }
}

export function getBookingsByUser(store: AdminStore, userId: string): AdminBooking[] {
  return store.bookings
    .filter(b => b.userId === userId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBookingsByDate(store: AdminStore, date: string): AdminBooking[] {
  return store.bookings
    .filter(b => b.date === date && b.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getBookingsByDateRange(store: AdminStore, startDate: string, endDate: string): AdminBooking[] {
  return store.bookings
    .filter(b => b.date >= startDate && b.date <= endDate && b.status !== "cancelled")
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
}

export function checkConflict(
  store: AdminStore,
  studioId: StudioId,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): AdminBooking | null {
  const startIdx = TIME_SLOTS.indexOf(startTime);
  let endIdx = TIME_SLOTS.indexOf(endTime);
  if (endIdx === -1) endIdx = TIME_SLOTS.length;
  
  for (const booking of store.bookings) {
    if (booking.id === excludeBookingId) continue;
    if (booking.studioId !== studioId) continue;
    if (booking.date !== date) continue;
    if (booking.status === "cancelled") continue;
    
    const bStartIdx = TIME_SLOTS.indexOf(booking.startTime);
    let bEndIdx = TIME_SLOTS.indexOf(booking.endTime);
    if (bEndIdx === -1) bEndIdx = TIME_SLOTS.length;
    
    if (startIdx < bEndIdx && endIdx > bStartIdx) {
      return booking;
    }
  }
  
  for (const blocked of store.blockedSlots) {
    if (blocked.studioId !== null && blocked.studioId !== studioId) continue;
    if (blocked.date !== date) continue;
    
    const bStartIdx = TIME_SLOTS.indexOf(blocked.startTime);
    let bEndIdx = TIME_SLOTS.indexOf(blocked.endTime);
    if (bEndIdx === -1) bEndIdx = TIME_SLOTS.length;
    
    if (startIdx < bEndIdx && endIdx > bStartIdx) {
      return null;
    }
  }
  
  return null;
}

export function rescheduleBooking(
  store: AdminStore,
  bookingId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): { success: boolean; error?: string; conflict?: AdminBooking } {
  const booking = store.bookings.find(b => b.id === bookingId);
  if (!booking) return { success: false, error: "Réservation introuvable" };
  
  const conflict = checkConflict(store, booking.studioId, newDate, newStartTime, newEndTime, bookingId);
  if (conflict) {
    return { success: false, error: "Conflit avec une autre réservation", conflict };
  }
  
  const oldData = { date: booking.date, startTime: booking.startTime, endTime: booking.endTime };
  
  const newDateObj = new Date(newDate);
  const pricing = calculatePrice(booking.studioId, booking.groupType, newDateObj, newStartTime, newEndTime);
  
  const startIdx = TIME_SLOTS.indexOf(newStartTime);
  let endIdx = TIME_SLOTS.indexOf(newEndTime);
  if (endIdx === -1) endIdx = TIME_SLOTS.length;
  const durationHours = (endIdx - startIdx) * 0.5;
  const equipmentPrice = calculateEquipmentPrice(booking.equipment, durationHours);
  
  booking.date = newDate;
  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  booking.basePrice = pricing.total;
  booking.equipmentPrice = equipmentPrice;
  booking.totalPrice = pricing.total + equipmentPrice;
  booking.updatedAt = new Date();
  
  addAuditLog(store, "booking", bookingId, "reschedule", { before: oldData, after: { date: newDate, startTime: newStartTime, endTime: newEndTime } });
  
  const payment = store.payments.find(p => p.bookingId === bookingId);
  if (payment) {
    payment.amount = booking.totalPrice;
  }
  
  saveAdminStore(store);
  return { success: true };
}

export function cancelBooking(
  store: AdminStore,
  bookingId: string,
  reason: string
): { success: boolean; error?: string } {
  const booking = store.bookings.find(b => b.id === bookingId);
  if (!booking) return { success: false, error: "Réservation introuvable" };
  
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  booking.cancelReason = reason;
  booking.updatedAt = new Date();
  
  addAuditLog(store, "booking", bookingId, "cancel", { reason });
  
  saveAdminStore(store);
  return { success: true };
}

export function markNoShow(store: AdminStore, bookingId: string): { success: boolean; error?: string } {
  const booking = store.bookings.find(b => b.id === bookingId);
  if (!booking) return { success: false, error: "Réservation introuvable" };
  
  booking.status = "no-show";
  booking.updatedAt = new Date();
  
  addAuditLog(store, "booking", bookingId, "no-show", {});
  
  saveAdminStore(store);
  return { success: true };
}

export function markPaymentPaid(store: AdminStore, paymentId: string): { success: boolean; error?: string } {
  const payment = store.payments.find(p => p.id === paymentId);
  if (!payment) return { success: false, error: "Paiement introuvable" };
  
  payment.status = "paid";
  payment.paidAt = new Date();
  
  const booking = store.bookings.find(b => b.id === payment.bookingId);
  if (booking) {
    booking.paymentStatus = "paid";
    booking.updatedAt = new Date();
  }
  
  addAuditLog(store, "payment", paymentId, "mark-paid", { bookingId: payment.bookingId });
  
  saveAdminStore(store);
  return { success: true };
}

export function refundPayment(
  store: AdminStore,
  paymentId: string,
  amount: number
): { success: boolean; error?: string } {
  const payment = store.payments.find(p => p.id === paymentId);
  if (!payment) return { success: false, error: "Paiement introuvable" };
  
  if (amount > payment.amount - payment.refundedAmount) {
    return { success: false, error: "Montant de remboursement trop élevé" };
  }
  
  payment.refundedAmount += amount;
  payment.status = payment.refundedAmount >= payment.amount ? "refunded" : "partial-refund";
  
  addAuditLog(store, "payment", paymentId, "refund", { amount, total: payment.refundedAmount });
  
  saveAdminStore(store);
  return { success: true };
}

export function mergeUsers(
  store: AdminStore,
  primaryId: string,
  duplicateIds: string[]
): { success: boolean; error?: string } {
  const primary = store.users.find(u => u.id === primaryId);
  if (!primary) return { success: false, error: "Utilisateur principal introuvable" };
  
  const duplicates = store.users.filter(u => duplicateIds.includes(u.id));
  if (duplicates.length !== duplicateIds.length) {
    return { success: false, error: "Certains utilisateurs à fusionner sont introuvables" };
  }
  
  for (const booking of store.bookings) {
    if (duplicateIds.includes(booking.userId)) {
      booking.userId = primaryId;
      booking.updatedAt = new Date();
    }
  }
  
  let mergedBookings = 0;
  let mergedSpent = 0;
  for (const dup of duplicates) {
    mergedBookings += dup.totalBookings;
    mergedSpent += dup.totalSpent;
  }
  
  primary.totalBookings += mergedBookings;
  primary.totalSpent += mergedSpent;
  primary.notes += primary.notes ? "\n" : "";
  primary.notes += `Fusionné avec: ${duplicates.map(d => d.email).join(", ")}`;
  primary.updatedAt = new Date();
  
  for (const dup of duplicates) {
    dup.email = `${dup.email}_merged_${dup.id.slice(0, 8)}`;
    dup.isBlocked = true;
    dup.notes = `Fusionné vers ${primary.email}`;
    dup.updatedAt = new Date();
  }
  
  addAuditLog(store, "user", primaryId, "merge", { mergedIds: duplicateIds, mergedEmails: duplicates.map(d => d.email) });
  
  saveAdminStore(store);
  return { success: true };
}

export function blockUser(store: AdminStore, userId: string, blocked: boolean): { success: boolean; error?: string } {
  const user = store.users.find(u => u.id === userId);
  if (!user) return { success: false, error: "Utilisateur introuvable" };
  
  user.isBlocked = blocked;
  user.updatedAt = new Date();
  
  addAuditLog(store, "user", userId, blocked ? "block" : "unblock", {});
  
  saveAdminStore(store);
  return { success: true };
}

export function addBlockedSlot(
  store: AdminStore,
  studioId: StudioId | null,
  date: string,
  startTime: string,
  endTime: string,
  reason: string
): { success: boolean; id?: string } {
  const id = generateId();
  store.blockedSlots.push({
    id,
    studioId,
    date,
    startTime,
    endTime,
    reason,
    createdAt: new Date(),
  });
  
  saveAdminStore(store);
  return { success: true, id };
}

export function removeBlockedSlot(store: AdminStore, slotId: string): { success: boolean } {
  store.blockedSlots = store.blockedSlots.filter(s => s.id !== slotId);
  saveAdminStore(store);
  return { success: true };
}

export function getStats(store: AdminStore): {
  todayBookings: number;
  todayRevenue: number;
  weekBookings: number;
  weekRevenue: number;
  monthBookings: number;
  monthRevenue: number;
  pendingPayments: number;
  pendingAmount: number;
  occupancyToday: number;
  upcomingBookings: AdminBooking[];
  recentActivity: AuditLog[];
} {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  
  const todayBookings = store.bookings.filter(b => b.date === today && b.status !== "cancelled");
  const weekBookings = store.bookings.filter(b => b.date >= weekStartStr && b.date <= today && b.status !== "cancelled");
  const monthBookings = store.bookings.filter(b => b.date >= monthStartStr && b.date <= today && b.status !== "cancelled");
  
  const pendingPayments = store.payments.filter(p => p.status === "pending");
  
  const totalSlots = TIME_SLOTS.length * 2;
  const usedSlots = todayBookings.reduce((acc, b) => {
    const startIdx = TIME_SLOTS.indexOf(b.startTime);
    let endIdx = TIME_SLOTS.indexOf(b.endTime);
    if (endIdx === -1) endIdx = TIME_SLOTS.length;
    return acc + (endIdx - startIdx);
  }, 0);
  
  const upcomingBookings = store.bookings
    .filter(b => {
      if (b.status === "cancelled") return false;
      if (b.date > today) return true;
      if (b.date === today) {
        const nowTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        return b.startTime >= nowTime;
      }
      return false;
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 10);
  
  return {
    todayBookings: todayBookings.length,
    todayRevenue: todayBookings.reduce((acc, b) => acc + b.totalPrice, 0),
    weekBookings: weekBookings.length,
    weekRevenue: weekBookings.reduce((acc, b) => acc + b.totalPrice, 0),
    monthBookings: monthBookings.length,
    monthRevenue: monthBookings.reduce((acc, b) => acc + b.totalPrice, 0),
    pendingPayments: pendingPayments.length,
    pendingAmount: pendingPayments.reduce((acc, p) => acc + p.amount, 0),
    occupancyToday: totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0,
    upcomingBookings,
    recentActivity: store.auditLogs.slice(0, 20),
  };
}
