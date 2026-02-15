import {
  type DbBooking,
  type DbUser,
  type DbPayment,
  type DbBlockedSlot,
  type DbPricing,
  type DbEquipment,
  type DbPromoCode,
  type DbOpeningHours,
  type DbSetting,
  type DbAuditLog,
  type PaginatedResult,
  type BookingFilters,
  type UserFilters,
  type AuditLogFilters,
  type BookingStatus,
  type DbPaymentStatus,
} from "./db-types";
import { getParisDateISO } from "./utils";

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export async function getBookings(
  db: D1Database,
  filters: BookingFilters = {},
  page = 1,
  limit = 20,
): Promise<PaginatedResult<DbBooking>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push("b.status = ?");
    params.push(filters.status);
  }
  if (filters.studioId) {
    conditions.push("b.studio_id = ?");
    params.push(filters.studioId);
  }
  if (filters.userId) {
    conditions.push("b.user_id = ?");
    params.push(filters.userId);
  }
  if (filters.dateFrom) {
    conditions.push("b.date >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("b.date <= ?");
    params.push(filters.dateTo);
  }
  if (filters.paymentStatus) {
    conditions.push("b.payment_status = ?");
    params.push(filters.paymentStatus);
  }
  if (filters.search) {
    conditions.push("(b.booking_ref LIKE ? OR u.name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const joinUser = filters.search ? "LEFT JOIN users u ON b.user_id = u.id" : "";

  const countSql = `SELECT COUNT(*) as total FROM bookings b ${joinUser} ${where}`;
  const countResult = await db.prepare(countSql).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const dataSql = `SELECT b.* FROM bookings b ${joinUser} ${where} ORDER BY b.date DESC, b.start_time DESC LIMIT ? OFFSET ?`;
  const dataResult = await db.prepare(dataSql).bind(...params, limit, offset).all<DbBooking>();

  return { data: dataResult.results, total, page, limit };
}

export async function getBookingById(
  db: D1Database,
  id: string,
): Promise<DbBooking | null> {
  return db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<DbBooking>();
}

export async function getBookingByRef(
  db: D1Database,
  ref: string,
): Promise<DbBooking | null> {
  return db.prepare("SELECT * FROM bookings WHERE booking_ref = ?").bind(ref).first<DbBooking>();
}

export async function createBooking(
  db: D1Database,
  data: Omit<DbBooking, "id" | "created_at" | "updated_at">,
): Promise<DbBooking> {
  const id = generateId();
  const timestamp = now();

  await db.prepare(`
    INSERT INTO bookings (id, booking_ref, user_id, studio_id, date, start_time, end_time,
      group_type, status, base_price, equipment_price, total_price, equipment,
      payment_method, payment_status, notes, created_at, updated_at, cancelled_at, cancel_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, data.booking_ref, data.user_id, data.studio_id, data.date,
    data.start_time, data.end_time, data.group_type, data.status,
    data.base_price, data.equipment_price, data.total_price,
    data.equipment, data.payment_method, data.payment_status,
    data.notes, timestamp, timestamp, data.cancelled_at, data.cancel_reason,
  ).run();

  return (await getBookingById(db, id))!;
}

export async function updateBooking(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbBooking, "status" | "payment_status" | "notes" | "date" | "start_time" | "end_time" | "base_price" | "equipment_price" | "total_price" | "equipment" | "cancelled_at" | "cancel_reason">>,
): Promise<{ success: boolean; error?: string }> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false, error: "No fields to update" };

  sets.push("updated_at = ?");
  params.push(now());
  params.push(id);

  const result = await db.prepare(
    `UPDATE bookings SET ${sets.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return { success: result.meta.changes > 0 };
}

export async function getBookingsByDate(
  db: D1Database,
  date: string,
): Promise<(DbBooking & { user_name?: string; user_band_name?: string })[]> {
  const result = await db.prepare(
    `SELECT b.*, u.name as user_name, u.band_name as user_band_name 
     FROM bookings b
     LEFT JOIN users u ON b.user_id = u.id
     WHERE b.date = ? AND b.status != 'cancelled' 
     ORDER BY b.start_time ASC`,
  ).bind(date).all<DbBooking & { user_name?: string; user_band_name?: string }>();
  return result.results;
}

export async function getBookingsByDateRange(
  db: D1Database,
  startDate: string,
  endDate: string,
): Promise<(DbBooking & { user_name?: string; user_band_name?: string })[]> {
  const result = await db.prepare(
    `SELECT b.*, u.name as user_name, u.band_name as user_band_name 
     FROM bookings b
     LEFT JOIN users u ON b.user_id = u.id
     WHERE b.date >= ? AND b.date <= ? AND b.status != 'cancelled' 
     ORDER BY b.date ASC, b.start_time ASC`,
  ).bind(startDate, endDate).all<DbBooking & { user_name?: string; user_band_name?: string }>();
  return result.results;
}

export async function getBookingsByUser(
  db: D1Database,
  userId: string,
): Promise<DbBooking[]> {
  const result = await db.prepare(
    "SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, start_time DESC",
  ).bind(userId).all<DbBooking>();
  return result.results;
}

export async function checkConflict(
  db: D1Database,
  studioId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
): Promise<DbBooking | null> {
  const params: unknown[] = [studioId, date, endTime, startTime];
  let excludeClause = "";

  if (excludeBookingId) {
    excludeClause = "AND id != ?";
    params.push(excludeBookingId);
  }

  return db.prepare(`
    SELECT * FROM bookings
    WHERE studio_id = ? AND date = ? AND status != 'cancelled'
      AND start_time < ? AND end_time > ?
      ${excludeClause}
    LIMIT 1
  `).bind(...params).first<DbBooking>();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUsers(
  db: D1Database,
  filters: UserFilters = {},
  page = 1,
  limit = 20,
): Promise<PaginatedResult<DbUser>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    conditions.push("(name LIKE ? OR email LIKE ? OR band_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.isBlocked !== undefined) {
    conditions.push("is_blocked = ?");
    params.push(filters.isBlocked ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<DbUser>();

  return { data: result.results, total, page, limit };
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<DbUser | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<DbUser>();
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<DbUser | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<DbUser>();
}

export async function createUser(
  db: D1Database,
  data: { name: string; email?: string; phone?: string; band_name?: string; notes?: string },
): Promise<DbUser> {
  const id = generateId();
  const timestamp = now();

  await db.prepare(`
    INSERT INTO users (id, email, name, phone, band_name, notes, is_blocked, total_bookings, total_spent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(
    id, data.email ?? null, data.name, data.phone ?? null,
    data.band_name ?? null, data.notes ?? null, timestamp, timestamp,
  ).run();

  return (await getUserById(db, id))!;
}

export async function updateUser(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbUser, "email" | "name" | "phone" | "band_name" | "notes" | "is_blocked" | "total_bookings" | "total_spent">>,
): Promise<{ success: boolean; error?: string }> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false, error: "No fields to update" };

  sets.push("updated_at = ?");
  params.push(now());
  params.push(id);

  const result = await db.prepare(
    `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return { success: result.meta.changes > 0 };
}

export async function blockUser(
  db: D1Database,
  userId: string,
  blocked: boolean,
): Promise<{ success: boolean; error?: string }> {
  return updateUser(db, userId, { is_blocked: blocked ? 1 : 0 });
}

export async function mergeUsers(
  db: D1Database,
  primaryId: string,
  duplicateIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const primary = await getUserById(db, primaryId);
  if (!primary) return { success: false, error: "Utilisateur principal introuvable" };

  const placeholders = duplicateIds.map(() => "?").join(", ");
  const duplicates = await db.prepare(
    `SELECT * FROM users WHERE id IN (${placeholders})`,
  ).bind(...duplicateIds).all<DbUser>();

  if (duplicates.results.length !== duplicateIds.length) {
    return { success: false, error: "Certains utilisateurs sont introuvables" };
  }

  const statements: D1PreparedStatement[] = [];

  statements.push(
    db.prepare(`UPDATE bookings SET user_id = ?, updated_at = ? WHERE user_id IN (${placeholders})`).bind(primaryId, now(), ...duplicateIds),
  );

  let mergedBookings = 0;
  let mergedSpent = 0;
  for (const dup of duplicates.results) {
    mergedBookings += dup.total_bookings;
    mergedSpent += dup.total_spent;
  }

  const mergedEmails = duplicates.results.map(d => d.email).join(", ");
  const newNotes = primary.notes ? `${primary.notes}\nFusionné avec: ${mergedEmails}` : `Fusionné avec: ${mergedEmails}`;

  statements.push(
    db.prepare(
      "UPDATE users SET total_bookings = ?, total_spent = ?, notes = ?, updated_at = ? WHERE id = ?",
    ).bind(
      primary.total_bookings + mergedBookings,
      primary.total_spent + mergedSpent,
      newNotes,
      now(),
      primaryId,
    ),
  );

  for (const dup of duplicates.results) {
    statements.push(
      db.prepare(
        "UPDATE users SET email = ?, is_blocked = 1, notes = ?, updated_at = ? WHERE id = ?",
      ).bind(
        `${dup.email}_merged_${dup.id.slice(0, 8)}`,
        `Fusionné vers ${primary.email}`,
        now(),
        dup.id,
      ),
    );
  }

  await db.batch(statements);

  await addAuditLog(db, "user", primaryId, "merge", {
    mergedIds: duplicateIds,
    mergedEmails: duplicates.results.map(d => d.email),
  });

  return { success: true };
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function getPayments(
  db: D1Database,
  page = 1,
  limit = 20,
): Promise<PaginatedResult<DbPayment>> {
  const countResult = await db.prepare("SELECT COUNT(*) as total FROM payments").first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    "SELECT * FROM payments ORDER BY created_at DESC LIMIT ? OFFSET ?",
  ).bind(limit, offset).all<DbPayment>();

  return { data: result.results, total, page, limit };
}

export async function getPaymentByBookingId(
  db: D1Database,
  bookingId: string,
): Promise<DbPayment | null> {
  return db.prepare("SELECT * FROM payments WHERE booking_id = ?").bind(bookingId).first<DbPayment>();
}

export async function markPaymentPaid(
  db: D1Database,
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
  if (!payment) return { success: false, error: "Paiement introuvable" };

  const timestamp = now();

  await db.batch([
    db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?").bind(timestamp, paymentId),
    db.prepare("UPDATE bookings SET payment_status = 'paid', updated_at = ? WHERE id = ?").bind(timestamp, payment.booking_id),
  ]);

  await addAuditLog(db, "payment", paymentId, "mark-paid", { bookingId: payment.booking_id });

  return { success: true };
}

export async function refundPayment(
  db: D1Database,
  paymentId: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
  if (!payment) return { success: false, error: "Paiement introuvable" };

  if (amount > payment.amount - payment.refunded_amount) {
    return { success: false, error: "Montant de remboursement trop élevé" };
  }

  const newRefunded = payment.refunded_amount + amount;
  const newStatus: DbPaymentStatus = newRefunded >= payment.amount ? "refunded" : "partial-refund";

  await db.prepare(
    "UPDATE payments SET refunded_amount = ?, status = ? WHERE id = ?",
  ).bind(newRefunded, newStatus, paymentId).run();

  await addAuditLog(db, "payment", paymentId, "refund", { amount, total: newRefunded });

  return { success: true };
}

// ─── Blocked Slots ───────────────────────────────────────────────────────────

export async function getBlockedSlots(
  db: D1Database,
  studioId?: string,
  date?: string,
): Promise<DbBlockedSlot[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (studioId) {
    conditions.push("(studio_id = ? OR studio_id IS NULL)");
    params.push(studioId);
  }
  if (date) {
    conditions.push("date = ?");
    params.push(date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.prepare(
    `SELECT * FROM blocked_slots ${where} ORDER BY date ASC, start_time ASC`,
  ).bind(...params).all<DbBlockedSlot>();

  return result.results;
}

export async function addBlockedSlot(
  db: D1Database,
  data: { studio_id: string | null; date: string; start_time: string; end_time: string; reason: string },
): Promise<{ success: boolean; id: string }> {
  const id = generateId();

  await db.prepare(`
    INSERT INTO blocked_slots (id, studio_id, date, start_time, end_time, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, data.studio_id, data.date, data.start_time, data.end_time, data.reason, now()).run();

  return { success: true, id };
}

export async function removeBlockedSlot(
  db: D1Database,
  slotId: string,
): Promise<{ success: boolean }> {
  const result = await db.prepare("DELETE FROM blocked_slots WHERE id = ?").bind(slotId).run();
  return { success: result.meta.changes > 0 };
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export async function getPricing(db: D1Database): Promise<DbPricing[]> {
  const result = await db.prepare(
    "SELECT * FROM pricing ORDER BY studio_id, group_type, is_peak",
  ).all<DbPricing>();
  return result.results;
}

export async function updatePricing(
  db: D1Database,
  id: string,
  pricePerHalfHour: number,
): Promise<{ success: boolean }> {
  const result = await db.prepare(
    "UPDATE pricing SET price_per_half_hour = ?, updated_at = ? WHERE id = ?",
  ).bind(pricePerHalfHour, now(), id).run();
  return { success: result.meta.changes > 0 };
}

export async function getPricingForBooking(
  db: D1Database,
  studioId: string,
  groupType: string,
  isPeak: boolean,
): Promise<number> {
  const result = await db.prepare(
    "SELECT price_per_half_hour FROM pricing WHERE studio_id = ? AND group_type = ? AND is_peak = ?",
  ).bind(studioId, groupType, isPeak ? 1 : 0).first<{ price_per_half_hour: number }>();
  return result?.price_per_half_hour ?? 0;
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export async function getEquipment(db: D1Database): Promise<DbEquipment[]> {
  const result = await db.prepare("SELECT * FROM equipment ORDER BY equipment_id").all<DbEquipment>();
  return result.results;
}

export async function updateEquipment(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbEquipment, "name" | "max_per_session" | "pricing_type" | "session_pricing" | "price_per_hour">>,
): Promise<{ success: boolean }> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false };

  sets.push("updated_at = ?");
  params.push(now());
  params.push(id);

  const result = await db.prepare(
    `UPDATE equipment SET ${sets.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return { success: result.meta.changes > 0 };
}

// ─── Promo Codes ─────────────────────────────────────────────────────────────

export async function getPromoCodes(db: D1Database): Promise<DbPromoCode[]> {
  const result = await db.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all<DbPromoCode>();
  return result.results;
}

export async function createPromoCode(
  db: D1Database,
  data: { code: string; type: "percentage" | "fixed"; value: number; min_total?: number; expires_at?: string; max_usage?: number },
): Promise<{ success: boolean; id: string }> {
  const id = generateId();

  await db.prepare(`
    INSERT INTO promo_codes (id, code, type, value, min_total, is_active, expires_at, usage_count, max_usage, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
  `).bind(
    id, data.code.toUpperCase(), data.type, data.value,
    data.min_total ?? 0, data.expires_at ?? null,
    data.max_usage ?? null, now(),
  ).run();

  return { success: true, id };
}

export async function updatePromoCode(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbPromoCode, "code" | "type" | "value" | "min_total" | "is_active" | "expires_at" | "max_usage">>,
): Promise<{ success: boolean }> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false };

  params.push(id);

  const result = await db.prepare(
    `UPDATE promo_codes SET ${sets.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return { success: result.meta.changes > 0 };
}

export async function validatePromoCode(
  db: D1Database,
  code: string,
  total: number,
): Promise<{ valid: boolean; promo?: DbPromoCode; error?: string }> {
  const promo = await db.prepare(
    "SELECT * FROM promo_codes WHERE code = ? AND is_active = 1",
  ).bind(code.trim().toUpperCase()).first<DbPromoCode>();

  if (!promo) return { valid: false, error: "Code promo invalide" };

  if (promo.expires_at && promo.expires_at < now()) {
    return { valid: false, error: "Code promo expiré" };
  }

  if (promo.max_usage !== null && promo.usage_count >= promo.max_usage) {
    return { valid: false, error: "Code promo épuisé" };
  }

  if (promo.min_total > 0 && total < promo.min_total) {
    return { valid: false, error: `Montant minimum de ${promo.min_total}€ requis` };
  }

  return { valid: true, promo };
}

// ─── Opening Hours ───────────────────────────────────────────────────────────

export async function getOpeningHours(db: D1Database): Promise<DbOpeningHours[]> {
  const result = await db.prepare(
    "SELECT * FROM opening_hours ORDER BY studio_id, day_of_week",
  ).all<DbOpeningHours>();
  return result.results;
}

export async function updateOpeningHours(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbOpeningHours, "open_time" | "close_time" | "is_closed">>,
): Promise<{ success: boolean }> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) return { success: false };

  params.push(id);

  const result = await db.prepare(
    `UPDATE opening_hours SET ${sets.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return { success: result.meta.changes > 0 };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(
  db: D1Database,
  key: string,
): Promise<string | null> {
  const result = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return result?.value ?? null;
}

export async function setSetting(
  db: D1Database,
  key: string,
  value: string,
): Promise<{ success: boolean }> {
  const existing = await db.prepare("SELECT id FROM settings WHERE key = ?").bind(key).first<{ id: string }>();

  if (existing) {
    await db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = ?").bind(value, now(), key).run();
  } else {
    await db.prepare(
      "INSERT INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(generateId(), key, value, now()).run();
  }

  return { success: true };
}

export async function getAllSettings(db: D1Database): Promise<DbSetting[]> {
  const result = await db.prepare("SELECT * FROM settings ORDER BY key").all<DbSetting>();
  return result.results;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export async function addAuditLog(
  db: D1Database,
  entityType: string,
  entityId: string,
  action: string,
  changes: Record<string, unknown>,
  performedBy = "admin",
): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, changes, performed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(), entityType, entityId, action,
    JSON.stringify(changes), performedBy, now(),
  ).run();
}

export async function getAuditLogs(
  db: D1Database,
  filters: AuditLogFilters = {},
  page = 1,
  limit = 50,
): Promise<PaginatedResult<DbAuditLog>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.entityType) {
    conditions.push("entity_type = ?");
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    conditions.push("entity_id = ?");
    params.push(filters.entityId);
  }
  if (filters.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters.dateFrom) {
    conditions.push("created_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("created_at <= ?");
    params.push(filters.dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${where}`).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<DbAuditLog>();

  return { data: result.results, total, page, limit };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  todayBookings: number;
  todayRevenue: number;
  weekBookings: number;
  weekRevenue: number;
  monthBookings: number;
  monthRevenue: number;
  pendingPayments: number;
  pendingAmount: number;
  occupancyToday: number;
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const today = getParisDateISO();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = getParisDateISO(weekStart);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = getParisDateISO(monthStart);

  const [todayResult, weekResult, monthResult, pendingResult, occupancyResult] = await db.batch([
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(weekStartStr, today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(monthStartStr, today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'pending'",
    ),
    db.prepare(
      "SELECT start_time, end_time FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
  ]);

  type CountRevenue = { count: number; revenue: number };
  type CountTotal = { count: number; total: number };
  type TimeRange = { start_time: string; end_time: string };

  const todayRow = (todayResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const weekRow = (weekResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const monthRow = (monthResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const pendingRow = (pendingResult.results as unknown as CountTotal[])[0] ?? { count: 0, total: 0 };
  const todaySlots = occupancyResult.results as unknown as TimeRange[];

  const ALL_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
    "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
  ];

  const totalSlots = ALL_SLOTS.length * 2;
  let usedSlots = 0;
  for (const row of todaySlots) {
    const startIdx = ALL_SLOTS.indexOf(row.start_time);
    let endIdx = ALL_SLOTS.indexOf(row.end_time);
    if (endIdx === -1) endIdx = ALL_SLOTS.length;
    if (startIdx !== -1) usedSlots += endIdx - startIdx;
  }

  return {
    todayBookings: todayRow.count,
    todayRevenue: todayRow.revenue,
    weekBookings: weekRow.count,
    weekRevenue: weekRow.revenue,
    monthBookings: monthRow.count,
    monthRevenue: monthRow.revenue,
    pendingPayments: pendingRow.count,
    pendingAmount: pendingRow.total,
    occupancyToday: totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0,
  };
}
