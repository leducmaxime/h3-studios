CREATE TABLE IF NOT EXISTS payment_refunds (
  stripe_refund_id TEXT PRIMARY KEY,
  payment_id       TEXT NOT NULL,
  booking_id       TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL,
  status           TEXT NOT NULL,
  reason           TEXT,
  performed_by     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_id ON payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_booking_id ON payment_refunds(booking_id);
