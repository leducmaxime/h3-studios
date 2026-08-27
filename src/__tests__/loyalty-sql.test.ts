import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it, beforeEach } from "vitest";
import { buildDueLoyaltyRewardCandidatesQuery, buildLoyaltyCountsQuery, claimLoyaltyAward, claimLoyaltyRewardEmail, getUserLoyaltyCounts, getUserLoyaltyDiscountTotal } from "@/lib/db";
import { getBookingAmountDue } from "@/lib/booking-totals";
import { getLoyaltyProgress } from "@/lib/loyalty";

const now = { dateISO: "2026-08-20", hours: 20, minutes: 0 };
class D1Memory {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) {
    const s = this.sqlite.prepare(sql);
    return { bind: (...p: SQLInputValue[]) => ({ first: async <T>() => s.get(...p) as T, all: async <T>() => ({ results: s.all(...p) as T[] }), run: async () => { const r = s.run(...p); return { meta: { changes: Number(r.changes) } }; } }) };
  }
}

let sqlite: DatabaseSync;
let db: D1Memory;
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT DEFAULT '', first_name TEXT, is_blocked INTEGER DEFAULT 0, loyalty_enabled INTEGER DEFAULT 0, loyalty_discount_type TEXT, loyalty_discount_value REAL DEFAULT 0, loyalty_threshold INTEGER DEFAULT 0, loyalty_notified_award_index INTEGER DEFAULT 0, loyalty_emails_opt_out INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE bookings (id TEXT PRIMARY KEY, user_id TEXT, date TEXT, start_time TEXT, end_time TEXT, status TEXT, promo_discount REAL DEFAULT 0, loyalty_award_id TEXT, base_price REAL DEFAULT 0, equipment_price REAL DEFAULT 0, total_price REAL DEFAULT 0, updated_at TEXT);`);
  db = new D1Memory(sqlite);
  sqlite.prepare("INSERT INTO users (id,email,name,first_name,is_blocked,loyalty_enabled,loyalty_discount_type,loyalty_discount_value,loyalty_threshold,loyalty_notified_award_index,loyalty_emails_opt_out) VALUES ('u','u@example.com','User',NULL,0,1,'fixed',10,3,0,0)").run();
});

const add = (id: string, date: string, status = "confirmed", award: string | null = null) => sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,loyalty_award_id) VALUES (?,?,?,?,?,?,?)").run(id, "u", date, "10:00", "12:00", status, award);

describe("fidélité — SQL D1", () => {
  it("compte seulement les réservations passées confirmées/completed et les awards distincts", async () => {
    add("a", "2000-08-19", "confirmed", "award-1"); add("b", "2000-08-18", "completed", "award-1");
    add("c", "2000-08-17", "no-show"); add("d", "2000-08-16", "cancelled", "award-2"); add("e", "2999-08-21");
    const q = buildLoyaltyCountsQuery("u", now);
    const row = sqlite.prepare(q.sql).get(...(q.params as SQLInputValue[])) as { past_eligible: number; awards_granted: number; past_since_award: number };
    expect(row).toEqual({ past_eligible: 2, awards_granted: 1, past_since_award: 0 });
    await expect(getUserLoyaltyCounts(db as unknown as D1Database, "u")).resolves.toEqual({ pastEligibleBookings: 2, awardsGranted: 1, pastSinceLastAward: 0 });
  });

  it("construit les candidats avec tous les paramètres liés et les filtres de sécurité", () => {
    const q = buildDueLoyaltyRewardCandidatesQuery(now, 25);
    expect(q.params).toHaveLength((q.sql.match(/\?/g) || []).length);
    expect(q.params).toHaveLength(10);
    expect(q.sql).toContain("COALESCE(u.is_blocked, 0) = 0");
    expect(q.sql).toContain("u.email IS NOT NULL");
    expect(q.sql).toContain("TRIM(u.email) <> ''");
    expect(q.sql).toContain("COALESCE(u.loyalty_emails_opt_out, 0) = 0");
    expect(q.sql).toContain("lower(trim(u.email))");
  });

  it("déduplique les candidats dus par email normalisé avec le plus petit id", () => {
    sqlite.prepare("UPDATE users SET loyalty_threshold=1 WHERE id='u'").run();
    sqlite.prepare("INSERT INTO users (id,email,name,first_name,is_blocked,loyalty_enabled,loyalty_discount_type,loyalty_discount_value,loyalty_threshold,loyalty_notified_award_index,loyalty_emails_opt_out) VALUES ('v',' U@EXAMPLE.COM ','Duplicate',NULL,0,1,'fixed',10,1,0,0)").run();
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('u-booking','u','2000-01-01','10:00','12:00','confirmed')").run();
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('v-booking','v','2000-01-02','10:00','12:00','confirmed')").run();

    const q = buildDueLoyaltyRewardCandidatesQuery(now, 25);
    const rows = sqlite.prepare(q.sql).all(...(q.params as SQLInputValue[])) as { id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("u");
  });

  it("exclut du SQL les clients déjà notifiés pour l'award courant", () => {
    // Un client reste « dû » jusqu'à sa prochaine réservation. Sans ce filtre
    // en SQL, les déjà-notifiés satureraient le LIMIT à chaque exécution et
    // les nouveaux gagnants ne seraient jamais atteints.
    sqlite.prepare("UPDATE users SET loyalty_threshold=1 WHERE id='u'").run();
    add("u-booking", "2000-01-01");

    const pending = buildDueLoyaltyRewardCandidatesQuery(now, 25);
    expect(sqlite.prepare(pending.sql).all(...(pending.params as SQLInputValue[]))).toHaveLength(1);

    sqlite.prepare("UPDATE users SET loyalty_notified_award_index=1 WHERE id='u'").run();
    const notified = buildDueLoyaltyRewardCandidatesQuery(now, 25);
    expect(sqlite.prepare(notified.sql).all(...(notified.params as SQLInputValue[]))).toHaveLength(0);
  });

  it("ne promeut pas le doublon d'inbox une fois le gagnant notifié", () => {
    // Le rang par inbox est calculé avant le filtre « déjà notifié » : sinon le
    // perdant deviendrait rang 1 et enverrait un second mail à la même adresse.
    sqlite.prepare("UPDATE users SET loyalty_threshold=1, loyalty_notified_award_index=1 WHERE id='u'").run();
    sqlite.prepare("INSERT INTO users (id,email,name,first_name,is_blocked,loyalty_enabled,loyalty_discount_type,loyalty_discount_value,loyalty_threshold,loyalty_notified_award_index,loyalty_emails_opt_out) VALUES ('v',' U@EXAMPLE.COM ','Duplicate',NULL,0,1,'fixed',10,1,0,0)").run();
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('u-booking','u','2000-01-01','10:00','12:00','confirmed')").run();
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('v-booking','v','2000-01-02','10:00','12:00','confirmed')").run();

    const q = buildDueLoyaltyRewardCandidatesQuery(now, 25);
    expect(sqlite.prepare(q.sql).all(...(q.params as SQLInputValue[]))).toHaveLength(0);
  });

  it("réarme l'index de notification au cycle suivant après consommation de l'award", () => {
    const config = { enabled: true, type: "fixed" as const, value: 10, threshold: 2 };
    const cycleOne = getLoyaltyProgress(config, 2, 0, 2);
    const firstAwardIndex = cycleOne.awardsGranted + 1;
    expect(cycleOne.isDue).toBe(true);
    expect(firstAwardIndex).toBe(1);

    const cycleTwo = getLoyaltyProgress(config, 4, 1, 2);
    const secondAwardIndex = cycleTwo.awardsGranted + 1;
    expect(cycleTwo.isDue).toBe(true);
    expect(secondAwardIndex).toBe(2);
    expect(1).toBeLessThan(secondAwardIndex);
  });

  it("la garde de claim email empêche une seconde réservation au même awardIndex", async () => {
    expect(await claimLoyaltyRewardEmail(db as unknown as D1Database, { userId: "u", awardIndex: 1 })).toBe(true);
    expect(await claimLoyaltyRewardEmail(db as unknown as D1Database, { userId: "u", awardIndex: 1 })).toBe(false);
    expect(sqlite.prepare("SELECT loyalty_notified_award_index FROM users WHERE id='u'").get()).toEqual({ loyalty_notified_award_index: 1 });
  });

  it("réclamation concurrente : la seconde avec expectedAwardsGranted échoue et la ligne reste inchangée", async () => {
    add("b", "2026-08-20");
    const args = { bookingId: "b", userId: "u", awardId: "a1", discount: 10, expectedAwardsGranted: 0 };
    expect(await claimLoyaltyAward(db as unknown as D1Database, args)).toBe(true);
    expect(await claimLoyaltyAward(db as unknown as D1Database, { ...args, awardId: "a2" })).toBe(false);
    expect(sqlite.prepare("SELECT promo_discount, loyalty_award_id FROM bookings WHERE id='b'").get()).toEqual({ promo_discount: 10, loyalty_award_id: "a1" });
  });

  it("panier multi-réservations : claim partagé compté comme un seul award et remises bornées par ligne", async () => {
    add("b", "2026-08-19");
    add("c", "2026-08-18");
    sqlite.prepare("UPDATE bookings SET base_price=7, equipment_price=3, total_price=10 WHERE id='b'").run();
    sqlite.prepare("UPDATE bookings SET base_price=20, equipment_price=0, total_price=20 WHERE id='c'").run();
    const award = "shared-award";
    expect(await claimLoyaltyAward(db as unknown as D1Database, { bookingId: "b", userId: "u", awardId: award, discount: 10, expectedAwardsGranted: 0 })).toBe(true);
    expect(await claimLoyaltyAward(db as unknown as D1Database, { bookingId: "c", userId: "u", awardId: award, discount: 5, expectedAwardsGranted: 1 })).toBe(true);
    const counts = await getUserLoyaltyCounts(db as unknown as D1Database, "u");
    const rows = sqlite.prepare("SELECT base_price + equipment_price AS gross, promo_discount, loyalty_award_id FROM bookings WHERE loyalty_award_id=?").all(award) as { gross: number; promo_discount: number; loyalty_award_id: string }[];
    expect(counts.awardsGranted).toBe(1);
    expect(rows.every(r => r.promo_discount <= r.gross)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.promo_discount, 0)).toBe(15);
    expect(new Set(rows.map(r => r.loyalty_award_id))).toEqual(new Set([award]));
  });

  it("réutilise promo_discount pour le montant dû d'une ligne fidélité", () => expect(getBookingAmountDue({ base_price: 30, equipment_price: 5, total_price: 35, promo_discount: 10 })).toBe(25));

  it("après libération d'un award, la requête de comptage le retire et la progression redevient due", async () => {
    add("b", "2026-08-19");
    expect(await claimLoyaltyAward(db as unknown as D1Database, { bookingId: "b", userId: "u", awardId: "award-1", discount: 10, expectedAwardsGranted: 0 })).toBe(true);
    expect((await getUserLoyaltyCounts(db as unknown as D1Database, "u")).awardsGranted).toBe(1);
    sqlite.prepare("UPDATE bookings SET promo_discount=4, loyalty_award_id=NULL WHERE id='b'").run();
    expect(await getUserLoyaltyCounts(db as unknown as D1Database, "u")).toMatchObject({ awardsGranted: 0 });
    expect(getLoyaltyProgress({ enabled: true, type: "fixed", value: 10, threshold: 1 }, 1, 0).isDue).toBe(true);
  });

  it("modification du brut : l'award reste compté par la requête de fidélité", async () => {
    add("b", "2026-08-19");
    expect(await claimLoyaltyAward(db as unknown as D1Database, { bookingId: "b", userId: "u", awardId: "award-1", discount: 10, expectedAwardsGranted: 0 })).toBe(true);
    sqlite.prepare("UPDATE bookings SET total_price=5, base_price=5 WHERE id='b'").run();
    expect(await getUserLoyaltyCounts(db as unknown as D1Database, "u")).toMatchObject({ awardsGranted: 1 });
    expect((sqlite.prepare("SELECT loyalty_award_id FROM bookings WHERE id='b'").get() as { loyalty_award_id: string }).loyalty_award_id).toBe("award-1");
  });

  it("après une remise, seules les réservations postérieures comptent pour le cycle suivant", async () => {
    add("old-1", "2000-01-01");
    add("old-2", "2000-01-02");
    add("old-3", "2000-01-03");
    add("rewarded", "2000-01-04", "confirmed", "award-1");
    add("after-1", "2000-01-05");
    expect(await getUserLoyaltyCounts(db as unknown as D1Database, "u")).toMatchObject({ pastEligibleBookings: 5, awardsGranted: 1, pastSinceLastAward: 1 });
  });

  it("attribution commune : getUserLoyaltyCounts additionne les réservations passées des deux comptes", async () => {
    sqlite.prepare("INSERT INTO users (id,email,name,first_name,is_blocked,loyalty_enabled,loyalty_discount_type,loyalty_discount_value,loyalty_threshold,loyalty_notified_award_index,loyalty_emails_opt_out) VALUES ('duplicate','duplicate@example.com','Duplicate',NULL,0,1,'percentage',10,3,0,0)").run();
    add("primary-booking", "2000-01-01");
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('duplicate-booking','duplicate','2000-01-02','10:00','12:00','completed')").run();
    sqlite.prepare("UPDATE bookings SET user_id='u' WHERE user_id='duplicate'").run();
    await expect(getUserLoyaltyCounts(db as unknown as D1Database, "u")).resolves.toMatchObject({ pastEligibleBookings: 2 });
  });

  it("somme uniquement les remises fidélité non annulées, bornées par le brut", async () => {
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,promo_discount,loyalty_award_id,total_price) VALUES (?,?,?,?,?,?,?,?,?)").run("loyal", "u", "2000-01-01", "10:00", "12:00", "confirmed", 10, "award-1", 20);
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,promo_discount,loyalty_award_id,total_price) VALUES (?,?,?,?,?,?,?,?,?)").run("capped", "u", "2000-01-02", "10:00", "12:00", "completed", 12, "award-2", 5);
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,promo_discount,loyalty_award_id,total_price) VALUES (?,?,?,?,?,?,?,?,?)").run("cancelled", "u", "2000-01-03", "10:00", "12:00", "cancelled", 8, "award-3", 30);
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,promo_discount,total_price) VALUES (?,?,?,?,?,?,?,?)").run("promo", "u", "2000-01-04", "10:00", "12:00", "confirmed", 9, 40);
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,promo_discount,total_price) VALUES (?,?,?,?,?,?,?,?)").run("manual", "u", "2000-01-05", "10:00", "12:00", "confirmed", 4, 25);
    await expect(getUserLoyaltyDiscountTotal(db as unknown as D1Database, "u")).resolves.toBe(15);
  });
});
