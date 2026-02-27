-- Ajouter round_mode aux codes promo
-- Permet d'arrondir la réduction aux 50 centimes près

ALTER TABLE promo_codes ADD COLUMN round_mode TEXT DEFAULT 'none' CHECK(round_mode IN ('down', 'up', 'none'));
