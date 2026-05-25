-- Add stripe_event_id column to payments table for webhook idempotency
ALTER TABLE payments ADD COLUMN stripe_event_id TEXT;

-- Index for fast lookups during webhook processing
CREATE INDEX IF NOT EXISTS idx_payments_stripe_event_id
ON payments(stripe_event_id);
