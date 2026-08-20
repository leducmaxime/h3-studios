import { describe, expect, it } from "vitest";
import {
  buildExportFilename,
  buildExportTitle,
  buildMonthCellLines,
  bookingBlockColor,
  computeDayOccupancyRatePure,
  computeScale,
  computeSlotRange,
  dayColumnWidth,
  dayGridWidth,
  layoutBookingBlock,
  truncateText,
} from "@/lib/calendar-export";
import type { CalendarExportBooking } from "@/lib/calendar-export";

function booking(overrides: Partial<CalendarExportBooking>): CalendarExportBooking {
  return {
    id: "b1",
    booking_ref: "H3-0001",
    date: "2026-08-17",
    start_time: "18:00",
    end_time: "20:00",
    studio_id: "la-scene",
    group_type: "group",
    status: "confirmed",
    payment_status: "paid",
    band_name: "Les Dragons",
    user_name: "Alice",
    ...overrides,
  };
}

const measure = (w: number) => ({ measureText: (s: string) => ({ width: s.length * w }) });

describe("computeSlotRange", () => {
  it("calcule les bornes dans ALL_TIME_SLOTS", () => {
    expect(computeSlotRange("18:00", "20:00")).toEqual({ startIdx: 18, endIdx: 22 });
  });

  it("traite 00:00 comme fin de journée", () => {
    const r = computeSlotRange("23:30", "00:00");
    expect(r.startIdx).toBe(29);
    expect(r.endIdx).toBe(30); // 00:00 est le 31e élément (index 30)
  });
});

describe("layoutBookingBlock", () => {
  it("positionne depuis 09:00 avec le pitch demandé", () => {
    // ALL_TIME_SLOTS commence à 09:00 (index 0) → 18:00 = index 18
    const r = layoutBookingBlock({ startIdx: 18, endIdx: 22 }, 44);
    expect(r.top).toBe(18 * 44);
    expect(r.height).toBe(4 * 44);
  });

  it("applique une hauteur minimale lisible", () => {
    // pitch 20 → 1 créneau = 20px, mais le minimum est 24px
    const r = layoutBookingBlock({ startIdx: 18, endIdx: 19 }, 20);
    expect(r.height).toBe(24);
  });
});

describe("truncateText", () => {
  it("retourne le texte inchangé s'il tient", () => {
    expect(truncateText(measure(10), "court", 100)).toBe("court");
  });

  it("ajoute une ellipse quand le texte dépasse", () => {
    const out = truncateText(measure(10), "un nom très très long", 60);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan("un nom très très long".length);
  });
});

describe("buildMonthCellLines", () => {
  it("tri par heure et plafonne avec le compte des lignes masquées", () => {
    const lines = buildMonthCellLines(
      [
        booking({ id: "a", start_time: "12:00", band_name: "Zulu" }),
        booking({ id: "b", start_time: "09:00", band_name: "Alpha" }),
        booking({ id: "c", start_time: "10:00", band_name: "Bravo" }),
        booking({ id: "d", start_time: "11:00", band_name: "Charlie" }),
        booking({ id: "e", start_time: "14:00", band_name: "Delta" }),
      ],
      2,
    );
    expect(lines.lines).toHaveLength(2);
    expect(lines.lines[0].time).toBe("09:00");
    expect(lines.lines[0].name).toBe("Alpha");
    expect(lines.lines[1].time).toBe("10:00");
    expect(lines.overflow).toBe(3);
  });
});

describe("computeDayOccupancyRatePure", () => {
  it("0 sans réservation", () => {
    // 2026-08-17 est un lundi (studio ouvert 18:00-00:00 → peu de créneaux)
    const date = new Date(2026, 7, 17);
    expect(computeDayOccupancyRatePure([], date)).toBe(0);
  });

  it("borné à 1 même en sur-réservation", () => {
    const date = new Date(2026, 7, 17); // lundi
    const many = Array.from({ length: 12 }, (_, i) =>
      booking({ id: `b${i}`, start_time: "18:00", end_time: "22:30", studio_id: "la-scene" }),
    );
    expect(computeDayOccupancyRatePure(many, date)).toBeLessThanOrEqual(1);
  });
});

describe("bookingBlockColor", () => {
  it("consultations en émeraude sauf absent", () => {
    expect(bookingBlockColor(booking({ group_type: "solo", status: "confirmed" })).border).toBe("#34d399");
    expect(bookingBlockColor(booking({ group_type: "duo", status: "no-show" })).border).toBe("#f87171");
  });

  it("payé en vert, impayé en orange", () => {
    expect(bookingBlockColor(booking({ payment_status: "paid" })).border).toBe("#4ade80");
    expect(bookingBlockColor(booking({ payment_status: "pending" })).border).toBe("#fbbf24");
  });
});

describe("dayGridWidth", () => {
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 17 + i));

  it("réserve une colonne par jour en vue semaine", () => {
    // Régression : la mesure ne comptait que 2 colonnes alors que le rendu en
    // dessine 7 → les jours 3 à 7 sortaient du canvas et étaient tronqués.
    const width = dayGridWidth({
      view: "week",
      currentDate: weekDates[0],
      weekDates,
      bookings: [],
      blockedSlots: [],
    });
    expect(width).toBe(90 + 7 * dayColumnWidth("week"));
    expect(width).toBe(1490);
  });

  it("une seule colonne en vue jour", () => {
    const width = dayGridWidth({
      view: "day",
      currentDate: weekDates[0],
      weekDates,
      bookings: [],
      blockedSlots: [],
    });
    expect(width).toBe(90 + dayColumnWidth("day"));
    expect(width).toBe(370);
  });

  it("reste dans le budget de pixels après mise à l'échelle (vue semaine)", () => {
    const width = 1490;
    const height = 56 + 44 + 31 * 44 + 40;
    const s = computeScale(width, height);
    expect(width * height * s * s).toBeLessThanOrEqual(12_000_000 + 1);
  });
});

describe("computeScale", () => {
  it("double la résolution sous le budget iOS", () => {
    expect(computeScale(800, 600)).toBe(2);
  });

  it("réduit l'échelle quand la surface mise à l'échelle dépasse le budget", () => {
    const s = computeScale(4000, 2000); // 8M px logiques → 32M px à 2x > 12M
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThan(2);
    expect(4000 * 2000 * s * s).toBeLessThanOrEqual(12_000_000 + 1);
  });
});

describe("buildExportFilename / buildExportTitle", () => {
  it("nomme le fichier avec la vue et la date d'ancrage", () => {
    expect(buildExportFilename("week", new Date(2026, 7, 17))).toBe("h3-planning-week-2026-08-17.png");
  });

  it("titre français de la vue semaine", () => {
    const title = buildExportTitle({
      view: "week",
      currentDate: new Date(2026, 7, 17),
      weekDates: [new Date(2026, 7, 17), new Date(2026, 7, 18), new Date(2026, 7, 19), new Date(2026, 7, 20), new Date(2026, 7, 21), new Date(2026, 7, 22), new Date(2026, 7, 23)],
      bookings: [],
      blockedSlots: [],
    });
    expect(title).toMatch(/^Planning — Semaine du /);
  });
});
