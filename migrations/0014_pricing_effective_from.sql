-- Issue #47 : grille tarifaire programmée. effective_from = date d'entrée en
-- vigueur (calendrier Paris, YYYY-MM-DD). '1970-01-01' est le sentinelle de la
-- grille de base : toutes les lignes existantes en héritent.
ALTER TABLE pricing ADD COLUMN effective_from TEXT NOT NULL DEFAULT '1970-01-01';
