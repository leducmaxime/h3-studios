-- ═══════════════════════════════════════════════════════════════════════════
-- Notifications push pour le panneau d'administration.
--   push_subscriptions   : abonnements Web Push, rattachés à un administrateur
--   push_preferences     : exceptions explicites aux valeurs par défaut du code
--   push_reminders_sent  : idempotence des rappels de réservation
--
-- endpoint est UNIQUE : si un appareil partagé se réabonne pour un autre
-- administrateur, l'abonnement est réattribué plutôt que dupliqué.
-- Les préférences sont clairsemées : une ligne n'existe que si l'administrateur
-- déroge à la valeur par défaut du code ; un nouvel événement ne demande donc
-- aucune migration.
-- Les rappels sont indexés par (booking_id, target_key), target_key étant
-- date || ' ' || start_time : un déplacement crée une nouvelle clé et réarme
-- correctement le rappel.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_success_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_admin ON push_subscriptions(admin_id);

CREATE TABLE IF NOT EXISTS push_preferences (
  admin_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (admin_id, event_type)
);

CREATE TABLE IF NOT EXISTS push_reminders_sent (
  booking_id TEXT NOT NULL,
  target_key TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (booking_id, target_key)
);
CREATE INDEX IF NOT EXISTS idx_push_reminders_target ON push_reminders_sent(target_key);
