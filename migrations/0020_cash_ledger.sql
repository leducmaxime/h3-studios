-- ═══════════════════════════════════════════════════════════════════════════
-- Grand livre de trésorerie.
--   payments            : mouvements signés (+ encaissement, − remboursement)
--   payment_allocations : application aux réservations, même signe
-- Remplace payments.booking_id, payments.refunded_amount et payment_refunds.
-- Sauvegarde préalable obligatoire : wrangler d1 export
-- ═══════════════════════════════════════════════════════════════════════════

-- ORDRE CRITIQUE, VÉRIFIÉ EN LOCAL SUR UNE COPIE RÉELLE DE LA BASE :
-- payment_allocations déclare une FK vers payments et ne peut donc PAS être
-- créée ni peuplée avant le DROP/RENAME. Un DROP TABLE exécute un DELETE
-- implicite que PRAGMA defer_foreign_keys ne couvre pas : le COMMIT échoue sur
-- "FOREIGN KEY constraint failed". Les allocations sont donc préparées dans
-- alloc_staging (sans FK), et payment_allocations n'est créée qu'une fois
-- payments_new renommée. Ne pas réordonner les étapes.

-- ── 1. Nouvelle table des mouvements ───────────────────────────────────────
-- parent_id sans FK déclarée : auto-référence dans une table renommée en fin
-- de migration ; l'intégrité est assurée par le seul chemin d'écriture.
CREATE TABLE payments_new (
  id           TEXT PRIMARY KEY,
  amount       REAL NOT NULL CHECK (amount <> 0),
  method       TEXT NOT NULL CHECK (method IN ('card','cash','transfer','check')),
  status       TEXT NOT NULL CHECK (status IN ('pending','settled','failed')),
  paid_at      TEXT,
  external_ref TEXT,
  parent_id    TEXT,
  reason       TEXT,
  performed_by TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── 2. Encaissements Stripe : une ligne par session ────────────────────────
INSERT INTO payments_new (id, amount, method, status, paid_at, external_ref, created_at)
SELECT MIN(p.id), ROUND(SUM(p.amount), 2), 'card', 'settled',
       MIN(p.paid_at), p.stripe_event_id, MIN(p.created_at)
FROM payments p
WHERE p.stripe_event_id IS NOT NULL AND p.amount > 0
GROUP BY p.stripe_event_id;

-- ── 3. Encaissements manuels (méthode normalisée cheque -> check) ───────────
INSERT INTO payments_new (id, amount, method, status, paid_at, external_ref, created_at)
SELECT p.id, p.amount,
       CASE WHEN p.method = 'cheque' THEN 'check' ELSE p.method END,
       CASE WHEN p.status = 'pending' THEN 'pending' ELSE 'settled' END,
       p.paid_at, NULL, p.created_at
FROM payments p
WHERE p.stripe_event_id IS NULL AND p.amount > 0;

-- ── 4. Table de préparation des applications (volontairement sans FK) ──────
-- Les allocations sont accumulées ici tant que l'ancienne table payments
-- existe encore. La table définitive, avec ses FK, est créée à l'étape 8bis,
-- une fois payments_new renommée. Voir la note d'ordre critique en tête.
CREATE TABLE alloc_staging (
  id         TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  amount     REAL NOT NULL,
  created_at TEXT NOT NULL
);

-- ── 5. Applications positives (la sous-requête EST la table de fusion) ─────
INSERT INTO alloc_staging (id, payment_id, booking_id, amount, created_at)
SELECT lower(hex(randomblob(16))), COALESCE(s.survivor_id, p.id), p.booking_id,
       p.amount, COALESCE(p.created_at, datetime('now'))
FROM payments p
LEFT JOIN (SELECT stripe_event_id, MIN(id) AS survivor_id
           FROM payments WHERE stripe_event_id IS NOT NULL AND amount > 0
           GROUP BY stripe_event_id) s ON s.stripe_event_id = p.stripe_event_id
WHERE p.amount > 0;

-- ── 6. Remboursements Stripe → mouvements négatifs ─────────────────────────
INSERT INTO payments_new (id, amount, method, status, paid_at, external_ref,
                          parent_id, reason, performed_by, created_at)
SELECT lower(hex(randomblob(16))), -ROUND(r.amount_cents/100.0, 2), 'card',
       CASE WHEN r.status IN ('succeeded','pending') THEN 'settled'
            WHEN r.status = 'requires_action'        THEN 'pending'
            ELSE 'failed' END,
       r.updated_at, r.stripe_refund_id,
       COALESCE(s.survivor_id, r.payment_id),
       r.reason, r.performed_by, r.created_at
FROM payment_refunds r
LEFT JOIN payments p ON p.id = r.payment_id
LEFT JOIN (SELECT stripe_event_id, MIN(id) AS survivor_id
           FROM payments WHERE stripe_event_id IS NOT NULL AND amount > 0
           GROUP BY stripe_event_id) s ON s.stripe_event_id = p.stripe_event_id;

INSERT INTO alloc_staging (id, payment_id, booking_id, amount, created_at)
SELECT lower(hex(randomblob(16))), pn.id, r.booking_id,
       -ROUND(r.amount_cents/100.0, 2), r.created_at
FROM payment_refunds r
JOIN payments_new pn ON pn.external_ref = r.stripe_refund_id;

-- ── 7. Remboursements manuels non tracés (reconstitution) ──────────────────
-- L'ancien refundPayment écrivait refunded_amount sans ligne payment_refunds.
INSERT INTO payments_new (id, amount, method, status, paid_at, parent_id, reason, created_at)
SELECT lower(hex(randomblob(16))),
       -ROUND(p.refunded_amount - COALESCE(t.cents,0)/100.0, 2),
       CASE WHEN p.method = 'cheque' THEN 'check' ELSE p.method END,
       'settled', p.created_at, p.id,
       'Reconstitué à la migration (remboursement hors grand livre)', p.created_at
FROM payments p
LEFT JOIN (SELECT payment_id, SUM(amount_cents) AS cents FROM payment_refunds
           WHERE status IN ('succeeded','pending') GROUP BY payment_id) t
       ON t.payment_id = p.id
WHERE p.refunded_amount > 0
  AND p.refunded_amount - COALESCE(t.cents,0)/100.0 > 0.005;

INSERT INTO alloc_staging (id, payment_id, booking_id, amount, created_at)
SELECT lower(hex(randomblob(16))), pn.id, p.booking_id, pn.amount, pn.created_at
FROM payments_new pn
JOIN payments p ON p.id = pn.parent_id
WHERE pn.external_ref IS NULL AND pn.amount < 0;

-- ── 8. Bascule ─────────────────────────────────────────────────────────────
-- Aucune FK ne pointe encore vers payments : le DROP est sûr.
DROP TABLE payment_refunds;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

-- ── 8bis. Table définitive des applications, avec ses FK ───────────────────
-- Créée seulement maintenant : « payments » désigne désormais la nouvelle
-- table, les FK se résolvent donc correctement et le CHECK peut s'appliquer.
CREATE TABLE payment_allocations (
  id         TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount     REAL NOT NULL CHECK (amount <> 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO payment_allocations (id, payment_id, booking_id, amount, created_at)
SELECT id, payment_id, booking_id, amount, created_at FROM alloc_staging;

DROP TABLE alloc_staging;

-- ── 9. Index ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_payments_external_ref ON payments(external_ref)
  WHERE external_ref IS NOT NULL;
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_payments_parent  ON payments(parent_id);
CREATE UNIQUE INDEX idx_alloc_payment_booking ON payment_allocations(payment_id, booking_id);
CREATE INDEX idx_alloc_booking ON payment_allocations(booking_id);
