import { type DbBooking, type DbUser, type DbPayment } from "./db-types";
import { formatPrice, resolveEquipmentDisplay, bookingEndMinutes, clockMinutes } from "./booking";
import { getBookingAmountDue } from "./booking-totals";
import { formatDateISO } from "./utils";
import { formatSiret, resolveBookingClientIdentity, resolveUserClientIdentity } from "./client-identity";
import { storedPaymentStatusLabel, bookingStatusLabel, groupTypeLabel, paymentMethodLabel, paymentRecordStatusLabel, paymentTypeLabel, studioLabel } from "@/lib/labels";
import { roundCents, splitTtc } from "@/lib/tax";
import type { ReportChartsPngs } from "@/lib/report-charts";
import { COMPANY, companyRcs } from "@/lib/company";
// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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

function formatDateForCSV(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Arrondi au centime avant formatage, pour que toutes les colonnes de montants
 *  se réconcilient (Montant total − Remise = Montant dû), y compris celles qui
 *  ne passent pas par `splitTtc`. */
function formatPriceForCSV(amount: number): string {
  return Number.isFinite(amount) ? roundCents(amount).toFixed(2) : "0.00";
}

// ─── Bookings Export ─────────────────────────────────────────────────────────

interface BookingWithUser extends DbBooking {}

export function buildBookingsCSV(bookings: BookingWithUser[]): string {
  const headers = [
    "Référence",
    "Client",
    "Type de client",
    "Raison sociale",
    "SIRET",
    "RNA",
    "Instagram",
    "Email",
    "Studio",
    "Date",
    "Heure début",
    "Heure fin",
    "Durée (h)",
    "Nom du groupe",
    "Type de groupe",
    "Statut",
    "Options",
    "Montant options TTC (EUR)",
    "Montant total TTC (EUR)",
    "Montant dû TTC (EUR)",
    "Montant dû HT (EUR)",
    "TVA 20% (EUR)",
    "Remise TTC (EUR)",
    "Paiement",
  ];

  const rows = bookings.map((booking) => {
    const clientIdentity = resolveBookingClientIdentity(booking, undefined);
    const studioName = studioLabel(booking.studio_id);
    
    const durationHours = ((bookingEndMinutes(booking.start_time, booking.end_time) - clockMinutes(booking.start_time)) / 60).toFixed(1);
    const equipmentDisplay = resolveEquipmentDisplay(booking.equipment, booking.equipment_price);
    const options = equipmentDisplay.lines.map((line) => `${line.name || line.id} ×${line.quantity}`).join(" ; ") || "—";

    const due = splitTtc(getBookingAmountDue(booking));
    return [
      escapeCSV(booking.booking_ref),
      escapeCSV(booking.user_name || "—"),
      escapeCSV(clientIdentity.resolved ? clientIdentity.clientTypeLabel : "—"),
      escapeCSV(clientIdentity.legalName || "—"),
      escapeCSV(clientIdentity.siret || "—"),
      escapeCSV(clientIdentity.rna || "—"),
      escapeCSV(clientIdentity.instagramAccounts || "—"),
      escapeCSV(booking.user_email || "—"),
      escapeCSV(studioName),
      escapeCSV(formatDateForCSV(booking.date)),
      escapeCSV(booking.start_time),
      escapeCSV(booking.end_time),
      escapeCSV(durationHours),
      escapeCSV(booking.band_name || booking.user_band_name || "—"),
      escapeCSV(groupTypeLabel(booking.group_type)),
      escapeCSV(bookingStatusLabel(booking.status)),
      escapeCSV(options),
      escapeCSV(formatPriceForCSV(Number(booking.equipment_price) || 0)),
      escapeCSV(formatPriceForCSV(Number(booking.total_price) || 0)),
      escapeCSV(formatPriceForCSV(due.ttc)),
      escapeCSV(formatPriceForCSV(due.ht)),
      escapeCSV(formatPriceForCSV(due.vat)),
      escapeCSV(formatPriceForCSV(Number(booking.promo_discount) || 0)),
      escapeCSV(storedPaymentStatusLabel(booking.payment_status)),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function exportBookingsCSV(bookings: BookingWithUser[]): void {
  const csv = buildBookingsCSV(bookings);
  const timestamp = formatDateISO(new Date());
  downloadCSV(`h3-reservations-${timestamp}.csv`, csv);
}

// ─── Users Export ────────────────────────────────────────────────────────────

function formatPhoneForCSV(phone: string | null | undefined): string {
  const trimmed = phone?.trim() || "";
  if (!trimmed) return "—";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  if (hasPlus && digits.startsWith("33") && digits.length === 11) {
    const rest = digits.slice(2);
    return `+33 ${rest[0]} ${rest.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ").trim()}`;
  }
  if (/[^\d+]/.test(trimmed.replace(/^\+/, ""))) return trimmed;
  const grouped = digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return hasPlus ? `+${grouped}` : grouped;
}

export function buildUsersCSV(users: DbUser[]): string {
  const headers = [
    "Nom",
    "Type de client",
    "Raison sociale",
    "SIRET",
    "RNA",
    "Instagram",
    "Email",
    "Téléphone",
    "Groupe",
    "Réservations",
    "Annulations",
    "Heures réservées",
    "% La Scène",
    "% Le Podium",
    "Panier moyen TTC (EUR)",
    "Total options TTC (EUR)",
    "Total remises TTC (EUR)",
    "Total dépensé TTC (EUR)",
    "Total dépensé HT (EUR)",
    "TVA 20% (EUR)",
    "Bloqué",
    "Notes internes",
  ];

  const rows = users.map((user) => {
    const clientIdentity = resolveUserClientIdentity(user);
    const spent = splitTtc(user.total_spent);
    const sceneDenominator = (user.total_bookings_la_scene ?? 0) + (user.total_bookings_le_podium ?? 0);
    return [
      escapeCSV(user.name),
      escapeCSV(clientIdentity.clientTypeLabel),
      escapeCSV(clientIdentity.legalName || "—"),
      escapeCSV(clientIdentity.siret || "—"),
      escapeCSV(clientIdentity.rna || "—"),
      escapeCSV(clientIdentity.instagramAccounts || "—"),
      escapeCSV(user.email || "—"),
      escapeCSV(formatPhoneForCSV(user.phone)),
      escapeCSV(user.band_name || "—"),
      escapeCSV(user.total_bookings),
      escapeCSV(user.total_cancellations ?? 0),
      escapeCSV(((user.total_minutes ?? 0) / 60).toFixed(1)),
      escapeCSV((sceneDenominator > 0 ? 100 * (user.total_bookings_la_scene ?? 0) / sceneDenominator : 0).toFixed(1)),
      escapeCSV((sceneDenominator > 0 ? 100 * (user.total_bookings_le_podium ?? 0) / sceneDenominator : 0).toFixed(1)),
      escapeCSV(formatPriceForCSV(user.total_bookings > 0 ? user.total_spent / user.total_bookings : 0)),
      escapeCSV(formatPriceForCSV(user.total_equipment ?? 0)),
      escapeCSV(formatPriceForCSV(user.total_discounts ?? 0)),
      escapeCSV(formatPriceForCSV(spent.ttc)),
      escapeCSV(formatPriceForCSV(spent.ht)),
      escapeCSV(formatPriceForCSV(spent.vat)),
      escapeCSV(user.is_blocked === 1 ? "Oui" : "Non"),
      escapeCSV(user.notes || "—"),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function exportUsersCSV(users: DbUser[]): void {
  const csv = buildUsersCSV(users);
  const timestamp = formatDateISO(new Date());
  downloadCSV(`h3-clients-${timestamp}.csv`, csv);
}

// ─── Payments Export ─────────────────────────────────────────────────────────

interface PaymentWithDetails extends DbPayment {
  booking_ref?: string | null;
  user_name?: string | null;
  user_band_name?: string | null;
  payment_type?: "on-site" | "online" | null;
}

export function exportPaymentsCSV(payments: PaymentWithDetails[]): void {
  const headers = [
    "Réf. réservation",
    "Client",
    "Groupe",
    "Type paiement",
    "Méthode",
    "Statut",
    "Montant TTC (EUR)",
    "Montant HT (EUR)",
    "TVA 20% (EUR)",
    "Remboursé TTC (EUR)",
    "Remboursé HT (EUR)",
    "TVA 20% remboursée (EUR)",
    "Date paiement",
  ];

  const rows = payments.map((payment) => {
    const amount = splitTtc(payment.amount);
    const refunded = splitTtc(payment.refunded_amount);
    return [
      escapeCSV(payment.booking_ref || "—"),
      escapeCSV(payment.user_name || "—"),
      escapeCSV(payment.user_band_name || "—"),
      escapeCSV(payment.payment_type ? paymentTypeLabel(payment.payment_type) : "—"),
      escapeCSV(paymentMethodLabel(payment.method)),
      escapeCSV(paymentRecordStatusLabel(payment.status)),
      escapeCSV(formatPriceForCSV(amount.ttc)),
      escapeCSV(formatPriceForCSV(amount.ht)),
      escapeCSV(formatPriceForCSV(amount.vat)),
      escapeCSV(formatPriceForCSV(refunded.ttc)),
      escapeCSV(formatPriceForCSV(refunded.ht)),
      escapeCSV(formatPriceForCSV(refunded.vat)),
      escapeCSV(payment.paid_at ? formatDateForCSV(payment.paid_at) : "—"),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const timestamp = formatDateISO(new Date());
  downloadCSV(`h3-paiements-${timestamp}.csv`, csv);
}

// ─── PDF Invoice Export ───────────────────────────────────────────────────────

interface InvoiceBooking extends DbBooking {}

export async function generateInvoicePDF(
  booking: InvoiceBooking,
  payment: DbPayment | null,
  user: DbUser,
  equipmentNames?: Record<string, string>
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header - H3 Studios
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("H3 STUDIOS", 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.address.street, 20, y);
  y += 5;
  doc.text(`${COMPANY.address.postalCode} ${COMPANY.address.city}`, 20, y);
  y += 5;
  doc.text(`Tél: ${COMPANY.phoneDisplay}`, 20, y);
  y += 5;
  doc.text(`Email: ${COMPANY.email}`, 20, y);
  y += 5;
  doc.text(`${COMPANY.legalForm} au capital de ${COMPANY.shareCapital} — ${companyRcs()}`, 20, y);
  y += 5;
  doc.text(`SIRET: ${COMPANY.siret}`, 20, y);
  y += 5;
  doc.text(`TVA intracommunautaire: ${COMPANY.vatNumber}`, 20, y);
  y += 15;

  // Invoice title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageWidth - 20, 20, { align: "right" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Réf: ${booking.booking_ref}`, pageWidth - 20, 28, { align: "right" });
  doc.text(`Date: ${new Date(booking.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`, pageWidth - 20, 35, { align: "right" });

  y += 10;

  // Line separator
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Client info
  ensureSpace(120);
  const clientIdentity = resolveBookingClientIdentity(booking, user);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Client:", 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(user.name, 45, y);
  y += 6;
  if (user.email) {
    doc.text(user.email, 45, y);
    y += 6;
  }
  if (user.phone) {
    doc.text(user.phone, 45, y);
    y += 6;
  }
  if (clientIdentity.isBusiness) {
    doc.text(`Type de client: ${clientIdentity.clientTypeLabel}`, 45, y);
    y += 6;
    if (clientIdentity.legalName) {
      doc.text(`Raison sociale: ${clientIdentity.legalName}`, 45, y);
      y += 6;
    }
    if (clientIdentity.siret) {
      doc.text(`SIRET: ${formatSiret(clientIdentity.siret)}`, 45, y);
      y += 6;
    }
    if (clientIdentity.rna) {
      doc.text(`RNA: ${clientIdentity.rna}`, 45, y);
      y += 6;
    }
    if (user.address_line1) {
      doc.text("Adresse:", 20, y);
      doc.text(user.address_line1, 45, y);
      y += 6;
      const locality = [user.postal_code, user.city].filter(Boolean).join(" ");
      if (locality) {
        doc.text(locality, 45, y);
        y += 6;
      }
    }
  }
  if (booking.band_name) {
    doc.text(`Groupe: ${booking.band_name}`, 45, y);
    y += 6;
  }
  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Booking details
  const studioName = studioLabel(booking.studio_id);
  const startParts = booking.start_time.split(":");
  const endParts = booking.end_time.split(":");
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
  const durationHours = (endMinutes - startMinutes) / 60;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Détails de la réservation", 20, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  const details = [
    ["Studio:", studioName],
    ["Date:", new Date(booking.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
    ["Horaire:", `${booking.start_time} - ${booking.end_time}`],
    ["Durée:", `${durationHours} heure${durationHours > 1 ? "s" : ""}`],
    ["Type:", groupTypeLabel(booking.group_type)],
  ];

  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, 25, y);
    doc.text(value, 70, y);
    y += 6;
  });

  // Equipment
  const equipmentDisplay = resolveEquipmentDisplay(booking.equipment, booking.equipment_price, id => equipmentNames?.[id]);
  const equipmentTotal = equipmentDisplay.subtotal;
  if (booking.equipment) {
      const equipmentList = equipmentDisplay.lines;
      const exact = equipmentDisplay.showLinePrices;
      if (equipmentList.length > 0) {
        ensureSpace(equipmentList.length * 5 + 14);
        y += 4;
        doc.text("Équipements:", 25, y);
        y += 6;
        equipmentList.forEach((eq) => {
          const eqPrice = exact ? eq.lineTotal! : undefined;
          doc.text(`  • ${eq.name || eq.id} ×${eq.quantity}`, 30, y);
          if (typeof eqPrice === "number") {
            doc.text(`${eqPrice.toFixed(2)} € TTC`, 140, y);
          }
          y += 5;
        });
      }
  }

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Pricing summary
  ensureSpace(95);
  const basePrice = booking.base_price || 0;
  const netTotal = getBookingAmountDue(booking);

  doc.setFont("helvetica", "normal");
  doc.text("Sous-total répétition:", 100, y);
  doc.text(`${basePrice.toFixed(2)} € TTC`, pageWidth - 20, y, { align: "right" });
  y += 6;

  if (equipmentTotal > 0) {
    doc.text("Équipements:", 100, y);
    doc.text(`${equipmentTotal.toFixed(2)} € TTC`, pageWidth - 20, y, { align: "right" });
    y += 6;
  }

  if ((Number(booking.promo_discount) || 0) > 0) {
    doc.text("Remise:", 100, y);
    doc.text(`-${(Number(booking.promo_discount) || 0).toFixed(2)} € TTC`, pageWidth - 20, y, { align: "right" });
    y += 6;
  }

  y += 4;
  doc.setDrawColor(150);
  doc.line(100, y, pageWidth - 20, y);
  y += 8;

  const tax = splitTtc(netTotal);
  doc.setFont("helvetica", "normal");
  doc.text("HT:", 100, y);
  doc.text(`${tax.ht.toFixed(2)} €`, pageWidth - 20, y, { align: "right" });
  y += 6;
  doc.text("TVA 20%:", 100, y);
  doc.text(`${tax.vat.toFixed(2)} €`, pageWidth - 20, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total TTC:", 100, y);
  doc.text(`${netTotal.toFixed(2)} € TTC`, pageWidth - 20, y, { align: "right" });
  y += 15;

  // Payment info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Une facture ne doit jamais afficher « — » pour le moyen de paiement.
  const paymentMethodDisplay = booking.payment_method
    ? paymentMethodLabel(booking.payment_method)
    : payment
      ? paymentMethodLabel(payment.method)
      : "Espèces";
  const paymentStatusDisplay = payment ? paymentRecordStatusLabel(payment.status) : "En attente";

  doc.text(`Méthode de paiement: ${paymentMethodDisplay}`, 20, y);
  y += 5;
  doc.text(`Statut: ${paymentStatusDisplay}`, 20, y);
  y += 20;

  // Footer
  ensureSpace(30);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Merci de votre confiance !", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(`${COMPANY.brandName} - SIRET: ${COMPANY.siret} - TVA: ${COMPANY.vatNumber}`, pageWidth / 2, y, { align: "center" });

  // Download
  doc.save(`h3-facture-${booking.booking_ref}.pdf`);
}

// ─── PDF Dashboard Report Export ──────────────────────────────────────────────

export interface DashboardReportClient {
  name: string;
  bandName: string | null;
  bookings: number;
  revenue: number;
  minutes: number;
}

export interface DashboardReportNamedStat {
  label: string;
  count: number;
  revenue: number;
}

export interface DashboardReportStats {
  revenue: number;
  bookingCount: number;
  bookedDurationLabel: string;
  equipmentRevenue: number;
  discounts: number;
  promoDiscounts: number;
  manualDiscounts: number;
  loyaltyDiscounts: number;
  avgBasket: number;
  minPrice: number;
  maxPrice: number;
  cancellations: number;
  occupancyRate: number;
  occupancyBookedLabel: string;
  occupancyOpenLabel: string;
  pendingPayments: number;
  pendingAmount: number;
  overduePayments: number;
  overdueAmount: number;
  studioStats: DashboardReportNamedStat[];
  groupTypes: DashboardReportNamedStat[];
  clientTypes: DashboardReportNamedStat[];
  paymentMethods: DashboardReportNamedStat[];
  paymentChannels: DashboardReportNamedStat[];
  topByRevenue: DashboardReportClient[];
  topByBookings: DashboardReportClient[];
  topByHours: DashboardReportClient[];
}

export interface DashboardReportPeriod {
  title: string;
  subtitle: string;
  filename: string;
}

function formatReportHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder > 0 ? `${hours}h${String(remainder).padStart(2, "0")}` : `${hours}h`;
}

export async function generateDashboardReportPDF(
  stats: DashboardReportStats,
  period: DashboardReportPeriod,
  charts?: ReportChartsPngs,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginTop = 20;
  const marginBottom = 18;
  let y = marginTop;

  const ensureSpace = (neededH: number) => {
    if (y + neededH > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(0);
    }
  };

  const insertChart = (dataUrl: string) => {
    const chartW = pageWidth - 40;
    const chartH = chartW * (300 / 760);
    ensureSpace(chartH + 10);
    y += 6;
    doc.addImage(dataUrl, "JPEG", 20, y, chartW, chartH);
    y += chartH + 10;
  };

  const sectionHeader = (title: string, neededH: number) => {
    ensureSpace(neededH);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(title, 20, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  const separator = (neededH = 14) => {
    ensureSpace(neededH);
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
  };

  const writeNamedStats = (rows: DashboardReportNamedStat[], emptyLabel: string) => {
    if (rows.length === 0) {
      doc.text(emptyLabel, 25, y);
      y += 7;
      return;
    }
    rows.forEach((row) => {
      doc.text(`${row.label}:`, 25, y);
      doc.text(`${row.count} · ${row.revenue.toFixed(2)} \u20AC TTC`, 90, y);
      y += 7;
    });
  };

  const writeTopClients = (rows: DashboardReportClient[], metric: "revenue" | "bookings" | "hours") => {
    if (rows.length === 0) {
      doc.text("Aucune r\u00E9servation sur la p\u00E9riode", 25, y);
      y += 7;
      return;
    }
    rows.forEach((client, idx) => {
      const bandSuffix = client.bandName ? ` (${client.bandName})` : "";
      const primary = metric === "revenue"
        ? `${client.revenue.toFixed(2)} \u20AC TTC`
        : metric === "bookings"
          ? `${client.bookings} r\u00E9sa`
          : formatReportHours(client.minutes);
      const secondary = metric === "revenue"
        ? `${client.bookings} r\u00E9sa · ${formatReportHours(client.minutes)}`
        : metric === "bookings"
          ? `${client.revenue.toFixed(2)} \u20AC TTC · ${formatReportHours(client.minutes)}`
          : `${client.revenue.toFixed(2)} \u20AC TTC · ${client.bookings} r\u00E9sa`;
      doc.text(`${idx + 1}. ${client.name}${bandSuffix}`, 25, y);
      doc.text(`${primary} · ${secondary}`, 120, y);
      y += 7;
    });
  };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("H3 STUDIOS", 20, y);
  y += 8;

  doc.setFontSize(14);
  doc.text(period.title, 20, y);
  y += 7;
  if (period.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(period.subtitle, 20, y);
    doc.setTextColor(0);
    y += 10;
  } else {
    y += 8;
  }

  separator(20);

  sectionHeader("Indicateurs cl\u00E9s", 120);

  const tax = splitTtc(stats.revenue);
  const equipPct = stats.revenue > 0 ? Math.round((stats.equipmentRevenue / stats.revenue) * 100) : 0;
  const occupancyLabel = stats.occupancyRate % 1 === 0
    ? stats.occupancyRate.toFixed(0)
    : stats.occupancyRate.toFixed(1);

  const kpis = [
    ["R\u00E9servations:", `${stats.bookingCount} \u00B7 ${stats.bookedDurationLabel}`],
    ["CA r\u00E9serv\u00E9:", `${stats.revenue.toFixed(2)} \u20AC TTC`],
    ["  HT:", `${tax.ht.toFixed(2)} \u20AC`],
    ["  TVA 20%:", `${tax.vat.toFixed(2)} \u20AC`],
    ["  dont options:", `${stats.equipmentRevenue.toFixed(2)} \u20AC TTC (${equipPct}%)`],
    ["Remises accord\u00E9es:", `${stats.discounts.toFixed(2)} \u20AC TTC`],
    ["  promo / manuelle / fid\u00E9lit\u00E9:", `${stats.promoDiscounts.toFixed(2)} / ${stats.manualDiscounts.toFixed(2)} / ${stats.loyaltyDiscounts.toFixed(2)} \u20AC`],
    ["Panier moyen:", `${stats.avgBasket.toFixed(2)} \u20AC TTC (de ${stats.minPrice.toFixed(2)} \u00E0 ${stats.maxPrice.toFixed(2)})`],
    ["Annulations:", `${stats.cancellations}`],
    ["Occupation:", `${occupancyLabel}% \u00B7 ${stats.occupancyBookedLabel} / ${stats.occupancyOpenLabel}`],
    ["Sur place \u00E0 encaisser:", `${stats.pendingPayments} \u00B7 ${stats.pendingAmount.toFixed(2)} \u20AC TTC`],
    ["Au recouvrement:", `${stats.overduePayments} \u00B7 ${stats.overdueAmount.toFixed(2)} \u20AC TTC`],
  ];

  kpis.forEach(([label, value]) => {
    doc.text(label, 25, y);
    doc.text(value, 100, y);
    y += 7;
  });

  y += 10;

  if (charts?.revenue) insertChart(charts.revenue);

  separator();
  if (charts?.occupancy) insertChart(charts.occupancy);

  separator();
  sectionHeader("R\u00E9partition par studio", 20 + Math.max(stats.studioStats.length, 1) * 7 + 20);
  writeNamedStats(stats.studioStats, "Aucun studio sur la p\u00E9riode");
  y += 6;
  if (charts?.studiosBookings) insertChart(charts.studiosBookings);
  if (charts?.studiosRevenue) insertChart(charts.studiosRevenue);

  separator();
  sectionHeader("R\u00E9partition par type de client", 20 + Math.max(stats.groupTypes.length, stats.clientTypes.length, 1) * 7 + 20);
  doc.setFont("helvetica", "bold");
  doc.text("Nombre", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeNamedStats(stats.groupTypes, "Aucune r\u00E9servation sur la p\u00E9riode");
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Type", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeNamedStats(stats.clientTypes, "Aucune r\u00E9servation sur la p\u00E9riode");
  y += 6;
  if (charts?.clientsGroup) insertChart(charts.clientsGroup);
  if (charts?.clientsType) insertChart(charts.clientsType);

  separator();
  sectionHeader("Moyens de paiement", 20 + Math.max(stats.paymentMethods.length, stats.paymentChannels.length, 1) * 7 + 20);
  doc.setFont("helvetica", "bold");
  doc.text("Tous", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeNamedStats(stats.paymentMethods, "Aucun paiement enregistr\u00E9");
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("En ligne / Sur place", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeNamedStats(stats.paymentChannels, "Aucun paiement enregistr\u00E9");
  y += 6;
  if (charts?.paymentMethods) insertChart(charts.paymentMethods);
  if (charts?.paymentChannels) insertChart(charts.paymentChannels);

  separator();
  sectionHeader("Top 5 des meilleurs clients", 30 + 21 * 3);
  doc.setFont("helvetica", "bold");
  doc.text("Par CA", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeTopClients(stats.topByRevenue, "revenue");
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Par r\u00E9servations", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeTopClients(stats.topByBookings, "bookings");
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Par heures", 25, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  writeTopClients(stats.topByHours, "hours");

  separator();
  if (charts?.durations) insertChart(charts.durations);

  ensureSpace(20);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`G\u00E9n\u00E9r\u00E9 le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0);

  const filename = period.filename.endsWith(".pdf") ? period.filename : `${period.filename}.pdf`;
  doc.save(filename);
}
