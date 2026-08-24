"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "rwsdk/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  History,
  MapPin,
  Music,
} from "lucide-react";
import { getParisDateISO } from "@/lib/utils";
import {
  getBookingAmountDue,
  getDisplayPaymentStatusFromSummary,
  isKeepBalanceDue,
  shouldShowDisplayPaymentStatus,
  type DisplayPaymentStatus,
} from "@/lib/booking-totals";
import {
  downloadICS,
  formatDuration,
  generateGoogleCalendarUrl,
  generateICS,
  resolveEquipmentDisplay,
} from "@/lib/booking";
import { companyFullAddress } from "@/lib/company";
import { Price } from "@/components/common/Price";
import { TaxBreakdown } from "@/components/common/TaxBreakdown";
import { useClientAuth } from "@/lib/client-auth-store";
import {
  BOOKING_STATUS_LABELS,
  bookingStatusLabel,
  clientDisplayPaymentStatusLabel,
  groupTypeLabel,
  PAYMENT_STATUS_FAQ_HREF,
  studioLabel,
} from "@/lib/labels";

interface BookingRow {
  id: string;
  booking_ref: string;
  studio_id: string;
  date: string;
  start_time: string;
  end_time: string;
  group_type: string;
  base_price?: number;
  equipment_price?: number;
  total_price: number;
  promo_code?: string | null;
  promo_discount: number;
  equipment?: string | null;
  status: string;
  payment_method?: string | null;
  payment_status: string | null;
  band_name: string | null;
  total_paid?: number;
  total_collected?: number;
  total_refunded?: number;
  keep_balance_due?: number;
  remaining?: number;
}

type ListTab = "upcoming" | "past";

const PAST_PAGE_SIZE = 5;
const STUDIO_ADDRESS = companyFullAddress();
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STUDIO_ADDRESS)}`;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  confirmed: { label: BOOKING_STATUS_LABELS.confirmed, bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cancelled: { label: BOOKING_STATUS_LABELS.cancelled, bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  completed: { label: BOOKING_STATUS_LABELS.completed, bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  "no-show": { label: BOOKING_STATUS_LABELS["no-show"], bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

const PAYMENT_TONES: Record<DisplayPaymentStatus, { bg: string; text: string; border: string }> = {
  paid: { bg: "bg-emerald-600/10", text: "text-emerald-400", border: "border-emerald-600/20" },
  "pay-on-site": { bg: "bg-orange-600/10", text: "text-orange-400", border: "border-orange-600/20" },
  pending: { bg: "bg-amber-600/10", text: "text-amber-400", border: "border-amber-600/20" },
  cancelled: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
  "paid-before-cancel": { bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-600/20" },
  refunded: { bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-600/20" },
};

function parseBookingsPayload(payload: unknown): BookingRow[] {
  if (Array.isArray(payload)) return payload as BookingRow[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: BookingRow[] }).data;
  }
  return [];
}

function bookingCalendarDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function compareUpcoming(a: BookingRow, b: BookingRow): number {
  return a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);
}

function comparePast(a: BookingRow, b: BookingRow): number {
  return b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time);
}

function formatDateFR(dateStr: string): string {
  return bookingCalendarDate(dateStr).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  return bookingCalendarDate(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getDayName(dateStr: string): string {
  return bookingCalendarDate(dateStr).toLocaleDateString("fr-FR", { weekday: "short" });
}

function isPastBooking(booking: BookingRow, today: string): boolean {
  return booking.date < today || ["cancelled", "completed", "no-show"].includes(booking.status);
}

function getBookingDueAmount(booking: BookingRow): number | null {
  if (booking.status === "cancelled" && !(isKeepBalanceDue(booking) && (booking.remaining ?? 0) > 0)) {
    return null;
  }
  if (booking.status === "cancelled") {
    return booking.remaining ?? getBookingAmountDue({
      base_price: booking.base_price ?? 0,
      equipment_price: booking.equipment_price ?? 0,
      total_price: booking.total_price,
      promo_discount: booking.promo_discount ?? 0,
    });
  }
  return getBookingAmountDue({
    base_price: booking.base_price ?? 0,
    equipment_price: booking.equipment_price ?? 0,
    total_price: booking.total_price,
    promo_discount: booking.promo_discount ?? 0,
  });
}

function getStatusTone(booking: BookingRow) {
  return STATUS_CONFIG[booking.status] ?? {
    label: bookingStatusLabel(booking.status),
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
  };
}

function getPaymentView(booking: BookingRow) {
  const displayPaymentStatus = getDisplayPaymentStatusFromSummary(
    booking.status,
    booking.payment_status,
    booking.total_collected ?? booking.total_paid ?? 0,
    booking.total_refunded ?? 0,
    { keepBalanceDue: isKeepBalanceDue(booking), remaining: booking.remaining ?? 0 },
  );
  return {
    status: displayPaymentStatus,
    label: clientDisplayPaymentStatusLabel(displayPaymentStatus),
    ...PAYMENT_TONES[displayPaymentStatus],
  };
}

function addToCalendar(booking: BookingRow, target: "ics" | "google") {
  const studio = studioLabel(booking.studio_id);
  const date = bookingCalendarDate(booking.date);
  if (target === "ics") {
    downloadICS(
      generateICS(date, booking.start_time, booking.end_time, studio, booking.booking_ref),
      `h3-studios-${booking.booking_ref}.ics`,
    );
    return;
  }
  window.open(
    generateGoogleCalendarUrl(date, booking.start_time, booking.end_time, studio, booking.booking_ref),
    "_blank",
    "noopener,noreferrer",
  );
}

export function AccountBookings() {
  const { user, status } = useClientAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("upcoming");
  const [pastVisible, setPastVisible] = useState(PAST_PAGE_SIZE);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/client/bookings");
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/mon-compte/connexion";
        return;
      }
      if (!response.ok) {
        setBookings([]);
        setLoadError(true);
        return;
      }
      const payload = await response.json();
      setBookings(parseBookingsPayload(payload));
    } catch {
      setBookings([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      window.location.href = "/mon-compte/connexion";
      return;
    }
    void loadBookings();
  }, [status, user?.id, loadBookings]);

  const today = getParisDateISO();
  const upcoming = useMemo(
    () => bookings.filter((booking) => !isPastBooking(booking, today)).sort(compareUpcoming),
    [bookings, today],
  );
  const past = useMemo(
    () => bookings.filter((booking) => isPastBooking(booking, today)).sort(comparePast),
    [bookings, today],
  );
  const nextBooking = upcoming[0] ?? null;
  const otherUpcoming = upcoming.slice(1);
  const visiblePast = past.slice(0, pastVisible);

  if (loading || !user) {
    return <div className="py-16 text-center text-zinc-400">Chargement...</div>;
  }

  return (
    <div>
        {loadError && (
          <div className="mb-8 rounded-2xl border border-red-900/40 bg-red-950/30 px-5 py-5 text-center">
            <p className="text-sm text-red-300">Impossible de charger vos réservations pour le moment.</p>
            <Button
              className="mt-4 bg-primary text-black hover:bg-primary/90"
              size="sm"
              onClick={() => void loadBookings()}
            >
              Réessayer
            </Button>
          </div>
        )}

        {!loadError && nextBooking && (
          <NextSessionCard
            booking={nextBooking}
            expanded={openBookingId === nextBooking.id}
            onToggle={() => setOpenBookingId((current) => current === nextBooking.id ? null : nextBooking.id)}
          />
        )}

        {!loadError && (
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => setListTab("upcoming")}
              aria-pressed={listTab === "upcoming"}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                listTab === "upcoming"
                  ? "text-primary border-b-2 border-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              À venir
              <span className="ml-2 text-xs font-normal text-zinc-500">{upcoming.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setListTab("past")}
              aria-pressed={listTab === "past"}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                listTab === "past"
                  ? "text-primary border-b-2 border-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Passées
              <span className="ml-2 text-xs font-normal text-zinc-500">{past.length}</span>
            </button>
          </div>
        )}

        {!loadError && listTab === "upcoming" && (
          <section>
            {upcoming.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 text-center">
                <CalendarDays className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-white font-medium">Aucune réservation à venir</p>
                <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
                  Retrouvez ici vos prochaines sessions, ajoutez-les à votre calendrier et consultez le détail de chaque réservation.
                </p>
                <Button
                  className="mt-5 bg-primary text-black hover:bg-primary/90"
                  size="sm"
                  onClick={() => navigate("/reservation")}
                >
                  Réserver un studio
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : otherUpcoming.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center">Votre prochaine session est affichée ci-dessus.</p>
            ) : (
              <div className="space-y-3">
                {otherUpcoming.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    expanded={openBookingId === booking.id}
                    onToggle={() => setOpenBookingId((current) => current === booking.id ? null : booking.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {!loadError && listTab === "past" && (
          <section>
            {past.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 text-center">
                <History className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">Aucune réservation passée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePast.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    expanded={openBookingId === booking.id}
                    onToggle={() => setOpenBookingId((current) => current === booking.id ? null : booking.id)}
                  />
                ))}
                {pastVisible < past.length && (
                  <div className="pt-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      onClick={() => setPastVisible((count) => count + PAST_PAGE_SIZE)}
                    >
                      Voir plus
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
    </div>
  );
}

function NextSessionCard({
  booking,
  expanded,
  onToggle,
}: {
  booking: BookingRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = getStatusTone(booking);
  const payment = getPaymentView(booking);
  const amount = getBookingDueAmount(booking);
  const duration = formatDuration(booking.start_time, booking.end_time);

  return (
    <section className="mb-10 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-zinc-900/70 to-zinc-950 p-5 lg:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Prochaine session</p>
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-white capitalize">{formatDateFR(booking.date)}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              {booking.start_time} — {booking.end_time}
              {duration && <span className="text-zinc-500">({duration})</span>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {studioLabel(booking.studio_id)}
            </span>
            <span className="text-zinc-400">{groupTypeLabel(booking.group_type, { long: true })}</span>
          </p>
          <p className="mt-2 font-mono text-sm text-zinc-400">{booking.booking_ref}</p>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-400 underline-offset-2 hover:text-white hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            {STUDIO_ADDRESS}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
          <PaymentBadge payment={payment} />
          {amount !== null && <span className="text-white font-bold"><Price amount={amount} /></span>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <CalendarActions booking={booking} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/20 text-white hover:bg-white/10"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? "Masquer le détail" : "Voir le détail"}
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>
      {expanded && <BookingDetails booking={booking} className="mt-5 border-t border-white/10 pt-5" />}
    </section>
  );
}

function BookingCard({
  booking,
  expanded,
  onToggle,
}: {
  booking: BookingRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = getStatusTone(booking);
  const payment = getPaymentView(booking);
  const amount = getBookingDueAmount(booking);
  const isPast = isPastBooking(booking, getParisDateISO());

  return (
    <article className={`bg-zinc-900/50 border rounded-2xl p-5 transition-all duration-200 ${isPast ? "border-zinc-800/50" : "border-zinc-800 hover:border-zinc-700"}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <div className={`h-14 w-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPast ? "bg-zinc-800/50" : "bg-primary/10"}`}>
            <span className={`text-xs font-medium ${isPast ? "text-zinc-500" : "text-primary/70"}`}>{getDayName(booking.date)}</span>
            <span className={`text-lg font-bold leading-tight ${isPast ? "text-zinc-400" : "text-white"}`}>{formatShortDate(booking.date).split(" ")[0]}</span>
          </div>
          <div className="hidden lg:block h-10 w-px bg-zinc-800" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">{formatDateFR(booking.date)}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {booking.start_time} — {booking.end_time}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-400 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              {studioLabel(booking.studio_id)}
            </span>
            <span className="flex items-center gap-1">
              {groupTypeLabel(booking.group_type)}
            </span>
            {booking.band_name && (
              <span className="flex items-center gap-1">
                <Music className="h-3.5 w-3.5 text-zinc-500" />
                {booking.band_name}
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono text-xs text-zinc-500">{booking.booking_ref}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
          <PaymentBadge payment={payment} />
          {amount !== null && <span className="text-white font-bold text-sm ml-1"><Price amount={amount} /></span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isPast && <CalendarActions booking={booking} />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? "Masquer le détail" : "Voir le détail"}
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>
      {expanded && <BookingDetails booking={booking} className="mt-4 border-t border-zinc-800 pt-4" />}
    </article>
  );
}

function CalendarActions({ booking }: { booking: BookingRow }) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        onClick={() => addToCalendar(booking, "ics")}
      >
        <Download className="h-4 w-4 mr-2" />
        Ajouter au calendrier
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        onClick={() => addToCalendar(booking, "google")}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Google Agenda
      </Button>
    </>
  );
}

function PaymentBadge({ payment }: { payment: ReturnType<typeof getPaymentView> }) {
  if (!shouldShowDisplayPaymentStatus(payment.status)) return null;
  const className = `text-xs font-medium px-3 py-1.5 rounded-full border ${payment.bg} ${payment.text} ${payment.border}`;
  if (payment.status === "paid-before-cancel") {
    return (
      <a href={PAYMENT_STATUS_FAQ_HREF} className={`${className} underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80`}>
        {payment.label}
      </a>
    );
  }
  return <span className={className}>{payment.label}</span>;
}

function RecapLine({ label, amount, tone }: { label: string; amount?: number; tone?: "muted" | "discount" }) {
  return (
    <div className={`flex items-center justify-between gap-4 text-sm ${tone === "discount" ? "text-emerald-400" : tone === "muted" ? "text-zinc-400" : "text-zinc-200"}`}>
      <span className="min-w-0">{label}</span>
      {amount != null && (
        <span className="shrink-0 tabular-nums">{tone === "discount" ? "-" : ""}<Price amount={amount} bare /></span>
      )}
    </div>
  );
}

function BookingDetails({ booking, className }: { booking: BookingRow; className?: string }) {
  const duration = formatDuration(booking.start_time, booking.end_time);
  const equipment = resolveEquipmentDisplay(booking.equipment, booking.equipment_price ?? 0);
  const amount = getBookingDueAmount(booking);
  const studioPrice = Number(booking.base_price) || Math.max(0, (Number(booking.total_price) || 0) - (Number(booking.equipment_price) || 0));
  const discount = Number(booking.promo_discount) || 0;
  const studioName = studioLabel(booking.studio_id);

  return (
    <div className={className}>
      <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Récapitulatif</p>
        <div className="mt-3 space-y-2">
          <RecapLine
            label={duration ? `${studioName} · ${duration}` : studioName}
            amount={studioPrice}
          />
          {equipment.lines.map((line) => (
            <RecapLine
              key={`${line.id}-${line.quantity}`}
              label={`${line.name} ×${line.quantity}`}
              amount={equipment.showLinePrices && typeof line.lineTotal === "number" ? line.lineTotal : undefined}
              tone="muted"
            />
          ))}
          {!equipment.showLinePrices && equipment.subtotal > 0 && (
            <RecapLine label="Options" amount={equipment.subtotal} tone="muted" />
          )}
          {discount > 0 && (
            <RecapLine
              label={booking.promo_code ? `Remise (${booking.promo_code})` : "Remise"}
              amount={discount}
              tone="discount"
            />
          )}
        </div>
        {amount !== null && (
          <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
            <TaxBreakdown ttc={amount} />
            <div className="flex items-center justify-between gap-4 pt-1 text-sm font-semibold text-white">
              <span>Total TTC</span>
              <span className="tabular-nums"><Price amount={amount} bare /></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
