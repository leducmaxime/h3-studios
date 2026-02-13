import { type DbBooking, type DbUser, type DbPayment } from "./db-types";
import { STUDIOS, formatPrice, type StudioId } from "./booking";

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

function formatPriceForCSV(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ─── Bookings Export ─────────────────────────────────────────────────────────

interface BookingWithUser extends DbBooking {
  user_name?: string;
  user_email?: string;
}

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
  const timestamp = new Date().toISOString().slice(0, 10);
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
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`h3-clients-${timestamp}.csv`, csv);
}

// ─── Payments Export ─────────────────────────────────────────────────────────

interface PaymentWithDetails extends DbPayment {
  booking_ref?: string | null;
  user_name?: string | null;
}

export function exportPaymentsCSV(payments: PaymentWithDetails[]): void {
  const headers = [
    "Réf. réservation",
    "Client",
    "Méthode",
    "Statut",
    "Montant (EUR)",
    "Remboursé (EUR)",
    "Date paiement",
  ];

  const rows = payments.map((payment) => {
    const methodLabels: Record<string, string> = {
      card: "Carte",
      cash: "Espèces",
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
      escapeCSV(methodLabels[payment.method] || payment.method),
      escapeCSV(statusLabels[payment.status] || payment.status),
      escapeCSV(formatPriceForCSV(payment.amount)),
      escapeCSV(formatPriceForCSV(payment.refunded_amount)),
      escapeCSV(payment.paid_at ? formatDateForCSV(payment.paid_at) : "—"),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`h3-paiements-${timestamp}.csv`, csv);
}
