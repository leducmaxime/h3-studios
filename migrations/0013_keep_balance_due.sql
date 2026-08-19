-- Choix d'annulation « Sans remboursement › Paiement dû » :
-- le solde reste exigible après annulation (0 = dette annulée, comportement historique).
ALTER TABLE bookings ADD COLUMN keep_balance_due INTEGER NOT NULL DEFAULT 0;
