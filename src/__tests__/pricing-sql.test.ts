import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { selectPriceCentsAsOf } from "../lib/pricing";
import { PRICING_AS_OF_SQL, PRICING_EARLIEST_SQL } from "../lib/db";
import type { DbPricing } from "../lib/db-types";

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE pricing (
      id TEXT PRIMARY KEY,
      studio_id TEXT NOT NULL,
      group_type TEXT NOT NULL,
      is_peak INTEGER NOT NULL,
      price_per_half_hour INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      effective_from TEXT NOT NULL DEFAULT '1970-01-01'
    );
  `);
  db.exec(`
    INSERT INTO pricing VALUES
      ('base', 'la-scene', 'solo', 0, 3000, '2026-08-20 10:00:00', '1970-01-01'),
      ('future', 'la-scene', 'solo', 0, 6000, '2026-08-20 10:00:00', '2026-09-01'),
      ('latest', 'la-scene', 'solo', 0, 9000, '2026-08-20 10:00:00', '2026-12-01'),
      ('peak-base', 'la-scene', 'solo', 1, 4000, '2026-08-20 10:00:00', '1970-01-01'),
      ('peak-future', 'la-scene', 'solo', 1, 7000, '2026-08-20 10:00:00', '2026-09-01'),
      ('scheduled-only', 'le-podium', 'duo', 0, 5000, '2026-08-20 10:00:00', '2026-09-01');
  `);
});

function sqlPrice(studioId: string, groupType: string, isPeak: boolean, date: string): number {
  const result = db.prepare(PRICING_AS_OF_SQL).get(studioId, groupType, isPeak ? 1 : 0, date) as { price_per_half_hour: number } | undefined;
  if (result) return result.price_per_half_hour;
  const fallback = db.prepare(PRICING_EARLIEST_SQL).get(studioId, groupType, isPeak ? 1 : 0) as { price_per_half_hour: number } | undefined;
  return fallback?.price_per_half_hour ?? 0;
}

function rows(): DbPricing[] {
  return db.prepare("SELECT * FROM pricing").all() as unknown as DbPricing[];
}

describe("pricing effective_from SQL parity", () => {
  it("correspond au résolveur pur sur les frontières, indépendamment du fuseau", () => {
    const previousTZ = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
    try {
      for (const date of ["2026-08-20", "2026-09-01", "2026-09-15", "2026-10-15", "2026-12-01", "2026-12-15"]) {
        for (const isPeak of [false, true]) {
          expect(sqlPrice("la-scene", "solo", isPeak, date)).toBe(
            selectPriceCentsAsOf(rows(), "la-scene", "solo", isPeak, date),
          );
        }
      }
    } finally {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    }
  });

  it("utilise le fallback ASC pour une cellule uniquement programmée", () => {
    expect(sqlPrice("le-podium", "duo", false, "2026-08-01")).toBe(5000);
    expect(selectPriceCentsAsOf(rows(), "le-podium", "duo", false, "2026-08-01")).toBe(5000);
  });

});
