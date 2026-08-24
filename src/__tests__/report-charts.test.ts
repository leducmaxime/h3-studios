import { describe, expect, it } from "vitest";
import {
  aggregatePaymentChannels,
  barGeometry,
  durationCumulative,
  formatChartDateLabel,
  formatChartEuro,
  formatDurationHours,
  formatOccupancyLabel,
  formatWeekLabel,
  occupancyChartTitle,
  occupancyGranularityForRange,
  pieSliceAngles,
  shouldGroupRevenueByMonth,
  zeroFillDaily,
  zeroFillMonthly,
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

describe("period-aware chart helpers", () => {
  it("choisit la granularité d'occupation selon le filtre dashboard", () => {
    expect(occupancyGranularityForRange("year")).toBe("month");
    expect(occupancyGranularityForRange("month")).toBe("week");
    expect(occupancyGranularityForRange("week")).toBe("day");
    expect(occupancyGranularityForRange("today")).toBe("day");
    expect(occupancyGranularityForRange("custom")).toBe("day");
  });

  it("titre d'occupation aligné sur le dashboard", () => {
    expect(occupancyChartTitle("month")).toBe("Occupation par mois");
    expect(occupancyChartTitle("week")).toBe("Occupation par semaine");
    expect(occupancyChartTitle("day")).toBe("Occupation par jour");
  });

  it("groupe le CA par mois pour une année ou un custom > 90 jours", () => {
    expect(shouldGroupRevenueByMonth("year", 365)).toBe(true);
    expect(shouldGroupRevenueByMonth("custom", 91)).toBe(true);
    expect(shouldGroupRevenueByMonth("custom", 90)).toBe(false);
    expect(shouldGroupRevenueByMonth("month", 31)).toBe(false);
  });

  it("formate les labels d'axe jour / mois / semaine", () => {
    expect(formatChartDateLabel("2026-08-17")).toBe("17/08");
    expect(formatChartDateLabel("2026-08")).toMatch(/août/i);
    expect(formatOccupancyLabel("2026-08-17", "week")).toBe("sem. du 17/08");
    expect(formatOccupancyLabel("2026-08", "month")).toMatch(/août/i);
  });
});

describe("zeroFillMonthly", () => {
  it("comble les mois sans revenu", () => {
    expect(zeroFillMonthly(
      [{ date: "2026-01", revenue: 10 }, { date: "2026-03", revenue: 30 }],
      "2026-01-01",
      "2026-03-31",
    )).toEqual([
      { date: "2026-01", revenue: 10 },
      { date: "2026-02", revenue: 0 },
      { date: "2026-03", revenue: 30 },
    ]);
  });

  it("retourne les lignes telles quelles si les bornes sont invalides", () => {
    const rows = [{ date: "2026-01", revenue: 1 }];
    expect(zeroFillMonthly(rows, "not-a-date", "2026-03")).toEqual(rows);
    expect(zeroFillMonthly(rows, "2026-04", "2026-01")).toEqual(rows);
  });
});

describe("aggregatePaymentChannels", () => {
  it("agrège carte en ligne vs tout le reste sur place", () => {
    const [online, onsite] = aggregatePaymentChannels([
      { key: "card-online", method: "Carte en ligne", count: 2, revenue: 40 },
      { key: "cash", method: "Espèces", count: 1, revenue: 10 },
      { key: "card-onsite", method: "Carte sur place", count: 3, revenue: 30 },
    ]);
    expect(online).toMatchObject({ method: "En ligne", count: 2, revenue: 40 });
    expect(onsite).toMatchObject({ method: "Sur place", count: 4, revenue: 40 });
  });
});

describe("durationCumulative", () => {
  it("calcule la part cumulée et formate les durées", () => {
    expect(durationCumulative([
      { slots: 2, label: "1h", count: 1 },
      { slots: 3, label: "1h30", count: 3 },
    ])).toEqual([
      { slots: 2, label: "1h", count: 1, cumPct: 25 },
      { slots: 3, label: "1h30", count: 3, cumPct: 100 },
    ]);
    expect(formatDurationHours(135)).toBe("2h15");
    expect(formatDurationHours(120)).toBe("2h");
  });
});
