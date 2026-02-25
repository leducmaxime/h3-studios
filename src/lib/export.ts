import { type DbBooking, type DbUser, type DbPayment } from "./db-types";
import { STUDIOS, formatPrice, type StudioId } from "./booking";
import { formatDateISO } from "./utils";
import { jsPDF } from "jspdf";

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
    "Email",
    "Studio",
    "Date",
    "Heure début",
    "Heure fin",
    "Durée (h)",
    "Groupe",
    "Statut",
    "Montant (EUR)",
    "Paiement",
  ];

  const rows = bookings.map((booking) => {
    const studioName = STUDIOS[booking.studio_id as StudioId]?.name || booking.studio_id;
    
    // Calculate duration in hours
    const startParts = booking.start_time.split(":");
    const endParts = booking.end_time.split(":");
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const durationHours = ((endMinutes - startMinutes) / 60).toFixed(1);

    // Status labels
    const statusLabels: Record<string, string> = {
      confirmed: "Confirmé",
      completed: "Terminé",
      cancelled: "Annulé",
      "no-show": "No-show",
    };

    const paymentLabels: Record<string, string> = {
      pending: "En attente",
      paid: "Payé",
      "pay-on-site": "Sur place",
    };

    return [
      escapeCSV(booking.booking_ref),
      escapeCSV(booking.user_name || "—"),
      escapeCSV(booking.user_email || "—"),
      escapeCSV(studioName),
      escapeCSV(formatDateForCSV(booking.date)),
      escapeCSV(booking.start_time),
      escapeCSV(booking.end_time),
      escapeCSV(durationHours),
      escapeCSV(booking.group_type),
      escapeCSV(statusLabels[booking.status] || booking.status),
      escapeCSV(formatPriceForCSV(booking.total_price)),
      escapeCSV(paymentLabels[booking.payment_status || ""] || booking.payment_status || "—"),
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
    "Email",
    "Téléphone",
    "Groupe",
    "Réservations",
    "Total dépensé (EUR)",
    "Bloqué",
  ];

  const rows = users.map((user) => {
    return [
      escapeCSV(user.name),
      escapeCSV(user.email || "—"),
      escapeCSV(user.phone || "—"),
      escapeCSV(user.band_name || "—"),
      escapeCSV(user.total_bookings),
      escapeCSV(formatPriceForCSV(user.total_spent)),
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
    "Montant (EUR)",
    "Remboursé (EUR)",
    "Date paiement",
  ];

  const rows = payments.map((payment) => {
    const methodLabels: Record<string, string> = {
      card: "CB",
      cash: "Espèces",
      transfer: "Virement",
      check: "Chèque",
      cheque: "Chèque",
    };

    const paymentTypeLabels: Record<string, string> = {
      "on-site": "Sur place",
      online: "En ligne",
    };

    const statusLabels: Record<string, string> = {
      pending: "En attente",
      paid: "Payé",
      refunded: "Remboursé",
      "partial-refund": "Partiel",
    };

    return [
      escapeCSV(payment.booking_ref || "—"),
      escapeCSV(payment.user_name || "—"),
      escapeCSV(payment.user_band_name || "—"),
      escapeCSV(payment.payment_type ? (paymentTypeLabels[payment.payment_type] || payment.payment_type) : "—"),
      escapeCSV(methodLabels[payment.method] || payment.method),
      escapeCSV(statusLabels[payment.status] || payment.status),
      escapeCSV(formatPriceForCSV(payment.amount)),
      escapeCSV(formatPriceForCSV(payment.refunded_amount)),
      escapeCSV(payment.paid_at ? formatDateForCSV(payment.paid_at) : "—"),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const timestamp = formatDateISO(new Date());
  downloadCSV(`h3-paiements-${timestamp}.csv`, csv);
}

// ─── PDF Invoice Export ───────────────────────────────────────────────────────

interface InvoiceBooking extends DbBooking {}

export function generateInvoicePDF(
  booking: InvoiceBooking,
  payment: DbPayment | null,
  user: DbUser
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

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
  if (booking.band_name) {
    doc.text(`Groupe: ${booking.band_name}`, 45, y);
    y += 6;
  }
  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Booking details
  const studioName = STUDIOS[booking.studio_id as StudioId]?.name || booking.studio_id;
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
    ["Type:", booking.group_type.charAt(0).toUpperCase() + booking.group_type.slice(1)],
  ];

  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, 25, y);
    doc.text(value, 70, y);
    y += 6;
  });

  // Equipment
  let equipmentTotal = 0;
  if (booking.equipment) {
    try {
      const equipmentList: Array<{ id: string; quantity: number; name?: string; price?: number }> = JSON.parse(booking.equipment);
      if (equipmentList.length > 0) {
        y += 4;
        doc.text("Équipements:", 25, y);
        y += 6;
        equipmentList.forEach((eq) => {
          const eqPrice = eq.price || 0;
          equipmentTotal += eqPrice;
          doc.text(`  • ${eq.name || eq.id} ×${eq.quantity}`, 30, y);
          if (eqPrice > 0) {
            doc.text(`${eqPrice.toFixed(2)} €`, 140, y);
          }
          y += 5;
        });
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  y += 10;

  // Line separator
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Pricing summary
  const basePrice = booking.base_price || 0;
  const totalPrice = booking.total_price || 0;

  doc.setFont("helvetica", "normal");
  doc.text("Sous-total répétition:", 100, y);
  doc.text(`${basePrice.toFixed(2)} €`, pageWidth - 20, y, { align: "right" });
  y += 6;

  if (equipmentTotal > 0) {
    doc.text("Équipements:", 100, y);
    doc.text(`${equipmentTotal.toFixed(2)} €`, pageWidth - 20, y, { align: "right" });
    y += 6;
  }

  y += 4;
  doc.setDrawColor(150);
  doc.line(100, y, pageWidth - 20, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total TTC:", 100, y);
  doc.text(`${totalPrice.toFixed(2)} €`, pageWidth - 20, y, { align: "right" });
  y += 15;

  // Payment info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const paymentMethodLabel = booking.payment_method === "card" ? "Carte bancaire" : "Espèces";
  const paymentStatusLabel = payment?.status === "paid" ? "Payé" : payment?.status === "pending" ? "En attente" : booking.payment_status === "paid" ? "Payé" : "En attente";

  doc.text(`Méthode de paiement: ${paymentMethodLabel}`, 20, y);
  y += 5;
  doc.text(`Statut: ${paymentStatusLabel}`, 20, y);
  y += 20;

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Merci de votre confiance !", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("H3 Studios - SIRET: XXX XXX XXX XXXXX", pageWidth / 2, y, { align: "center" });

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

export function generateMonthlyReportPDF(
  stats: MonthlyStats,
  period: { month: number; year: number }
): void {
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
    ["Revenu total:", `${stats.revenue.toFixed(2)} \u20AC`],
    ["  dont options/\u00E9quipements:", `${stats.equipmentRevenue.toFixed(2)} \u20AC (${equipPct}%)`],
    ["Nombre de r\u00E9servations:", `${stats.bookingCount}`],
    ["Panier moyen:", `${stats.avgBasket.toFixed(2)} \u20AC`],
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
    const studioName = STUDIOS[studio.studio_id as StudioId]?.name || studio.studio_id;
    doc.text(`${studioName}:`, 25, y);
    doc.text(`${studio.count} réservation${studio.count > 1 ? "s" : ""}, ${studio.revenue.toFixed(2)} €`, 80, y);
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

  const methodLabels: Record<string, string> = {
    cash: "Esp\u00E8ces",
    card: "CB",
    transfer: "Virement",
    check: "Ch\u00E8que",
    cheque: "Ch\u00E8que",
  };

  if (stats.paymentMethods.length > 0) {
    stats.paymentMethods.forEach((pm) => {
      const label = methodLabels[pm.method] || pm.method;
      doc.text(`${label}:`, 25, y);
      doc.text(`${pm.count} paiement${pm.count > 1 ? "s" : ""}, ${pm.revenue.toFixed(2)} \u20AC`, 80, y);
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
      doc.text(`${client.bookings} r\u00E9sa, ${client.revenue.toFixed(2)} \u20AC`, 120, y);
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
    doc.text(`${week.count} r\u00E9sa, ${week.revenue.toFixed(2)} \u20AC`, 80, y);
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
