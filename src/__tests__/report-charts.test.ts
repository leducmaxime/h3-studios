import { describe, expect, it } from "vitest";
import {
  barGeometry,
  formatChartEuro,
  formatWeekLabel,
  pieSliceAngles,
  zeroFillDaily,
} from "@/lib/report-charts";

describe("zeroFillDaily", () => {
  it("comble les jours sans revenu entre deux bornes", () => {
    const rows = [
      { date: "2026-08-01", revenue: 100 },
      { date: "2026-08-03", revenue: 50 },
    ];
    const filled = zeroFillDaily(rows, "2026-08-01", "2026-08-03");
    expect(filled).toEqual([
      { date: "2026-08-01", revenue: 100 },
      { date: "2026-08-02", revenue: 0 },
      { date: "2026-08-03", revenue: 50 },
    ]);
  });

  it("retourne les lignes telles quelles si les bornes sont invalides", () => {
    const rows = [{ date: "2026-08-01", revenue: 1 }];
    expect(zeroFillDaily(rows, "not-a-date", "2026-08-01")).toEqual(rows);
    expect(zeroFillDaily(rows, "2026-08-05", "2026-08-01")).toEqual(rows);
  });
});

describe("pieSliceAngles", () => {
  it("total 0 → aucun slice (pas de NaN)", () => {
    expect(pieSliceAngles([0, 0])).toEqual([]);
    expect(pieSliceAngles([])).toEqual([]);
  });

  it("calcule les angles proportionnels et les pourcentages", () => {
    const slices = pieSliceAngles([100, 300]);
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({ pct: 25 });
    expect(slices[1]).toMatchObject({ pct: 75 });
    expect(slices[0].startAngle).toBeCloseTo(0);
    expect(slices[1].endAngle).toBeCloseTo(Math.PI * 2);
  });
});

describe("barGeometry", () => {
  it("clamp le domaine à 0-100", () => {
    const bars = barGeometry([-5, 50, 150], 300, 100);
    expect(bars).toHaveLength(3);
    expect(bars[0].h).toBe(0);
    expect(bars[1].h).toBe(50);
    expect(bars[2].h).toBe(100);
  });

  it("retourne un tableau vide sans données", () => {
    expect(barGeometry([], 300, 100)).toEqual([]);
  });

  it("espacent les barres sans chevauchement", () => {
    const bars = barGeometry([10, 10], 200, 100, 0.25);
    expect(bars[0].x + bars[0].w).toBeLessThanOrEqual(bars[1].x);
  });
});

describe("formatChartEuro / formatWeekLabel", () => {
  it("formate l'euro à la française", () => {
    expect(formatChartEuro(1234)).toMatch(/€ TTC$/);
    expect(formatChartEuro(0)).toBe("0 € TTC");
  });

  it("libellé semaine français", () => {
    expect(formatWeekLabel("2026-08-17")).toBe("sem. du 17/08");
    expect(formatWeekLabel("pas-une-date")).toBe("pas-une-date");
  });
});
