ALTER TABLE users ADD COLUMN loyalty_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN loyalty_discount_type TEXT;
ALTER TABLE users ADD COLUMN loyalty_discount_value REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN loyalty_threshold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN loyalty_award_id TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_loyalty_award ON bookings(user_id, loyalty_award_id);
