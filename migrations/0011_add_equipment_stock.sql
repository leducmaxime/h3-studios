ALTER TABLE equipment ADD COLUMN stock_total INTEGER NOT NULL DEFAULT 1;
UPDATE equipment SET stock_total = 2 WHERE equipment_id = 'cymbal';
UPDATE equipment SET stock_total = 6 WHERE equipment_id = 'mic';
UPDATE equipment SET stock_total = 3 WHERE equipment_id = 'guitar';
UPDATE equipment SET stock_total = 1 WHERE equipment_id = 'bass';
UPDATE equipment SET stock_total = 2 WHERE equipment_id = 'piano';
