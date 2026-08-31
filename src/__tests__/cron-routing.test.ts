import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCronJob, resolveReminderLeadHours } from "@/lib/cron";

function readWranglerConfig(): {
  env?: Record<string, { triggers?: { crons?: string[] } }>;
} {
  const source = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  return JSON.parse(withoutComments) as {
    env?: Record<string, { triggers?: { crons?: string[] } }>;
  };
}

describe("routage des cron jobs", () => {
  it("reconnaît les expressions connues et refuse les autres", () => {
    expect(resolveCronJob("0 6 * * *")).toBe("daily");
    expect(resolveCronJob("*/5 * * * *")).toBe("reminders");
    expect(resolveCronJob("0 7 * * *")).toBeNull();
    expect(resolveCronJob("")).toBeNull();
    expect(resolveCronJob(undefined)).toBeNull();
  });

  it("normalise les espaces de l'expression", () => {
    expect(resolveCronJob(" 0  6 * * * ")).toBe("daily");
  });

  it("branche chaque cron configuré dans staging et production", () => {
    const config = readWranglerConfig();
    for (const environment of ["staging", "production"]) {
      const crons = config.env?.[environment]?.triggers?.crons ?? [];
      expect(crons.length, `${environment} doit avoir au moins un cron`).toBeGreaterThan(0);
      for (const cron of crons) {
        expect(resolveCronJob(cron), `${environment}: ${cron}`).not.toBeNull();
      }
    }
  });
});

describe("délai des rappels", () => {
  it("utilise 2 heures par défaut et borne le réglage", () => {
    expect(resolveReminderLeadHours(undefined)).toBe(2);
    expect(resolveReminderLeadHours(null)).toBe(2);
    expect(resolveReminderLeadHours("garbage")).toBe(2);
    expect(resolveReminderLeadHours("4")).toBe(4);
    expect(resolveReminderLeadHours("0")).toBe(1);
    expect(resolveReminderLeadHours("25")).toBe(24);
  });
});
