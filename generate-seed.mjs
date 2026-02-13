#!/usr/bin/env node
// Generates seed.sql with realistic mock data matching admin-store.ts patterns

import { randomUUID } from "crypto";

const FIRST_NAMES = ["Marie", "Pierre", "Sophie", "Thomas", "Julie", "Nicolas", "Emma", "Lucas", "Léa", "Hugo", "Camille", "Antoine", "Chloé", "Maxime", "Laura", "Alexandre"];
const LAST_NAMES = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia", "David"];
const BAND_NAMES = ["Les Rockeurs", "Jazz Fusion", "Metal Storm", "Acoustic Dreams", "Electric Souls", "The Groove", "Rhythm Section", "Sound Wave", "Echo Chamber", "Bass Line", "Drum Circle", "Guitar Heroes", "Vocal Harmony", "Blues Brothers", "Funk Masters", ""];
const CANCEL_REASONS = ["Empêchement", "Maladie", "Changement de plans", "Autre groupe"];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
];

const PRICING = {
  "la-scene": { solo: { offPeak: 6, peak: 6 }, duo: { offPeak: 12, peak: 12 }, group: { offPeak: 18, peak: 22 } },
  "le-podium": { solo: { offPeak: 6, peak: 6 }, duo: { offPeak: 12, peak: 12 }, group: { offPeak: 15, peak: 18 } },
};

const EQUIPMENT_DATA = {
  cymbal: { name: "2 Cymbales Crash", maxPerSession: 1, pricingType: "session", sessionPricing: [3], pricePerHour: 0 },
  mic: { name: "Micro supplémentaire", maxPerSession: 4, pricingType: "session", sessionPricing: [3, 5, 6, 6], pricePerHour: 2 },
  guitar: { name: "Guitare électrique", maxPerSession: 3, pricingType: "session", sessionPricing: [3, 6, 9], pricePerHour: 0 },
  bass: { name: "Basse", maxPerSession: 1, pricingType: "session", sessionPricing: [3], pricePerHour: 0 },
  piano: { name: "Piano numérique", maxPerSession: 2, pricingType: "session", sessionPricing: [3, 6], pricePerHour: 0 },
};

const STUDIO_HOURS = {
  "le-podium": {
    0: { open: "10:00", close: "22:30" },
    1: { open: "18:00", close: "22:30" },
    2: { open: "10:00", close: "22:30" },
    3: { open: "10:00", close: "22:30" },
    4: { open: "10:00", close: "22:30" },
    5: { open: "10:00", close: "22:30" },
    6: { open: "10:00", close: "22:30" },
  },
  "la-scene": {
    0: { open: "10:00", close: "00:00" },
    1: { open: "18:00", close: "00:00" },
    2: { open: "10:00", close: "00:00" },
    3: { open: "10:00", close: "00:00" },
    4: { open: "10:00", close: "00:00" },
    5: { open: "10:00", close: "00:00" },
    6: { open: "10:00", close: "00:00" },
  },
};

function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function esc(s) { return s.replace(/'/g, "''"); }
function fmtDate(d) { return d.toISOString().slice(0, 10); }
function fmtDatetime(d) { return d.toISOString().slice(0, 19).replace("T", " "); }

function generateBookingRef(date) {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `H3-${datePart}-${randomPart}`;
}

function isPeakTime(time) {
  const hour = parseInt(time.split(":")[0]);
  return hour >= 18;
}

function calculatePrice(studioId, groupType, date, startTime, endTime) {
  const startIdx = TIME_SLOTS.indexOf(startTime);
  const endIdx = TIME_SLOTS.indexOf(endTime);
  if (startIdx === -1 || endIdx === -1) return 0;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  let total = 0;
  for (let i = startIdx; i < endIdx; i++) {
    const slot = TIME_SLOTS[i];
    const peak = isPeakTime(slot) || isWeekend;
    const rate = peak ? PRICING[studioId][groupType].peak : PRICING[studioId][groupType].offPeak;
    total += rate;
  }
  return total;
}

function calculateEquipmentPrice(equipment, durationHours) {
  let total = 0;
  for (const eq of equipment) {
    const data = EQUIPMENT_DATA[eq.id];
    if (data.pricingType === "session" && data.sessionPricing) {
      const idx = Math.min(eq.quantity, data.sessionPricing.length) - 1;
      total += data.sessionPricing[idx];
    } else {
      total += data.pricePerHour * eq.quantity * durationHours;
    }
  }
  return total;
}

// --- Generate SQL ---
const lines = [];
lines.push("-- H3 Studios Seed Data");
lines.push("-- Generated from admin-store.ts mock data patterns");
lines.push("");

// 1. Admin users (password hashes are bcrypt-style placeholders)
// admin123 -> $2a$10$... placeholder (will be replaced with real hashing in auth layer)
lines.push("-- Admin users");
lines.push(`INSERT INTO admin_users (id, email, password_hash, name, role, is_active) VALUES ('adm-001', 'admin@h3studios.fr', '$2a$10$placeholder_admin123_hash_will_be_set_by_auth', 'Admin H3', 'super-admin', 1);`);
lines.push(`INSERT INTO admin_users (id, email, password_hash, name, role, is_active) VALUES ('adm-002', 'operateur@h3studios.fr', '$2a$10$placeholder_oper123_hash_will_be_set_by_auth', 'Opérateur H3', 'operator', 1);`);
lines.push("");

// 2. Pricing from PRICING constant
lines.push("-- Pricing (from booking.ts PRICING)");
let pricingId = 1;
for (const [studioId, groups] of Object.entries(PRICING)) {
  for (const [groupType, prices] of Object.entries(groups)) {
    lines.push(`INSERT INTO pricing (id, studio_id, group_type, is_peak, price_per_half_hour) VALUES ('prc-${String(pricingId++).padStart(3, "0")}', '${studioId}', '${groupType}', 0, ${prices.offPeak});`);
    lines.push(`INSERT INTO pricing (id, studio_id, group_type, is_peak, price_per_half_hour) VALUES ('prc-${String(pricingId++).padStart(3, "0")}', '${studioId}', '${groupType}', 1, ${prices.peak});`);
  }
}
lines.push("");

// 3. Equipment from EQUIPMENT constant
lines.push("-- Equipment (from booking.ts EQUIPMENT)");
let eqIdx = 1;
for (const [eqId, eq] of Object.entries(EQUIPMENT_DATA)) {
  const sessionPricingJson = eq.sessionPricing ? JSON.stringify(eq.sessionPricing) : null;
  lines.push(`INSERT INTO equipment (id, equipment_id, name, max_per_session, pricing_type, session_pricing, price_per_hour) VALUES ('eq-${String(eqIdx++).padStart(3, "0")}', '${eqId}', '${esc(eq.name)}', ${eq.maxPerSession}, '${eq.pricingType}', ${sessionPricingJson ? `'${sessionPricingJson}'` : "NULL"}, ${eq.pricePerHour});`);
}
lines.push("");

// 4. Opening hours from STUDIO_HOURS
lines.push("-- Opening hours (from booking.ts STUDIO_HOURS)");
let ohIdx = 1;
for (const [studioId, days] of Object.entries(STUDIO_HOURS)) {
  for (const [day, hours] of Object.entries(days)) {
    lines.push(`INSERT INTO opening_hours (id, studio_id, day_of_week, open_time, close_time, is_closed) VALUES ('oh-${String(ohIdx++).padStart(3, "0")}', '${studioId}', ${day}, '${hours.open}', '${hours.close}', 0);`);
  }
}
lines.push("");

// 5. Promo codes (from booking.ts)
lines.push("-- Promo codes (from booking.ts)");
lines.push(`INSERT INTO promo_codes (id, code, type, value, min_total, is_active) VALUES ('prm-001', 'BIENVENUE', 'percentage', 10, 0, 1);`);
lines.push(`INSERT INTO promo_codes (id, code, type, value, min_total, is_active) VALUES ('prm-002', 'H3AMIS', 'fixed', 5, 15, 1);`);
lines.push(`INSERT INTO promo_codes (id, code, type, value, min_total, is_active) VALUES ('prm-003', 'ROCK2026', 'percentage', 15, 0, 1);`);
lines.push("");

// 6. Settings
lines.push("-- Default settings");
lines.push(`INSERT INTO settings (id, key, value) VALUES ('set-001', 'booking_advance_days', '30');`);
lines.push(`INSERT INTO settings (id, key, value) VALUES ('set-002', 'cancellation_hours', '24');`);
lines.push(`INSERT INTO settings (id, key, value) VALUES ('set-003', 'max_booking_duration_slots', '12');`);
lines.push("");

// 7. Generate 50 users
lines.push("-- Users (50 clients)");
const users = [];
const now = new Date();
for (let i = 0; i < 50; i++) {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const createdDaysAgo = randomInt(1, 365);
  const createdAt = new Date(now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);
  const isBlocked = Math.random() < 0.02 ? 1 : 0;
  const bandName = randomElement(BAND_NAMES);
  const id = `usr-${String(i + 1).padStart(3, "0")}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`;
  const phone = `06${randomInt(10000000, 99999999)}`;

  users.push({ id, email, name: `${firstName} ${lastName}`, phone, bandName, isBlocked, createdAt, totalBookings: 0, totalSpent: 0 });
  lines.push(`INSERT INTO users (id, email, name, phone, band_name, notes, is_blocked, total_bookings, total_spent, created_at, updated_at) VALUES ('${id}', '${esc(email)}', '${esc(firstName)} ${esc(lastName)}', '${phone}', '${esc(bandName)}', '', ${isBlocked}, 0, 0, '${fmtDatetime(createdAt)}', '${fmtDatetime(createdAt)}');`);
}
lines.push("");

// 8. Generate bookings (~600) - 30 days back, 14 days forward
lines.push("-- Bookings and Payments (~600 bookings)");
const studioIds = ["la-scene", "le-podium"];
const groupTypes = ["solo", "duo", "group"];
const durations = [2, 2, 2, 2, 3, 3];
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
let bookingCount = 0;
let paymentCount = 0;

for (let dayOffset = -30; dayOffset <= 14; dayOffset++) {
  const date = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const dateStr = fmtDate(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const bookingsPerDay = isWeekend ? randomInt(16, 24) : randomInt(12, 20);

  const usedSlots = new Map();
  studioIds.forEach(id => usedSlots.set(id, new Set()));

  for (let b = 0; b < bookingsPerDay; b++) {
    const studioId = randomElement(studioIds);
    const groupType = randomElement(groupTypes);
    const duration = randomElement(durations);
    const startIndex = randomInt(0, TIME_SLOTS.length - duration - 1);
    const startTime = TIME_SLOTS[startIndex];
    const endTime = TIME_SLOTS[startIndex + duration] || "00:00";

    const studioSlots = usedSlots.get(studioId);
    if (dayOffset > -7) {
      let hasConflict = false;
      for (let i = startIndex; i < startIndex + duration && i < TIME_SLOTS.length; i++) {
        if (studioSlots.has(TIME_SLOTS[i])) { hasConflict = true; break; }
      }
      if (hasConflict) continue;
    }

    for (let i = startIndex; i < startIndex + duration && i < TIME_SLOTS.length; i++) {
      studioSlots.add(TIME_SLOTS[i]);
    }

    const user = randomElement(users);
    const basePrice = calculatePrice(studioId, groupType, date, startTime, endTime);

    const equipment = [];
    if (Math.random() < 0.3) {
      const eqTypes = ["cymbal", "mic", "guitar", "bass", "piano"];
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
    const totalPrice = basePrice + equipmentPrice;

    const isPast = date < today;
    const paymentMethod = Math.random() < 0.6 ? "card" : "cash";

    let status = "confirmed";
    let paymentStatus = paymentMethod === "card" ? "paid" : "pending";

    if (isPast) {
      const rand = Math.random();
      if (rand < 0.85) { status = "completed"; paymentStatus = "paid"; }
      else if (rand < 0.92) { status = "cancelled"; paymentStatus = paymentMethod === "card" ? "paid" : "pending"; }
      else { status = "no-show"; paymentStatus = paymentMethod === "card" ? "paid" : "pending"; }
    }

    const createdAt = new Date(date.getTime() - randomInt(1, 14) * 24 * 60 * 60 * 1000);
    const bookingId = `bk-${String(++bookingCount).padStart(4, "0")}`;
    const bookingRef = generateBookingRef(createdAt);
    const cancelledAt = status === "cancelled" ? new Date(createdAt.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000) : null;
    const cancelReason = status === "cancelled" ? randomElement(CANCEL_REASONS) : null;
    const equipmentJson = equipment.length > 0 ? JSON.stringify(equipment) : null;

    lines.push(`INSERT INTO bookings (id, booking_ref, user_id, studio_id, date, start_time, end_time, group_type, status, base_price, equipment_price, total_price, equipment, payment_method, payment_status, notes, created_at, updated_at, cancelled_at, cancel_reason) VALUES ('${bookingId}', '${bookingRef}', '${user.id}', '${studioId}', '${dateStr}', '${startTime}', '${endTime}', '${groupType}', '${status}', ${basePrice}, ${equipmentPrice}, ${totalPrice}, ${equipmentJson ? `'${esc(equipmentJson)}'` : "NULL"}, '${paymentMethod}', '${paymentStatus}', '', '${fmtDatetime(createdAt)}', '${fmtDatetime(createdAt)}', ${cancelledAt ? `'${fmtDatetime(cancelledAt)}'` : "NULL"}, ${cancelReason ? `'${esc(cancelReason)}'` : "NULL"});`);

    const paymentId = `pay-${String(++paymentCount).padStart(4, "0")}`;
    const paidAt = paymentStatus === "paid" ? (paymentMethod === "card" ? createdAt : (isPast ? date : null)) : null;
    const paymentDbStatus = paymentStatus === "paid" ? "paid" : "pending";

    lines.push(`INSERT INTO payments (id, booking_id, amount, method, status, refunded_amount, paid_at, created_at) VALUES ('${paymentId}', '${bookingId}', ${totalPrice}, '${paymentMethod}', '${paymentDbStatus}', 0, ${paidAt ? `'${fmtDatetime(paidAt)}'` : "NULL"}, '${fmtDatetime(createdAt)}');`);

    user.totalBookings++;
    user.totalSpent += totalPrice;
  }
}
lines.push("");

// 9. Update user totals
lines.push("-- Update user booking totals");
for (const user of users) {
  if (user.totalBookings > 0) {
    lines.push(`UPDATE users SET total_bookings = ${user.totalBookings}, total_spent = ${user.totalSpent} WHERE id = '${user.id}';`);
  }
}

console.log(lines.join("\n"));
process.stderr.write(`Generated: ${bookingCount} bookings, ${paymentCount} payments, ${users.length} users\n`);
