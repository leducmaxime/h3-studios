-- Issue #47 : une version de grille = 12 lignes partageant le même
-- effective_from. La résolution prend la dernière version effective_from <= date.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_version
  ON pricing (studio_id, group_type, is_peak, effective_from);
