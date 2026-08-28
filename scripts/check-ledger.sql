-- Contrôles post-migration 0020_cash_ledger.
-- C1 doit être strictement égal à P1 ; C2 doit renvoyer 0 ligne.

-- C1 — reste dû recalculé sur le nouveau modèle
SELECT 'C1' AS controle,
       ROUND(SUM(MAX(b.total_price - COALESCE(b.promo_discount,0),0) - COALESCE(paid.a,0)),2) AS reste_du
FROM bookings b
LEFT JOIN (SELECT a.booking_id, SUM(a.amount) a FROM payment_allocations a
           JOIN payments p ON p.id = a.payment_id WHERE p.status='settled'
           GROUP BY a.booking_id) paid ON paid.booking_id = b.id
WHERE b.status != 'cancelled' OR b.keep_balance_due = 1;

-- C2 — sur-affectation (doit renvoyer 0 ligne)
SELECT 'C2' AS controle, p.id, p.amount, SUM(a.amount) AS alloue
FROM payments p JOIN payment_allocations a ON a.payment_id = p.id
GROUP BY p.id, p.amount
HAVING ABS(SUM(a.amount)) > ABS(p.amount) + 0.005;

-- C3 — mouvements non entièrement affectés (informatif, pas une erreur)
-- Comparaison en valeur absolue : les mouvements négatifs (remboursements) ont
-- des allocations négatives, une soustraction signée les manquerait.
SELECT 'C3' AS controle, p.id, p.amount,
       ABS(p.amount) - ABS(COALESCE(SUM(a.amount),0)) AS non_alloue
FROM payments p
LEFT JOIN payment_allocations a ON a.payment_id = p.id
GROUP BY p.id, p.amount
HAVING ABS(p.amount) - ABS(COALESCE(SUM(a.amount),0)) > 0.005;

-- C4 — intégrité référentielle (doit renvoyer 0 ligne)
SELECT 'C4' AS controle, a.id, a.payment_id, a.booking_id
FROM payment_allocations a
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = a.payment_id)
   OR NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = a.booking_id);

-- C5 — parent_id orphelin (doit renvoyer 0 ligne)
SELECT 'C5' AS controle, c.id, c.parent_id
FROM payments c
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = c.parent_id);

-- C6 — table de préparation résiduelle (doit renvoyer 0 ligne)
SELECT 'C6' AS controle, name FROM sqlite_master WHERE name = 'alloc_staging';
