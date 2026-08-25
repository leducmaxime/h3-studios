import type { BookingStatus } from "@/lib/db-types";
import type { StudioId } from "@/lib/booking";

export type BookingsDateFilter = "all" | "today" | "week" | "month" | "upcoming" | "past" | "custom";
export type BookingsPaymentFilter = "all" | "paid" | "remaining" | "on-site-due";
export type BookingsStatusFilter = BookingStatus | "all" | "not-cancelled";
export type BookingsDateDirectionFilter = "upcoming" | "past" | "";

export function parseBookingsSearch(search?: string) {
  const params = new URLSearchParams(search?.startsWith("?") ? search.slice(1) : search ?? "");
  const dateFrom = dateQueryParam(params, "dateFrom");
  const dateTo = dateFrom ? dateQueryParam(params, "dateTo") : "";
  const dateDirectionRaw = params.get("dateDirection");
  const dateDirection: BookingsDateDirectionFilter =
    dateDirectionRaw === "upcoming" || dateDirectionRaw === "past" ? dateDirectionRaw : "";
  const status = params.get("status");
  const payment = params.get("payment");
  const studio = params.get("studio");

  let dateFilter: BookingsDateFilter = "upcoming";
  if (dateFrom) dateFilter = "custom";
  else if (dateDirection === "upcoming") dateFilter = "upcoming";
  else if (dateDirection === "past") dateFilter = "past";

  return {
    statusFilter: (
      status === "confirmed" || status === "completed" || status === "cancelled" || status === "no-show" || status === "not-cancelled"
        ? status
        : "all"
    ) as BookingsStatusFilter,
    studioFilter: (studio === "la-scene" || studio === "le-podium" ? studio : "all") as StudioId | "all",
    dateFilter,
    customDateFrom: dateFrom,
    customDateTo: dateTo,
    extraDateDirection: (dateFrom ? dateDirection : "") as BookingsDateDirectionFilter,
    paymentStatusFilter: (
      payment === "paid" || payment === "remaining" || payment === "on-site-due" ? payment : "all"
    ) as BookingsPaymentFilter,
  };
}

function dateQueryParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
