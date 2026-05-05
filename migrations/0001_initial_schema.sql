CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super-admin', 'operator')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  band_name TEXT,
  notes TEXT,
  is_blocked INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'France'
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_ref TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  studio_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  group_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('confirmed', 'cancelled', 'completed', 'no-show')),
  base_price INTEGER NOT NULL,
  equipment_price INTEGER DEFAULT 0,
  total_price INTEGER NOT NULL,
  equipment TEXT,
  payment_method TEXT CHECK(payment_method IN ('card', 'cash')),
  payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'pay-on-site')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  cancelled_at TEXT,
  cancel_reason TEXT,
  band_name TEXT,
  promo_code TEXT,
  promo_discount INTEGER DEFAULT 0,
  promo_type TEXT CHECK(promo_type IN ('percentage', 'fixed'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('card', 'cash', 'transfer', 'check', 'cheque')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'refunded', 'partial-refund')),
  refunded_amount INTEGER DEFAULT 0,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocked_slots (
  id TEXT PRIMARY KEY,
  studio_id TEXT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  group_type TEXT NOT NULL CHECK(group_type IN ('solo', 'duo', 'group')),
  is_peak INTEGER NOT NULL,
  price_per_half_hour INTEGER NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  equipment_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  max_per_session INTEGER NOT NULL,
  pricing_type TEXT NOT NULL CHECK(pricing_type IN ('session', 'hourly')),
  session_pricing TEXT,
  price_per_hour INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('percentage', 'fixed')),
  value INTEGER NOT NULL,
  min_total INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  round_mode TEXT DEFAULT 'none' CHECK(round_mode IN ('down', 'up', 'none'))
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  is_closed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes TEXT,
  performed_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS google_reviews (
  id TEXT PRIMARY KEY,
  google_review_id TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT,
  text_original TEXT,
  relative_time TEXT,
  publish_time TEXT,
  google_maps_uri TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_studio_id ON bookings(studio_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(date);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_studio_id ON blocked_slots(studio_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_opening_hours_studio ON opening_hours(studio_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_google_reviews_rating ON google_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_google_reviews_publish_time ON google_reviews(publish_time);
