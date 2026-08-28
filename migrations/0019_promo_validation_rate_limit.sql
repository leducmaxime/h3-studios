CREATE TABLE IF NOT EXISTS promo_validation_attempts (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_promo_validation_attempts_window
  ON promo_validation_attempts(window_start);
