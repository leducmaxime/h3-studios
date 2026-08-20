/**
 * Export visuel du planning admin (jour / semaine / mois) en image PNG.
 *
 * Aucune capture DOM : la vue est redessinée à partir des données de
 * réservation sur un canvas, ce qui garantit une image lisible sur toutes les
 * vues (mobile comme bureau) sans dépendre de html2canvas (incompatible avec
 * les couleurs oklch de Tailwind v4) ni des limites de `overflow-x-auto`.
 *
 * Le module est sûr côté serveur (SSR) : aucun accès à `document`/`window` au
 * niveau du module. Il est importé dynamiquement depuis le gestionnaire de clic
 * du calendrier.
 */

import { ALL_TIME_SLOTS, STUDIO_HOURS, type GroupType, type StudioId } from "@/lib/booking";
import { groupTypeLabel, studioLabelShort } from "@/lib/labels";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarExportBooking {
  id: string;
  booking_ref: string;
  date: string; // YYYY-MM-DD (date Paris)
  start_time: string; // "HH:MM" (ALL_TIME_SLOTS)
  end_time: string; // "HH:MM" ou "00:00" (minuit)
  studio_id: StudioId | string;
  group_type: GroupType | string;
  status: string; // confirmed | completed | cancelled | no-show
  payment_status: string | null; // paid | pending | pay-on-site | null
  band_name?: string | null;
  user_name?: string;
  user_band_name?: string;
}

export interface CalendarExportBlockedSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  studio_id: StudioId | null; // null = les deux studios
  reason: string;
}

export type CalendarExportView = "day" | "week" | "month";

export interface CalendarExportOptions {
  view: CalendarExportView;
  currentDate: Date; // date d'ancrage (jour / mois)
  weekDates: Date[]; // 7 dates pour la vue semaine
  bookings: CalendarExportBooking[];
  blockedSlots: CalendarExportBlockedSlot[];
}

// ─── Constantes de dessin ───────────────────────────────────────────────────

const PITCH = 44; // px par créneau de 30 min (plus lisible qu'à l'écran, 30px)
const TIME_GUTTER = 90;
const MAX_AREA_PX = 12_000_000; // budget iOS Safari (~16.7M max)
const MAX_MONTH_LINES = 4;
const MIN_BLOCK_H = 24;

const COLORS = {
  bg: "#18181b",
  panel: "#27272a",
  border: "#3f3f46",
  borderSoft: "#2d2d31",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#71717a",
  primary: "#ffde59",
  laScene: "#60a5fa",
  lePodium: "#a78bfa",
  paid: "#4ade80",
  unpaid: "#fbbf24",
  absent: "#f87171",
  consult: "#34d399",
  today: "#ffde59",
};

// ─── Helpers purs (testables hors navigateur) ───────────────────────────────

export interface SlotRange {
  startIdx: number;
  endIdx: number;
}

/** Bornes d'un créneau dans ALL_TIME_SLOTS ("00:00" = fin de journée). */
export function computeSlotRange(startTime: string, endTime: string): SlotRange {
  const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
  let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
  if (endIdx === -1) endIdx = ALL_TIME_SLOTS.length; // "00:00" minuit
  return { startIdx, endIdx };
}

export interface BookingRect {
  top: number;
  height: number;
}

/** Position verticale d'un bloc, alignée sur la grille horaire (départ 09:00). */
export function layoutBookingBlock(range: SlotRange, pitch: number = PITCH): BookingRect {
  const startBaseline = ALL_TIME_SLOTS.indexOf("09:00");
  const top = (range.startIdx - startBaseline) * pitch;
  const height = Math.max((range.endIdx - range.startIdx) * pitch, MIN_BLOCK_H);
  return { top, height };
}

/**
 * Tronque un texte avec une ellipse, en respectant la largeur disponible.
 * `measurer` est l'interface minimale de `CanvasRenderingContext2D` (testable en node).
 */
export function truncateText(
  measurer: { measureText(s: string): { width: number } },
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return "";
  if (measurer.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measurer.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low <= 0 ? ellipsis : text.slice(0, low) + ellipsis;
}

export interface MonthCellLine {
  time: string;
  studio: string; // studio court (Scène / Podium)
  name: string;
}

export interface MonthCellContent {
  lines: MonthCellLine[];
  overflow: number; // nombre de réservations non affichées
}

/** Lignes « HH:MM · Studio · Nom » d'une journée, triées par heure, plafonnées. */
export function buildMonthCellLines(
  bookingsInDay: CalendarExportBooking[],
  maxLines: number = MAX_MONTH_LINES,
): MonthCellContent {
  const sorted = [...bookingsInDay].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const shown = sorted.slice(0, maxLines);
  return {
    lines: shown.map((b) => ({
      time: b.start_time,
      studio: studioLabelShort(b.studio_id),
      name: b.band_name || b.user_band_name || b.user_name || b.booking_ref.slice(-4),
    })),
    overflow: Math.max(0, sorted.length - maxLines),
  };
}

/**
 * Taux d'occupation réel (créneaux réservés / créneaux ouverts) pour une
 * journée, en miroir de `computeDayOccupancyRate` de Calendar.tsx.
 */
export function computeDayOccupancyRatePure(bookingsInDay: CalendarExportBooking[], date: Date): number {
  const dow = date.getDay();
  const studios: StudioId[] = ["la-scene", "le-podium"];
  let totalOpen = 0;
  let totalBooked = 0;

  for (const studioId of studios) {
    const hours = STUDIO_HOURS[studioId]?.[dow];
    if (!hours) continue;
    const openIdx = ALL_TIME_SLOTS.indexOf(hours.open);
    const closeIdx = hours.close === "00:00" ? ALL_TIME_SLOTS.length : ALL_TIME_SLOTS.indexOf(hours.close);
    if (openIdx === -1) continue;
    const safeClose = closeIdx === -1 ? ALL_TIME_SLOTS.length : closeIdx;
    const openSlots = Math.max(0, safeClose - openIdx);
    totalOpen += openSlots;

    for (const b of bookingsInDay) {
      if (b.studio_id !== studioId) continue;
      const { startIdx, endIdx } = computeSlotRange(b.start_time, b.end_time);
      if (startIdx === -1 || endIdx <= startIdx) continue;
      totalBooked += endIdx - startIdx;
    }
  }

  if (totalOpen === 0) return 0;
  return Math.min(totalBooked / totalOpen, 1);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Nom du fichier généré, ex. `h3-planning-week-2026-08-17.png`. */
export function buildExportFilename(view: CalendarExportView, currentDate: Date): string {
  return `h3-planning-${view}-${toDateStr(currentDate)}.png`;
}

/** Titre français de la barre d'en-tête de l'image. */
export function buildExportTitle(opts: CalendarExportOptions): string {
  const { view, currentDate, weekDates } = opts;
  if (view === "day") {
    return `Planning — ${currentDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
  }
  if (view === "week" && weekDates.length === 7) {
    const from = weekDates[0].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const to = weekDates[6].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return `Planning — Semaine du ${from} au ${to}`;
  }
  return `Planning — ${currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
}

/** Couleurs de bloc, en miroir de `getPaymentStatusColor` / consultations de Calendar.tsx. */
export function bookingBlockColor(booking: CalendarExportBooking): { bg: string; border: string; text: string } {
  const isConsultation = booking.group_type === "solo" || booking.group_type === "duo";
  if (booking.status === "no-show") {
    return { bg: "rgba(248,113,113,0.22)", border: COLORS.absent, text: COLORS.absent };
  }
  if (isConsultation) {
    return { bg: "rgba(52,211,153,0.18)", border: COLORS.consult, text: "#d1fae5" };
  }
  if (booking.payment_status === "paid") {
    return { bg: "rgba(74,222,128,0.18)", border: COLORS.paid, text: "#d1fae5" };
  }
  return { bg: "rgba(251,191,36,0.18)", border: COLORS.unpaid, text: "#fef3c7" };
}

function studioColor(studioId: string): string {
  return studioId === "la-scene" ? COLORS.laScene : COLORS.lePodium;
}

// ─── Géométrie (mesures, calculables sans canvas) ───────────────────────────

export interface GridSize {
  width: number;
  height: number;
}

/** Largeur d'une colonne de jour (scindée en 2 studios au rendu). */
export function dayColumnWidth(view: CalendarExportView): number {
  return view === "day" ? 280 : 200;
}

/**
 * Largeur totale de la grille jour/semaine.
 * Source unique : la mesure du canvas et le rendu doivent utiliser la même
 * valeur, sinon les colonnes dépassent le canvas et sont silencieusement
 * tronquées (la vue semaine compte 7 colonnes, pas 2).
 */
export function dayGridWidth(opts: CalendarExportOptions): number {
  const cols = opts.view === "day" ? 1 : Math.min(opts.weekDates.length, 7);
  return TIME_GUTTER + cols * dayColumnWidth(opts.view);
}

function measureDayGrid(opts: CalendarExportOptions): GridSize {
  const totalSlots = ALL_TIME_SLOTS.length - ALL_TIME_SLOTS.indexOf("09:00");
  const gridHeight = totalSlots * PITCH;
  const headerH = 44;
  const legendH = 40;
  const titleH = 56;
  return {
    width: dayGridWidth(opts),
    height: titleH + headerH + gridHeight + legendH,
  };
}

function measureMonthGrid(opts: CalendarExportOptions): GridSize {
  const cellW = 170;
  const cellBaseH = 34;
  const lineH = 15;
  const firstDay = new Date(opts.currentDate.getFullYear(), opts.currentDate.getMonth(), 1);
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  let totalH = 0;
  for (let w = 0; w < 6; w++) {
    let rowH = cellBaseH + 10;
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + w * 7 + i);
      if (d.getMonth() !== opts.currentDate.getMonth()) continue;
      const dateStr = toDateStr(d);
      const dayBookings = opts.bookings.filter((b) => b.date === dateStr && b.status !== "cancelled");
      const fullyBlocked = opts.blockedSlots.some(
        (s) => s.date === dateStr && s.studio_id === null && s.start_time === "09:00" && s.end_time === "00:00",
      );
      const n = fullyBlocked ? 1 : Math.min(dayBookings.length, MAX_MONTH_LINES);
      const cellH = cellBaseH + n * lineH + (dayBookings.length > MAX_MONTH_LINES ? lineH : 0) + 10;
      if (cellH > rowH) rowH = cellH;
    }
    totalH += rowH;
  }

  return {
    width: cellW * 7,
    height: 56 + 30 + totalH + 40,
  };
}

// ─── Rendu canvas ───────────────────────────────────────────────────────────

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Crée le canvas à la taille logique voulue, échelle DPR sous budget iOS. */
function createCanvas(width: number, height: number): HTMLCanvasElement {
  const scale = computeScale(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de créer le canvas");
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/** Sécurité iOS : recalcule l'échelle pour rester sous le budget de pixels. */
export function computeScale(w: number, h: number): number {
  const maxScale = 2;
  const areaScale = Math.sqrt(MAX_AREA_PX / (w * h));
  return Math.max(1, Math.min(maxScale, areaScale));
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number | string = 400): void {
  ctx.font = `${weight} ${size}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, width: number): void {
  setFont(ctx, 20, 700);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(title, 16, 30);
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(16, 44);
  ctx.lineTo(width - 16, 44);
  ctx.stroke();
}

function drawLegend(ctx: CanvasRenderingContext2D, y: number): void {
  const items: Array<{ color: string; label: string; hatched?: boolean }> = [
    { color: COLORS.paid, label: "Payé" },
    { color: COLORS.unpaid, label: "Reste à payer" },
    { color: COLORS.absent, label: "Absent" },
    { color: COLORS.consult, label: "Consultation" },
    { color: "#71717a", label: "Bloqué", hatched: true },
  ];
  setFont(ctx, 12, 500);
  let x = 16;
  for (const item of items) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, 12, 12);
    if (item.hatched) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      for (let i = -2; i < 14; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + 14);
        ctx.lineTo(x + i + 12, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = item.color;
      ctx.fillRect(x + 2, y + 2, 8, 8);
    }
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(item.label, x + 18, y + 11);
    x += ctx.measureText(item.label).width + 18 + 24;
  }
}

function drawBookingBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  booking: CalendarExportBooking,
): void {
  const colors = bookingBlockColor(booking);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);

  const padX = 6;
  const textW = w - padX * 2;
  if (h < 26) return;
  const line1 = `${booking.start_time} · ${groupTypeLabel(booking.group_type)}`;
  setFont(ctx, 12, 700);
  ctx.fillStyle = colors.text;
  ctx.fillText(truncateText(ctx, line1, textW), x + padX, y + 15);
  if (h < 40) return;
  const name = booking.band_name || booking.user_band_name || booking.user_name || booking.booking_ref.slice(-4);
  setFont(ctx, 12, 400);
  ctx.fillStyle = colors.text;
  ctx.fillText(truncateText(ctx, name, textW), x + padX, y + 30);
}

function drawBlockedSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  reason: string,
): void {
  ctx.fillStyle = "rgba(113,113,122,0.16)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.dim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = "rgba(161,161,170,0.4)";
  ctx.lineWidth = 1.5;
  for (let i = -h; i < w + h; i += 7) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.restore();
  if (h < 28) return;
  setFont(ctx, 12, 700);
  ctx.fillStyle = COLORS.text;
  const label = `Bloqué · ${reason || ""}`.trim();
  ctx.fillText(truncateText(ctx, label, w - 12), x + 6, y + 15);
}

function bookingsFor(dateStr: string, studioId: string, list: CalendarExportBooking[]): CalendarExportBooking[] {
  return list.filter(
    (b) => b.date === dateStr && b.studio_id === studioId && b.status !== "cancelled" && b.group_type === "group",
  );
}

function consultationsFor(dateStr: string, list: CalendarExportBooking[]): CalendarExportBooking[] {
  return list.filter(
    (b) => b.date === dateStr && (b.group_type === "solo" || b.group_type === "duo") && b.status !== "cancelled",
  );
}

function blockedFor(dateStr: string, studioId: string, list: CalendarExportBlockedSlot[]): CalendarExportBlockedSlot[] {
  return list.filter((s) => s.date === dateStr && (s.studio_id === null || s.studio_id === studioId));
}

function renderDayGrid(ctx: CanvasRenderingContext2D, opts: CalendarExportOptions): void {
  const { bookings, blockedSlots } = opts;
  const studioCols: StudioId[] = ["la-scene", "le-podium"];
  const studioW = dayColumnWidth(opts.view);
  const totalSlots = ALL_TIME_SLOTS.length - ALL_TIME_SLOTS.indexOf("09:00");
  const gridHeight = totalSlots * PITCH;
  const titleH = 56;
  const headerH = 44;
  const gridTop = titleH + headerH;
  const width = dayGridWidth(opts);

  drawTitle(ctx, buildExportTitle(opts), width);

  const dates = opts.view === "day" ? [opts.currentDate] : opts.weekDates.slice(0, 7);
  const today = new Date();

  // En-têtes de colonnes (jours × studios)
  let colX = TIME_GUTTER;
  for (const date of dates) {
    const dayHeader = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    ctx.fillStyle = COLORS.muted;
    setFont(ctx, 12, 600);
    ctx.fillText(dayHeader, colX + 6, titleH + 16);
    if (isSameDay(date, today)) {
      ctx.fillStyle = COLORS.today;
      setFont(ctx, 11, 700);
      ctx.fillText("Aujourd'hui", colX + 6, titleH + 30);
    }
    for (const studioId of studioCols) {
      const x = colX + (studioId === "la-scene" ? 0 : studioW / 2);
      ctx.fillStyle = studioColor(studioId);
      ctx.fillRect(x + 4, titleH + 34, studioW / 2 - 8, 3);
      setFont(ctx, 12, 700);
      ctx.fillStyle = studioColor(studioId);
      ctx.fillText(studioLabelShort(studioId), x + 8, titleH + 28);
    }
    colX += studioW;
  }

  // Lignes horaires + labels
  ctx.strokeStyle = COLORS.borderSoft;
  ctx.lineWidth = 1;
  for (let i = 0; i <= totalSlots; i++) {
    const y = gridTop + i * PITCH;
    ctx.beginPath();
    ctx.moveTo(TIME_GUTTER, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
    if (i < totalSlots && i % 2 === 0) {
      const hourLabel = ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf("09:00") + i];
      setFont(ctx, 12, 400);
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(hourLabel, TIME_GUTTER - 12 - ctx.measureText(hourLabel).width, y + PITCH - 8);
    }
  }

  // Séparateurs verticaux entre jours
  for (let i = 1; i < dates.length; i++) {
    const x = TIME_GUTTER + i * studioW;
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, gridTop);
    ctx.lineTo(x + 0.5, gridTop + gridHeight);
    ctx.stroke();
  }

  // Blocs
  colX = TIME_GUTTER;
  for (const date of dates) {
    const dateStr = toDateStr(date);
    for (const studioId of studioCols) {
      const colW = studioW / 2;
      const x = colX + (studioId === "la-scene" ? 0 : colW);
      for (const slot of blockedFor(dateStr, studioId, blockedSlots)) {
        const { startIdx, endIdx } = computeSlotRange(slot.start_time, slot.end_time);
        if (startIdx === -1) continue;
        const { top, height } = layoutBookingBlock({ startIdx, endIdx });
        drawBlockedSlot(ctx, x + 4, gridTop + top, colW - 8, height, slot.reason);
      }
      for (const b of bookingsFor(dateStr, studioId, bookings)) {
        const { startIdx, endIdx } = computeSlotRange(b.start_time, b.end_time);
        if (startIdx === -1) continue;
        const { top, height } = layoutBookingBlock({ startIdx, endIdx });
        drawBookingBlock(ctx, x + 4, gridTop + top, colW - 8, height, b);
      }
      for (const b of consultationsFor(dateStr, bookings)) {
        if (b.studio_id !== studioId) continue;
        const { startIdx, endIdx } = computeSlotRange(b.start_time, b.end_time);
        if (startIdx === -1) continue;
        const { top, height } = layoutBookingBlock({ startIdx, endIdx });
        drawBookingBlock(ctx, x + 4, gridTop + top, colW - 8, height, b);
      }
    }
    colX += studioW;
  }

  drawLegend(ctx, gridTop + gridHeight + 12);
}

function renderMonthGrid(ctx: CanvasRenderingContext2D, opts: CalendarExportOptions): void {
  const { bookings, blockedSlots, currentDate } = opts;
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const cellW = 170;
  const titleH = 56;
  const dayNamesH = 30;
  const cellBaseH = 34;
  const lineH = 15;
  const today = new Date();

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  drawTitle(ctx, buildExportTitle(opts), cellW * 7);

  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = COLORS.muted;
    setFont(ctx, 12, 600);
    ctx.fillText(dayNames[i], i * cellW + 8, titleH + dayNamesH - 10);
  }

  let y = titleH + dayNamesH;
  for (let w = 0; w < 6; w++) {
    // Hauteur de la ligne = max des cellules du mois courant
    let rowH = cellBaseH + 10;
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + w * 7 + i);
      if (d.getMonth() !== currentDate.getMonth()) continue;
      const dateStr = toDateStr(d);
      const dayBookings = bookings.filter((b) => b.date === dateStr && b.status !== "cancelled");
      const fullyBlocked = blockedSlots.some(
        (s) => s.date === dateStr && s.studio_id === null && s.start_time === "09:00" && s.end_time === "00:00",
      );
      const n = fullyBlocked ? 1 : Math.min(dayBookings.length, MAX_MONTH_LINES);
      const cellH = cellBaseH + n * lineH + (dayBookings.length > MAX_MONTH_LINES ? lineH : 0) + 10;
      if (cellH > rowH) rowH = cellH;
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + i);
      const dateStr = toDateStr(date);
      const inMonth = date.getMonth() === currentDate.getMonth();
      const x = i * cellW;

      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, rowH - 1);

      if (!inMonth) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x + 1, y + 1, cellW - 2, rowH - 2);
        continue;
      }

      const dayBookings = bookings.filter((b) => b.date === dateStr && b.status !== "cancelled");
      const dayBlocked = blockedSlots.filter((s) => s.date === dateStr);
      const fullyBlocked = dayBlocked.some(
        (s) => s.studio_id === null && s.start_time === "09:00" && s.end_time === "00:00",
      );
      const occupancy = computeDayOccupancyRatePure(dayBookings, date);

      const tint =
        occupancy === 0
          ? "rgba(39,39,42,0.5)"
          : occupancy < 0.5
            ? "rgba(74,222,128,0.10)"
            : occupancy <= 0.8
              ? "rgba(251,191,36,0.10)"
              : "rgba(248,113,113,0.12)";
      ctx.fillStyle = tint;
      ctx.fillRect(x + 1, y + 1, cellW - 2, rowH - 2);

      ctx.fillStyle = isSameDay(date, today) ? COLORS.today : COLORS.text;
      setFont(ctx, 12, isSameDay(date, today) ? 700 : 500);
      ctx.fillText(String(date.getDate()), x + 8, y + 18);

      if (fullyBlocked) {
        ctx.fillStyle = COLORS.muted;
        setFont(ctx, 12, 500);
        ctx.fillText("Fermé", x + 8, y + 36);
      } else if (dayBookings.length > 0) {
        const { lines, overflow } = buildMonthCellLines(dayBookings);
        let ly = y + 34;
        for (const line of lines) {
          const studioCol = studioColor(line.studio === "Scène" ? "la-scene" : "le-podium");
          const text = `${line.time}  ${line.name}`;
          setFont(ctx, 11, 600);
          const timeW = ctx.measureText(line.time).width;
          ctx.fillStyle = studioCol;
          ctx.fillText(line.time, x + 8, ly);
          ctx.fillStyle = COLORS.text;
          setFont(ctx, 11, 400);
          ctx.fillText(truncateText(ctx, line.name, cellW - 18 - timeW - 4), x + 8 + timeW + 4, ly);
          ly += lineH;
        }
        if (overflow > 0) {
          ctx.fillStyle = COLORS.dim;
          setFont(ctx, 11, 500);
          ctx.fillText(`+${overflow} autre${overflow > 1 ? "s" : ""}`, x + 8, ly);
        }
      } else if (dayBlocked.length > 0) {
        ctx.fillStyle = COLORS.dim;
        setFont(ctx, 11, 500);
        ctx.fillText(`Bloqué (${dayBlocked.length})`, x + 8, y + 36);
      }
    }
    y += rowH;
  }

  drawLegend(ctx, y + 12);
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Dessine la vue courante du planning et déclenche le téléchargement du PNG.
 * Résout le nom du fichier généré. Jette une Error (message français) en cas
 * d'échec (canvas indisponible, blob nul…).
 */
export async function exportCalendarAsPng(opts: CalendarExportOptions): Promise<string> {
  let canvas: HTMLCanvasElement;
  try {
    const size = opts.view === "month" ? measureMonthGrid(opts) : measureDayGrid(opts);
    canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de créer le canvas");

    if (opts.view === "month") {
      renderMonthGrid(ctx, opts);
    } else {
      renderDayGrid(ctx, opts);
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      throw new Error("Export impossible sur cet appareil");
    }

    const filename = buildExportFilename(opts.view, opts.currentDate);
    downloadBlob(filename, blob);
    return filename;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Échec de l'export du planning");
  }
}
