-- Contrôles de pré-vol : à exécuter avant migrations/0020_cash_ledger.sql.
-- Les libellés en première colonne facilitent l'identification des résultats.

-- P1 — reste dû total (invariant de référence)
SELECT 'P1' AS controle,
       ROUND(SUM(MAX(b.total_price - COALESCE(b.promo_discount,0),0) - COALESCE(paid.a,0)),2) AS reste_du
FROM bookings b
LEFT JOIN (SELECT booking_id, SUM(CASE WHEN status IN ('paid','refunded','partial-refund')
                                  THEN amount - COALESCE(refunded_amount,0) ELSE 0 END) a
           FROM payments GROUP BY booking_id) paid ON paid.booking_id = b.id
WHERE b.status != 'cancelled' OR b.keep_balance_due = 1;

-- P2 — total encaissé net
SELECT 'P2' AS controle,
       ROUND(SUM(CASE WHEN status IN ('paid','refunded','partial-refund')
                      THEN amount - COALESCE(refunded_amount,0) ELSE 0 END),2) AS total_encaisse_net
FROM payments;

-- P3a — paiement Stripe en attente (doit renvoyer 0)
SELECT 'P3a' AS controle, COUNT(*) AS anomalies
FROM payments
WHERE stripe_event_id IS NOT NULL AND status = 'pending';

-- P3b — remboursement rattaché à un paiement qui n'est pas par carte (doit renvoyer 0)
SELECT 'P3b' AS controle, COUNT(*) AS anomalies
FROM payment_refunds r
JOIN payments p ON p.id = r.payment_id
WHERE p.method != 'card';

-- P3c — paiements à zéro : INFORMATIF, ce n'est PAS un blocage.
-- Ils correspondent aux réservations 100 % remisées (total_price = promo_discount).
-- La migration ne les reprend pas (CHECK amount <> 0) : un mouvement de 0 € n'est
-- pas un mouvement de trésorerie. Le statut « payé » de ces réservations reste
-- dérivé correctement (finalTotal <= 0). Mesuré à 5 sur staging.
-- Noter la valeur, ne pas interrompre la fenêtre sur ce contrôle.
SELECT 'P3c' AS controle, COUNT(*) AS paiements_zero
FROM payments
WHERE amount = 0;

-- P4 — paiements orphelins (doit renvoyer 0)
-- BLOQUANT : une allocation vers une réservation inexistante violerait la FK.
SELECT 'P4' AS controle, COUNT(*) AS orphelins
FROM payments p
LEFT JOIN bookings b ON b.id = p.booking_id
WHERE b.id IS NULL;

-- P5 — remboursement résiduel porté par un paiement Stripe (doit renvoyer 0)
-- BLOQUANT : l'étape 7 de la migration reconstitue les remboursements non tracés
-- en pointant parent_id vers p.id. Si ce paiement est une ligne Stripe absorbée
-- par la fusion (survivant = MIN(id)), le parent_id désignerait une ligne
-- supprimée. Les remboursements manuels ne concernent que les paiements non-carte.
SELECT 'P5' AS controle, COUNT(*) AS parents_danglants
FROM payments p
LEFT JOIN (SELECT payment_id, SUM(amount_cents) AS cents FROM payment_refunds
           WHERE status IN ('succeeded','pending') GROUP BY payment_id) t
       ON t.payment_id = p.id
WHERE p.refunded_amount > 0
  AND p.refunded_amount - COALESCE(t.cents,0)/100.0 > 0.005
  AND p.stripe_event_id IS NOT NULL;
