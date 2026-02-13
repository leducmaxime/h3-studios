import { describe, it, expect } from "vitest";

interface TimeSlot {
  startTime: string;
  endTime: string;
}

function hasConflict(existing: TimeSlot[], newSlot: TimeSlot): boolean {
  for (const slot of existing) {
    const existingStart = timeToMinutes(slot.startTime);
    const existingEnd = timeToMinutes(slot.endTime);
    const newStart = timeToMinutes(newSlot.startTime);
    const newEnd = timeToMinutes(newSlot.endTime);

    if (newStart < existingEnd && newEnd > existingStart) {
      return true;
    }
  }
  return false;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (time === "00:00") return 24 * 60;
  return hours * 60 + minutes;
}

describe("Conflict Detection", () => {
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
