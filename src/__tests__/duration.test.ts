import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { bookingEndMinutes, clockMinutes } from "../lib/booking";
import { bookingDurationExpression } from "../lib/db";

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE bookings (start_time TEXT NOT NULL, end_time TEXT NOT NULL);");
});

afterAll(() => db.close());

function executeDuration(start: string, end: string, alias?: string): number {
  db.exec("DELETE FROM bookings;");
  db.prepare("INSERT INTO bookings (start_time, end_time) VALUES (?, ?)").run(start, end);
  const from = alias ? "FROM bookings b" : "FROM bookings";
  const row = db.prepare(`SELECT ${bookingDurationExpression(alias ?? "")} AS minutes ${from}`).get() as { minutes: number };
  return Number(row.minutes);
}

const cases = [
  ["10:00", "11:30"],
  ["22:00", "00:00"],
  ["22:00", "03:00"],
  ["00:00", "00:30"],
  ["00:00", "02:00"],
  ["10:00", "10:00"],
  ["10:00", "09:00"],
  ["23:30", "00:00"],
] as const;

describe("booking duration SQL fragment", () => {
  it.each(cases)("matches bookingEndMinutes for %s → %s", (start, end) => {
    const expected = bookingEndMinutes(start, end) - clockMinutes(start);
    expect(executeDuration(start, end)).toBe(expected);
    expect(executeDuration(start, end, "b")).toBe(expected);
  });

  it("remains composable inside a larger arithmetic expression", () => {
    db.exec("DELETE FROM bookings;");
    db.prepare("INSERT INTO bookings (start_time, end_time) VALUES (?, ?)").run("22:00", "03:00");
    const row = db.prepare(`SELECT ${bookingDurationExpression()} / 60 AS hours FROM bookings`).get() as { hours: number };
    expect(Number(row.hours)).toBe(5);
  });
});
