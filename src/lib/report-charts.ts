/**
 * Graphiques du rapport mensuel PDF — dessinés en canvas, embarqués en JPEG.
 *
 * Les graphiques recharts affichés à l'écran (CA réservé, Occupation par
 * semaine, Répartition par studio, Méthodes de paiement) sont reproduits ici
 * à partir des données, sans capture DOM (pas de html2canvas : incompatible
 * avec les couleurs oklch de Tailwind v4, inutilement lourd, et capture SVG
 * recharts peu fiable).
 *
 * Module sûr côté serveur (SSR) : aucun accès à `document` au niveau du module.
 * Il est importé dynamiquement depuis `generateMonthlyReportPDF` (côté client).
 */

import { paymentMethodLabel, studioLabel } from "@/lib/labels";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
}

export interface OccupancyPoint {
  day: string; // YYYY-MM-DD (lundi de la semaine)
  occupancyPct: number;
}

export interface StudioPoint {
  studio_id: string;
  count: number;
  revenue: number;
}

export interface PaymentPoint {
  method: string;
  count: number;
  revenue: number;
}

export interface ReportChartsInput {
  revenue: RevenuePoint[];
  occupancy: OccupancyPoint[];
  studios: StudioPoint[];
  paymentMethods: PaymentPoint[];
}

export interface ReportChartsPngs {
  revenue: string; // data URL JPEG
  occupancy: string;
  studios: string;
  paymentMethods: string;
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

export const PIE_PALETTE = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.blue, CHART_COLORS.green];

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
  return values.map((value, i) => {
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

/** Format monétaire français compact, ex. « 1 234 € ». */
export function formatChartEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
}

/** Libellé d'axe semaine : « sem. du 11/08 » depuis un lundi ISO. */
export function formatWeekLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match.map(Number);
  return `sem. du ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
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

function drawTitle(ctx: CanvasRenderingContext2D, title: string): void {
  setFont(ctx, 14, 700);
  ctx.fillStyle = "#e4e4e7";
  ctx.fillText(title, MARGIN.left, MARGIN.top - 12);
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
  drawTitle(ctx, "CA réservé");
  if (input.length === 0) {
    drawEmptyState(ctx);
    return;
  }

  const sorted = [...input].sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...sorted.map((p) => p.revenue), 1);
  const yMax = niceAxisMax(max);
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = H - MARGIN.top - MARGIN.bottom;
  // Un seul point : i/(n-1) donnerait NaN et le tracé disparaîtrait.
  const xAt = (i: number) => (sorted.length === 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i / (sorted.length - 1)) * plotW);
  const yAt = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH;

  // Grille + axe Y
  ctx.strokeStyle = CHART_COLORS.zinc800;
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = (yMax / ticks) * i;
    const y = yAt(value);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y + 0.5);
    ctx.lineTo(W - MARGIN.right, y + 0.5);
    ctx.stroke();
    setFont(ctx, 11, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.textAlign = "right";
    ctx.fillText(formatChartEuro(value), MARGIN.left - 8, y + 4);
  }

  // Ligne
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

  // Points + labels X
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
      ctx.fillText(p.date.slice(8) + "/" + p.date.slice(5, 7), x, H - MARGIN.bottom + 16);
    }
  });
  ctx.textAlign = "left";
}

function drawBarChart(ctx: CanvasRenderingContext2D, input: OccupancyPoint[]): void {
  drawTitle(ctx, "Occupation par semaine");
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

  bars.forEach((bar, i) => {
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
    ctx.fillText(formatWeekLabel(p.day), x, H - MARGIN.bottom + 16);
  });
  ctx.textAlign = "left";
}

interface DonutItem {
  label: string;
  value: number;
}

function drawDonutChart(ctx: CanvasRenderingContext2D, title: string, items: DonutItem[]): void {
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

  // Trou central : rempli avec la couleur de fond plutôt que `destination-out`
  // (l'alpha serait aplati en noir à la conversion JPEG).
  ctx.fillStyle = CHART_COLORS.zinc900;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  // Légende à droite
  let ly = MARGIN.top + 20;
  items.forEach((item, i) => {
    ctx.fillStyle = PIE_PALETTE[i % PIE_PALETTE.length];
    ctx.fillRect(MARGIN.left + 190, ly, 10, 10);
    const pct = slices[i]?.pct ?? 0;
    setFont(ctx, 12, 500);
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText(item.label, MARGIN.left + 208, ly + 10);
    setFont(ctx, 12, 400);
    ctx.fillStyle = CHART_COLORS.zinc400;
    ctx.fillText(`${item.value} · ${pct}%`, MARGIN.left + 208 + 150, ly + 10);
    ly += 20;
  });
}

// ─── API publique ───────────────────────────────────────────────────────────

/** Dessine les 4 graphiques du rapport et renvoie leurs data URLs JPEG. */
export function renderReportCharts(input: ReportChartsInput): ReportChartsPngs {
  try {
    const revenueCanvas = makeCanvas();
    drawLineChart(revenueCanvas.ctx, input.revenue);

    const occupancyCanvas = makeCanvas();
    drawBarChart(occupancyCanvas.ctx, input.occupancy);

    const studiosCanvas = makeCanvas();
    drawDonutChart(
      studiosCanvas.ctx,
      "Répartition par studio",
      input.studios.map((s) => ({ label: studioLabel(s.studio_id), value: s.count })),
    );

    const paymentsCanvas = makeCanvas();
    drawDonutChart(
      paymentsCanvas.ctx,
      "Méthodes de paiement",
      input.paymentMethods.map((p) => ({ label: paymentMethodLabel(p.method), value: p.count })),
    );

    return {
      revenue: revenueCanvas.canvas.toDataURL("image/jpeg", 0.85),
      occupancy: occupancyCanvas.canvas.toDataURL("image/jpeg", 0.85),
      studios: studiosCanvas.canvas.toDataURL("image/jpeg", 0.85),
      paymentMethods: paymentsCanvas.canvas.toDataURL("image/jpeg", 0.85),
    };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Échec de la génération des graphiques");
  }
}
