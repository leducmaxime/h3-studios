import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { bookingEndMinutes, clockMinutes, slotDurationSlots, timeRangesOverlap } from "@/lib/booking";
import { sqlBookingEndInstant, sqlBookingStartInstant } from "@/lib/db";

interface TimeSlot {
  startTime: string;
  endTime: string;
}

function hasConflict(existing: TimeSlot[], newSlot: TimeSlot): boolean {
  return existing.some((slot) => timeRangesOverlap(
    slot.startTime,
    slot.endTime,
    newSlot.startTime,
    newSlot.endTime,
  ));
}

let sqlite: DatabaseSync;
beforeAll(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE bookings (studio_id TEXT, date TEXT, status TEXT, start_time TEXT, end_time TEXT);");
});
afterAll(() => sqlite.close());

function sqlHasConflict(existing: TimeSlot, candidate: TimeSlot): boolean {
  sqlite.exec("DELETE FROM bookings;");
  sqlite.prepare("INSERT INTO bookings VALUES (?, ?, ?, ?, ?)").run("la-scene", "2026-01-01", "confirmed", existing.startTime, existing.endTime);
  const row = sqlite.prepare(`
    SELECT 1 AS conflict
    FROM bookings b
    WHERE ${sqlBookingStartInstant("b")} < datetime(?, '+' || ? || ' minutes')
      AND ${sqlBookingEndInstant("b")} > datetime(?, '+' || ? || ' minutes')
    LIMIT 1
  `).get(
    "2026-01-01",
    bookingEndMinutes(candidate.startTime, candidate.endTime),
    "2026-01-01",
    clockMinutes(candidate.startTime),
  ) as { conflict?: number } | undefined;
  return row?.conflict === 1;
}

describe("Conflict Detection", () => {
  it("uses the shared clock and end-minute rules", () => {
    expect(bookingEndMinutes("10:00", "10:00") - clockMinutes("10:00")).toBe(0);
    expect(hasConflict([{ startTime: "10:00", endTime: "10:00" }], { startTime: "14:00", endTime: "16:00" })).toBe(false);
  });

  it("rejects zero-length ranges while retaining the sub-hour admin allowance", () => {
    expect(slotDurationSlots("10:00", "10:00")).toBe(0);
    expect(slotDurationSlots("10:00", "10:30")).toBe(1);
  });

  it("uses the corrected shared SQL conflict predicate", () => {
    expect(sqlHasConflict({ startTime: "10:00", endTime: "10:00" }, { startTime: "14:00", endTime: "16:00" })).toBe(false);
    expect(sqlHasConflict({ startTime: "10:00", endTime: "12:00" }, { startTime: "11:00", endTime: "13:00" })).toBe(true);
  });

  it("should detect no conflict when slots don't overlap", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "12:00" },
    ];
    const newSlot = { startTime: "14:00", endTime: "16:00" };

    expect(hasConflict(existing, newSlot)).toBe(false);
  });

  it("should detect conflict when slots fully overlap", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "12:00" },
    ];
    const newSlot = { startTime: "10:00", endTime: "12:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("should detect conflict when new slot starts during existing", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "14:00" },
    ];
    const newSlot = { startTime: "12:00", endTime: "16:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("should detect conflict when new slot ends during existing", () => {
    const existing: TimeSlot[] = [
      { startTime: "12:00", endTime: "16:00" },
    ];
    const newSlot = { startTime: "10:00", endTime: "14:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("should detect conflict when new slot is inside existing", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "16:00" },
    ];
    const newSlot = { startTime: "12:00", endTime: "14:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("should detect conflict when existing is inside new", () => {
    const existing: TimeSlot[] = [
      { startTime: "12:00", endTime: "14:00" },
    ];
    const newSlot = { startTime: "10:00", endTime: "16:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("should detect no conflict for adjacent slots (end == start)", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "12:00" },
    ];
    const newSlot = { startTime: "12:00", endTime: "14:00" };

    expect(hasConflict(existing, newSlot)).toBe(false);
  });

  it("should detect no conflict for adjacent slots (new ends when existing starts)", () => {
    const existing: TimeSlot[] = [
      { startTime: "14:00", endTime: "16:00" },
    ];
    const newSlot = { startTime: "12:00", endTime: "14:00" };

    expect(hasConflict(existing, newSlot)).toBe(false);
  });

  it("should handle midnight boundary without conflict", () => {
    const existing: TimeSlot[] = [
      { startTime: "22:00", endTime: "00:00" },
    ];
    const newSlot = { startTime: "20:00", endTime: "22:00" };

    expect(hasConflict(existing, newSlot)).toBe(false);
  });

  it("should handle midnight boundary with conflict", () => {
    const existing: TimeSlot[] = [
      { startTime: "22:00", endTime: "00:00" },
    ];
    const newSlot = { startTime: "23:00", endTime: "00:00" };

    expect(hasConflict(existing, newSlot)).toBe(true);
  });

  it("keeps midnight adjacency free and detects next-day overlap", () => {
    expect(hasConflict([{ startTime: "23:00", endTime: "03:00" }], { startTime: "03:00", endTime: "05:00" })).toBe(false);
    expect(hasConflict([{ startTime: "23:00", endTime: "03:00" }], { startTime: "22:30", endTime: "23:30" })).toBe(true);
  });

  it("should check against multiple existing slots", () => {
    const existing: TimeSlot[] = [
      { startTime: "10:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "16:00" },
      { startTime: "18:00", endTime: "20:00" },
    ];
    
    expect(hasConflict(existing, { startTime: "08:00", endTime: "10:00" })).toBe(false);
    expect(hasConflict(existing, { startTime: "11:00", endTime: "13:00" })).toBe(true);
    expect(hasConflict(existing, { startTime: "16:00", endTime: "18:00" })).toBe(false);
    expect(hasConflict(existing, { startTime: "19:00", endTime: "21:00" })).toBe(true);
  });
});
