import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { updatePromoCode, UPDATABLE_PROMO_CODE_FIELDS } from "@/lib/db";
import { isValidDateISO } from "@/lib/utils";

class D1Memory {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql);
    return {
      bind: (...params: SQLInputValue[]) => ({
        first: async <T>() => statement.get(...params) as T,
        all: async <T>() => ({ results: statement.all(...params) as T[] }),
        run: async () => {
          const result = statement.run(...params);
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    };
  }
}

let sqlite: DatabaseSync;
let db: D1Memory;

const readCode = () => sqlite.prepare("SELECT * FROM promo_codes WHERE id = 'p1'").get() as Record<string, unknown>;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE promo_codes (
      id TEXT PRIMARY KEY, code TEXT UNIQUE, type TEXT, value REAL DEFAULT 0,
      min_total REAL DEFAULT 0, is_active INTEGER DEFAULT 1, expires_at TEXT,
      usage_count INTEGER DEFAULT 0, max_usage INTEGER, round_mode TEXT DEFAULT 'none',
      created_at TEXT, user_id TEXT, source TEXT DEFAULT 'manual', scope TEXT DEFAULT 'cart',
      used_at TEXT, used_booking_ref TEXT, notified_at TEXT, cycle_end TEXT
    );
  `);
  sqlite.prepare(
    `INSERT INTO promo_codes (id, code, type, value, expires_at, user_id, source, scope, max_usage)
     VALUES ('p1','FID-ABCD1234','fixed',10,'2026-10-27','u1','loyalty','cart',1)`,
  ).run();
  db = new D1Memory(sqlite);
});

describe("isValidDateISO", () => {
  it("accepte une date calendaire au format AAAA-MM-JJ", () => {
    expect(isValidDateISO("2026-10-27")).toBe(true);
    expect(isValidDateISO("2028-02-29")).toBe(true); // 2028 est bissextile
  });

  it("refuse les formats non conformes", () => {
    expect(isValidDateISO("27/10/2026")).toBe(false);
    expect(isValidDateISO("2026-10-27T00:00:00Z")).toBe(false);
    expect(isValidDateISO("2026-10-7")).toBe(false);
    expect(isValidDateISO("")).toBe(false);
  });

  it("refuse une date au bon format mais inexistante", () => {
    expect(isValidDateISO("2026-02-30")).toBe(false);
    expect(isValidDateISO("2026-13-01")).toBe(false);
    expect(isValidDateISO("2026-00-10")).toBe(false);
  });

  it("refuse les valeurs non textuelles", () => {
    expect(isValidDateISO(null)).toBe(false);
    expect(isValidDateISO(undefined)).toBe(false);
    expect(isValidDateISO(20261027)).toBe(false);
  });
});

describe("updatePromoCode — garde-fou sur les colonnes", () => {
  it("prolonge la date d'expiration d'un code fidélité", async () => {
    const result = await updatePromoCode(db as never, "p1", { expires_at: "2026-12-31" });
    expect(result.success).toBe(true);
    expect(readCode().expires_at).toBe("2026-12-31");
  });

  it("ignore les colonnes hors whitelist sans casser la requête", async () => {
    const result = await updatePromoCode(
      db as never,
      "p1",
      { expires_at: "2026-12-31", user_id: "autre", source: "manual", usage_count: 99 } as never,
    );

    expect(result.success).toBe(true);
    const row = readCode();
    expect(row.expires_at).toBe("2026-12-31");
    // Les colonnes sensibles restent intactes.
    expect(row.user_id).toBe("u1");
    expect(row.source).toBe("loyalty");
    expect(row.usage_count).toBe(0);
  });

  it("n'exécute aucune requête si le corps ne contient que des clés inconnues", async () => {
    const result = await updatePromoCode(db as never, "p1", { source: "manual" } as never);
    expect(result.success).toBe(false);
    expect(readCode().source).toBe("loyalty");
  });

  it("expose la liste des colonnes modifiables partagée avec la route admin", () => {
    expect([...UPDATABLE_PROMO_CODE_FIELDS]).toEqual([
      "code", "type", "value", "min_total", "is_active", "expires_at", "max_usage", "round_mode",
    ]);
    expect(UPDATABLE_PROMO_CODE_FIELDS).not.toContain("user_id");
    expect(UPDATABLE_PROMO_CODE_FIELDS).not.toContain("source");
    expect(UPDATABLE_PROMO_CODE_FIELDS).not.toContain("usage_count");
  });
});
