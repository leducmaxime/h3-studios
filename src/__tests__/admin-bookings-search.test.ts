import { describe, expect, it } from "vitest";
import { parseBookingsSearch } from "@/lib/admin-bookings-search";

describe("parseBookingsSearch", () => {
  it("recovers the dashboard on-site-due deep link", () => {
    expect(parseBookingsSearch("?payment=on-site-due&dateFrom=2026-08-01&dateTo=2026-08-31&dateDirection=upcoming")).toEqual({
      statusFilter: "all",
      studioFilter: "all",
      dateFilter: "custom",
      customDateFrom: "2026-08-01",
      customDateTo: "2026-08-31",
      extraDateDirection: "upcoming",
      paymentStatusFilter: "on-site-due",
    });
  });

  it("reads status and date range from the reservations card", () => {
    expect(parseBookingsSearch("status=not-cancelled&dateFrom=2026-08-01&dateTo=2026-08-31")).toMatchObject({
      statusFilter: "not-cancelled",
      dateFilter: "custom",
      customDateFrom: "2026-08-01",
      customDateTo: "2026-08-31",
      extraDateDirection: "",
    });
  });

  it("uses dateDirection when no custom range is present", () => {
    expect(parseBookingsSearch("dateDirection=upcoming")).toMatchObject({
      dateFilter: "upcoming",
      extraDateDirection: "",
    });
  });
});
