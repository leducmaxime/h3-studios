ALTER TABLE promo_codes ADD COLUMN user_id TEXT;
ALTER TABLE promo_codes ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE promo_codes ADD COLUMN scope TEXT DEFAULT 'cart';
ALTER TABLE promo_codes ADD COLUMN used_at TEXT;
ALTER TABLE promo_codes ADD COLUMN used_booking_ref TEXT;
ALTER TABLE promo_codes ADD COLUMN notified_at TEXT;
ALTER TABLE promo_codes ADD COLUMN cycle_end TEXT;

CREATE INDEX IF NOT EXISTS idx_promo_codes_user_id ON promo_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_source ON promo_codes(source);

ALTER TABLE users ADD COLUMN loyalty_code_validity_days INTEGER DEFAULT 60;
ALTER TABLE users ADD COLUMN loyalty_cycle_start TEXT;

UPDATE users SET loyalty_cycle_start = (
  SELECT MAX(
    datetime(
      b.date,
      '+' || (
        CASE
          WHEN b.end_time = '00:00' THEN 1440
          WHEN (CAST(substr(b.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.end_time, 4, 2) AS INTEGER))
             <= (CAST(substr(b.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.start_time, 4, 2) AS INTEGER))
            THEN (CAST(substr(b.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.end_time, 4, 2) AS INTEGER)) + 1440
          ELSE (CAST(substr(b.end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(b.end_time, 4, 2) AS INTEGER))
        END
      ) || ' minutes'
    )
  )
  FROM bookings b
  WHERE b.user_id = users.id
    AND b.status != 'cancelled'
    AND b.loyalty_award_id IS NOT NULL
) WHERE loyalty_enabled = 1;
