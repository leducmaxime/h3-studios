// TypeScript types matching D1 database tables (migrations/0001_initial_schema.sql)
// All dates stored as ISO TEXT in SQLite, booleans as INTEGER (0/1)

// --- Admin Users ---

export type AdminRole = "super-admin" | "operator";

export interface DbAdminUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  is_active: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

// --- Sessions ---

export interface DbSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// --- Users (clients / musicians) ---

export interface DbUser {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  band_name: string | null;
  notes: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  is_blocked: number;
  total_bookings: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

// --- Bookings ---

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no-show";
export type PaymentMethod = "card" | "cash" | "cheque" | "transfer";
export type PaymentStatus = "pending" | "paid" | "pay-on-site";
export type GroupType = "solo" | "duo" | "group";
export type StudioId = "la-scene" | "le-podium";

export interface DbBooking {
  id: string;
  booking_ref: string;
  user_id: string;
  band_name: string | null;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_type: string;
  status: BookingStatus;
  base_price: number;
  equipment_price: number;
  total_price: number;
  equipment: string | null; // JSON array
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  promo_code: string | null;
  promo_type: "percentage" | "fixed" | null;
  promo_discount: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  user_name: string | null;
  user_email: string | null;
  user_band_name: string | null;
  user_phone: string | null;
}

// Type for creating bookings (excludes auto-generated fields and user fields from LEFT JOIN)
export type CreateBooking = Omit<DbBooking, "id" | "created_at" | "updated_at" | "user_name" | "user_email" | "user_band_name" | "user_phone">;

// --- Payments ---

export type DbPaymentStatus = "pending" | "paid" | "refunded" | "partial-refund";

export interface DbPayment {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  status: DbPaymentStatus;
  refunded_amount: number;
  paid_at: string | null;
  created_at: string;
}

export interface AdminPaymentRow extends DbPayment {
  booking_ref: string | null;
  user_name: string | null;
  user_band_name: string | null;
  user_id: string | null;
  booking_date: string | null;
  payment_type: "on-site" | "online";
}

export type AdminPaymentSortField = "created_at" | "booking_date" | "amount" | "status" | "method" | "payment_type";
export type AdminPaymentSortOrder = "asc" | "desc";

export interface AdminPaymentFilters {
  status?: "pending" | "paid" | "refunded" | "partial-refund";
  method?: "card" | "cash" | "transfer" | "check";
  paymentType?: "on-site" | "online";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: AdminPaymentSortField;
  sortOrder?: AdminPaymentSortOrder;
}

// --- Blocked Slots ---

export interface DbBlockedSlot {
  id: string;
  studio_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

// --- Pricing ---

export interface DbPricing {
  id: string;
  studio_id: string;
  group_type: string;
  is_peak: number; // 0 | 1
  price_per_half_hour: number;
  updated_at: string;
}

// --- Equipment ---

export interface DbEquipment {
  id: string;
  equipment_id: string;
  name: string;
  max_per_session: number;
  pricing_type: string;
  session_pricing: string | null; // JSON array
  price_per_hour: number;
  updated_at: string;
}

// --- Promo Codes ---

export interface DbPromoCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_total: number;
  is_active: number; // 0 | 1
  expires_at: string | null;
  usage_count: number;
  max_usage: number | null;
  created_at: string;
}

// --- Opening Hours ---

export interface DbOpeningHours {
  id: string;
  studio_id: string;
  day_of_week: number; // 0 (Sunday) - 6 (Saturday)
  open_time: string;
  close_time: string;
  is_closed: number; // 0 | 1
}

// --- Settings ---

export interface DbSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

// --- Audit Logs ---

export type AuditEntityType = "booking" | "user" | "payment" | "setting" | "promo" | "equipment" | "pricing" | "blocked_slot";

export interface DbAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: string | null; // JSON
  performed_by: string;
  created_at: string;
}

// --- Paginated response ---

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Filter types ---

export type BookingSortField = "date" | "start_time" | "total_price" | "status" | "payment_status" | "created_at";
export type BookingSortOrder = "asc" | "desc";

export interface BookingFilters {
  status?: BookingStatus;
  studioId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: string;
  search?: string; // booking_ref or user name
  sortBy?: BookingSortField;
  sortOrder?: BookingSortOrder;
}

export interface UserFilters {
  search?: string; // name, email, band_name
  isBlocked?: boolean;
  hasBookings?: boolean;
  sortBy?: UserSortField;
  sortOrder?: UserSortOrder;
}

export type UserSortField = "created_at" | "name" | "total_bookings" | "total_spent";
export type UserSortOrder = "asc" | "desc";

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Extended type with user data from LEFT JOIN
export interface BookingWithUser extends DbBooking {}
