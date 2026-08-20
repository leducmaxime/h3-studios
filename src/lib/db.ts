import {
  type DbBooking,
  type DbUser,
  type DbPayment,
  type AdminPaymentRow,
  type AdminPaymentFilters,
  type DbBlockedSlot,
  type DbPricing,
  type DbEquipment,
  type DbPromoCode,
  type DbOpeningHours,
  type DbSetting,
  type DbAuditLog,
  type DbAuditLogWithDetails,
  type PaginatedResult,
  type BookingFilters,
  type UserFilters,
  type AuditLogFilters,
  type BookingStatus,
  type DbPaymentStatus,
  type DbPaymentConfirmation,
  type DbPaymentRefund,
  type DbPaymentWithRefund,
  type CreateBooking,
  type DashboardStats,
} from "./db-types";
import { getParisDateISO, getParisNow, getISOWeekStartUTCNoon } from "./utils";
import { ALL_TIME_SLOTS, STUDIO_HOURS, type StudioId } from "./booking";
import { applyDiscountRounding, getBookingAmountDue } from "./booking-totals";

/** Normalise "00:00" en "24:00" pour les comparaisons de strings SQL.
 *  "00:00" est plus petit que toutes les heures en string compare,
 *  ce qui casse les gardes start_time < ? AND end_time > ?. */
function normEnd(time: string): string {
  return time === "00:00" ? "24:00" : time;
}

/** Clause SQL pour comparer end_time en traitant "00:00" comme "24:00" */
const END_CMP = "CASE WHEN end_time = '00:00' THEN '24:00' ELSE end_time END";

const PAID_BY_BOOKING_CTE = `paid_by_booking AS (
  SELECT booking_id, COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN amount - refunded_amount ELSE 0 END), 0) as paid_amount
  FROM payments
  GROUP BY booking_id
)`;

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
    conditions.push("(b.booking_ref LIKE ? OR u.name LIKE ? OR u.band_name LIKE ? OR b.band_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  if (filters.dateDirection && filters.dateDirection !== "all") {
    const today = getParisDateISO();
    if (filters.dateDirection === "upcoming") {
      conditions.push("b.date >= ?");
      params.push(today);
      conditions.push("b.status != 'cancelled'");
    } else if (filters.dateDirection === "past") {
      conditions.push("b.date < ?");
      params.push(today);
    } else if (filters.dateDirection === "now") {
      conditions.push("b.date = ?");
      params.push(today);
      const parisNow = getParisNow();
      const nowTimeStr = `${String(parisNow.hours).padStart(2, "0")}:${String(parisNow.minutes).padStart(2, "0")}`;
      // Disparaît 15 min après la fin : end_time + 15min > now → end_time > now - 15min
      const nowMinus15 = parisNow.hours * 60 + parisNow.minutes - 15;
      const nm15H = Math.floor(Math.max(0, nowMinus15) / 60);
      const nm15M = Math.max(0, nowMinus15) % 60;
      const nowMinus15Str = `${String(nm15H).padStart(2, "0")}:${String(nm15M).padStart(2, "0")}`;
      conditions.push("b.start_time <= ? AND b.end_time > ?");
      params.push(nowTimeStr, nowMinus15Str);
      conditions.push("b.status NOT IN ('cancelled', 'no-show')");
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const joinUser = "LEFT JOIN users u ON b.user_id = u.id";

  const countSql = `SELECT COUNT(*) as total FROM bookings b ${joinUser} ${where}`;
  const countResult = await db.prepare(countSql).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;

  const sortBy = filters.sortBy || "created_at";
  const sortOrder = filters.sortOrder || "desc";

  const validSortFields = ["date", "start_time", "total_price", "status", "payment_status", "created_at"];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "date";
  const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const secondarySort = safeSortBy === "date" ? `, b.start_time ${safeSortOrder}` : "";
  const dataSql = `SELECT b.*, u.name as user_name, u.email as user_email, u.band_name as user_band_name, u.phone as user_phone FROM bookings b ${joinUser} ${where} ORDER BY b.${safeSortBy} ${safeSortOrder}${secondarySort}, b.created_at DESC LIMIT ? OFFSET ?`;
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

export async function getBookingsByRefs(
  db: D1Database,
  refs: string[],
): Promise<DbBooking[]> {
  if (refs.length === 0) return [];
  const placeholders = refs.map(() => "?").join(", ");
  const result = await db.prepare(
    `SELECT * FROM bookings WHERE booking_ref IN (${placeholders}) ORDER BY created_at ASC`,
  ).bind(...refs).all<DbBooking>();
  return result.results;
}

export async function createBooking(
  db: D1Database,
  data: CreateBooking,
): Promise<DbBooking> {
  const id = generateId();
  const timestamp = now();

  // INSERT atomique avec garde anti-conflit (TOCTOU fix)
  // Si un conflit existe déjà pour ce studio/date/start_time, l'INSERT échoue silencieusement
  const result = await db.prepare(`
    INSERT INTO bookings (id, booking_ref, user_id, band_name, client_type, legal_name, siret, rna, instagram_accounts, studio_id, date, start_time, end_time,
      group_type, status, base_price, equipment_price, total_price, equipment,
      payment_method, payment_status, notes, round_mode, promo_code, promo_discount, promo_type, created_at, updated_at, cancelled_at, cancel_reason)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings
      WHERE studio_id = ? AND date = ? AND status != 'cancelled'
        AND start_time < ?
        AND CASE WHEN end_time = '00:00' THEN '24:00' ELSE end_time END > ?
    )
  `).bind(
    id, data.booking_ref, data.user_id, data.band_name, data.client_type, data.legal_name, data.siret, data.rna, data.instagram_accounts, data.studio_id, data.date,
    data.start_time, data.end_time, data.group_type, data.status,
    data.base_price, data.equipment_price, data.total_price,
    data.equipment, data.payment_method, data.payment_status,
    data.notes, data.round_mode, data.promo_code || null, data.promo_discount, data.promo_type || null, timestamp, timestamp, data.cancelled_at, data.cancel_reason,
    // Paramètres pour le WHERE NOT EXISTS
    data.studio_id, data.date, normEnd(data.end_time), data.start_time,
  ).run();

  if (result.meta.changes === 0) {
    throw new Error("Conflit de créneau détecté — réservation non créée");
  }

  return (await getBookingById(db, id))!;
}

export async function updateBooking(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbBooking, "status" | "payment_status" | "notes" | "date" | "start_time" | "end_time" | "studio_id" | "base_price" | "equipment_price" | "total_price" | "equipment" | "cancelled_at" | "cancel_reason" | "keep_balance_due" | "promo_discount" | "promo_code" | "promo_type">>,
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
  const params: unknown[] = [studioId, date, normEnd(endTime), startTime];
  let excludeClause = "";

  if (excludeBookingId) {
    excludeClause = "AND id != ?";
    params.push(excludeBookingId);
  }

  // Treat "00:00" as "24:00" for string comparison — "00:00" means midnight/end of day
  return db.prepare(`
    SELECT * FROM bookings
    WHERE studio_id = ? AND date = ? AND status != 'cancelled'
      AND start_time < ?
      AND CASE WHEN end_time = '00:00' THEN '24:00' ELSE end_time END > ?
      ${excludeClause}
    LIMIT 1
  `).bind(...params).first<DbBooking>();
}

// ─── Blocked Slot Conflict Check ─────────────────────────────────────────────

export async function checkBlockedSlotConflict(
  db: D1Database,
  studioId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<DbBlockedSlot | null> {
  // Check for blocked slots that overlap with the requested time
  // studio_id can be NULL (blocks all studios) or specific studio
  // Note: end_time = '00:00' means midnight/end of day (toute la journée)
  // A blocked slot overlaps if:
  //   - The blocked slot starts before the booking ends
  //   - AND the blocked slot ends after the booking starts (or is 00:00 meaning all day)
  return db.prepare(`
    SELECT * FROM blocked_slots
    WHERE date = ?
      AND (studio_id = ? OR studio_id IS NULL)
      AND (
        -- Case 1: Blocked slot ends at midnight (toute la journée) - blocks everything
        end_time = '00:00'
        OR
        -- Case 2: Blocked slot has specific times - check overlap
        (start_time < ? AND end_time > ?)
      )
    LIMIT 1
  `).bind(date, studioId, normEnd(endTime), startTime).first<DbBlockedSlot>();
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

  const hasBookings = filters.hasBookings;

  if (filters.search) {
    conditions.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.band_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.isBlocked !== undefined) {
    conditions.push("u.is_blocked = ?");
    params.push(filters.isBlocked ? 1 : 0);
  }

  if (hasBookings !== undefined) {
    conditions.push(hasBookings ? "COALESCE(s.total_bookings, 0) > 0" : "COALESCE(s.total_bookings, 0) = 0");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortBy = filters.sortBy || "created_at";
  const sortOrder = filters.sortOrder || "desc";
  const validSortFields = ["created_at", "name", "total_bookings", "total_spent"];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const sortExpr = (() => {
    switch (safeSortBy) {
      case "name":
        return "u.name";
      case "total_bookings":
        return "COALESCE(s.total_bookings, 0)";
      case "total_spent":
        return "COALESCE(s.total_spent, 0)";
      case "created_at":
      default:
        return "u.created_at";
    }
  })();

  const countResult = await db.prepare(
    `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) as total_bookings,
          COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as total_spent
        FROM bookings
        WHERE status != 'cancelled'
        GROUP BY user_id
      ) s ON u.id = s.user_id
      ${where}
    `,
  ).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;

  const result = await db.prepare(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash,
        u.name,
        u.first_name,
        u.last_name,
        u.phone,
        u.band_name,
        u.client_type,
        u.legal_name,
        u.siret,
        u.rna,
        u.instagram_accounts,
        u.notes,
        u.address_line1,
        u.address_line2,
        u.postal_code,
        u.city,
        u.country,
        u.is_blocked,
        COALESCE(s.total_bookings, 0) as total_bookings,
        COALESCE(s.total_spent, 0) as total_spent,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) as total_bookings,
          COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as total_spent
        FROM bookings
        WHERE status != 'cancelled'
        GROUP BY user_id
      ) s ON u.id = s.user_id
      ${where}
      ORDER BY ${sortExpr} ${safeSortOrder}, u.created_at DESC
      LIMIT ? OFFSET ?
    `,
  ).bind(...params, limit, offset).all<DbUser>();

  return { data: result.results, total, page, limit };
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<DbUser | null> {
  return db.prepare(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash,
        u.name,
        u.first_name,
        u.last_name,
        u.phone,
        u.band_name,
        u.client_type,
        u.legal_name,
        u.siret,
        u.rna,
        u.instagram_accounts,
        u.notes,
        u.address_line1,
        u.address_line2,
        u.postal_code,
        u.city,
        u.country,
        u.is_blocked,
        COALESCE(s.total_bookings, 0) as total_bookings,
        COALESCE(s.total_spent, 0) as total_spent,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) as total_bookings,
          COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as total_spent
        FROM bookings
        WHERE status != 'cancelled'
        GROUP BY user_id
      ) s ON u.id = s.user_id
      WHERE u.id = ?
    `,
  ).bind(id).first<DbUser>();
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<DbUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  return db.prepare(
    `SELECT u.*, COALESCE(s.total_bookings, 0) as total_bookings, COALESCE(s.total_spent, 0) as total_spent
     FROM users u
     LEFT JOIN (
       SELECT user_id, COUNT(*) as total_bookings, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as total_spent
       FROM bookings WHERE status != 'cancelled' GROUP BY user_id
     ) s ON u.id = s.user_id
     WHERE LOWER(TRIM(u.email)) = ?`,
  ).bind(normalizedEmail).first<DbUser>();
}

/**
 * Atomically find or create a user by normalized email.
 * Uses INSERT OR IGNORE to avoid SELECT-then-INSERT races.
 * For a pre-existing user: does NOT update profile fields (PII-overwrite protection).
 * For a newly created user: populates name, phone, band_name, address from profile.
 * Returns { user, wasCreated }.
 */
export async function findOrCreateUserByEmail(
  db: D1Database,
  email: string,
  profile: {
    name: string;
    first_name?: string;
    last_name?: string;
    client_type?: string;
    legal_name?: string;
    siret?: string;
    rna?: string;
    instagram_accounts?: string;
    phone?: string;
    band_name?: string;
    address_line1?: string;
    postal_code?: string;
    city?: string;
  },
): Promise<{ user: DbUser; wasCreated: boolean }> {
  const id = generateId();
  const timestamp = now();
  const normalizedEmail = email.trim().toLowerCase();

  const result = await db.prepare(`
    INSERT OR IGNORE INTO users (id, email, name, first_name, last_name, phone, band_name, client_type, legal_name, siret, rna, instagram_accounts, address_line1, postal_code, city, is_blocked, total_bookings, total_spent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(
    id,
    normalizedEmail,
    profile.name,
    profile.first_name ?? null,
    profile.last_name ?? null,
    profile.phone ?? null,
    profile.band_name ?? null,
    profile.client_type ?? "particulier",
    profile.legal_name ?? null,
    profile.siret ?? null,
    profile.rna ?? null,
    profile.instagram_accounts ?? null,
    profile.address_line1 ?? null,
    profile.postal_code ?? null,
    profile.city ?? null,
    timestamp,
    timestamp,
  ).run();

  const wasCreated = result.meta.changes > 0;

  // If changes === 0, the email already existed — wasCreated = false.
  // We still SELECT to get the authoritative row (which was NOT overwritten).
  const user = await getUserByEmail(db, normalizedEmail);
  if (!user) {
    throw new Error("Utilisateur introuvable après création");
  }

  return { user, wasCreated };
}

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  passwordHash: string,
): Promise<{ success: boolean }> {
  const result = await db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
  ).bind(passwordHash, now(), userId).run();
  return { success: result.meta.changes > 0 };
}

export async function createUser(
  db: D1Database,
  data: {
    name: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    band_name?: string;
    notes?: string;
    address_line1?: string;
    address_line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  },
): Promise<DbUser> {
  const id = generateId();
  const timestamp = now();

  await db.prepare(`
    INSERT INTO users (id, email, name, first_name, last_name, phone, band_name, notes, address_line1, address_line2, postal_code, city, country, is_blocked, total_bookings, total_spent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(
    id,
    data.email ? data.email.trim().toLowerCase() : null,
    data.name,
    data.first_name ?? null,
    data.last_name ?? null,
    data.phone ?? null,
    data.band_name ?? null,
    data.notes ?? null,
    data.address_line1 ?? null,
    data.address_line2 ?? null,
    data.postal_code ?? null,
    data.city ?? null,
    data.country ?? null,
    timestamp,
    timestamp,
  ).run();

  return (await getUserById(db, id))!;
}

export async function updateUser(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbUser, "email" | "name" | "first_name" | "last_name" | "phone" | "band_name" | "notes" | "is_blocked" | "total_bookings" | "total_spent" | "address_line1" | "address_line2" | "postal_code" | "city" | "country" | "password_hash" | "client_type" | "legal_name" | "siret" | "rna" | "instagram_accounts">>,
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
  const uniqueDuplicateIds = Array.from(new Set(duplicateIds)).filter((id) => id !== primaryId);
  if (uniqueDuplicateIds.length === 0) return { success: true };

  const primary = await getUserById(db, primaryId);
  if (!primary) return { success: false, error: "Utilisateur principal introuvable" };

  const placeholders = uniqueDuplicateIds.map(() => "?").join(", ");
  const duplicates = await db.prepare(
    `SELECT * FROM users WHERE id IN (${placeholders})`,
  ).bind(...uniqueDuplicateIds).all<DbUser>();

  if (duplicates.results.length !== uniqueDuplicateIds.length) {
    return { success: false, error: "Certains utilisateurs sont introuvables" };
  }

  const statements: D1PreparedStatement[] = [];

  statements.push(
    db.prepare(`UPDATE bookings SET user_id = ?, updated_at = ? WHERE user_id IN (${placeholders})`).bind(primaryId, now(), ...uniqueDuplicateIds),
  );

  const mergedEmails = duplicates.results.map((d) => d.email).filter(Boolean).join(", ") || "(sans email)";
  const newNotes = primary.notes
    ? `${primary.notes}\nFusionné avec: ${mergedEmails}`
    : `Fusionné avec: ${mergedEmails}`;

  statements.push(
    db.prepare("UPDATE users SET notes = ?, updated_at = ? WHERE id = ?").bind(newNotes, now(), primaryId),
  );

  statements.push(
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).bind(...uniqueDuplicateIds),
  );

  await db.batch(statements);

  await addAuditLog(db, "user", primaryId, "merge", {
    mergedIds: uniqueDuplicateIds,
    mergedEmails: duplicates.results.map((d) => d.email),
  });

  return { success: true };
}

// ─── Payments ────────────────────────────────────────────────────────────────

/** CTE SQL partagée pour enrichir les vrais enregistrements de paiement uniquement */
function buildPaymentsCTE(): string {
  return `
    WITH payments_enriched AS (
      SELECT
        p.id as id,
        p.booking_id as booking_id,
        p.amount as amount,
        CASE
          WHEN p.method IN ('cheque', 'check') THEN 'check'
          ELSE p.method
        END as method,
        p.status as status,
        p.refunded_amount as refunded_amount,
        p.paid_at as paid_at,
        p.created_at as created_at,
        p.stripe_event_id as stripe_event_id,
        COALESCE((SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status IN ('succeeded', 'pending', 'requires_action')), 0) as refund_reserved_cents,
        MAX(0, ROUND(p.amount * 100) - COALESCE((SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status IN ('succeeded', 'pending', 'requires_action')), 0)) / 100.0 as refundable_amount,
        COALESCE((SELECT SUM(amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status = 'pending'), 0) as refund_pending_cents,
        b.booking_ref as booking_ref,
        COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.name) as user_name,
        u.band_name as user_band_name,
        u.id as user_id,
        b.date as booking_date,
        CASE
          WHEN b.payment_status = 'pay-on-site' THEN 'on-site'
          WHEN p.method = 'card' THEN 'online'
          ELSE 'on-site'
        END as payment_type
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      LEFT JOIN users u ON u.id = b.user_id
    )
  `;
}

export async function getPayments(
  db: D1Database,
  filters: AdminPaymentFilters = {},
  page = 1,
  limit = 20,
): Promise<PaginatedResult<AdminPaymentRow>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    if (filters.status === "refunded") {
      conditions.push("status IN ('refunded', 'partial-refund')");
    } else {
      conditions.push("status = ?");
      params.push(filters.status);
    }
  }

  if (filters.method) {
    conditions.push("method = ?");
    params.push(filters.method);
  }

  if (filters.paymentType) {
    conditions.push("payment_type = ?");
    params.push(filters.paymentType);
  }

  if (filters.search) {
    conditions.push("(booking_ref LIKE ? OR user_name LIKE ? OR user_band_name LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.dateFrom) {
    conditions.push("booking_date >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push("booking_date <= ?");
    params.push(filters.dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortBy = filters.sortBy || "created_at";
  const sortOrder = filters.sortOrder || "desc";
  const validSortFields = ["created_at", "booking_date", "amount", "status", "method", "payment_type"];
  const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const countResult = await db.prepare(
    `${buildPaymentsCTE()}
      SELECT COUNT(*) as total FROM payments_enriched ${where}
    `,
  ).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const statsResult = await db.prepare(
    `${buildPaymentsCTE()}
      SELECT
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pendingAmount,
        COUNT(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN 1 END) as paidCount,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN amount - refunded_amount ELSE 0 END), 0) as paidAmount
      FROM payments_enriched ${where}
    `,
  ).bind(...params).first<{ pendingCount: number; pendingAmount: number; paidCount: number; paidAmount: number }>();

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `${buildPaymentsCTE()}
      SELECT * FROM payments_enriched ${where}
      ORDER BY ${safeSortBy} ${safeSortOrder}, created_at DESC
      LIMIT ? OFFSET ?
    `,
  ).bind(...params, limit, offset).all<AdminPaymentRow>();

  return {
    data: result.results,
    total,
    page,
    limit,
    stats: {
      pendingCount: statsResult?.pendingCount ?? 0,
      pendingAmount: statsResult?.pendingAmount ?? 0,
      paidCount: statsResult?.paidCount ?? 0,
      paidAmount: statsResult?.paidAmount ?? 0,
    },
  };
}

export async function getPaymentsByBookingId(
  db: D1Database,
  bookingId: string,
): Promise<DbPaymentWithRefund[]> {
  const result = await db.prepare(
    `SELECT
      p.id as id,
      p.booking_id as booking_id,
      p.amount as amount,
      CASE WHEN p.method IN ('cheque', 'check') THEN 'check' ELSE p.method END as method,
      p.status as status,
      p.refunded_amount as refunded_amount,
      p.paid_at as paid_at,
      p.created_at as created_at,
      p.stripe_event_id as stripe_event_id,
      COALESCE((SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status IN ('succeeded', 'pending', 'requires_action')), 0) as refund_reserved_cents,
      CASE WHEN p.status IN ('paid', 'refunded', 'partial-refund') THEN MAX(0, ROUND(p.amount * 100) - MAX(COALESCE((SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status IN ('succeeded', 'pending', 'requires_action')), 0), ROUND(p.refunded_amount * 100))) / 100.0 ELSE 0 END as refundable_amount
      ,COALESCE((SELECT SUM(amount_cents) FROM payment_refunds pr WHERE pr.payment_id = p.id AND pr.status = 'pending'), 0) as refund_pending_cents
    FROM payments p
    WHERE p.booking_id = ?
    ORDER BY p.created_at ASC`,
  ).bind(bookingId).all<DbPaymentWithRefund>();
  return result.results;
}

/**
 * Recalcule et met à jour booking.payment_status en fonction des paiements réels.
 * À appeler après tout add/update/delete/refund de paiement.
 * Idempotent : ne fait pas d'UPDATE si la valeur ne change pas.
 */
export async function recomputeBookingPaymentStatus(db: D1Database, bookingId: string): Promise<void> {
  const booking = await db.prepare(
    "SELECT id, base_price, equipment_price, total_price, promo_discount, payment_method, payment_status FROM bookings WHERE id = ?"
  ).bind(bookingId).first<{
    id: string; base_price: number; equipment_price: number; total_price: number;
    promo_discount: number; payment_method: string; payment_status: string;
  }>();
  if (!booking) return;

  const payments = await db.prepare(
    "SELECT amount, status, refunded_amount FROM payments WHERE booking_id = ?"
  ).bind(bookingId).all<{ amount: number; status: string; refunded_amount: number }>();

  const rows = payments.results || [];
  const totalCollected = rows
    .filter(p => p.status === "paid" || p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalRefunded = rows
    .filter(p => p.status === "refunded" || p.status === "partial-refund")
    .reduce((acc, p) => acc + (Number(p.refunded_amount) || 0), 0);
  const netPaid = totalCollected - totalRefunded;

  // Convention pré-remise simplifiée (audit Phase 7B : zéro ligne post-remise)
  const total = Number(booking.total_price) || 0;
  const discount = Number(booking.promo_discount) || 0;
  const finalTotal = Math.max(0, total - discount);

  let newStatus: string;
  if (finalTotal <= 0 || netPaid >= finalTotal - 0.005) {
    newStatus = "paid";
  } else if (netPaid > 0) {
    newStatus = "pay-on-site";
  } else if (booking.payment_method === "card" && booking.payment_status === "pending") {
    newStatus = "pending"; // Stripe en cours, ne pas toucher
  } else {
    newStatus = "pay-on-site";
  }

  if (newStatus !== booking.payment_status) {
    await db.prepare("UPDATE bookings SET payment_status = ?, updated_at = ? WHERE id = ?")
      .bind(newStatus, new Date().toISOString().replace("T", " ").slice(0, 19), bookingId)
      .run();
  }
}

export async function addPayment(
  db: D1Database,
  data: {
    booking_id: string;
    amount: number;
    method: string;
    status: DbPaymentStatus;
    paid_at?: string | null;
    stripe_event_id?: string | null;
  }
): Promise<{ success: boolean; id: string }> {
  const id = generateId();
  const timestamp = now();
  
  await db.prepare(
    `INSERT INTO payments (id, booking_id, amount, method, status, refunded_amount, paid_at, created_at, stripe_event_id)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    id, 
    data.booking_id, 
    data.amount, 
    data.method, 
    data.status, 
    data.paid_at || (data.status === "paid" ? timestamp : null),
    timestamp,
    data.stripe_event_id || null
  ).run();

  await recomputeBookingPaymentStatus(db, data.booking_id);
  await addAuditLog(db, "payment", id, "create", { bookingId: data.booking_id, amount: data.amount, method: data.method });

  return { success: true, id };
}

/**
 * Insertion de paiement idempotente (INSERT OR IGNORE) clé sur
 * (booking_id, stripe_event_id) — utilisé par le finaliseur de session Stripe
 * pour compléter les paiements sans doublon, y compris après un échec partiel
 * puis un retry (webhook + flux de récupération). Retourne `inserted: false`
 * quand la ligne existait déjà.
 */
export async function addPaymentIdempotent(
  db: D1Database,
  data: {
    booking_id: string;
    amount: number;
    method: string;
    status: DbPaymentStatus;
    paid_at?: string | null;
    stripe_event_id?: string | null;
  }
): Promise<{ inserted: boolean }> {
  const id = generateId();
  const timestamp = now();

  const result = await db.prepare(
    `INSERT OR IGNORE INTO payments (id, booking_id, amount, method, status, refunded_amount, paid_at, created_at, stripe_event_id)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
  ).bind(
    id,
    data.booking_id,
    data.amount,
    data.method,
    data.status,
    data.paid_at || (data.status === "paid" ? timestamp : null),
    timestamp,
    data.stripe_event_id || null,
  ).run();

  if ((result.meta?.changes ?? 0) === 0) {
    return { inserted: false };
  }

  await recomputeBookingPaymentStatus(db, data.booking_id);
  await addAuditLog(db, "payment", id, "create", { bookingId: data.booking_id, amount: data.amount, method: data.method });

  return { inserted: true };
}

export async function markPaymentPaid(
  db: D1Database,
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
  if (!payment) return { success: false, error: "Paiement introuvable" };

  const booking = await db.prepare("SELECT total_price, promo_discount, payment_status FROM bookings WHERE id = ?")
    .bind(payment.booking_id)
    .first<{ total_price: number; promo_discount: number; payment_status: string | null }>();
  if (!booking) return { success: false, error: "Réservation introuvable" };

  const timestamp = now();

  await db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?")
    .bind(timestamp, paymentId)
    .run();

  await db.prepare("UPDATE bookings SET updated_at = ? WHERE id = ?")
    .bind(timestamp, payment.booking_id)
    .run();

  await recomputeBookingPaymentStatus(db, payment.booking_id);
  await addAuditLog(db, "payment", paymentId, "mark-paid", { bookingId: payment.booking_id });

  return { success: true };
}

export async function getPaymentById(db: D1Database, paymentId: string): Promise<DbPayment | null> {
  return db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
}

export async function upsertPaymentRefund(db: D1Database, refund: { stripeRefundId: string; paymentId: string; bookingId: string; amountCents: number; status: string; reason?: string; performedBy?: string; now: string }): Promise<{ inserted: boolean }> {
  const result = await db.prepare(`INSERT INTO payment_refunds (stripe_refund_id, payment_id, booking_id, amount_cents, status, reason, performed_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_refund_id) DO NOTHING`)
    .bind(refund.stripeRefundId, refund.paymentId, refund.bookingId, Math.round(refund.amountCents), refund.status, refund.reason ?? null, refund.performedBy ?? null, refund.now, refund.now).run();
  await db.prepare("UPDATE payment_refunds SET status = ?, updated_at = ? WHERE stripe_refund_id = ?")
    .bind(refund.status, refund.now, refund.stripeRefundId).run();
  return { inserted: (result.meta?.changes ?? 0) > 0 };
}

export async function recomputePaymentRefundState(db: D1Database, paymentId: string): Promise<{ refundedAmount: number; status: DbPaymentStatus }> {
  const payment = await getPaymentById(db, paymentId);
  if (!payment) throw new Error("Paiement introuvable");
  const sum = await db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as cents FROM payment_refunds WHERE payment_id = ? AND status IN ('succeeded', 'pending')").bind(paymentId).first<{ cents: number }>();
  const ledgerCents = Math.round(sum?.cents ?? 0);
  const refundedAmount = ledgerCents / 100;
  let status = payment.status;
  if (status === "paid" || status === "refunded" || status === "partial-refund") {
    const amountCents = Math.round(payment.amount * 100);
    status = ledgerCents <= 0 ? "paid" : ledgerCents >= amountCents ? "refunded" : "partial-refund";
    await db.prepare("UPDATE payments SET refunded_amount = ?, status = ? WHERE id = ?").bind(refundedAmount, status, paymentId).run();
  }
  return { refundedAmount, status };
}

export async function getPaymentRefunds(db: D1Database, paymentId: string): Promise<DbPaymentRefund[]> {
  const result = await db.prepare("SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY created_at ASC").bind(paymentId).all<DbPaymentRefund>();
  return result.results;
}

export async function refundPayment(
  db: D1Database,
  paymentId: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
  if (!payment) return { success: false, error: "Paiement introuvable" };

  if (payment.method === "card") {
    return { success: false, error: "Les paiements carte doivent être remboursés via Stripe" };
  }

  if (amount > payment.amount - payment.refunded_amount) {
    return { success: false, error: "Montant de remboursement trop élevé" };
  }

  const newRefunded = Math.round((payment.refunded_amount + amount) * 100) / 100;
  const newStatus: DbPaymentStatus = newRefunded >= payment.amount - 0.005 ? "refunded" : "partial-refund";

  await db.prepare(
    "UPDATE payments SET refunded_amount = ?, status = ? WHERE id = ?",
  ).bind(newRefunded, newStatus, paymentId).run();

  await recomputeBookingPaymentStatus(db, payment.booking_id);
  await addAuditLog(db, "payment", paymentId, "refund", { amount, total: newRefunded });

  return { success: true };
}

export async function updatePayment(
  db: D1Database,
  paymentId: string,
  data: { amount?: number; method?: string },
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare(`
    SELECT p.*, b.payment_status as booking_payment_status
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.id = ?
  `).bind(paymentId).first<DbPayment & { booking_payment_status: string }>();

  if (!payment) return { success: false, error: "Paiement introuvable" };

  const paymentType = payment.booking_payment_status === "pay-on-site"
    ? "on-site"
    : (payment.method === "card" ? "online" : "on-site");

  if (paymentType === "online") return { success: false, error: "Impossible de modifier un paiement en ligne" };

  const validMethods = ["card", "cash", "transfer", "check"];
  if (data.method && !validMethods.includes(data.method)) {
    return { success: false, error: "Méthode de paiement invalide" };
  }
  if (data.amount !== undefined && data.amount <= 0) {
    return { success: false, error: "Le montant doit être supérieur à 0" };
  }

  if (data.amount !== undefined) {
    const booking = await db.prepare("SELECT base_price, equipment_price, total_price, promo_discount FROM bookings WHERE id = ?")
      .bind(payment.booking_id).first<{ base_price: number; equipment_price: number; total_price: number; promo_discount: number }>();
    if (booking) {
      const maxAmount = getBookingAmountDue(booking);
      if (data.amount > maxAmount) {
        return { success: false, error: `Le montant ne peut pas dépasser le prix de la réservation (${maxAmount}€)` };
      }
    }
  }

  const newAmount = data.amount ?? payment.amount;
  const newMethod = data.method ?? payment.method;

  await db.prepare(
    "UPDATE payments SET amount = ?, method = ? WHERE id = ?",
  ).bind(newAmount, newMethod, paymentId).run();

  await recomputeBookingPaymentStatus(db, payment.booking_id);
  await addAuditLog(db, "payment", paymentId, "update", { amount: newAmount, method: newMethod, previousAmount: payment.amount, previousMethod: payment.method });

  return { success: true };
}

export async function deletePayment(
  db: D1Database,
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare(`
    SELECT p.*, b.payment_status as booking_payment_status, b.total_price, b.promo_discount
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.id = ?
  `).bind(paymentId).first<DbPayment & { booking_payment_status: string; total_price: number; promo_discount: number }>();

  if (!payment) return { success: false, error: "Paiement introuvable" };

  const isOnline = payment.booking_payment_status !== "pay-on-site" && payment.method === "card";
  if (isOnline) return { success: false, error: "Impossible de supprimer un paiement en ligne" };

  await db.prepare("DELETE FROM payments WHERE id = ?").bind(paymentId).run();

  await recomputeBookingPaymentStatus(db, payment.booking_id);
  await addAuditLog(db, "payment", paymentId, "delete", { bookingId: payment.booking_id, amount: payment.amount });

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

export async function getBlockedSlotsByDateRange(
  db: D1Database,
  startDate: string,
  endDate: string,
  studioId?: string,
): Promise<DbBlockedSlot[]> {
  const conditions: string[] = ["date >= ?", "date <= ?"];
  const params: unknown[] = [startDate, endDate];

  if (studioId) {
    conditions.push("(studio_id = ? OR studio_id IS NULL)");
    params.push(studioId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
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
  return (result?.price_per_half_hour ?? 0) / 100;
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export async function getEquipment(db: D1Database): Promise<DbEquipment[]> {
  const result = await db.prepare("SELECT * FROM equipment ORDER BY equipment_id").all<DbEquipment>();
  return result.results;
}

export async function updateEquipment(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbEquipment, "name" | "max_per_session" | "stock_total" | "pricing_type" | "session_pricing" | "price_per_hour">>,
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
  data: { code: string; type: "percentage" | "fixed"; value: number; min_total?: number; expires_at?: string; max_usage?: number; round_mode?: "down" | "up" | "none" },
): Promise<{ success: boolean; id: string }> {
  const id = generateId();

  await db.prepare(`
    INSERT INTO promo_codes (id, code, type, value, min_total, is_active, expires_at, usage_count, max_usage, round_mode, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?)
  `).bind(
    id, data.code.toUpperCase(), data.type, data.value,
    data.min_total ?? 0, data.expires_at ?? null,
    data.max_usage ?? null, data.round_mode ?? "none", now(),
  ).run();

  return { success: true, id };
}

export async function updatePromoCode(
  db: D1Database,
  id: string,
  data: Partial<Pick<DbPromoCode, "code" | "type" | "value" | "min_total" | "is_active" | "expires_at" | "max_usage" | "round_mode">>,
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
): Promise<{ valid: boolean; promo?: DbPromoCode; roundedDiscount?: number; error?: string }> {
  const promo = await db.prepare(
    "SELECT * FROM promo_codes WHERE code = ? AND is_active = 1", 
  ).bind(code.trim().toUpperCase()).first<DbPromoCode>();
  if (!promo) return { valid: false, error: "Code promo invalide" };
  // Expiration
  if (promo.expires_at && new Date(promo.expires_at) < new Date(now())) return { valid: false, error: "Code promo expiré" };
  // Usage limit
  if (promo.max_usage !== null && promo.usage_count >= promo.max_usage) return { valid: false, error: "Code promo épuisé" };
  // Minimum amount
  if (promo.min_total > 0 && total < promo.min_total) return { valid: false, error: `Montant minimum de ${promo.min_total}€ TTC requis` };
  
  // Calculer la réduction
  let discount = promo.value;
  if (promo.type === "percentage") {
    discount = (total * promo.value) / 100;
  }

  // Appliquer l'arrondi configuré
  const finalDiscount = applyDiscountRounding(discount, promo.round_mode ?? "none");

  return { valid: true, promo, roundedDiscount: finalDiscount };
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

// ─── Payment confirmations (session-level dedup) ────────────────────────────

export async function getPaymentConfirmation(
  db: D1Database,
  sessionId: string,
): Promise<DbPaymentConfirmation | null> {
  return db.prepare("SELECT * FROM payment_confirmations WHERE session_id = ?")
    .bind(sessionId)
    .first<DbPaymentConfirmation>();
}

/**
 * Revendique une session Stripe pour la finalisation (ajout de paiements +
 * email consolidé). INSERT OR IGNORE : un seul appelant devient "owner" —
 * le webhook et le flux de récupération ne peuvent pas finaliser deux fois.
 */
export async function claimPaymentConfirmation(
  db: D1Database,
  sessionId: string,
  bookingRefs: string[],
): Promise<{ inserted: boolean }> {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO payment_confirmations (session_id, booking_refs, finalized_at)
     VALUES (?, ?, ?)`,
  ).bind(sessionId, bookingRefs.join(","), now()).run();
  return { inserted: (result.meta?.changes ?? 0) > 0 };
}

/**
 * Claim ATOMIQUE de la livraison email pour une session : UPDATE exclusif sur
 * `email_sent_at IS NULL`. Un seul appelant (webhook ou récupération, owner ou
 * retry) gagne le claim et envoie l'email — les concurrents voient
 * `claimed: false` et n'envoient pas. En cas d'échec d'envoi, le claim peut
 * être libéré via releasePaymentConfirmationEmail pour un retry ultérieur.
 */
export async function claimPaymentConfirmationEmail(
  db: D1Database,
  sessionId: string,
): Promise<{ claimed: boolean; claimedAt: string }> {
  const claimedAt = now();
  const result = await db.prepare(
    "UPDATE payment_confirmations SET email_sent_at = ? WHERE session_id = ? AND email_sent_at IS NULL",
  ).bind(claimedAt, sessionId).run();
  return { claimed: (result.meta?.changes ?? 0) > 0, claimedAt };
}

/** Libère le claim email (email_sent_at) après un échec d'envoi, pour retry. */
export async function releasePaymentConfirmationEmail(
  db: D1Database,
  sessionId: string,
  claimedAt: string,
): Promise<void> {
  await db.prepare(
    "UPDATE payment_confirmations SET email_sent_at = NULL WHERE session_id = ? AND email_sent_at = ?",
  ).bind(sessionId, claimedAt).run();
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
  sortBy = "date",
  sortOrder = "desc",
): Promise<PaginatedResult<DbAuditLogWithDetails>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.entityType) {
    conditions.push("a.entity_type = ?");
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    conditions.push("a.entity_id = ?");
    params.push(filters.entityId);
  }
  if (filters.action) {
    conditions.push("a.action = ?");
    params.push(filters.action);
  }
  if (filters.performedBy) {
    conditions.push("a.performed_by = ?");
    params.push(filters.performedBy);
  }
  if (filters.dateFrom) {
    conditions.push("a.created_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("a.created_at <= ?");
    params.push(filters.dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Build ORDER BY clause
  const orderColumn = sortBy === "date" ? "created_at" : sortBy === "admin" ? "performed_by" : sortBy === "entity" ? "entity_type" : "action";
  const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs a ${where}`).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `SELECT a.*, au.name as admin_name, b.booking_ref as booking_ref,
            COALESCE(booking_user.email, entity_user.email) as user_email
     FROM audit_logs a
     LEFT JOIN admin_users au ON a.performed_by = au.id
     LEFT JOIN payments p ON a.entity_type = 'payment' AND p.id = a.entity_id
     LEFT JOIN bookings b ON (a.entity_type = 'booking' AND b.id = a.entity_id)
                          OR (a.entity_type = 'payment' AND b.id = p.booking_id)
     LEFT JOIN users booking_user ON b.user_id = booking_user.id
     LEFT JOIN users entity_user ON a.entity_type = 'user' AND entity_user.id = a.entity_id
     ${where} ORDER BY a.${orderColumn} ${orderDirection} LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<DbAuditLogWithDetails>();

  return { data: result.results, total, page, limit };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

function parseDateISOToUTCNoon(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function minusDaysParisISO(todayISO: string, days: number): string {
  const d = parseDateISOToUTCNoon(todayISO);
  d.setUTCDate(d.getUTCDate() - days);
  return getParisDateISO(d);
}

export function resolveStatsRange(opts: {
  mode?: "today" | "rolling" | "week" | "month" | "year" | "custom";
  period?: "week" | "month" | "quarter" | "year";
  year?: number;
  month?: number;
  week?: number;
  dateFrom?: string;
  dateTo?: string;
  today?: string;
}): { from: string; to: string; groupByMonth: boolean } {
  const today = opts.today ?? getParisDateISO();

  // Custom date range — use directly
  if (opts.dateFrom && opts.dateTo && opts.dateFrom <= opts.dateTo) {
    const from = opts.dateFrom;
    const to = opts.dateTo;
    const fromD = parseDateISOToUTCNoon(from);
    const toD = parseDateISOToUTCNoon(to);
    const days = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
    return { from, to, groupByMonth: days > 90 };
  }

  const inferredMode = (() => {
    if (opts.mode) return opts.mode;
    if (opts.year && opts.week) return "week";
    if (opts.year && opts.month) return "month";
    if (opts.year) return "year";
    return "rolling";
  })();
  const inferredPeriod = opts.period ?? "month";

  if (inferredMode === "today") {
    return { from: today, to: today, groupByMonth: false };
  }
  if (inferredMode === "month" && opts.year && opts.month) {
    const year = Math.round(opts.year);
    const month = Math.round(opts.month);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
      const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
      return { from: getParisDateISO(from), to: getParisDateISO(to), groupByMonth: false };
    }
  }
  if (inferredMode === "week" && opts.year && opts.week) {
    const year = Math.round(opts.year);
    const week = Math.round(opts.week);
    if (year >= 2000 && year <= 2100 && week >= 1 && week <= 53) {
      const monday = getISOWeekStartUTCNoon(year, week);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return { from: getParisDateISO(monday), to: getParisDateISO(sunday), groupByMonth: false };
    }
  }
  if (inferredMode === "year" && opts.year) {
    const year = Math.round(opts.year);
    if (year >= 2000 && year <= 2100) {
      const from = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
      const to = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
      return { from: getParisDateISO(from), to: getParisDateISO(to), groupByMonth: true };
    }
  }

  // Rolling (default)
  const days = (() => {
    switch (inferredPeriod) {
      case "week": return 7;
      case "quarter": return 90;
      case "year": return 365;
      default: return 30;
    }
  })();
  return {
    from: minusDaysParisISO(today, days - 1),
    to: today,
    groupByMonth: inferredPeriod === "year",
  };
}

function getStudioOpenSlotsCount(studioId: StudioId, dayOfWeek: number): number {
  const hours = STUDIO_HOURS[studioId][dayOfWeek];
  const openIdx = ALL_TIME_SLOTS.indexOf(hours.open);
  const closeIdx = hours.close === "00:00" ? ALL_TIME_SLOTS.length : ALL_TIME_SLOTS.indexOf(hours.close);
  if (openIdx === -1) return 0;
  const safeClose = closeIdx === -1 ? ALL_TIME_SLOTS.length : closeIdx;
  return Math.max(0, safeClose - openIdx);
}

export async function getDashboardStats(
  db: D1Database,
  opts?: {
    month?: number;
    year?: number;
    week?: number;
    mode?: "today" | "rolling" | "week" | "month" | "year" | "custom";
    period?: "week" | "month" | "quarter" | "year";
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<DashboardStats> {
  const today = getParisDateISO();
  const parisNow = getParisNow();
  const nowHHMM = `${String(parisNow.hours).padStart(2, "0")}:${String(parisNow.minutes).padStart(2, "0")}`;
  const sessionEndedSql = `(b.date < ? OR (b.date = ? AND CASE WHEN b.end_time = '00:00' THEN '24:00' ELSE b.end_time END <= ?))`;
  const sessionNotEndedSql = `(b.date > ? OR (b.date = ? AND CASE WHEN b.end_time = '00:00' THEN '24:00' ELSE b.end_time END > ?))`;
  const remainingExpr = `(MAX(b.total_price - COALESCE(b.promo_discount, 0), 0) - COALESCE(paid.paid_amount, 0))`;

  const inferredMode: "today" | "rolling" | "week" | "month" | "year" | "custom" = (() => {
    if (opts?.mode) return opts.mode;
    if (opts?.year && opts?.week) return "week";
    if (opts?.year && opts?.month) return "month";
    if (opts?.year) return "year";
    return "rolling";
  })();
  const inferredPeriod: "week" | "month" | "quarter" | "year" = opts?.period || "month";

  const { from: rangeFrom, to: rangeTo } = resolveStatsRange({
    mode: opts?.mode as any,
    period: inferredPeriod,
    year: opts?.year,
    month: opts?.month,
    week: opts?.week,
    dateFrom: opts?.dateFrom,
    dateTo: opts?.dateTo,
    today,
  });

  const rangeDays = (() => {
    const from = parseDateISOToUTCNoon(rangeFrom);
    const to = parseDateISOToUTCNoon(rangeTo);
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 1;
  })();

  let weekFrom = minusDaysParisISO(today, 6);
  let weekTo = today;
  const monthFrom = minusDaysParisISO(today, 29);

  if (opts?.year && opts?.week) {
    const year = Math.round(opts.year);
    const week = Math.round(opts.week);
    if (year >= 2000 && year <= 2100 && week >= 1 && week <= 53) {
      const monday = getISOWeekStartUTCNoon(year, week);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      weekFrom = getParisDateISO(monday);
      weekTo = getParisDateISO(sunday);
    }
  }

  let reportMonthFrom: string | null = null;
  let reportMonthTo: string | null = null;
  if (opts?.year) {
    const year = Math.round(opts.year);
    if (year >= 2000 && year <= 2100) {
      if (opts?.month) {
        const month = Math.round(opts.month);
        if (month >= 1 && month <= 12) {
          const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
          const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
          reportMonthFrom = getParisDateISO(from);
          reportMonthTo = getParisDateISO(to);
        }
      } else {
        const from = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
        const to = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
        reportMonthFrom = getParisDateISO(from);
        reportMonthTo = getParisDateISO(to);
      }
    }
  }

  const [todayResult, weekResult, monthResult, pendingResult, occupancyResult, reportMonthResult, rangeResult, rangeDurationResult, rangePendingResult, rangeEquipmentResult, rangeMinMaxResult, rangeDiscountsResult, rangeCancellationsResult, rangeOverdueAggregateResult, rangeOverdueListResult] = await db.batch([
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(weekFrom, weekTo),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(monthFrom, today),
    db.prepare(
      `WITH ${PAID_BY_BOOKING_CTE}
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0)), 0) as total
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      WHERE b.status != 'cancelled'
        AND b.payment_status = 'pay-on-site'
        AND (b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0)) > 0`,
    ),
    db.prepare(
      "SELECT studio_id, start_time, end_time FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(reportMonthFrom || monthFrom, reportMonthTo || today),

    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),

    db.prepare(
      `SELECT
        COALESCE(SUM(
          (
            CASE WHEN end_time = '00:00'
              THEN 1440
              ELSE (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER))
            END
          )
          -
          (
            CASE WHEN start_time = '00:00'
              THEN 1440
              ELSE (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
            END
          )
        ), 0) as minutes
      FROM bookings
      WHERE date >= ? AND date <= ?
        AND status != 'cancelled'`,
    ).bind(rangeFrom, rangeTo),

    db.prepare(
      `WITH ${PAID_BY_BOOKING_CTE}
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0)), 0) as total
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      WHERE b.status != 'cancelled'
        AND b.payment_status = 'pay-on-site'
        AND b.date >= ? AND b.date <= ?
        AND ${sessionNotEndedSql}
        AND (b.total_price - COALESCE(b.promo_discount, 0) - COALESCE(paid.paid_amount, 0)) > 0`,
    ).bind(rangeFrom, rangeTo, today, today, nowHHMM),

    db.prepare(
      "SELECT COALESCE(SUM(equipment_price), 0) as total FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),

    db.prepare(
      "SELECT COALESCE(MIN(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as min_price, COALESCE(MAX(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as max_price FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),
    db.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN promo_code IS NOT NULL AND TRIM(promo_code) != '' THEN MIN(COALESCE(promo_discount, 0), MAX(total_price, 0)) ELSE 0 END), 0) as promo_discounts,
        COALESCE(SUM(CASE WHEN promo_code IS NULL OR TRIM(promo_code) = '' THEN MIN(COALESCE(promo_discount, 0), MAX(total_price, 0)) ELSE 0 END), 0) as manual_discounts
      FROM bookings
      WHERE date >= ? AND date <= ? AND status != 'cancelled'`,
    ).bind(rangeFrom, rangeTo),
    db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE date >= ? AND date <= ? AND status = 'cancelled'",
    ).bind(rangeFrom, rangeTo),
    db.prepare(
      `WITH ${PAID_BY_BOOKING_CTE}
      SELECT COUNT(*) as count, COALESCE(SUM(${remainingExpr}), 0) as total
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
        AND b.date >= ? AND b.date <= ?
        AND ${sessionEndedSql}
        AND ${remainingExpr} > 0.005`,
    ).bind(rangeFrom, rangeTo, today, today, nowHHMM),
    db.prepare(
      `WITH ${PAID_BY_BOOKING_CTE}
      SELECT b.id, b.booking_ref, b.date, b.start_time, b.end_time, b.studio_id, b.status,
        u.name as user_name, COALESCE(b.band_name, u.band_name) as band_name,
        ${remainingExpr} as remaining
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      LEFT JOIN users u ON u.id = b.user_id
      WHERE (b.status != 'cancelled' OR b.keep_balance_due = 1)
        AND b.date >= ? AND b.date <= ?
        AND ${sessionEndedSql}
        AND ${remainingExpr} > 0.005
      ORDER BY b.date ASC, b.start_time ASC
      LIMIT 50`,
    ).bind(rangeFrom, rangeTo, today, today, nowHHMM),
  ]);

  type CountRevenue = { count: number; revenue: number };
  type CountTotal = { count: number; total: number };
  type MinutesRow = { minutes: number | string };
  type TimeRange = { studio_id: string; start_time: string; end_time: string };

  const todayRow = (todayResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const weekRow = (weekResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const monthRow = (monthResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const pendingRow = (pendingResult.results as unknown as CountTotal[])[0] ?? { count: 0, total: 0 };
  const reportMonthRow = (reportMonthResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const rangeRow = (rangeResult.results as unknown as CountRevenue[])[0] ?? { count: 0, revenue: 0 };
  const rangeDurationRow = (rangeDurationResult.results as unknown as MinutesRow[])[0] ?? { minutes: 0 };
  const rangePendingRow = (rangePendingResult.results as unknown as CountTotal[])[0] ?? { count: 0, total: 0 };
  const rangeEquipmentRow = (rangeEquipmentResult.results as unknown as Array<{ total: number }>)[0] ?? { total: 0 };
  const rangeMinMaxRow = (rangeMinMaxResult.results as unknown as Array<{ min_price: number; max_price: number }>)[0] ?? { min_price: 0, max_price: 0 };
  const rangeDiscountsRow = (rangeDiscountsResult.results as unknown as Array<{ promo_discounts: number; manual_discounts: number }>)[0] ?? { promo_discounts: 0, manual_discounts: 0 };
  const rangeCancellationsRow = (rangeCancellationsResult.results as unknown as Array<{ count: number }>)[0] ?? { count: 0 };
  const rangeOverdueRow = (rangeOverdueAggregateResult.results as unknown as Array<{ count: number; total: number }>)[0] ?? { count: 0, total: 0 };
  const rangeOverdueBookings = (rangeOverdueListResult.results as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    remaining: Number(row.remaining) || 0,
  })) as DashboardStats["rangeOverdueBookings"];
  const todaySlots = occupancyResult.results as unknown as TimeRange[];

  const rangeBookedMinutes = (() => {
    const v = rangeDurationRow.minutes;
    const n = typeof v === "string" ? parseInt(v, 10) : v;
    return Number.isFinite(n) ? n : 0;
  })();

  const dayOfWeek = parseDateISOToUTCNoon(today).getUTCDay();
  const totalSlots =
    getStudioOpenSlotsCount("la-scene", dayOfWeek) +
    getStudioOpenSlotsCount("le-podium", dayOfWeek);
  let usedSlots = 0;
  for (const row of todaySlots) {
    const startIdx = ALL_TIME_SLOTS.indexOf(row.start_time);
    let endIdx = ALL_TIME_SLOTS.indexOf(row.end_time);
    if (endIdx === -1 && row.end_time === "00:00") endIdx = ALL_TIME_SLOTS.length;
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      usedSlots += endIdx - startIdx;
    }
  }

  const monthCount = reportMonthFrom && reportMonthTo ? reportMonthRow.count : monthRow.count;
  const monthRevenue = reportMonthFrom && reportMonthTo ? reportMonthRow.revenue : monthRow.revenue;

  return {
    todayBookings: todayRow.count,
    todayRevenue: todayRow.revenue,
    weekBookings: weekRow.count,
    weekRevenue: weekRow.revenue,
    monthBookings: monthCount,
    monthRevenue,
    pendingPayments: pendingRow.count,
    pendingAmount: pendingRow.total,
    occupancyToday: totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0,

    rangeFrom,
    rangeTo,
    rangeDays,
    rangeBookings: rangeRow.count,
    rangeRevenue: rangeRow.revenue,
    rangePromoDiscounts: rangeDiscountsRow.promo_discounts,
    rangeManualDiscounts: rangeDiscountsRow.manual_discounts,
    rangeDiscounts: rangeDiscountsRow.promo_discounts + rangeDiscountsRow.manual_discounts,
    rangeCancellations: rangeCancellationsRow.count,
    rangeOverduePayments: rangeOverdueRow.count,
    rangeOverdueAmount: rangeOverdueRow.total,
    rangeOverdueBookings,
    rangeBookedMinutes,
    rangePendingPayments: rangePendingRow.count,
    rangePendingAmount: rangePendingRow.total,
    rangeEquipmentRevenue: rangeEquipmentRow.total,
    rangeMinPrice: rangeMinMaxRow.min_price,
    rangeMaxPrice: rangeMinMaxRow.max_price,
  };
}

// ─── Monthly Report Data ────────────────────────────────────────────────────

export interface MonthlyReportData {
  revenue: number;
  bookingCount: number;
  equipmentRevenue: number;
  noShowCount: number;
  avgBasket: number;
  occupancyRate: number;
  studioStats: Array<{ studio_id: string; count: number; revenue: number }>;
  paymentMethods: Array<{ method: string; count: number; revenue: number }>;
  topClients: Array<{ name: string; band_name: string | null; bookings: number; revenue: number }>;
  weeklyStats: Array<{ week: number; count: number; revenue: number }>;
}

export async function getMonthlyReportData(
  db: D1Database,
  month: number,
  year: number,
): Promise<MonthlyReportData> {
  const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  const rangeFrom = getParisDateISO(from);
  const rangeTo = getParisDateISO(to);

  const [
    revenueResult,
    equipmentResult,
    noShowResult,
    studioResult,
    paymentResult,
    topClientsResult,
    weeklyResult,
    occupancySlotsResult,
  ] = await db.batch([
    // Total revenue + booking count
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),

    // Equipment revenue
    db.prepare(
      "SELECT COALESCE(SUM(equipment_price), 0) as total FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),

    // No-show count
    db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE date >= ? AND date <= ? AND status = 'no-show'",
    ).bind(rangeFrom, rangeTo),

    // Studio breakdown
    db.prepare(
      "SELECT studio_id, COUNT(*) as count, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled' GROUP BY studio_id",
    ).bind(rangeFrom, rangeTo),

    // Payment methods
    db.prepare(
      `SELECT p.method, COUNT(*) as count, COALESCE(SUM(p.amount - COALESCE(p.refunded_amount, 0)), 0) as revenue
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE b.date >= ? AND b.date <= ? AND b.status != 'cancelled' AND p.status IN ('paid', 'refunded', 'partial-refund')
       GROUP BY p.method`,
    ).bind(rangeFrom, rangeTo),

    // Top 5 clients
    db.prepare(
      `SELECT u.name, u.band_name, COUNT(*) as bookings, COALESCE(SUM(MAX(b.total_price - COALESCE(b.promo_discount, 0), 0)), 0) as revenue
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.date >= ? AND b.date <= ? AND b.status != 'cancelled'
       GROUP BY b.user_id
       ORDER BY revenue DESC
       LIMIT 5`,
    ).bind(rangeFrom, rangeTo),

    // Weekly breakdown
    db.prepare(
      `SELECT
         CAST(strftime('%W', date) AS INTEGER) as week_num,
         COUNT(*) as count,
         COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue
       FROM bookings
       WHERE date >= ? AND date <= ? AND status != 'cancelled'
       GROUP BY week_num
       ORDER BY week_num`,
    ).bind(rangeFrom, rangeTo),

    // Occupancy: booked slots per studio per day
    db.prepare(
      "SELECT date, studio_id, start_time, end_time FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),
  ]);

  const revenueRow = revenueResult.results[0] as { count: number; revenue: number };
  const equipmentRow = equipmentResult.results[0] as { total: number };
  const noShowRow = noShowResult.results[0] as { count: number };

  const revenue = typeof revenueRow.revenue === "string" ? parseFloat(revenueRow.revenue) : revenueRow.revenue;
  const bookingCount = typeof revenueRow.count === "string" ? parseInt(revenueRow.count as unknown as string, 10) : revenueRow.count;
  const equipmentRevenue = typeof equipmentRow.total === "string" ? parseFloat(equipmentRow.total) : equipmentRow.total;
  const noShowCount = typeof noShowRow.count === "string" ? parseInt(noShowRow.count as unknown as string, 10) : noShowRow.count;
  const avgBasket = bookingCount > 0 ? Math.round((revenue / bookingCount) * 100) / 100 : 0;

  const studioStats = studioResult.results.map((r) => {
    const row = r as { studio_id: string; count: number; revenue: number };
    return {
      studio_id: row.studio_id,
      count: typeof row.count === "string" ? parseInt(row.count as unknown as string, 10) : row.count,
      revenue: typeof row.revenue === "string" ? parseFloat(row.revenue as unknown as string) : row.revenue,
    };
  });

  const paymentMethods = paymentResult.results.map((r) => {
    const row = r as { method: string; count: number; revenue: number };
    return {
      method: row.method,
      count: typeof row.count === "string" ? parseInt(row.count as unknown as string, 10) : row.count,
      revenue: typeof row.revenue === "string" ? parseFloat(row.revenue as unknown as string) : row.revenue,
    };
  });

  const topClients = topClientsResult.results.map((r) => {
    const row = r as { name: string; band_name: string | null; bookings: number; revenue: number };
    return {
      name: row.name,
      band_name: row.band_name,
      bookings: typeof row.bookings === "string" ? parseInt(row.bookings as unknown as string, 10) : row.bookings,
      revenue: typeof row.revenue === "string" ? parseFloat(row.revenue as unknown as string) : row.revenue,
    };
  });

  const weeklyStats = weeklyResult.results.map((r) => {
    const row = r as { week_num: number; count: number; revenue: number };
    return {
      week: typeof row.week_num === "string" ? parseInt(row.week_num as unknown as string, 10) : row.week_num,
      count: typeof row.count === "string" ? parseInt(row.count as unknown as string, 10) : row.count,
      revenue: typeof row.revenue === "string" ? parseFloat(row.revenue as unknown as string) : row.revenue,
    };
  });

  // Occupancy calculation: iterate over each day in range
  let totalOpenSlots = 0;
  let totalUsedSlots = 0;
  const slotRows = occupancySlotsResult.results as Array<{ date: string; studio_id: string; start_time: string; end_time: string }>;

  const fromDate = parseDateISOToUTCNoon(rangeFrom);
  const toDate = parseDateISOToUTCNoon(rangeTo);
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    const dayOfWeek = cursor.getUTCDay();
    totalOpenSlots +=
      getStudioOpenSlotsCount("la-scene", dayOfWeek) +
      getStudioOpenSlotsCount("le-podium", dayOfWeek);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const row of slotRows) {
    const startIdx = ALL_TIME_SLOTS.indexOf(row.start_time);
    let endIdx = ALL_TIME_SLOTS.indexOf(row.end_time);
    if (endIdx === -1 && row.end_time === "00:00") endIdx = ALL_TIME_SLOTS.length;
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      totalUsedSlots += endIdx - startIdx;
    }
  }

  const occupancyRate = totalOpenSlots > 0 ? Math.round((totalUsedSlots / totalOpenSlots) * 1000) / 10 : 0;

  return {
    revenue,
    bookingCount,
    equipmentRevenue,
    noShowCount,
    avgBasket,
    occupancyRate,
    studioStats,
    paymentMethods,
    topClients,
    weeklyStats,
  };
}

// ─── Orphaned Bookings Cleanup ─────────────────────────────────────────

export interface OrphanedBooking {
  id: string;
  booking_ref: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  studio_id: string;
  status: string;
  total_price: number;
}

export async function getOrphanedBookings(db: D1Database): Promise<OrphanedBooking[]> {
  const result = await db.prepare(`
    SELECT b.id, b.booking_ref, b.user_id, b.date, b.start_time, b.end_time, b.studio_id, b.status, b.total_price
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    WHERE u.id IS NULL
    ORDER BY b.date DESC, b.created_at DESC
  `).all<OrphanedBooking>();
  return result.results;
}

export async function deleteOrphanedBookings(db: D1Database): Promise<{ success: boolean; count: number }> {
  const result = await db.prepare(`
    DELETE FROM bookings
    WHERE user_id NOT IN (SELECT id FROM users)
  `).run();
  
  const count = result.meta.changes || 0;
  return { success: true, count };
}
