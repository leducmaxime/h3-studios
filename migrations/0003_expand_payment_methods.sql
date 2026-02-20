CREATE TABLE IF NOT EXISTS payments_new (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('card', 'cash', 'transfer', 'check', 'cheque')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'refunded', 'partial-refund')),
  refunded_amount INTEGER DEFAULT 0,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO payments_new (id, booking_id, amount, method, status, refunded_amount, paid_at, created_at)
SELECT
  id,
  booking_id,
  amount,
  method,
  status,
  refunded_amount,
  paid_at,
  created_at
FROM payments;

DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
