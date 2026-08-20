import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it, beforeEach } from "vitest";
import { buildLoyaltyCountsQuery, claimLoyaltyAward, getUserLoyaltyCounts } from "@/lib/db";
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
  sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, loyalty_enabled INTEGER DEFAULT 0, loyalty_discount_type TEXT, loyalty_discount_value REAL DEFAULT 0, loyalty_threshold INTEGER DEFAULT 0);
    CREATE TABLE bookings (id TEXT PRIMARY KEY, user_id TEXT, date TEXT, start_time TEXT, end_time TEXT, status TEXT, promo_discount REAL DEFAULT 0, loyalty_award_id TEXT, base_price REAL DEFAULT 0, equipment_price REAL DEFAULT 0, total_price REAL DEFAULT 0, updated_at TEXT);`);
  db = new D1Memory(sqlite);
  sqlite.prepare("INSERT INTO users VALUES ('u',1,'fixed',10,3)").run();
});

const add = (id: string, date: string, status = "confirmed", award: string | null = null) => sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status,loyalty_award_id) VALUES (?,?,?,?,?,?,?)").run(id, "u", date, "10:00", "12:00", status, award);

describe("fidélité — SQL D1", () => {
  it("compte seulement les réservations passées confirmées/completed et les awards distincts", async () => {
    add("a", "2000-08-19", "confirmed", "award-1"); add("b", "2000-08-18", "completed", "award-1");
    add("c", "2000-08-17", "no-show"); add("d", "2000-08-16", "cancelled", "award-2"); add("e", "2999-08-21");
    const q = buildLoyaltyCountsQuery("u", now);
    const row = sqlite.prepare(q.sql).get(...(q.params as SQLInputValue[])) as { past_eligible: number; awards_granted: number };
    expect(row).toEqual({ past_eligible: 2, awards_granted: 1 });
    await expect(getUserLoyaltyCounts(db as unknown as D1Database, "u")).resolves.toEqual({ pastEligibleBookings: 2, awardsGranted: 1 });
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

  it("attribution commune : getUserLoyaltyCounts additionne les réservations passées des deux comptes", async () => {
    sqlite.prepare("INSERT INTO users VALUES ('duplicate',1,'percentage',10,3)").run();
    add("primary-booking", "2000-01-01");
    sqlite.prepare("INSERT INTO bookings (id,user_id,date,start_time,end_time,status) VALUES ('duplicate-booking','duplicate','2000-01-02','10:00','12:00','completed')").run();
    sqlite.prepare("UPDATE bookings SET user_id='u' WHERE user_id='duplicate'").run();
    await expect(getUserLoyaltyCounts(db as unknown as D1Database, "u")).resolves.toMatchObject({ pastEligibleBookings: 2 });
  });
});
