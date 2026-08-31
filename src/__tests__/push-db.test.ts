import { describe, expect, it } from "vitest";
import { buildDueRemindersQuery } from "@/lib/db";
import { dispatchDueReminderRows } from "@/lib/cron";
import { bookingReminderKey, formatParisReminderKey, getParisNow } from "@/lib/utils";

describe("notifications push — requêtes et horaires", () => {
  it("construit la fenêtre des rappels avec une anti-jointure idempotente", () => {
    const query = buildDueRemindersQuery("2026-08-20 10:00", "2026-08-20 12:00", 25);

    expect(query.params).toEqual(["2026-08-20 10:00", "2026-08-20 12:00", 25]);
    expect(query.sql).toContain("b.status = 'confirmed'");
    expect(query.sql).toContain("(b.date || ' ' || b.start_time) > ?");
    expect(query.sql).toContain("(b.date || ' ' || b.start_time) <= ?");
    expect(query.sql).toContain("LEFT JOIN push_reminders_sent prs");
    expect(query.sql).toContain("prs.booking_id = b.id");
    expect(query.sql).toContain("prs.target_key = (b.date || ' ' || b.start_time)");
    expect(query.sql).toContain("prs.booking_id IS NULL");
    expect(query.sql).toContain("b.booking_ref");
    expect(query.sql).toContain("b.studio_id");
    expect(query.sql).toContain("u.name AS user_name");
  });

  it("rend correctement les instants autour des changements d'heure", () => {
    const spring = new Date("2026-03-29T00:30:00Z");
    const fall = new Date("2026-10-25T00:30:00Z");

    expect(getParisNow(spring)).toMatchObject({ dateISO: "2026-03-29", hours: 1, minutes: 30 });
    expect(getParisNow(new Date(spring.getTime() + 2 * 60 * 60 * 1000))).toMatchObject({ hours: 4, minutes: 30 });
    expect(getParisNow(fall)).toMatchObject({ dateISO: "2026-10-25", hours: 2, minutes: 30 });
    expect(getParisNow(new Date(fall.getTime() + 2 * 60 * 60 * 1000))).toMatchObject({ hours: 3, minutes: 30 });
  });

  it("produit des clés de rappel comparables lexicographiquement", () => {
    // Le format doit être identique des deux côtés de la comparaison SQL :
    // 16 caractères, jamais de secondes.
    const bookingKey = bookingReminderKey("2026-08-20", "20:00");
    const nowKey = formatParisReminderKey(new Date("2026-08-20T16:05:00Z")); // 18:05 Paris

    expect(bookingKey).toBe("2026-08-20 20:00");
    expect(nowKey).toBe("2026-08-20 18:05");
    expect(bookingKey).toHaveLength(16);
    expect(nowKey).toHaveLength(16);
    expect(nowKey < bookingKey).toBe(true);

    // Régression : une clé avec secondes casserait l'ordre lexicographique.
    expect("2026-08-20 20:00" < "2026-08-20 20:00:00").toBe(true);
  });

  it("garde 2 h d'écart réel de part et d'autre des changements d'heure", () => {
    // Passage à l'heure d'été : la réservation est à 04:30 murales, le rappel
    // 2 h avant doit tomber à 01:30 murales (et non 02:30, heure qui n'existe pas).
    const springStart = new Date("2026-03-29T02:30:00Z"); // 04:30 CEST
    const springReminder = new Date(springStart.getTime() - 2 * 3600 * 1000);
    expect(formatParisReminderKey(springStart)).toBe("2026-03-29 04:30");
    expect(formatParisReminderKey(springReminder)).toBe("2026-03-29 01:30");

    // Retour à l'heure d'hiver : 03:30 murales, rappel 2 h avant à 02:30 murales
    // — l'heure 02:30 existe deux fois ce jour-là, la conversion depuis
    // l'instant absolu reste non ambiguë.
    const fallStart = new Date("2026-10-25T02:30:00Z"); // 03:30 CET
    const fallReminder = new Date(fallStart.getTime() - 2 * 3600 * 1000);
    expect(formatParisReminderKey(fallStart)).toBe("2026-10-25 03:30");
    expect(formatParisReminderKey(fallReminder)).toBe("2026-10-25 02:30");
  });

  it("conserve le fonctionnement sans argument", () => {
    expect(getParisNow()).toMatchObject({
      dateISO: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hours: expect.any(Number),
      minutes: expect.any(Number),
    });
  });

  it("ne distribue qu'une fois lorsque le claim est déjà pris", async () => {
    const rows = [
      { booking_id: "booking-1", date: "2026-08-20", start_time: "20:00" },
      { booking_id: "booking-1", date: "2026-08-20", start_time: "20:00" },
    ];
    const claims = [true, false];
    const dispatched: string[] = [];

    const summary = await dispatchDueReminderRows(
      rows,
      async (bookingId, targetKey) => {
        expect(targetKey).toBe(bookingReminderKey("2026-08-20", "20:00"));
        expect(bookingId).toBe("booking-1");
        return claims.shift()!;
      },
      async (row) => {
        dispatched.push(row.booking_id);
      },
    );

    expect(dispatched).toEqual(["booking-1"]);
    expect(summary).toEqual({ sent: 1, ignored: 1 });
  });

  it("réarme le rappel quand la réservation est déplacée", async () => {
    const rows = [
      { booking_id: "booking-1", date: "2026-08-20", start_time: "20:00" },
      { booking_id: "booking-1", date: "2026-08-20", start_time: "21:00" },
    ];
    const claimedKeys = new Set<string>();
    const dispatched: string[] = [];

    const summary = await dispatchDueReminderRows(
      rows,
      async (bookingId, targetKey) => {
        const claimKey = `${bookingId}:${targetKey}`;
        if (claimedKeys.has(claimKey)) return false;
        claimedKeys.add(claimKey);
        return true;
      },
      async (row) => {
        dispatched.push(row.start_time);
      },
    );

    expect(dispatched).toEqual(["20:00", "21:00"]);
    expect(summary).toEqual({ sent: 2, ignored: 0 });
  });
});
