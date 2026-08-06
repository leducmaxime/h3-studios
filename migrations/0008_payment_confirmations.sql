-- Session-level dedup for online payment confirmation.
-- Garantit qu'une session Stripe payée déclenche exactement UN email de
-- confirmation consolidé, même si le webhook et le flux de récupération
-- (payment success session lookup) s'exécutent tous les deux. Ligne ajoutée
-- par le finaliseur idempotent (src/lib/payment-confirmation.ts).
CREATE TABLE IF NOT EXISTS payment_confirmations (
  session_id TEXT PRIMARY KEY,
  booking_refs TEXT NOT NULL,
  finalized_at TEXT NOT NULL,
  email_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_confirmations_created_at
ON payment_confirmations(created_at);

-- Idempotence des écritures de paiement : une réservation ne peut recevoir
-- qu'UN paiement par session Stripe (clé = session.id). L'INSERT OR IGNORE du
-- finaliseur s'appuie sur cet index pour ne jamais dupliquer un paiement, y
-- compris après un échec partiel puis un retry. (NULL autorisés : paiements
-- sur place / anciens paiements sans session.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_booking_stripe_event
ON payments(booking_id, stripe_event_id)
WHERE stripe_event_id IS NOT NULL;
