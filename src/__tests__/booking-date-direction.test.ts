import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { dateDirectionCondition } from "@/lib/db";

/**
 * Vérifications reproductibles du prédicat « À venir » / « Passées »
 * (issue #42) : classement par instant de fin en Europe/Paris, avec
 * end_time = "00:00" traité comme une fin en fin de journée.
 *
 * On exécute le SQL réellement généré par `dateDirectionCondition` contre
 * une base SQLite en mémoire, avec une horloge figée.
 */

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed'
    );
  `);
});

beforeEach(() => {
  db.exec("DELETE FROM bookings");
});

function insert(id: string, date: string, endTime: string) {
  db.prepare(
    "INSERT INTO bookings (id, date, start_time, end_time) VALUES (?, ?, ?, ?)",
  ).run(id, date, "10:00", endTime);
}

function runDirection(
  direction: "upcoming" | "past",
  now: { dateISO: string; hours: number; minutes: number },
): string[] {
  const { sql, params } = dateDirectionCondition(direction, now);
  const rows = db
    .prepare(`SELECT b.id FROM bookings b WHERE ${sql}`)
    .all(...(params as never[])) as { id: string }[];
  return rows.map((r) => r.id).sort();
}

// Horloge figée : 19 août 2026, 20:51 à Paris (reproduit le constat staging).
const NOW = { dateISO: "2026-08-19", hours: 20, minutes: 51 };

// 23:30 le même soir, pour le cas d'une séance se terminant à minuit.
const LATE = { dateISO: "2026-08-19", hours: 23, minutes: 30 };

describe("dateDirectionCondition — filtre « À venir » / « Passées » (#42)", () => {
  it("une réservation du jour déjà terminée est « passée », pas « à venir »", () => {
    insert("ended-16h", "2026-08-19", "17:00");
    expect(runDirection("upcoming", NOW)).toEqual([]);
    expect(runDirection("past", NOW)).toEqual(["ended-16h"]);
  });

  it("une réservation du jour encore à venir reste « à venir »", () => {
    insert("later-22h", "2026-08-19", "22:00");
    expect(runDirection("upcoming", NOW)).toEqual(["later-22h"]);
    expect(runDirection("past", NOW)).toEqual([]);
  });

  it("une réservation se terminant exactement maintenant est « passée »", () => {
    insert("exact-end", "2026-08-19", "20:51");
    expect(runDirection("upcoming", NOW)).toEqual([]);
    expect(runDirection("past", NOW)).toEqual(["exact-end"]);
  });

  it("end_time = \"00:00\" compte comme fin de journée : encore « à venir » le soir même", () => {
    insert("midnight", "2026-08-19", "00:00");
    expect(runDirection("upcoming", NOW)).toEqual(["midnight"]);
    expect(runDirection("past", NOW)).toEqual([]);
    // À 23:30, toujours à venir (minuit pas encore atteint).
    expect(runDirection("upcoming", LATE)).toEqual(["midnight"]);
  });

  it("une réservation d'hier est « passée », celle de demain « à venir »", () => {
    insert("yesterday", "2026-08-18", "00:00");
    insert("tomorrow", "2026-08-20", "10:30");
    expect(runDirection("upcoming", NOW)).toEqual(["tomorrow"]);
    expect(runDirection("past", NOW)).toEqual(["yesterday"]);
  });

  it("une séance d'hier finissant à minuit (00:00) est « passée » dès le lendemain", () => {
    insert("yesterday-midnight", "2026-08-18", "00:00");
    expect(runDirection("upcoming", NOW)).toEqual([]);
    expect(runDirection("past", NOW)).toEqual(["yesterday-midnight"]);
  });

  it("complémentarité : chaque réservation tombe dans exactement un des deux filtres", () => {
    insert("ended-16h", "2026-08-19", "17:00");
    insert("later-22h", "2026-08-19", "22:00");
    insert("midnight", "2026-08-19", "00:00");
    insert("yesterday", "2026-08-18", "11:00");
    insert("tomorrow", "2026-08-20", "10:30");

    const upcoming = runDirection("upcoming", NOW);
    const past = runDirection("past", NOW);

    expect(upcoming).toEqual(["later-22h", "midnight", "tomorrow"]);
    expect(past).toEqual(["ended-16h", "yesterday"]);

    // Aucune intersection, aucune omission.
    expect(upcoming.filter((id) => past.includes(id))).toEqual([]);
    expect([...upcoming, ...past].sort()).toEqual(
      ["ended-16h", "later-22h", "midnight", "tomorrow", "yesterday"].sort(),
    );
  });
});
