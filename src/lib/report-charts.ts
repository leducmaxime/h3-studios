/**
 * Graphiques du rapport PDF — dessinés en canvas, embarqués en JPEG.
 *
 * Reproduit les vues du dashboard (CA, occupation, studios, clients,
 * paiements, durées) à partir des données, sans capture DOM.
 *
 * Module sûr côté serveur (SSR) : aucun accès à `document` au niveau du module.
 * Importé dynamiquement depuis le générateur PDF (côté client).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RevenuePoint {
  date: string; // YYYY-MM-DD ou YYYY-MM
  revenue: number;
}

export interface OccupancyPoint {
  day: string;
  occupancyPct: number;
}

export type OccupancyGranularity = "day" | "week" | "month";

export interface NamedCountPoint {
  label: string;
  count: number;
  revenue: number;
}

export interface PaymentReportPoint {
  key: string;
  method: string;
  count: number;
  revenue: number;
}

export interface DurationReportPoint {
  slots: number;
  label: string;
  count: number;
}

export interface ReportChartsInput {
  revenue: RevenuePoint[];
  occupancy: OccupancyPoint[];
  occupancyGranularity: OccupancyGranularity;
  studios: NamedCountPoint[];
  groupTypes: NamedCountPoint[];
  clientTypes: NamedCountPoint[];
  payments: PaymentReportPoint[];
  durations: DurationReportPoint[];
  avgDurationMinutes?: number;
  medianDurationMinutes?: number;
}

export interface ReportChartsPngs {
  revenue: string;
  occupancy: string;
  studiosBookings: string;
  studiosRevenue: string;
  clientsGroup: string;
  clientsType: string;
  paymentMethods: string;
  paymentChannels: string;
  durations: string;
}

// ─── Couleurs (alignées sur CHART_COLORS / PIE_COLORS de Dashboard.tsx) ─────

export const CHART_COLORS = {
  primary: "#ffde59",
  secondary: "#a78bfa",
  green: "#4ade80",
  red: "#f87171",
  blue: "#60a5fa",
  zinc400: "#a1a1aa",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
};

export const PIE_PALETTE = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.red];

const W = 760;
const H = 300;
const MARGIN = { top: 34, right: 20, bottom: 34, left: 60 };

// ─── Helpers purs (testables hors navigateur) ───────────────────────────────

/** Comble les jours sans revenu entre `from` et `to` (bornes incluses). */
export function zeroFillDaily(rows: RevenuePoint[], from: string, to: string): RevenuePoint[] {
  const map = new Map(rows.map((r) => [r.date, r.revenue]));
  const out: RevenuePoint[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || end < cursor) return [...rows];
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, revenue: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Comble les mois sans revenu entre `from` et `to` (YYYY-MM ou YYYY-MM-DD). */
export function zeroFillMonthly(rows: RevenuePoint[], from: string, to: string): RevenuePoint[] {
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth) || toMonth < fromMonth) {
    return [...rows];
  }
  const map = new Map(rows.map((r) => [r.date.slice(0, 7), r.revenue]));
  const out: RevenuePoint[] = [];
  let year = Number(fromMonth.slice(0, 4));
  let month = Number(fromMonth.slice(5, 7));
  const endYear = Number(toMonth.slice(0, 4));
  const endMonth = Number(toMonth.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    out.push({ date: key, revenue: map.get(key) ?? 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export function shouldGroupRevenueByMonth(
  rangeMode: "today" | "week" | "month" | "year" | "custom",
  rangeDays: number,
): boolean {
  return rangeMode === "year" || (rangeMode === "custom" && rangeDays > 90);
}

export function occupancyGranularityForRange(
  rangeMode: "today" | "week" | "month" | "year" | "custom",
): OccupancyGranularity {
  if (rangeMode === "year") return "month";
  if (rangeMode === "month") return "week";
  return "day";
}

export function occupancyChartTitle(granularity: OccupancyGranularity): string {
  if (granularity === "month") return "Occupation par mois";
  if (granularity === "week") return "Occupation par semaine";
  return "Occupation par jour";
}

/** Libellé d'axe : mois (`YYYY-MM`) ou jour (`DD/MM`). */
export function formatChartDateLabel(iso: string): string {
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const year = Number(iso.slice(0, 4));
    const month = Number(iso.slice(5, 7));
    return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).toLocaleDateString("fr-FR", { month: "short" });
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}`;
}

/** Libellé d'axe semaine : « sem. du 11/08 » depuis un lundi ISO. */
export function formatWeekLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, , m, d] = match;
  return `sem. du ${d}/${m}`;
}

export function formatOccupancyLabel(iso: string, granularity: OccupancyGranularity): string {
  if (granularity === "week") return formatWeekLabel(iso);
  return formatChartDateLabel(iso);
}

export interface PieSlice {
  value: number;
  pct: number;
  startAngle: number; // radians
  endAngle: number;
}

/** Angles d'un donut, total 0 → tableau vide (gère le vide sans NaN). */
export function pieSliceAngles(values: number[]): PieSlice[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  let acc = 0;
  return values.map((value) => {
    const startAngle = (acc / total) * Math.PI * 2;
    acc += value;
    const endAngle = (acc / total) * Math.PI * 2;
    return { value, pct: Math.round((value / total) * 100), startAngle, endAngle };
  });
}

/** Géométrie de barres, domaine 0-100, largeurs égales. */
export function barGeometry(
  values: number[],
  plotW: number,
  plotH: number,
  padding = 0.25,
): Array<{ x: number; y: number; w: number; h: number }> {
  if (values.length === 0) return [];
  const slot = plotW / values.length;
  const barW = slot * (1 - padding);
  return values.map((v, i) => {
    const clamped = Math.max(0, Math.min(v, 100));
    const h = (clamped / 100) * plotH;
    return { x: i * slot + (slot - barW) / 2, y: plotH - h, w: barW, h };
  });
}

/** Format monétaire français compact, ex. « 1 234 € TTC ». */
export function formatChartEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " € TTC";
}

export function formatChartEuroShort(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}

export function formatDurationHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder > 0 ? `${hours}h${String(remainder).padStart(2, "0")}` : `${hours}h`;
}

export function aggregatePaymentChannels(payments: PaymentReportPoint[]): PaymentReportPoint[] {
  const online: PaymentReportPoint = { key: "channel-online", method: "En ligne", count: 0, revenue: 0 };
  const onsite: PaymentReportPoint = { key: "channel-onsite", method: "Sur place", count: 0, revenue: 0 };
  for (const payment of payments) {
    const target = payment.key === "card-online" ? online : onsite;
    target.count += payment.count;
    target.revenue += payment.revenue;
  }
  return [online, onsite];
}

export function durationCumulative(
  points: DurationReportPoint[],
): Array<DurationReportPoint & { cumPct: number }> {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  let running = 0;
  return points.map((point) => {
    running += point.count;
    return {
      ...point,
      cumPct: total > 0 ? Math.round((running / total) * 100) : 0,
    };
  });
}

// ─── Rendu canvas ───────────────────────────────────────────────────────────

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de créer le canvas");
  ctx.fillStyle = CHART_COLORS.zinc900;
  ctx.fillRect(0, 0, W, H);
  return { canvas, ctx };
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number | string = 400): void {
  ctx.font = `${weight} ${size}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, x = MARGIN.left): void {
  setFont(ctx, 14, 700);
  ctx.fillStyle = "#e4e4e7";
  ctx.fillText(title, x, MARGIN.top - 12);
}

function drawEmptyState(ctx: CanvasRenderingContext2D): void {
  setFont(ctx, 13, 400);
  ctx.fillStyle = CHART_COLORS.zinc400;
  ctx.textAlign = "center";
  ctx.fillText("Aucune donnée", W / 2, H / 2);
  ctx.textAlign = "left";
}

function niceAxisMax(max: number): number {
  if (max <= 0) return 100;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const v = m * step;
    if (v >= max) return v;
  }
  return max;
}

function drawLineChart(ctx: CanvasRenderingContext2D, input: RevenuePoint[]): void {
  const LINE_MARGIN = { ...MARGIN, left: 92 };
  drawTitle(ctx, "CA réservé", LINE_MARGIN.left);
  if (input.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const sorted = [...input].sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...sorted.map((p) => p.revenue), 1);
  const yMax = niceAxisMax(max);
  const plotW = W - LINE_MARGIN.left - LINE_MARGIN.right;
  const plotH = H - LINE_MARGIN.top - LINE_MARGIN.bottom;
  const xAt = (i: number) => (sorted.length === 1 ? LINE_MARGIN.left + plotW / 2 : LINE_MARGIN.left + (i / (sorted.length - 1)) * plotW);
  const yAt = (v: number) => LINE_MARGIN.top + plotH - (v / yMax) * plotH;

  ctx.strokeStyle = CHART_COLORS.zinc800;
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = (yMax / ticks) * i;
    const y = yAt(value);
    ctx.beginPath();
    ctx.moveTo(LINE_MARGIN.left, y + 0.5);
    ctx.lineTo(W - LINE_MARGIN.right, y + 0.5);
    ctx.stroke();
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "right";
    ctx.fillText(formatChartEuro(value), LINE_MARGIN.left - 8, y + 4);
  }

  ctx.strokeStyle = CHART_COLORS.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.revenue);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const labelEvery = Math.max(1, Math.ceil(sorted.length / 8));
  sorted.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.revenue);
    ctx.fillStyle = CHART_COLORS.primary;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (i % labelEvery === 0) {
      setFont(ctx, 11, 400);
      ctx.fillStyle = CHART_COLORS.zinc400;
      ctx.textAlign = "center";
      ctx.fillText(formatChartDateLabel(p.date), x, H - LINE_MARGIN.bottom + 16);
    }
  });
  ctx.textAlign = "left";
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  input: OccupancyPoint[],
  granularity: OccupancyGranularity,
): void {
  drawTitle(ctx, occupancyChartTitle(granularity));
  if (input.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;
  const bars = barGeometry(input.map((p) => p.occupancyPct), plotW, plotH);

  ctx.strokeStyle = CHART_COLORS.zinc800;
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = MARGIN.top + plotH - (plotH / ticks) * i;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y + 0.5);
    ctx.lineTo(W - MARGIN.right, y + 0.5);
    ctx.stroke();
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round((100 / ticks) * i)}%`, MARGIN.left - 8, y + 4);
  }

  bars.forEach((bar) => {
    ctx.fillStyle = CHART_COLORS.primary;
    ctx.fillRect(MARGIN.left + bar.x, MARGIN.top + bar.y, bar.w, bar.h);
  });

  const labelEvery = Math.max(1, Math.ceil(input.length / 6));
  input.forEach((p, i) => {
    if (i % labelEvery !== 0) return;
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "center";
    const x = MARGIN.left + i * (plotW / input.length) + plotW / input.length / 2;
    ctx.fillText(formatOccupancyLabel(p.day, granularity), x, H - MARGIN.bottom + 16);
  });
  ctx.textAlign = "left";
}

interface DonutItem {
  label: string;
  value: number;
}

function drawDonutChart(
  ctx: CanvasRenderingContext2D,
  title: string,
  items: DonutItem[],
  formatValue: (value: number) => string = String,
): void {
  drawTitle(ctx, title);
  if (items.length === 0 || items.every((i) => i.value <= 0)) {
    drawEmptyState(ctx);
    return;
  }

  const slices = pieSliceAngles(items.map((i) => i.value));
  const cx = MARGIN.left + 110;
  const cy = MARGIN.top + (H - MARGIN.top - MARGIN.bottom) / 2;
  const rOuter = 82;
  const rInner = 54;

  const start = -Math.PI / 2;
  slices.forEach((slice, i) => {
    ctx.fillStyle = PIE_PALETTE[i % PIE_PALETTE.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rOuter, start + slice.startAngle, start + slice.endAngle);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = CHART_COLORS.zinc900;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  let ly = MARGIN.top + 20;
  items.forEach((item, i) => {
    ctx.fillStyle = PIE_PALETTE[i % PIE_PALETTE.length];
    ctx.fillRect(MARGIN.left + 220, ly, 10, 10);
    const pct = slices[i]?.pct ?? 0;
    setFont(ctx, 12, 500);
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText(item.label, MARGIN.left + 238, ly + 10);
    setFont(ctx, 12, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.fillText(`${formatValue(item.value)} · ${pct}%`, MARGIN.left + 238 + 150, ly + 10);
    ly += 20;
  });
}

function drawDurationChart(
  ctx: CanvasRenderingContext2D,
  points: DurationReportPoint[],
  avgDurationMinutes = 0,
  medianDurationMinutes = 0,
): void {
  const titleBits = ["Durée des sessions"];
  if (avgDurationMinutes > 0) titleBits.push(`Moyenne ${formatDurationHours(avgDurationMinutes)}`);
  if (medianDurationMinutes > 0) titleBits.push(`Médiane ${formatDurationHours(medianDurationMinutes)}`);
  drawTitle(ctx, titleBits.join("  ·  "));

  if (points.length === 0 || points.every((point) => point.count <= 0)) {
    drawEmptyState(ctx);
    return;
  }

  const series = durationCumulative(points);
  const DURATION_MARGIN = { ...MARGIN, right: 48 };
  const plotW = W - DURATION_MARGIN.left - DURATION_MARGIN.right;
  const plotH = H - DURATION_MARGIN.top - DURATION_MARGIN.bottom;
  const yMax = niceAxisMax(Math.max(...series.map((point) => point.count), 1));
  const bars = barGeometry(series.map((point) => (point.count / yMax) * 100), plotW, plotH, 0.35);
  const xAtIndex = (i: number) => DURATION_MARGIN.left + i * (plotW / series.length) + plotW / series.length / 2;
  const xAtSlots = (slots: number) => {
    const first = series[0]?.slots ?? 2;
    const last = series[series.length - 1]?.slots ?? 9;
    if (last === first) return DURATION_MARGIN.left + plotW / 2;
    return DURATION_MARGIN.left + ((slots - first) / (last - first)) * plotW;
  };
  const yAtCount = (count: number) => DURATION_MARGIN.top + plotH - (count / yMax) * plotH;
  const yAtPct = (pct: number) => DURATION_MARGIN.top + plotH - (pct / 100) * plotH;

  ctx.strokeStyle = CHART_COLORS.zinc800;
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = (yMax / ticks) * i;
    const y = yAtCount(value);
    ctx.beginPath();
    ctx.moveTo(DURATION_MARGIN.left, y + 0.5);
    ctx.lineTo(W - DURATION_MARGIN.right, y + 0.5);
    ctx.stroke();
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(value)), DURATION_MARGIN.left - 8, y + 4);
    ctx.textAlign = "left";
    ctx.fillText(`${Math.round((100 / ticks) * i)}%`, W - DURATION_MARGIN.right + 6, y + 4);
  }

  bars.forEach((bar) => {
    ctx.fillStyle = CHART_COLORS.primary;
    ctx.fillRect(DURATION_MARGIN.left + bar.x, DURATION_MARGIN.top + bar.y, bar.w, bar.h);
  });

  ctx.strokeStyle = CHART_COLORS.secondary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((point, i) => {
    const x = xAtIndex(i);
    const y = yAtPct(point.cumPct);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  series.forEach((point, i) => {
    ctx.fillStyle = CHART_COLORS.secondary;
    ctx.beginPath();
    ctx.arc(xAtIndex(i), yAtPct(point.cumPct), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const drawRef = (slots: number, color: string, dash: number[]) => {
    const x = xAtSlots(slots);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x, DURATION_MARGIN.top);
    ctx.lineTo(x, DURATION_MARGIN.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (avgDurationMinutes > 0) drawRef(avgDurationMinutes / 30, CHART_COLORS.blue, [6, 4]);
  if (medianDurationMinutes > 0) drawRef(medianDurationMinutes / 30, CHART_COLORS.green, [2, 3]);

  series.forEach((point, i) => {
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "center";
    ctx.fillText(point.label, xAtIndex(i), H - DURATION_MARGIN.bottom + 16);
  });
  ctx.textAlign = "left";
}

function toJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ─── API publique ───────────────────────────────────────────────────────────

/** Dessine toutes les vues du dashboard et renvoie leurs data URLs JPEG. */
export function renderReportCharts(input: ReportChartsInput): ReportChartsPngs {
  try {
    const revenueCanvas = makeCanvas();
    drawLineChart(revenueCanvas.ctx, input.revenue);

    const occupancyCanvas = makeCanvas();
    drawBarChart(occupancyCanvas.ctx, input.occupancy, input.occupancyGranularity);

    const studiosBookingsCanvas = makeCanvas();
    drawDonutChart(
      studiosBookingsCanvas.ctx,
      "Répartition par studio — Réservations",
      input.studios.map((s) => ({ label: s.label, value: s.count })),
    );

    const studiosRevenueCanvas = makeCanvas();
    drawDonutChart(
      studiosRevenueCanvas.ctx,
      "Répartition par studio — CA",
      input.studios.map((s) => ({ label: s.label, value: s.revenue })),
      formatChartEuroShort,
    );

    const clientsGroupCanvas = makeCanvas();
    drawDonutChart(
      clientsGroupCanvas.ctx,
      "Répartition par type de client — Nombre",
      input.groupTypes.map((g) => ({ label: g.label, value: g.count })),
    );

    const clientsTypeCanvas = makeCanvas();
    drawDonutChart(
      clientsTypeCanvas.ctx,
      "Répartition par type de client — Type",
      input.clientTypes.map((c) => ({ label: c.label, value: c.count })),
    );

    const paymentsCanvas = makeCanvas();
    drawDonutChart(
      paymentsCanvas.ctx,
      "Méthodes de paiement — Tous",
      input.payments.map((p) => ({ label: p.method, value: p.count })),
    );

    const channelsCanvas = makeCanvas();
    drawDonutChart(
      channelsCanvas.ctx,
      "Méthodes de paiement — En ligne / Sur place",
      aggregatePaymentChannels(input.payments).map((p) => ({ label: p.method, value: p.count })),
    );

    const durationsCanvas = makeCanvas();
    drawDurationChart(
      durationsCanvas.ctx,
      input.durations,
      input.avgDurationMinutes,
      input.medianDurationMinutes,
    );

    return {
      revenue: toJpeg(revenueCanvas.canvas),
      occupancy: toJpeg(occupancyCanvas.canvas),
      studiosBookings: toJpeg(studiosBookingsCanvas.canvas),
      studiosRevenue: toJpeg(studiosRevenueCanvas.canvas),
      clientsGroup: toJpeg(clientsGroupCanvas.canvas),
      clientsType: toJpeg(clientsTypeCanvas.canvas),
      paymentMethods: toJpeg(paymentsCanvas.canvas),
      paymentChannels: toJpeg(channelsCanvas.canvas),
      durations: toJpeg(durationsCanvas.canvas),
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Échec de la génération des graphiques");
  }
}
