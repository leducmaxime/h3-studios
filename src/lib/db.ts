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
  type PaginatedResult,
  type BookingFilters,
  type UserFilters,
  type AuditLogFilters,
  type BookingStatus,
  type DbPaymentStatus,
  type CreateBooking,
} from "./db-types";
import { getParisDateISO } from "./utils";
import { ALL_TIME_SLOTS, STUDIO_HOURS, type StudioId } from "./booking";

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

  const dataSql = `SELECT b.*, u.name as user_name, u.email as user_email, u.band_name as user_band_name FROM bookings b ${joinUser} ${where} ORDER BY b.${safeSortBy} ${safeSortOrder}, b.created_at DESC LIMIT ? OFFSET ?`;
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
  data: CreateBooking,
): Promise<DbBooking> {
  const id = generateId();
  const timestamp = now();

  await db.prepare(`
    INSERT INTO bookings (id, booking_ref, user_id, band_name, studio_id, date, start_time, end_time,
      group_type, status, base_price, equipment_price, total_price, equipment,
      payment_method, payment_status, notes, round_mode, promo_discount, created_at, updated_at, cancelled_at, cancel_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, data.booking_ref, data.user_id, data.band_name, data.studio_id, data.date,
    data.start_time, data.end_time, data.group_type, data.status,
    data.base_price, data.equipment_price, data.total_price,
    data.equipment, data.payment_method, data.payment_status,
    data.notes, data.round_mode, data.promo_discount, timestamp, timestamp, data.cancelled_at, data.cancel_reason,
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

export async function checkConflictWithGroupType(
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
      AND group_type IN ('group', 'solo', 'duo')
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
  `).bind(date, studioId, endTime, startTime).first<DbBlockedSlot>();
}


export async function moveBookingToOtherStudio(
  db: D1Database,
  bookingId: string,
  newStudioId: string,
): Promise<{ success: boolean; error?: string }> {
  const booking = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(bookingId).first<DbBooking>();
  if (!booking) {
    return { success: false, error: "Réservation introuvable" };
  }

  const conflict = await checkConflict(db, newStudioId, booking.date, booking.start_time, booking.end_time, bookingId);
  if (conflict) {
    return { success: false, error: "L'autre studio n'est pas disponible pour ce créneau" };
  }

  await db.prepare("UPDATE bookings SET studio_id = ?, updated_at = ? WHERE id = ?")
    .bind(newStudioId, now(), bookingId)
    .run();

  return { success: true };
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
          COALESCE(SUM(total_price), 0) as total_spent
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
        u.name,
        u.phone,
        u.band_name,
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
          COALESCE(SUM(total_price), 0) as total_spent
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
        u.name,
        u.phone,
        u.band_name,
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
          COALESCE(SUM(total_price), 0) as total_spent
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
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<DbUser>();
}

export async function createUser(
  db: D1Database,
  data: {
    name: string;
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
    INSERT INTO users (id, email, name, phone, band_name, notes, address_line1, address_line2, postal_code, city, country, is_blocked, total_bookings, total_spent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).bind(
    id,
    data.email ?? null,
    data.name,
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
  data: Partial<Pick<DbUser, "email" | "name" | "phone" | "band_name" | "notes" | "is_blocked" | "total_bookings" | "total_spent" | "address_line1" | "address_line2" | "postal_code" | "city" | "country">>,
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
    `
      WITH paid_by_booking AS (
        SELECT booking_id, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
        FROM payments
        GROUP BY booking_id
      ),
      pay_on_site_pending AS (
        SELECT
          'on-site:' || b.id as id,
          b.id as booking_id,
          (b.total_price - COALESCE(paid.paid_amount, 0)) as amount,
          '' as method,
          'pending' as status,
          0 as refunded_amount,
          NULL as paid_at,
          b.created_at as created_at,
          b.booking_ref as booking_ref,
          u.name as user_name,
          u.band_name as user_band_name,
          u.id as user_id,
          b.date as booking_date,
          'on-site' as payment_type
        FROM bookings b
        LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
        LEFT JOIN users u ON u.id = b.user_id
        WHERE b.status != 'cancelled'
          AND b.payment_status = 'pay-on-site'
          AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0
      ),
      payments_enriched AS (
        SELECT
          p.id as id,
          p.booking_id as booking_id,
          p.amount as amount,
          CASE
            WHEN b.payment_status != 'pay-on-site' THEN 'card'
            WHEN p.method IN ('cheque', 'check') THEN 'check'
            ELSE p.method
          END as method,
          p.status as status,
          p.refunded_amount as refunded_amount,
          p.paid_at as paid_at,
          p.created_at as created_at,
          b.booking_ref as booking_ref,
          u.name as user_name,
          u.band_name as user_band_name,
          u.id as user_id,
          b.date as booking_date,
          CASE WHEN b.payment_status = 'pay-on-site' THEN 'on-site' ELSE 'online' END as payment_type
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        LEFT JOIN users u ON u.id = b.user_id
      )
      SELECT COUNT(*) as total FROM (
        SELECT * FROM payments_enriched
        UNION ALL
        SELECT * FROM pay_on_site_pending
      )
      ${where}
    `,
  ).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `
      WITH paid_by_booking AS (
        SELECT booking_id, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
        FROM payments
        GROUP BY booking_id
      ),
      pay_on_site_pending AS (
        SELECT
          'on-site:' || b.id as id,
          b.id as booking_id,
          (b.total_price - COALESCE(paid.paid_amount, 0)) as amount,
          '' as method,
          'pending' as status,
          0 as refunded_amount,
          NULL as paid_at,
          b.created_at as created_at,
          b.booking_ref as booking_ref,
          u.name as user_name,
          u.band_name as user_band_name,
          u.id as user_id,
          b.date as booking_date,
          'on-site' as payment_type
        FROM bookings b
        LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
        LEFT JOIN users u ON u.id = b.user_id
        WHERE b.status != 'cancelled'
          AND b.payment_status = 'pay-on-site'
          AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0
      ),
      payments_enriched AS (
        SELECT
          p.id as id,
          p.booking_id as booking_id,
          p.amount as amount,
          CASE
            WHEN b.payment_status != 'pay-on-site' THEN 'card'
            WHEN p.method IN ('cheque', 'check') THEN 'check'
            ELSE p.method
          END as method,
          p.status as status,
          p.refunded_amount as refunded_amount,
          p.paid_at as paid_at,
          p.created_at as created_at,
          b.booking_ref as booking_ref,
          u.name as user_name,
          u.band_name as user_band_name,
          u.id as user_id,
          b.date as booking_date,
          CASE WHEN b.payment_status = 'pay-on-site' THEN 'on-site' ELSE 'online' END as payment_type
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        LEFT JOIN users u ON u.id = b.user_id
      )
      SELECT * FROM (
        SELECT * FROM payments_enriched
        UNION ALL
        SELECT * FROM pay_on_site_pending
      )
      ${where}
      ORDER BY ${safeSortBy} ${safeSortOrder}, created_at DESC
      LIMIT ? OFFSET ?
    `,
  ).bind(...params, limit, offset).all<AdminPaymentRow>();

  return { data: result.results, total, page, limit };
}

export async function getPaymentsByBookingId(
  db: D1Database,
  bookingId: string,
): Promise<DbPayment[]> {
  const result = await db.prepare(
    `SELECT
      p.id as id,
      p.booking_id as booking_id,
      p.amount as amount,
      CASE
        WHEN b.payment_status != 'pay-on-site' THEN 'card'
        WHEN p.method IN ('cheque', 'check') THEN 'check'
        ELSE p.method
      END as method,
      p.status as status,
      p.refunded_amount as refunded_amount,
      p.paid_at as paid_at,
      p.created_at as created_at
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.booking_id = ?
    ORDER BY p.created_at ASC`,
  )
    .bind(bookingId)
    .all<DbPayment>();
  return result.results;
}

export async function getPaymentByBookingId(
  db: D1Database,
  bookingId: string,
): Promise<DbPayment | null> {
  return db.prepare(
    `SELECT
      p.id as id,
      p.booking_id as booking_id,
      p.amount as amount,
      CASE
        WHEN b.payment_status != 'pay-on-site' THEN 'card'
        WHEN p.method IN ('cheque', 'check') THEN 'check'
        ELSE p.method
      END as method,
      p.status as status,
      p.refunded_amount as refunded_amount,
      p.paid_at as paid_at,
      p.created_at as created_at
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.booking_id = ?
    ORDER BY p.created_at DESC`,
  ).bind(bookingId).first<DbPayment>();
}

export async function addPayment(
  db: D1Database,
  data: {
    booking_id: string;
    amount: number;
    method: string;
    status: DbPaymentStatus;
    paid_at?: string | null;
  }
): Promise<{ success: boolean; id: string }> {
  const id = generateId();
  const timestamp = now();
  
  await db.prepare(
    `INSERT INTO payments (id, booking_id, amount, method, status, refunded_amount, paid_at, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    id, 
    data.booking_id, 
    data.amount, 
    data.method, 
    data.status, 
    data.paid_at || (data.status === "paid" ? timestamp : null),
    timestamp
  ).run();

  if (data.status === "paid") {
    const payments = await getPaymentsByBookingId(db, data.booking_id);
    const totalPaid = payments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);
    
    const booking = await db.prepare("SELECT total_price, payment_status FROM bookings WHERE id = ?")
      .bind(data.booking_id)
      .first<{ total_price: number; payment_status: string | null }>();

    if (booking && totalPaid >= booking.total_price) {
      await db.prepare("UPDATE bookings SET payment_status = 'paid', updated_at = ? WHERE id = ?")
        .bind(timestamp, data.booking_id)
        .run();
    }
  }

  await addAuditLog(db, "payment", id, "create", { bookingId: data.booking_id, amount: data.amount, method: data.method });

  return { success: true, id };
}

export async function markPaymentPaid(
  db: D1Database,
  paymentId: string,
): Promise<{ success: boolean; error?: string }> {
  const payment = await db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<DbPayment>();
  if (!payment) return { success: false, error: "Paiement introuvable" };

  const booking = await db.prepare("SELECT total_price, payment_status FROM bookings WHERE id = ?")
    .bind(payment.booking_id)
    .first<{ total_price: number; payment_status: string | null }>();
  if (!booking) return { success: false, error: "Réservation introuvable" };

  const timestamp = now();

  await db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?")
    .bind(timestamp, paymentId)
    .run();

  const payments = await getPaymentsByBookingId(db, payment.booking_id);
  const totalPaid = payments.reduce((acc, p) => p.status === "paid" ? acc + p.amount : acc, 0);

  if (totalPaid >= booking.total_price) {
    if (booking.payment_status !== "pay-on-site") {
      await db.prepare("UPDATE bookings SET payment_status = 'paid', updated_at = ? WHERE id = ?")
        .bind(timestamp, payment.booking_id)
        .run();
    } else {
      await db.prepare("UPDATE bookings SET updated_at = ? WHERE id = ?")
        .bind(timestamp, payment.booking_id)
        .run();
    }
  } else {
    await db.prepare("UPDATE bookings SET updated_at = ? WHERE id = ?")
      .bind(timestamp, payment.booking_id)
      .run();
  }

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

// Arrondit aux 50 centimes près
function roundToNearest50Cents(amount: number): number {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  if (cents < 25) return euros;
  if (cents < 75) return euros + 0.5;
  return euros + 1;
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
  if (promo.min_total > 0 && total < promo.min_total) return { valid: false, error: `Montant minimum de ${promo.min_total}€ requis` };
  
  // Calculer la réduction
  let discount = promo.value;
  if (promo.type === "percentage") {
    discount = (total * promo.value) / 100;
  }

  // Appliquer l'arrondi si activé
  let finalDiscount = discount;
  if (promo.round_mode === "down" || promo.round_mode === "up") {
    finalDiscount = roundToNearest50Cents(discount);
  }

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
): Promise<PaginatedResult<DbAuditLog & { admin_name?: string | null }>> {
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
  if (filters.performedBy) {
    conditions.push("performed_by = ?");
    params.push(filters.performedBy);
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

  // Build ORDER BY clause
  const orderColumn = sortBy === "date" ? "created_at" : sortBy === "admin" ? "performed_by" : sortBy === "entity" ? "entity_type" : "action";
  const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";

  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs a ${where}`).bind(...params).first<{ total: number }>();
  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  const result = await db.prepare(
    `SELECT a.*, au.name as admin_name FROM audit_logs a LEFT JOIN admin_users au ON a.performed_by = au.id ${where} ORDER BY ${orderColumn} ${orderDirection} LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset).all<DbAuditLog & { admin_name: string | null }>();

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

  rangeFrom: string;
  rangeTo: string;
  rangeDays: number;
  rangeBookings: number;
  rangeRevenue: number;
  rangeBookedMinutes: number;
  rangePendingPayments: number;
  rangePendingAmount: number;
  rangeEquipmentRevenue: number;
  rangeMinPrice: number;
  rangeMaxPrice: number;
}

function getISOWeekStartUTCNoon(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

function parseDateISOToUTCNoon(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function minusDaysParisISO(todayISO: string, days: number): string {
  const d = parseDateISOToUTCNoon(todayISO);
  d.setUTCDate(d.getUTCDate() - days);
  return getParisDateISO(d);
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
    mode?: "today" | "rolling" | "week" | "month" | "year";
    period?: "week" | "month" | "quarter" | "year";
  },
): Promise<DashboardStats> {
  const today = getParisDateISO();

  const inferredMode: "today" | "rolling" | "week" | "month" | "year" = (() => {
    if (opts?.mode) return opts.mode;
    if (opts?.year && opts?.week) return "week";
    if (opts?.year && opts?.month) return "month";
    if (opts?.year) return "year";
    return "rolling";
  })();
  const inferredPeriod: "week" | "month" | "quarter" | "year" = opts?.period || "month";

  let rangeFrom = today;
  let rangeTo = today;
  if (inferredMode === "today") {
    rangeFrom = today;
    rangeTo = today;
  } else if (inferredMode === "month" && opts?.year && opts?.month) {
    const year = Math.round(opts.year);
    const month = Math.round(opts.month);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
      const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
      rangeFrom = getParisDateISO(from);
      rangeTo = getParisDateISO(to);
    }
  } else if (inferredMode === "week" && opts?.year && opts?.week) {
    const year = Math.round(opts.year);
    const week = Math.round(opts.week);
    if (year >= 2000 && year <= 2100 && week >= 1 && week <= 53) {
      const monday = getISOWeekStartUTCNoon(year, week);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      rangeFrom = getParisDateISO(monday);
      rangeTo = getParisDateISO(sunday);
    }
  } else if (inferredMode === "year" && opts?.year) {
    const year = Math.round(opts.year);
    if (year >= 2000 && year <= 2100) {
      const from = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
      const to = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
      rangeFrom = getParisDateISO(from);
      rangeTo = getParisDateISO(to);
    }
  } else {
    const days = (() => {
      switch (inferredPeriod) {
        case "week": return 7;
        case "quarter": return 90;
        case "year": return 365;
        default: return 30;
      }
    })();

    rangeFrom = minusDaysParisISO(today, days - 1);
    rangeTo = today;
  }

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

  const [todayResult, weekResult, monthResult, pendingResult, occupancyResult, reportMonthResult, rangeResult, rangeDurationResult, rangePendingResult, rangeEquipmentResult, rangeMinMaxResult] = await db.batch([
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(weekFrom, weekTo),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(monthFrom, today),
    db.prepare(
      `WITH paid_by_booking AS (
        SELECT booking_id, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
        FROM payments
        GROUP BY booking_id
      )
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(b.total_price - COALESCE(paid.paid_amount, 0)), 0) as total
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      WHERE b.status != 'cancelled'
        AND b.payment_status = 'pay-on-site'
        AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0`,
    ),
    db.prepare(
      "SELECT studio_id, start_time, end_time FROM bookings WHERE date = ? AND status != 'cancelled'",
    ).bind(today),
    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(reportMonthFrom || monthFrom, reportMonthTo || today),

    db.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
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
      `WITH paid_by_booking AS (
        SELECT booking_id, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
        FROM payments
        GROUP BY booking_id
      )
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(b.total_price - COALESCE(paid.paid_amount, 0)), 0) as total
      FROM bookings b
      LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
      WHERE b.status != 'cancelled'
        AND b.payment_status = 'pay-on-site'
        AND b.date >= ? AND b.date <= ?
        AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0`,
    ).bind(rangeFrom, rangeTo),

    db.prepare(
      "SELECT COALESCE(SUM(equipment_price), 0) as total FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),

    db.prepare(
      "SELECT COALESCE(MIN(total_price), 0) as min_price, COALESCE(MAX(total_price), 0) as max_price FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
    ).bind(rangeFrom, rangeTo),
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
      "SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'",
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
      "SELECT studio_id, COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled' GROUP BY studio_id",
    ).bind(rangeFrom, rangeTo),

    // Payment methods
    db.prepare(
      `SELECT p.method, COUNT(*) as count, COALESCE(SUM(p.amount), 0) as revenue
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       WHERE b.date >= ? AND b.date <= ? AND b.status != 'cancelled' AND p.status = 'paid'
       GROUP BY p.method`,
    ).bind(rangeFrom, rangeTo),

    // Top 5 clients
    db.prepare(
      `SELECT u.name, u.band_name, COUNT(*) as bookings, COALESCE(SUM(b.total_price), 0) as revenue
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
         COALESCE(SUM(total_price), 0) as revenue
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
