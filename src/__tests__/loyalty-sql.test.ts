import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLoyaltyCodeEmailData,
  buildDueLoyaltyCodeCandidatesQuery,
  buildUserLoyaltyProgressQuery,
  claimLoyaltyCycleStart,
  claimPromoCodeUsage,
  claimPromoValidationAttempt,
  createLoyaltyPromoCode,
  getUserLoyaltyDiscountTotal,
  getUserLoyaltyProgress,
  getLoyaltyPromoResendError,
  getLoyaltyPromoResendClientError,
  markLoyaltyPromoCodeResent,
  releasePromoCodeUsage,
  validatePromoCode,
} from "@/lib/db";
import { addDaysToDateISO, generateLoyaltyCode } from "@/lib/loyalty";
import { getParisDateISO } from "@/lib/utils";

const now = { dateISO: "2026-08-20", hours: 20, minutes: 0 };

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

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT, name TEXT DEFAULT '', first_name TEXT,
      is_blocked INTEGER DEFAULT 0, loyalty_enabled INTEGER DEFAULT 0,
      loyalty_discount_type TEXT, loyalty_discount_value REAL DEFAULT 0,
      loyalty_threshold INTEGER DEFAULT 0, loyalty_emails_opt_out INTEGER DEFAULT 0,
      loyalty_code_validity_days INTEGER DEFAULT 60, loyalty_cycle_start TEXT,
      updated_at TEXT
    );
    CREATE TABLE promo_codes (
      id TEXT PRIMARY KEY, code TEXT UNIQUE, type TEXT, value REAL DEFAULT 0,
      min_total REAL DEFAULT 0, is_active INTEGER DEFAULT 1, expires_at TEXT,
      usage_count INTEGER DEFAULT 0, max_usage INTEGER, round_mode TEXT DEFAULT 'none',
      created_at TEXT, user_id TEXT, source TEXT DEFAULT 'manual', scope TEXT DEFAULT 'cart',
      used_at TEXT, used_booking_ref TEXT, notified_at TEXT, cycle_end TEXT
    );
    CREATE TABLE promo_validation_attempts (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY, user_id TEXT, date TEXT, start_time TEXT, end_time TEXT,
      status TEXT, promo_discount REAL DEFAULT 0, loyalty_award_id TEXT,
      base_price REAL DEFAULT 0, equipment_price REAL DEFAULT 0, total_price REAL DEFAULT 0,
      updated_at TEXT
    );
  `);
  db = new D1Memory(sqlite);
  sqlite.prepare("INSERT INTO users (id,email,name,first_name,is_blocked,loyalty_enabled,loyalty_discount_type,loyalty_discount_value,loyalty_threshold) VALUES ('u','u@example.com','User',NULL,0,1,'fixed',10,2)").run();
});

const addBooking = (id: string, date: string, status = "confirmed") => sqlite.prepare(
  "INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES (?,?,?,?,?,?)",
).run(id, "u", date, "10:00", "12:00", status);

describe("fidélité — codes nominatif", () => {
  it("génère un code Crockford au format attendu", () => {
    const code = generateLoyaltyCode();
    expect(code).toMatch(/^FID-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(code.slice(4)).not.toMatch(/[ILOU]/);
  });

  it("calcule l'expiration en jours calendaires", () => {
    expect(addDaysToDateISO("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDateISO("2026-12-31", 60)).toBe("2027-03-01");
  });

  it("sélectionne uniquement les clients dus sur leur cycle courant", () => {
    addBooking("one", "2000-01-01");
    addBooking("two", "2000-01-02", "completed");
    const query = buildDueLoyaltyCodeCandidatesQuery(now, 200);
    expect(query.params).toHaveLength((query.sql.match(/\?/g) || []).length);
    expect(query.sql).toContain("loyalty_cycle_start");
    const rows = sqlite.prepare(query.sql).all(...(query.params as SQLInputValue[])) as Array<{ id: string; cycle_end: string }>;
    expect(rows).toMatchObject([{ id: "u", cycle_end: "2000-01-02 12:00:00" }]);
  });

  it("réclame atomiquement un cycle et refuse le second traitement", async () => {
    expect(await claimLoyaltyCycleStart(db as unknown as D1Database, "u", "2000-01-02 12:00:00")).toBe(true);
    expect(await claimLoyaltyCycleStart(db as unknown as D1Database, "u", "2000-01-02 12:00:00")).toBe(false);
    expect(sqlite.prepare("SELECT loyalty_cycle_start FROM users WHERE id='u'").get()).toEqual({ loyalty_cycle_start: "2000-01-02 12:00:00" });
  });

  it("crée un code nominatif expirant et à usage unique", async () => {
    const promo = await createLoyaltyPromoCode(db as unknown as D1Database, {
      userId: "u", type: "percentage", value: 15, threshold: 2,
      cycleEnd: "2026-08-20 12:00:00", validityDays: 60,
    });
    expect(promo).toMatchObject({ user_id: "u", source: "loyalty", max_usage: 1, cycle_end: "2026-08-20 12:00:00" });
    expect(promo.code).toMatch(/^FID-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it("met à jour notified_at lors d'un renvoi, même si le code était déjà notifié", async () => {
    sqlite.prepare("INSERT INTO promo_codes (id,code,type,value,user_id,source,notified_at) VALUES ('resend','RESEND','fixed',10,'u','loyalty','2000-01-01 00:00:00')").run();
    expect(await markLoyaltyPromoCodeResent(db as unknown as D1Database, "resend")).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect((sqlite.prepare("SELECT notified_at FROM promo_codes WHERE id='resend'").get() as { notified_at: string }).notified_at).not.toBe("2000-01-01 00:00:00");
  });

  it("refuse les codes manuels, utilisés, expirés et inactifs", () => {
    const base = { source: "loyalty" as const, used_at: null, expires_at: "2099-01-01", is_active: 1 };
    expect(getLoyaltyPromoResendError({ ...base, source: "manual" }, "2026-08-28")).toBe("Seuls les codes fidélité peuvent être renvoyés.");
    expect(getLoyaltyPromoResendError({ ...base, used_at: "2026-08-27 10:00:00" }, "2026-08-28")).toBe("Ce code a déjà été utilisé.");
    expect(getLoyaltyPromoResendError({ ...base, expires_at: "2026-08-27" }, "2026-08-28")).toBe("Ce code a expiré le 2026-08-27.");
    expect(getLoyaltyPromoResendError({ ...base, is_active: 0 }, "2026-08-28")).toBe("Ce code promo est inactif.");
  });

  it("refuse un client absent ou sans email", () => {
    expect(getLoyaltyPromoResendClientError(null)).toBe("Le client associé à ce code est introuvable.");
    expect(getLoyaltyPromoResendClientError({ email: "  " })).toBe("Le client associé à ce code n'a pas d'adresse email.");
  });

  it("transmet la portée réellement stockée du code, indépendamment de son type", () => {
    const data = buildLoyaltyCodeEmailData(
      { first_name: "Ada", name: "Ada Lovelace", email: "ada@example.com", loyalty_threshold: 3 },
      { code: "FID-TEST123", type: "percentage", value: 15, scope: "cart", expires_at: "2026-10-01" },
      "https://example.com/reservation",
    );
    expect(data.scope).toBe("cart");
  });

  it("applique un pourcentage à la première séance et un montant fixe au panier", async () => {
    const percentage = await createLoyaltyPromoCode(db as unknown as D1Database, {
      userId: "u", type: "percentage", value: 15, threshold: 2,
      cycleEnd: "2026-08-20 12:00:00", validityDays: 60,
    });
    const fixed = await createLoyaltyPromoCode(db as unknown as D1Database, {
      userId: "u", type: "fixed", value: 15, threshold: 2,
      cycleEnd: "2026-08-20 12:00:00", validityDays: 60,
    });
    expect(percentage.scope).toBe("first_booking");
    expect(fixed.scope).toBe("cart");
  });

  it("fait courir la validité depuis l'émission, pas depuis la fin du cycle", async () => {
    // Une fidélité activée rétroactivement a une fin de cycle très ancienne :
    // la dater depuis le cycle livrerait un code déjà expiré.
    const promo = await createLoyaltyPromoCode(db as unknown as D1Database, {
      userId: "u", type: "fixed", value: 15, threshold: 2,
      cycleEnd: "2020-01-01 12:00:00", validityDays: 60,
    });
    expect(promo.expires_at).toBe(addDaysToDateISO(getParisDateISO(), 60));
    expect(promo.expires_at! > getParisDateISO()).toBe(true);
  });

  it("n'élit pas un client fidélité sans aucune réservation éligible", () => {
    sqlite.prepare("UPDATE users SET loyalty_threshold=1, loyalty_cycle_start=NULL WHERE id='u'").run();
    const query = buildDueLoyaltyCodeCandidatesQuery(now, 200);
    expect(sqlite.prepare(query.sql).all(...(query.params as SQLInputValue[]))).toHaveLength(0);
  });

  it("compte le total et le cycle courant avec les mêmes critères que le cron", async () => {
    addBooking("one", "2000-01-01");
    addBooking("two", "2000-01-02", "completed");
    sqlite.prepare("UPDATE users SET loyalty_threshold=3, loyalty_cycle_start='2000-01-01 12:00:00' WHERE id='u'").run();

    const query = buildUserLoyaltyProgressQuery(now, "u");
    expect(query.sql).toContain("b.status IN ('confirmed','completed')");
    expect(query.sql).toContain("u.loyalty_cycle_start IS NULL OR eb.booking_end > u.loyalty_cycle_start");
    await expect(getUserLoyaltyProgress(db as unknown as D1Database, "u")).resolves.toEqual({
      pastEligibleBookings: 2,
      counter: 1,
      remainingToNextAward: 2,
      isDue: false,
      threshold: 3,
    });
  });

  it("déclare une remise due quand le compteur dépasse le seuil", async () => {
    addBooking("one", "2000-01-01");
    addBooking("two", "2000-01-02");
    addBooking("three", "2000-01-03");
    sqlite.prepare("UPDATE users SET loyalty_threshold=2 WHERE id='u'").run();

    await expect(getUserLoyaltyProgress(db as unknown as D1Database, "u")).resolves.toMatchObject({
      pastEligibleBookings: 3,
      counter: 3,
      remainingToNextAward: 0,
      isDue: true,
      threshold: 2,
    });
  });

  it("renvoie zéro pour un seuil nul sans réservation", async () => {
    sqlite.prepare("UPDATE users SET loyalty_threshold=0 WHERE id='u'").run();

    await expect(getUserLoyaltyProgress(db as unknown as D1Database, "u")).resolves.toEqual({
      pastEligibleBookings: 0,
      counter: 0,
      remainingToNextAward: 0,
      isDue: false,
      threshold: 0,
    });
  });

  it("filtre les codes nominatifs par propriétaire", async () => {
    const cart = [{ ref: "booking", date: "2026-08-20", startTime: "10:00", subtotal: 20 }];
    sqlite.prepare("INSERT INTO promo_codes (id,code,type,value,user_id,source) VALUES ('owned','OWNED','fixed',5,'u','loyalty')").run();
    await expect(validatePromoCode(db as unknown as D1Database, "owned", cart, "other")).resolves.toEqual({ valid: false, error: "Code promo invalide" });
    await expect(validatePromoCode(db as unknown as D1Database, "owned", cart, "u")).resolves.toMatchObject({ valid: true });
  });

  it("consomme atomiquement un code et compense le claim", async () => {
    sqlite.prepare("INSERT INTO promo_codes (code,is_active,usage_count,max_usage,expires_at) VALUES ('ONCE',1,0,1,'2026-08-27')").run();
    expect(await claimPromoCodeUsage(db as unknown as D1Database, "once", "2026-08-27")).toBe(true);
    expect(await claimPromoCodeUsage(db as unknown as D1Database, "once", "2026-08-27")).toBe(false);
    await releasePromoCodeUsage(db as unknown as D1Database, "once");
    expect(sqlite.prepare("SELECT usage_count FROM promo_codes WHERE code='ONCE'").get()).toEqual({ usage_count: 0 });
  });

  it("refuse la 11e tentative de preview dans la même fenêtre", async () => {
    const window = 1_700_000_000_000;
    for (let index = 0; index < 10; index++) {
      expect(await claimPromoValidationAttempt(db as unknown as D1Database, "203.0.113.10", window)).toBe(true);
    }
    expect(await claimPromoValidationAttempt(db as unknown as D1Database, "203.0.113.10", window)).toBe(false);
  });

  it("conserve les remises historiques liées à loyalty_award_id", async () => {
    sqlite.prepare("INSERT INTO bookings (id,user_id,status,promo_discount,total_price,loyalty_award_id) VALUES ('legacy','u','confirmed',12,20,'award-1')").run();
    await expect(getUserLoyaltyDiscountTotal(db as unknown as D1Database, "u")).resolves.toBe(12);
  });
});
