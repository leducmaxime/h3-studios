-- Staging/prod D1 predates 0001's promo_codes.round_mode column.
-- Additive sync so admin create/update and validatePromoCode can persist down/up/none.
ALTER TABLE promo_codes ADD COLUMN round_mode TEXT DEFAULT 'none';
