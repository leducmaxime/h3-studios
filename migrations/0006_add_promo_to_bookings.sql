-- Migration: Add promo fields to bookings
ALTER TABLE bookings ADD COLUMN promo_code TEXT;
ALTER TABLE bookings ADD COLUMN promo_discount INTEGER DEFAULT 0;
