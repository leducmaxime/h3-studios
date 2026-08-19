import { type DbBooking, type DbUser, type DbPayment } from "./db-types";
import { formatPrice, resolveEquipmentDisplay } from "./booking";
import { getBookingAmountDue } from "./booking-totals";
import { formatDateISO } from "./utils";
import { formatSiret, resolveBookingClientIdentity, resolveUserClientIdentity } from "./client-identity";
import { bookingPaymentStatusLabel, bookingStatusLabel, groupTypeLabel, paymentMethodLabel, paymentMethodLabelShort, paymentRecordStatusLabel, paymentTypeLabel, studioLabel } from "@/lib/labels";
import { splitTtc } from "@/lib/tax";
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
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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

function formatPriceForCSV(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

// ─── Bookings Export ─────────────────────────────────────────────────────────

interface BookingWithUser extends DbBooking {}

export function exportBookingsCSV(bookings: BookingWithUser[]): void {
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
    "Groupe",
    "Statut",
    "Montant dû TTC (EUR)",
    "Montant dû HT (EUR)",
    "TVA 20% (EUR)",
    "Remise TTC (EUR)",
    "Paiement",
  ];

  const rows = bookings.map((booking) => {
    const clientIdentity = resolveBookingClientIdentity(booking, undefined);
    const studioName = studioLabel(booking.studio_id);
    
    // Calculate duration in hours
    const startParts = booking.start_time.split(":");
    const endParts = booking.end_time.split(":");
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const durationHours = ((endMinutes - startMinutes) / 60).toFixed(1);

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
      escapeCSV(groupTypeLabel(booking.group_type)),
      escapeCSV(bookingStatusLabel(booking.status)),
      escapeCSV(formatPriceForCSV(due.ttc)),
      escapeCSV(formatPriceForCSV(due.ht)),
      escapeCSV(formatPriceForCSV(due.vat)),
      escapeCSV(formatPriceForCSV(Number(booking.promo_discount) || 0)),
      escapeCSV(bookingPaymentStatusLabel(booking.payment_status)),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const timestamp = formatDateISO(new Date());
  downloadCSV(`h3-reservations-${timestamp}.csv`, csv);
}

// ─── Users Export ────────────────────────────────────────────────────────────

export function exportUsersCSV(users: DbUser[]): void {
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
    "Total dépensé TTC (EUR)",
    "Total dépensé HT (EUR)",
    "TVA 20% (EUR)",
    "Bloqué",
  ];

  const rows = users.map((user) => {
    const clientIdentity = resolveUserClientIdentity(user);
    const spent = splitTtc(user.total_spent);
    return [
      escapeCSV(user.name),
      escapeCSV(clientIdentity.clientTypeLabel),
      escapeCSV(clientIdentity.legalName || "—"),
      escapeCSV(clientIdentity.siret || "—"),
      escapeCSV(clientIdentity.rna || "—"),
      escapeCSV(clientIdentity.instagramAccounts || "—"),
      escapeCSV(user.email || "—"),
      escapeCSV(user.phone || "—"),
      escapeCSV(user.band_name || "—"),
      escapeCSV(user.total_bookings),
      escapeCSV(formatPriceForCSV(spent.ttc)),
      escapeCSV(formatPriceForCSV(spent.ht)),
      escapeCSV(formatPriceForCSV(spent.vat)),
      escapeCSV(user.is_blocked === 1 ? "Oui" : "Non"),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
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
  doc.text("16 Rue de la Liberté", 20, y);
  y += 5;
  doc.text("94370 Sucy-en-Brie", 20, y);
  y += 5;
  doc.text("Tél: 01 45 90 00 00", 20, y);
  y += 5;
  doc.text("Email: contact@h3studios.fr", 20, y);
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
  doc.text("H3 Studios - SIRET: 944 221 753 00014", pageWidth / 2, y, { align: "center" });

  // Download
  doc.save(`h3-facture-${booking.booking_ref}.pdf`);
}

// ─── PDF Monthly Report Export ────────────────────────────────────────────────

interface MonthlyStats {
  revenue: number;
  bookingCount: number;
  equipmentRevenue: number;
  noShowCount: number;
  avgBasket: number;
  occupancyRate: number;
  studioStats: Array<{ studio_id: string; count: number; revenue: number }>;
  paymentMethods: Array<{ method: string; count: number; revenue: number }>;
  topClients: Array<{ name: string; band_name: string | null; bookings: number; revenue: number }>;
  weeklyStats: Array<{ week: number; count: number; revenue: number }>;
}

export async function generateMonthlyReportPDF(
  stats: MonthlyStats,
  period: { month: number; year: number }
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const periodLabel = `${monthNames[period.month - 1]} ${period.year}`;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("H3 STUDIOS", 20, y);
  y += 8;

  doc.setFontSize(14);
  doc.text(`Rapport Mensuel - ${periodLabel}`, 20, y);
  y += 15;

  // Line separator
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // KPIs Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Indicateurs Clés", 20, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const equipPct = stats.revenue > 0 ? Math.round((stats.equipmentRevenue / stats.revenue) * 100) : 0;
  const noShowPct = stats.bookingCount > 0 ? Math.round((stats.noShowCount / stats.bookingCount) * 100) : 0;

  const kpis = [
    ["Revenu total:", `${stats.revenue.toFixed(2)} \u20AC TTC`],
    ["  HT:", `${splitTtc(stats.revenue).ht.toFixed(2)} \u20AC`],
    ["  TVA 20%:", `${splitTtc(stats.revenue).vat.toFixed(2)} \u20AC`],
    ["  dont options/\u00E9quipements:", `${stats.equipmentRevenue.toFixed(2)} \u20AC TTC (${equipPct}%)`],
    ["Nombre de r\u00E9servations:", `${stats.bookingCount}`],
    ["Panier moyen:", `${stats.avgBasket.toFixed(2)} \u20AC TTC`],
    ["Taux d'occupation:", `${stats.occupancyRate.toFixed(1)}%`],
    ["No-shows:", `${stats.noShowCount} (${noShowPct}% des r\u00E9servations)`],
  ];

  kpis.forEach(([label, value]) => {
    doc.text(label, 25, y);
    doc.text(value, 100, y);
    y += 7;
  });

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // By Studio Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Répartition par Studio", 20, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  stats.studioStats.forEach((studio) => {
    const studioName = studioLabel(studio.studio_id);
    doc.text(`${studioName}:`, 25, y);
    doc.text(`${studio.count} réservation${studio.count > 1 ? "s" : ""}, ${studio.revenue.toFixed(2)} € TTC`, 80, y);
    y += 7;
  });

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Payment Methods Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Moyens de Paiement", 20, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  if (stats.paymentMethods.length > 0) {
    stats.paymentMethods.forEach((pm) => {
      const label = paymentMethodLabelShort(pm.method);
      doc.text(`${label}:`, 25, y);
      doc.text(`${pm.count} paiement${pm.count > 1 ? "s" : ""}, ${pm.revenue.toFixed(2)} \u20AC TTC`, 80, y);
      y += 7;
    });
  } else {
    doc.text("Aucun paiement enregistr\u00E9", 25, y);
    y += 7;
  }

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Top 5 Clients Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Top 5 Clients", 20, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  if (stats.topClients.length > 0) {
    stats.topClients.forEach((client, idx) => {
      const bandSuffix = client.band_name ? ` (${client.band_name})` : "";
      doc.text(`${idx + 1}. ${client.name}${bandSuffix}`, 25, y);
      doc.text(`${client.bookings} r\u00E9sa, ${client.revenue.toFixed(2)} \u20AC TTC`, 120, y);
      y += 7;
    });
  } else {
    doc.text("Aucune r\u00E9servation sur la p\u00E9riode", 25, y);
    y += 7;
  }

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // By Week Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Répartition par Semaine", 20, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  stats.weeklyStats.forEach((week) => {
    doc.text(`Semaine ${week.week}:`, 25, y);
    doc.text(`${week.count} r\u00E9sa, ${week.revenue.toFixed(2)} \u20AC TTC`, 80, y);
    y += 6;
  });

  y += 15;

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`, pageWidth / 2, y, { align: "center" });

  // Download
  const monthStr = String(period.month).padStart(2, "0");
  doc.save(`h3-rapport-${period.year}-${monthStr}.pdf`);
}
