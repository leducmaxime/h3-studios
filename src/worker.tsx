import { render, route, layout } from "rwsdk/router";
import { bookingAllowsCollection, getBookingAmountDue, getBookingBalance, getBookingGrossTotal, getManualDiscountBlockMessage } from "@/lib/booking-totals";
import { paymentMethodLabelShort, studioLabel } from "@/lib/labels";
import { CGV_NOT_ACCEPTED_CODE, CGV_NOT_ACCEPTED_ERROR, DEFAULT_CLIENT_TYPE, isAcceptedCgv, isClientType, resolvedDisplayName, isValidEmail, isValidRna, isValidSiret, normalizeRna, normalizeSiret, pruneToClientType, resolveBookingIdentity, resolveClientType, validateBookingUserFields, type BookingUserBody, type BookingUserFields } from "@/lib/booking-fields";
import { finalizePaidCheckoutSession, type FinalizePaidSessionDeps } from "@/lib/payment-confirmation";
import type { RouteMiddleware } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { env, waitUntil } from "cloudflare:workers";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { MainLayout } from "@/app/layouts/MainLayout";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import { Home } from "@/app/pages/Home";
import { LesStudios } from "@/app/pages/LesStudios";
import { LeMateriel } from "@/app/pages/LeMateriel";
import { Tarifs } from "@/app/pages/Tarifs";
import { Reservation } from "@/app/pages/Reservation";
import { APropos } from "@/app/pages/APropos";
import { Avis } from "@/app/pages/Avis";
import { Equipe } from "@/app/pages/Equipe";
import { Actualites } from "@/app/pages/Actualites";
import { MentionsLegales } from "@/app/pages/MentionsLegales";
import { PolitiqueConfidentialite } from "@/app/pages/PolitiqueConfidentialite";
import { ConditionsVente } from "@/app/pages/ConditionsVente";
import { generateSitemap, generateRobotsTxt } from "@/app/seo";
import { AdminDashboard } from "@/app/pages/admin/Dashboard";
import { AdminCalendar } from "@/app/pages/admin/Calendar";
import { AdminBookings } from "@/app/pages/admin/Bookings";
import { AdminBookingDetail } from "@/app/pages/admin/BookingDetail";
import { AdminBlockedSlots } from "@/app/pages/admin/BlockedSlots";
import { AdminUsers } from "@/app/pages/admin/Users";
import { AdminUserDetail } from "@/app/pages/admin/UserDetail";
import { AdminPayments } from "@/app/pages/admin/Payments";
import { AdminEquipements } from "@/app/pages/admin/Equipements";
import { AdminPricing } from "@/app/pages/admin/Pricing";
import { AdminSettings } from "@/app/pages/admin/Settings";
import { AdminAuditLog } from "@/app/pages/admin/AuditLog";
import { AdminBookingNew } from "@/app/pages/admin/BookingNew";
import { Login } from "@/app/pages/admin/Login";
import { AdminForgotPassword } from "@/app/pages/admin/AdminForgotPassword";
import { AdminResetPassword } from "@/app/pages/admin/AdminResetPassword";
import { PaymentSuccess } from "@/app/pages/PaymentSuccess";
import { PaymentCancel } from "@/app/pages/PaymentCancel";
import { ClientLogin } from "@/app/pages/ClientLogin";
import { ClientAccount } from "@/app/pages/ClientAccount";
import { ClientProfile } from "@/app/pages/ClientProfile";
import { ForgotPassword } from "@/app/pages/ForgotPassword";
import { ResetPassword } from "@/app/pages/ResetPassword";
import { createCheckoutSession, retrieveCheckoutSession, constructWebhookEvent, type StripeCheckoutSession } from "@/lib/stripe";
import { DEFAULT_MATERIEL, parseMaterielSetting } from "@/lib/materiel";
import { sendBookingCancellationEmail, sendBookingConfirmationEmail, sendPasswordResetEmail, type BookingConfirmationData, type BookingSlot } from "@/lib/email";
import {
  type AdminRole,
  verifyPassword,
  hashPassword,
  createSession,
  validateSession,
  deleteSession,
  requireAuth,
  buildSessionCookie,
  clearSessionCookie,
  generateToken,
  generateId,
} from "@/lib/auth";
import {
  createClientSession,
  validateClientSession,
  deleteClientSession,
  buildClientSessionCookie,
  clearClientSessionCookie,
  getClientSessionToken,
  requireClientAuth,
} from "@/lib/client-auth";
import {
  getBookings,
  getBookingById,
  getBookingByRef,
  createBooking,
  updateBooking,
  getBookingsByDate,
  getBookingsByDateRange,
  checkConflict,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  blockUser,
  mergeUsers,
  getPayments,
  getPaymentsByBookingId,
  getPaymentById,
  addPayment,
  markPaymentPaid,
  refundPayment,
  updatePayment,
  deletePayment,
  recomputeBookingPaymentStatus,
  recomputePaymentRefundState,
  upsertPaymentRefund,
  getBlockedSlots,
  getBlockedSlotsByDateRange,
  addBlockedSlot,
  removeBlockedSlot,
  checkBlockedSlotConflict,
  getPricing,
  updatePricing,
  getPricingForBooking,
  getEquipment,
  updateEquipment,
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  validatePromoCode,
  getOpeningHours,
  updateOpeningHours,
  getAllSettings,
  getOrphanedBookings,
  deleteOrphanedBookings,
  setSetting,
  addAuditLog,
  getAuditLogs,
  getDashboardStats,
  getMonthlyReportData,
  getSetting,
  claimPaymentConfirmation,
  getPaymentConfirmation,
  claimPaymentConfirmationEmail,
  releasePaymentConfirmationEmail,
  addPaymentIdempotent,
  getUserByEmail,
  findOrCreateUserByEmail,
  getBookingsByRefs,
  resolveStatsRange,
} from "@/lib/db";
import { refundCardPayment, refundPayments } from "@/lib/refunds";
import { type BookingFilters, type AuditLogFilters, type DbBooking, type DbOpeningHours } from "@/lib/db-types";

import { ALL_TIME_SLOTS, STUDIO_HOURS, getStudioTimeSlots, setOpeningHours, computeBookingQuote, parseBookingEquipmentLines, computeMinAdvance, isMinAdvanceViolation, parseMinAdvanceHours, parseAllowCash, isCashPaymentForbidden, type StudioId, type GroupType, type QuoteEquipmentItem, type QuoteEquipmentCatalogueItem } from "@/lib/booking";
import { computeEquipmentAvailability } from "@/lib/booking";
import { getOfferedUnits } from "@/lib/equipment-pricing";
import {
  getParisDateISO,
  getParisNow,
  getISOWeekStartUTCNoon,
  parseDbTimestamp,
} from "@/lib/utils";
import {
  getStoredReviews,
  getReviewsSyncData,
  syncGoogleReviews,
} from "@/lib/google-reviews";
import {
  fetchInstagramFeedFromAPI,
  fetchInstagramFeedFromRSS,
  getCachedInstagramFeed,
  getInstagramToken,
  INSTAGRAM_LONG_LIVED_TOKEN_SECONDS,
  INSTAGRAM_TOKEN_EXPIRES_AT_SETTING,
  INSTAGRAM_TOKEN_REFRESHED_AT_SETTING,
  persistInstagramToken,
  refreshAndPersistInstagramToken,
  syncInstagram,
} from "@/lib/instagram";
import { isAllowedInstagramMediaUrl } from "@/lib/instagram-media";

const DocumentWithPath = ({
  children,
  path,
  nonce,
}: {
  children: React.ReactNode;
  path: string;
  nonce?: string;
}) => (
  <Document path={path} nonce={nonce}>
    {children}
  </Document>
);

function getSlotsForBooking(start: string, end: string): string[] {
  const startIdx = ALL_TIME_SLOTS.indexOf(start);
  let endIdx = ALL_TIME_SLOTS.indexOf(end);
  if (endIdx === -1 && end === "00:00") endIdx = ALL_TIME_SLOTS.length;
  if (startIdx === -1 || endIdx === -1) return [];
  return ALL_TIME_SLOTS.slice(startIdx, endIdx);
}

function buildOpeningHoursMap(dbHours: DbOpeningHours[]): Record<string, Record<number, { open: string; close: string }>> {
  const map: Record<string, Record<number, { open: string; close: string }>> = {};
  for (const h of dbHours) {
    if (!map[h.studio_id]) map[h.studio_id] = {};
    map[h.studio_id][h.day_of_week] = { open: h.open_time, close: h.close_time };
  }
  return map;
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function jsonSuccess(data: unknown): Response {
  return jsonResponse({ success: true, data });
}

function jsonError(error: string, status = 400): Response {
  return jsonResponse({ success: false, error }, status);
}

function validateAdminSettingValue(key: string, rawValue: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = rawValue.trim();

  const parseIntSetting = (opts: { label: string; min: number; max: number }) => {
    if (value === "") {
      return { ok: false as const, error: `${opts.label}: valeur obligatoire` };
    }
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || String(n) !== value) {
      return { ok: false as const, error: `${opts.label}: valeur invalide` };
    }
    if (n < opts.min || n > opts.max) {
      return { ok: false as const, error: `${opts.label}: valeur hors limites (${opts.min}-${opts.max})` };
    }
    return { ok: true as const, value: String(n) };
  };

  const parseNumberSetting = (opts: { label: string; min: number; max: number }) => {
    if (value === "") {
      return { ok: false as const, error: `${opts.label}: valeur obligatoire` };
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return { ok: false as const, error: `${opts.label}: valeur invalide` };
    }
    if (n < opts.min || n > opts.max) {
      return { ok: false as const, error: `${opts.label}: valeur hors limites (${opts.min}-${opts.max})` };
    }
    return { ok: true as const, value };
  };

  const parseBooleanSetting = (opts: { label: string }) => {
    if (value !== "true" && value !== "false") {
      return { ok: false as const, error: `${opts.label}: valeur invalide` };
    }
    return { ok: true as const, value };
  };

  switch (key) {
    case "cancellation.free_period_hours":
      return parseIntSetting({ label: "Délai d'annulation", min: 0, max: 168 });
    case "cancellation.fee_per_hour_eur":
      return parseNumberSetting({ label: "Frais d'annulation", min: 0, max: 500 });
    case "billing.vat_percent":
      return parseNumberSetting({ label: "TVA", min: 0, max: 30 });
    case "billing.payment_terms_days":
      return parseIntSetting({ label: "Conditions de paiement", min: 0, max: 120 });
    case "booking.min_advance_hours":
      return parseIntSetting({ label: "Délai minimum de réservation", min: 0, max: 72 });
    case "booking.max_advance_days":
      return parseIntSetting({ label: "Délai maximum de réservation", min: 1, max: 365 });
    case "booking.allow_cash":
      return parseBooleanSetting({ label: "Paiement sur place" });
    case "booking.require_phone":
      return { ok: false, error: "Ce réglage n'existe plus : le téléphone est toujours obligatoire." };
    case "promo_codes.enabled":
      return parseBooleanSetting({ label: "Activation des codes promo" });
    case "maintenance.enabled":
      return parseBooleanSetting({ label: "Mode maintenance" });
    case "maintenance.message":
      if (value.length > 500) {
        return { ok: false, error: "Message maintenance: trop long (max 500 caractères)" };
      }
      return { ok: true, value };
    default:
      return { ok: true, value: rawValue };
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const SUPER_ADMIN_ROUTE_PREFIXES = [
  "/api/admin/pricing",
  "/api/admin/equipment",
  "/api/admin/materiel",
  "/api/admin/promo-codes",
  "/api/admin/settings",
  "/api/admin/admin-users",
  "/api/admin/opening-hours",
  "/api/admin/public-holidays",
  "/api/admin/instagram",
  "/admin/studios",
  "/admin/equipements",
  "/admin/pricing",
  "/admin/settings",
  "/admin/audit-log",
  "/api/admin/audit",
];

const AUTH_EXCLUDED_PATHS = [
  "/api/admin/login",
  "/admin/login",
  "/api/admin/forgot-password",
  "/api/admin/reset-password",
  "/admin/mot-de-passe-oublie",
  "/admin/reinitialiser",
];

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isAuthExcluded(pathname: string): boolean {
  return AUTH_EXCLUDED_PATHS.some((path) => pathname === path);
}

function isSuperAdminRoute(pathname: string): boolean {
  return SUPER_ADMIN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/admin");
}

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === "h3_session") {
      return valueParts.join("=");
    }
  }
  return null;
}

const adminAuthMiddleware = (): RouteMiddleware =>
  async (rInfo) => {
    const { request } = rInfo;
    const url = new URL(request.url);
    const { pathname } = url;

    if (!isAdminPath(pathname)) return;
    if (isAuthExcluded(pathname)) return;

    const sessionId = getSessionToken(request);

    if (!sessionId) {
      if (isApiRoute(pathname)) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return Response.redirect(new URL("/admin/login", request.url).toString(), 302);
    }

    const user = await validateSession(env.DB, sessionId);

    if (!user) {
      if (isApiRoute(pathname)) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return Response.redirect(new URL("/admin/login", request.url).toString(), 302);
    }

    if (isSuperAdminRoute(pathname) && user.role !== "super-admin") {
      if (isApiRoute(pathname)) {
        return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      return Response.redirect(new URL("/admin", request.url).toString(), 302);
    }

    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set("X-Admin-User-Id", user.id);
    modifiedHeaders.set("X-Admin-User-Email", user.email);
    modifiedHeaders.set("X-Admin-User-Role", user.role);
    modifiedHeaders.set("X-Admin-User-Name", user.name);
    rInfo.request = new Request(request, { headers: modifiedHeaders });
  };

const app = defineApp([
  setCommonHeaders(),
  adminAuthMiddleware(),
  
  // Client auth middleware: redirect unauthenticated users on /mon-compte/* (except /mon-compte/connexion)
  async (rInfo) => {
    const { request } = rInfo;
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith("/mon-compte")) return;
    if (pathname === "/mon-compte/connexion") return;
    if (pathname === "/mon-compte/mot-de-passe-oublie") return;
    if (pathname === "/mon-compte/reinitialiser") return;
    if (pathname.startsWith("/api/client")) return;

    const token = getClientSessionToken(request);
    if (!token) {
      return Response.redirect(new URL("/mon-compte/connexion", request.url).toString(), 302);
    }

    const user = await validateClientSession(env.DB, token);
    if (!user) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/mon-compte/connexion" },
      });
    }
  },
  
  route("/sitemap.xml", () => {
    return new Response(generateSitemap(), {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }),
  
  route("/robots.txt", () => {
    return new Response(generateRobotsTxt(), {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  }),

  render(({ children, rw }) => <DocumentWithPath path="/" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/", Home),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/les-studios" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/les-studios", LesStudios),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/le-materiel" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/le-materiel", LeMateriel),
    ]),
  ]),

  route("/tarifs-et-reservation", () => {
    return new Response(null, {
      status: 301,
      headers: { Location: "/tarifs" },
    });
  }),

  render(({ children, rw }) => <DocumentWithPath path="/tarifs" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/tarifs", Tarifs),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/reservation" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/reservation", () => <Reservation />),
      route("/reservation/:step", ({ params }) => <Reservation step={params.step} />),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/a-propos" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/a-propos", APropos),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/avis" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/avis", Avis),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/equipe" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/equipe", Equipe),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/actualites" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/actualites", Actualites),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/mentions-legales" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mentions-legales", MentionsLegales),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/politique-confidentialite" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/politique-confidentialite", PolitiqueConfidentialite),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/conditions-de-vente" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/conditions-de-vente", ConditionsVente),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/admin/login" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    route("/admin/login", Login),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/admin/mot-de-passe-oublie" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    route("/admin/mot-de-passe-oublie", AdminForgotPassword),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/admin/reinitialiser" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    route("/admin/reinitialiser", AdminResetPassword),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/admin" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(AdminLayout, [
      route("/admin", AdminDashboard),
      route("/admin/calendar", AdminCalendar),
      route("/admin/bookings", AdminBookings),
      route("/admin/bookings/new", AdminBookingNew),
      route("/admin/bookings/:id", ({ params }) => <AdminBookingDetail bookingId={params.id} />),
      route("/admin/blocked-slots", AdminBlockedSlots),
      route("/admin/users", AdminUsers),
      route("/admin/users/:id", ({ params }) => <AdminUserDetail userId={params.id} />),
      route("/admin/payments", AdminPayments),
      route("/admin/equipements", AdminEquipements),
      route("/admin/studios", () => new Response(null, { status: 301, headers: { Location: "/admin/equipements" } })),
      route("/admin/pricing", AdminPricing),
      route("/admin/settings", AdminSettings),
      route("/admin/audit-log", AdminAuditLog),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/payment" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/payment/success", () => <PaymentSuccess />),
      route("/payment/cancel", () => <PaymentCancel />),
    ]),
  ]),

  route("/api/payment/create", async (info) => {
    const { request } = info;

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        firstName: string;
        lastName: string;
        email: string;
        bookingRefs: string[];
      };

      if (!body.bookingRefs || body.bookingRefs.length === 0) {
        return new Response(JSON.stringify({ error: "No booking references provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Look up bookings server-side — never trust client-supplied amount
      const bookings = [];
      for (const ref of body.bookingRefs) {
        const booking = await getBookingByRef(env.DB, ref);
        if (!booking) {
          return new Response(JSON.stringify({ error: `Booking not found: ${ref}` }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        bookings.push(booking);
      }
      const totalCents = bookings.reduce((sum, b) => sum + Math.round(getBookingAmountDue(b) * 100), 0);

      const secretKey = env.STRIPE_SECRET_KEY || "";
      if (!secretKey) {
        return new Response(JSON.stringify({ error: "Stripe not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const baseUrl = new URL(request.url).origin;

      const session = await createCheckoutSession(secretKey, {
        amountCents: totalCents,
        customerEmail: body.email,
        customerName: `${body.firstName} ${body.lastName}`,
        bookingRefs: body.bookingRefs,
        successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/payment/cancel`,
      });

      return new Response(JSON.stringify({
        sessionId: session.id,
        paymentUrl: session.url,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Payment creation error:", error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Payment creation failed"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),

  route("/api/payment/session", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const sessionId = url.searchParams.get("session_id");

      // Strict, length-capped Stripe Checkout Session ID format
      if (!sessionId || sessionId.length > 200 || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
        return jsonError("Not found", 404);
      }

      const secretKey = env.STRIPE_SECRET_KEY || "";
      if (!secretKey) {
        return jsonError("Not found", 404);
      }

      // Retrieve server-side — never trust refs/email/total from the client
      const session = await retrieveCheckoutSession(secretKey, sessionId);

      // Only refs authenticated by Stripe metadata
      const refs = [...new Set((session.metadata?.booking_refs || "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean))];

      if (refs.length === 0) {
        return jsonError("Not found", 404);
      }

      const bookings = await getBookingsByRefs(env.DB, refs);
      if (bookings.length !== refs.length) {
        return jsonError("Not found", 404);
      }

      const email = session.customer_email || session.metadata?.customer_email || "";
      const payload: Record<string, unknown> = {
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total ?? 0,
        bookings: bookings.map((b) => ({
          ref: b.booking_ref,
          studioId: b.studio_id,
          date: b.date,
          startTime: b.start_time,
          endTime: b.end_time,
          groupType: b.group_type,
          equipment: parseBookingEquipmentLines(b.equipment),
          equipmentPrice: b.equipment_price,
          totalPrice: b.total_price,
          promoCode: b.promo_code,
          promoDiscount: b.promo_discount,
        })),
      };
      if (email) {
        payload.email = email;
      }

      // Flux de récupération : si le webhook a été manqué/retardé, finalise ici
      // (idempotent, exactement un email par session). Ne finalise jamais une
      // session non payée ni une réservation annulée (audit dans ce cas).
      if (session.payment_status === "paid" && refs.length > 0) {
        const finalizePromise = finalizePaidCheckoutSession(session, refs, buildFinalizeDeps())
          .then((outcome) => {
            console.log(`Payment session ${session.id} recovery finalize outcome:`, outcome.status);
          })
          .catch((err) => {
            console.error(`Payment session ${session.id} recovery finalize error:`, err);
          });
        waitUntil(finalizePromise);
      }

      return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
    } catch {
      // Uniform 404 — never leak Stripe/DB error detail
      return jsonError("Not found", 404);
    }
  }),

  route("/api/contact", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as {
        name?: string;
        email?: string;
        subject?: string;
        message?: string;
      };

      if (!body.name || !body.email || !body.subject || !body.message) {
        return jsonError("Tous les champs sont obligatoires", 400);
      }

      if (!env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY not configured");
        return jsonError("Service d'email non configuré", 500);
      }

      const emailHtml = `
        <h2>Nouveau message de contact</h2>
        <p><strong>Nom :</strong> ${body.name}</p>
        <p><strong>Email :</strong> ${body.email}</p>
        <p><strong>Objet :</strong> ${body.subject}</p>
        <p><strong>Message :</strong></p>
        <p>${body.message.replace(/\n/g, "<br>")}</p>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "H3 Studios <contact@h3-studios.fr>",
          to: "contact@h3-studios.fr",
          subject: `[Contact] ${body.subject}`,
          html: emailHtml,
          reply_to: body.email,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error("Resend API error:", errorData);
        return jsonError(`Échec de l'envoi de l'email: ${errorData}`, 500);
      }

      return jsonSuccess({ sent: true });
    } catch (error) {
      console.error("POST /api/contact error:", error);
      return jsonError(error instanceof Error ? error.message : "Contact form failed", 500);
    }
  }),

  // ─── Public Status API ───────────────────────────────────────────────────────

  route("/api/status", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    const maintenance = await getSetting(env.DB, "site.maintenance_mode");
    return jsonSuccess({ maintenanceMode: maintenance === "true" });
  }),

  // ─── Public Booking API ──────────────────────────────────────────────────────

  route("/api/availability", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      if (!date) return jsonError("Date requise", 400);

      const excludeBookingId = url.searchParams.get("excludeBookingId");
      const bookings = (await getBookingsByDate(env.DB, date)).filter((b) => b.id !== excludeBookingId);
      const blockedSlots = await getBlockedSlots(env.DB, undefined, date);
      const bookingDate = new Date(date + "T00:00:00");

      // Load DB-driven opening hours so admin edits apply to slot availability
      setOpeningHours(buildOpeningHoursMap(await getOpeningHours(env.DB)));

      // Build per-studio, per-slot occupant map
      const occupantMap: Record<string, Record<string, { groupType: string; bookingId?: string } | null>> = {
        "la-scene": {},
        "le-podium": {},
      };

      for (const b of bookings) {
        const slots = getSlotsForBooking(b.start_time, b.end_time);
        for (const time of slots) {
          occupantMap[b.studio_id][time] = { groupType: b.group_type, bookingId: b.id };
        }
      }

      for (const s of blockedSlots) {
        const slots = getSlotsForBooking(s.start_time, s.end_time);
        const targetStudios = s.studio_id ? [s.studio_id] : ["la-scene", "le-podium"];
        for (const studioId of targetStudios) {
          for (const time of slots) {
            occupantMap[studioId][time] = { groupType: "blocked" };
          }
        }
      }

      // Build per-studio slot availability
      const result: Record<string, Array<{ time: string; available: boolean; groupType?: string; bookingId?: string }>> = {};

      for (const studioId of ["la-scene", "le-podium"] as StudioId[]) {
        const studioSlots = getStudioTimeSlots(studioId, bookingDate);
        result[studioId] = studioSlots.map((time) => {
          const occupant = occupantMap[studioId][time];
          if (!occupant) return { time, available: true };
          return { time, available: false, groupType: occupant.groupType, bookingId: occupant.bookingId };
        });
      }

      // Compute min_advance info (today only)
      const paris = getParisNow();
      let minAdvanceHours = 0;
      let minAdvanceCutoffTime: string | null = null;
      let todayFullyBlocked = false;
      if (date === paris.dateISO) {
        minAdvanceHours = parseMinAdvanceHours(await getSetting(env.DB, "booking.min_advance_hours"));
        ({ cutoffTime: minAdvanceCutoffTime, fullyBlocked: todayFullyBlocked } = computeMinAdvance(paris, minAdvanceHours));
      }

      return jsonSuccess({ slots: result, minAdvanceHours, minAdvanceCutoffTime, todayFullyBlocked });
    } catch (error) {
      console.error("GET /api/availability error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch availability", 500);
    }
  }),

  route("/api/equipment-availability", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const studioId = url.searchParams.get("studioId") || undefined;
      const excludeBookingId = url.searchParams.get("excludeBookingId");
      const validDate = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
      const validTime = (v: string | null) => !!v && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
      if (!validDate || !validTime(start) || !validTime(end)) return jsonError("Date et horaires invalides", 400);
      const [catalogue, rawBookings] = await Promise.all([getEquipment(env.DB), getBookingsByDate(env.DB, date!)]);
      const bookings = rawBookings.filter((b) => b.id !== excludeBookingId).map((b) => ({
        startTime: b.start_time, endTime: b.end_time, status: b.status, studioId: b.studio_id,
        equipment: b.equipment,
      }));
      return jsonSuccess({ items: catalogue.map((eq) => {
        const result = computeEquipmentAvailability({
          stockTotal: eq.stock_total, equipmentId: eq.equipment_id,
          requested: { startTime: start!, endTime: end! }, requestedStudioId: studioId, bookings,
        });
        return { id: eq.equipment_id, stockTotal: eq.stock_total, maxPerSession: eq.max_per_session,
          reserved: result.reserved, available: result.available, reservedOnOtherStudio: result.reservedOnOtherStudio };
      }) });
    } catch (error) {
      console.error("GET /api/equipment-availability error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch equipment availability", 500);
    }
  }),

  route("/api/bookings", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as {
        bookingRef: string;
        userId?: string;
        user: {
          clientType?: string | null;
          legalName?: string | null;
          siret?: string | null;
          rna?: string | null;
          instagramAccounts?: string | null;
          name: string;
          email: string;
          phone: string;
          bandName: string;
          addressLine1?: string;
          postalCode?: string;
          city?: string;
        };
        studioId: string;
        date: string;
        startTime: string;
        endTime: string;
        groupType: string;
        equipment: Array<{ id: string; quantity: number }>;
        equipmentPrice: number;
        price: number;
        paymentMethod: string;
        paymentStatus: string;
        promoCode?: string;
        round_mode?: "down" | "up" | "none";
        promoDiscount?: number;
        notes?: string;
        cartBookingRefs?: string[];
        isLastInCart?: boolean;
        createAccount?: boolean;
        accountPassword?: string;
        acceptedCgv?: boolean;
      };

      // Syntactic validation must precede identity resolution and all DB writes.
      if (!isAcceptedCgv(body.acceptedCgv)) {
        return jsonResponse({ success: false, error: CGV_NOT_ACCEPTED_ERROR, code: CGV_NOT_ACCEPTED_CODE }, 400);
      }
      const validStudios = ["la-scene", "le-podium"];
      const validGroupTypes = ["solo", "duo", "group"];
      if (!validStudios.includes(body.studioId)) return jsonError("Studio invalide", 400);
      if (!validGroupTypes.includes(body.groupType)) return jsonError("Type de groupe invalide", 400);
      if (body.paymentMethod !== "card" && body.paymentMethod !== "cash") return jsonError("Moyen de paiement invalide", 400);
      // Lu uniquement pour un paiement sur place : une réservation par carte
      // n'a pas besoin de ce réglage (isCashPaymentForbidden teste le mode
      // avant tout le reste).
      const allowCash = body.paymentMethod === "cash"
        ? parseAllowCash(await getSetting(env.DB, "booking.allow_cash"))
        : true;
      // Sans code promo, le net ne peut pas tomber à 0 : on refuse avant toute
      // écriture. Avec un code promo, seul le net calculé côté serveur tranche.
      if (body.paymentMethod === "cash" && !allowCash && !body.promoCode) {
        return jsonResponse({ success: false, error: "Le paiement sur place n'est plus disponible, réglez en ligne par carte.", code: "cash-not-allowed" }, 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return jsonError("Format de date invalide", 400);
      if (!/^\d{2}:\d{2}$/.test(body.startTime) || !/^\d{2}:\d{2}$/.test(body.endTime)) return jsonError("Format d'heure invalide", 400);
      // "00:00" = minuit/fin de journée, toujours après n'importe quelle heure
      if (body.endTime !== "00:00" && body.startTime >= body.endTime) return jsonError("L'heure de fin doit être après l'heure de début", 400);

      type AccountStatus = "authenticated" | "created" | "activation-email-sent" | "guest";
      // ── Identity resolution (Phase 5A: optional auth) ─────────────────────
      let userId: string;
      let accountStatus: AccountStatus;
      let newSessionToken: string | null = null;
      let guestWasCreated = false;

      // Optional session check
      const sessionToken = getClientSessionToken(request);
      let sessionUser: Awaited<ReturnType<typeof validateClientSession>> = null;
      if (sessionToken) {
        sessionUser = await validateClientSession(env.DB, sessionToken);
      }

      const clientType = resolveClientType(body.user?.clientType, sessionUser);
      if (!clientType) return jsonResponse({ success: false, error: "Type de client invalide.", code: "invalid-client-type" }, 400);
      const resolved = resolveBookingIdentity(body.user as BookingUserBody, sessionUser, clientType);
      const validation = validateBookingUserFields(resolved);
      if (!validation.ok) {
        return jsonResponse(
          { success: false, error: validation.error, code: "missing-fields", fields: validation.fields },
          400,
        );
      }

      const name = resolvedDisplayName(resolved);
      const email = resolved.email;
      const phone = resolved.phone;
      const bandNameRaw = resolved.bandName;
      const bookingBandName = bandNameRaw ? bandNameRaw : null;
      const addressLine1 = resolved.addressLine1;
      const postalCode = resolved.postalCode;
      const city = resolved.city;

      let authenticatedUserUpdates: Parameters<typeof updateUser>[2] | null = null;
      if (sessionUser) {
        // A) Authenticated user — use session identity, ignore body email for identity
        userId = sessionUser.id;
        accountStatus = "authenticated";

        const posted = {
          phone: body.user?.phone?.trim() || "",
          band_name: body.user?.bandName?.trim() || "",
          address_line1: body.user?.addressLine1?.trim() || "",
          postal_code: body.user?.postalCode?.trim() || "",
          city: body.user?.city?.trim() || "",
          client_type: resolved.clientType,
          legal_name: resolved.legalName,
          siret: resolved.siret,
          rna: resolved.rna,
          instagram_accounts: resolved.instagramAccounts,
        };
        const current = {
          phone: sessionUser.phone?.trim() || "",
          band_name: sessionUser.band_name?.trim() || "",
          address_line1: sessionUser.address_line1?.trim() || "",
          postal_code: sessionUser.postal_code?.trim() || "",
          city: sessionUser.city?.trim() || "",
          client_type: sessionUser.client_type?.trim() || "",
          legal_name: sessionUser.legal_name?.trim() || "",
          siret: sessionUser.siret?.trim() || "",
          rna: sessionUser.rna?.trim() || "",
          instagram_accounts: sessionUser.instagram_accounts?.trim() || "",
        };
        // D12: the v && v !== current filter prevents pruned empties clearing legal identity.
        const updates: Parameters<typeof updateUser>[2] = Object.fromEntries(
          Object.entries(posted).filter(([k, v]) => v && v !== current[k as keyof typeof current]),
        );
        if (Object.keys(updates).length > 0) authenticatedUserUpdates = updates;
      } else {
        // B) Guest: find-or-create user by normalized email
        const { user: guestUser, wasCreated } = await findOrCreateUserByEmail(env.DB, email, {
          name,
          phone,
          band_name: bandNameRaw || undefined,
          address_line1: addressLine1 || undefined,
          postal_code: postalCode || undefined,
          city: city || undefined,
          client_type: clientType,
          legal_name: resolved.legalName || undefined,
          siret: resolved.siret || undefined,
          rna: resolved.rna || undefined,
          instagram_accounts: resolved.instagramAccounts || undefined,
        });

        userId = guestUser.id;
        guestWasCreated = wasCreated;
        accountStatus = "guest";

        // Guest with an existing password_hash → has a real account, must log in
        if (!wasCreated && guestUser.password_hash) {
          return jsonResponse(
            { success: false, error: "Un compte existe avec cet email. Connectez-vous pour réserver.", code: "account-exists" },
            409,
          );
        }

        if (guestUser.is_blocked) {
          return jsonError("Votre compte a été bloqué. Veuillez nous contacter pour plus d'informations.", 403);
        }
      }

      // Idempotence FIRST — before any side effect (activation email) or
      // conflict check: a retry of an already-created bookingRef must return
      // the existing booking, not self-conflict with its own row.
      const existingByRef = await getBookingByRef(env.DB, body.bookingRef);
      if (existingByRef) {
        if (existingByRef.user_id === userId) {
          return jsonSuccess({ ...existingByRef, accountStatus });
        }
        return jsonResponse(
          { success: false, error: "Référence de réservation déjà utilisée", code: "booking-ref-conflict" },
          409,
        );
      }

      if (sessionUser && (!sessionUser.email?.trim() || !isValidEmail(sessionUser.email)) && resolved.email) {
        const existing = await getUserByEmail(env.DB, resolved.email);
        if (existing && existing.id !== sessionUser.id) {
          return jsonResponse(
            { success: false, error: "Cet email est déjà utilisé par un autre compte." },
            409,
          );
        }
        authenticatedUserUpdates = {
          ...(authenticatedUserUpdates ?? {}),
          email: resolved.email,
        };
      }

      if (authenticatedUserUpdates) {
        await updateUser(env.DB, userId, authenticatedUserUpdates);
      }

      // Guest account activation — only for genuinely new bookings
      if (!sessionUser) {
        if (guestWasCreated && body.createAccount && body.accountPassword && body.accountPassword.length >= 8) {
          // Newly created user + createAccount + valid password → set password + create session
          const passwordHash = await hashPassword(body.accountPassword);
          await updateUserPassword(env.DB, userId, passwordHash);
          const token = await createClientSession(env.DB, userId);
          newSessionToken = token;
          accountStatus = "created";
        } else if (!guestWasCreated && body.createAccount) {
          // Pre-existing user (guest or activated) + createAccount → password-reset email
          try {
            const resetToken = generateToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            await env.DB
              .prepare("INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
              .bind(`prt-booking-${generateId()}`, userId, resetToken, expiresAt)
              .run();
            const resetUrl = new URL(`/mon-compte/reinitialiser?token=${resetToken}`, request.url).toString();
            if (env.RESEND_API_KEY) {
              await sendPasswordResetEmail(
                env.RESEND_API_KEY,
                email,
                name,
                resetUrl,
                "Créez votre mot de passe H3 Studios",
              );
            }
          } catch (e) {
            console.error("Failed to send activation email:", e);
            // Non-blocking: continue regardless of email failure
          }
          accountStatus = "activation-email-sent";
        } else {
          // Just a guest — no account creation requested or password too short
          accountStatus = "guest";
        }
      }

      // ── Check for conflicts ──────────────────────────────────────────────
      const conflict = await checkConflict(env.DB, body.studioId, body.date, body.startTime, body.endTime);
      if (conflict) {
        return jsonError("Ce créneau n'est plus disponible", 409);
      }

      // Check for blocked slots
      const blockedSlot = await checkBlockedSlotConflict(env.DB, body.studioId, body.date, body.startTime, body.endTime);
      if (blockedSlot) {
        return jsonError(`Ce créneau est bloqué${blockedSlot.reason ? ` : ${blockedSlot.reason}` : ""}`, 409);
      }

      const paris = getParisNow();
      if (body.date === paris.dateISO) {
        const minAdvanceHours = parseMinAdvanceHours(await getSetting(env.DB, "booking.min_advance_hours"));
        const { cutoffTime, fullyBlocked } = computeMinAdvance(paris, minAdvanceHours);
        if (isMinAdvanceViolation(body.startTime, cutoffTime, fullyBlocked)) {
          return jsonError(`Les réservations doivent être faites au moins ${minAdvanceHours}h à l'avance`, 400);
        }
      }

      const maxAdvanceDays = parseInt(await getSetting(env.DB, "booking.max_advance_days") || "90", 10);
      const bookingDate = new Date(body.date + "T00:00:00");
      const todayDate = new Date(paris.dateISO + "T00:00:00");
      const diffDays = Math.round((bookingDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > maxAdvanceDays) {
        return jsonError(`Les réservations ne peuvent pas dépasser ${maxAdvanceDays} jours à l'avance`, 400);
      }

      // Load DB-driven opening hours and validate that the booking falls
      // within studio hours (prevents bookings outside opening hours).
      const hoursMap2 = buildOpeningHoursMap(await getOpeningHours(env.DB));
      setOpeningHours(hoursMap2);

      const openingDay = bookingDate.getDay();
      const studioHours = hoursMap2[body.studioId]?.[openingDay];
      if (studioHours) {
        if (body.startTime < studioHours.open) {
          return jsonError(`Le studio ouvre à ${studioHours.open.replace(/^0/, "").replace(":00", "")}h ce jour-là.`, 400);
        }
        const effectiveClose = studioHours.close === "00:00" ? "24:00" : studioHours.close;
        const effectiveEnd = body.endTime === "00:00" ? "24:00" : body.endTime;
        if (effectiveEnd > effectiveClose) {
          return jsonError(`Le studio ferme à ${studioHours.close.replace(/^0/, "").replace(":00", "")}h ce jour-là.`, 400);
        }
      }

      // ── Server-authoritative pricing ──────────────────────────────────────
      // Shared with admin creation (computeBookingQuote): the peak threshold
      // (peak_start_hour) and public holidays are always evaluated identically,
      // so the public flow and admin-created bookings cannot diverge.
      const peakStartHour = parseInt(await getSetting(env.DB, "peak_start_hour") || "18", 10);
      const publicHolidaysRaw = await getSetting(env.DB, "public_holidays") || "[]";
      const publicHolidays = JSON.parse(publicHolidaysRaw) as string[];

      const peakRate = await getPricingForBooking(env.DB, body.studioId, body.groupType, true);
      const offPeakRate = await getPricingForBooking(env.DB, body.studioId, body.groupType, false);

      const allEquipment = await getEquipment(env.DB);
      const equipmentCatalogue: QuoteEquipmentCatalogueItem[] = allEquipment.map((e) => ({
        id: e.equipment_id,
        name: e.name,
        pricingType: e.pricing_type,
        sessionPricing: e.session_pricing ? (JSON.parse(e.session_pricing) as number[]) : null,
        pricePerHour: e.price_per_hour,
      }));

      const quote = computeBookingQuote({
        studioId: body.studioId as StudioId,
        groupType: body.groupType as GroupType,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        equipment: body.equipment as QuoteEquipmentItem[] | undefined,
        peakStartHour,
        publicHolidays,
        peakRatePerHalfHour: peakRate,
        offPeakRatePerHalfHour: offPeakRate,
        equipmentCatalogue,
      });

      // Physical equipment is shared by both studios. Public bookings cannot
      // reserve more units than remain on the requested overlapping slot.
      const availabilityBookings = (await getBookingsByDate(env.DB, body.date)).map((b) => ({
        startTime: b.start_time, endTime: b.end_time, status: b.status, studioId: b.studio_id, equipment: b.equipment,
      }));
      for (const line of body.equipment ?? []) {
        if (!line || line.quantity <= 0) continue;
        const eq = allEquipment.find((item) => item.equipment_id === line.id);
        if (!eq) continue;
        const stock = computeEquipmentAvailability({ stockTotal: eq.stock_total, equipmentId: eq.equipment_id,
          requested: { startTime: body.startTime, endTime: body.endTime }, requestedStudioId: body.studioId, bookings: availabilityBookings });
        if (line.quantity > stock.available) {
          return jsonError(`Stock insuffisant pour « ${eq.name} » : ${stock.available} disponible(s) sur ce créneau`, 409);
        }
      }

      // Refus des créneaux invalides/vides : aucune réservation 0€ silencieuse.
      if (quote.halfHours === 0 || quote.slotBreakdown.length === 0) {
        return jsonError("Créneau invalide — l'heure de fin doit être après l'heure de début", 400);
      }

      const serverBasePrice = quote.basePrice;
      const serverEquipmentPrice = quote.equipmentPrice;
      const durationHours = quote.durationHours;
      const serverTotalPrice = quote.totalPrice;

      // ── Cart-level promo recompute (Phase 5A: server authoritative) ──────
      let serverPromoDiscount = 0;
      // Cart-level promo total (server-authoritative) — also used by the
      // consolidated confirmation email so it matches the charged amount.
      let cartPromoDiscountTotal = 0;
      let promoType: string | null = null;
      let promoValue: number | undefined = undefined;

      if (body.isLastInCart && body.promoCode) {
        // Last cart request with a promo code: full cart recompute
        const cartBookingRefs: string[] = Array.isArray(body.cartBookingRefs)
          ? body.cartBookingRefs
          : [body.bookingRef];

        // Fetch previous bookings (all cart refs except this one — not yet inserted)
        // Dedupe refs and scope to THIS user's bookings only — a client can
        // send arbitrary refs, and the allocation loop writes to them.
        const prevRefs = [...new Set(cartBookingRefs.filter((r) => r !== body.bookingRef))].slice(0, 20);
        const previousBookings = (prevRefs.length > 0
          ? await getBookingsByRefs(env.DB, prevRefs)
          : []
        ).filter((b) => b.user_id === userId);

        // Compute cart subtotal from stored authoritative DB prices +
        // this booking's recomputed price
        let cartSubtotal = 0;
        for (const ref of prevRefs) {
          const b = previousBookings.find((pb) => pb.booking_ref === ref);
          if (b) {
            cartSubtotal += (b.base_price || 0) + (b.equipment_price || 0);
          }
        }
        cartSubtotal += serverTotalPrice;

        // Validate promo on full cart subtotal
        const promoValidation = await validatePromoCode(env.DB, body.promoCode.trim().toUpperCase(), cartSubtotal);
        if (!promoValidation.valid) {
          return jsonError(promoValidation.error || "Code promo invalide", 400);
        }

        const discountTotal = Math.min(promoValidation.roundedDiscount || 0, cartSubtotal);
        cartPromoDiscountTotal = discountTotal;
        promoType = promoValidation.promo?.type || null;
        promoValue = promoValidation.promo?.value;

        // Allocate greedily in cart order: previous bookings first (refs order),
        // then this booking.
        let remaining = discountTotal;
        const allocations: Array<{ ref: string; id: string | null; discount: number }> = [];

        for (const ref of prevRefs) {
          const b = previousBookings.find((pb) => pb.booking_ref === ref);
          if (b) {
            const subtotal = (b.base_price || 0) + (b.equipment_price || 0);
            const alloc = Math.min(remaining, subtotal);
            allocations.push({ ref, id: b.id, discount: alloc });
            remaining -= alloc;
          }
        }

        // Current booking allocation
        const currentAlloc = Math.min(remaining, serverTotalPrice);
        allocations.push({ ref: body.bookingRef, id: null, discount: currentAlloc });
        remaining -= currentAlloc;

        // Update previous bookings' promo fields
        for (const alloc of allocations) {
          if (alloc.id) {
            await updateBooking(env.DB, alloc.id, {
              promo_discount: alloc.discount,
              promo_code: body.promoCode,
              promo_type: promoType,
            });
            // Fully discounted previous booking (e.g. 100% promo on a
            // multi-item cart): 0€ payment record — addPayment triggers
            // recomputeBookingPaymentStatus which sets "paid" automatically.
            const prevBooking = previousBookings.find((pb) => pb.id === alloc.id);
            const prevSubtotal = prevBooking ? (prevBooking.base_price || 0) + (prevBooking.equipment_price || 0) : 0;
            if (prevBooking && alloc.discount >= prevSubtotal && prevSubtotal > 0 && prevBooking.payment_status !== "paid") {
              await addPayment(env.DB, {
                booking_id: alloc.id,
                amount: 0,
                method: body.paymentMethod,
                status: "paid",
                paid_at: new Date().toISOString(),
              });
            }
          } else {
            serverPromoDiscount = alloc.discount;
          }
        }
      } else if (body.promoCode) {
        // Non-last cart request: store promo_code/type for later cart recompute,
        // but set discount to zero (authoritative allocation happens on last request)
        promoType = null; // will be set when the last request recomputes
        // Still validate the promo code for early error detection
        const promoValidation = await validatePromoCode(env.DB, body.promoCode.trim().toUpperCase(), serverTotalPrice);
        if (promoValidation.valid) {
          promoType = promoValidation.promo?.type || null;
          promoValue = promoValidation.promo?.value;
        }
        // serverPromoDiscount stays 0
      }

      const serverNetTotal = serverTotalPrice - serverPromoDiscount;
      const isZeroTotal = serverNetTotal <= 0;
      if (isCashPaymentForbidden(body.paymentMethod, allowCash, serverNetTotal)) {
        return jsonResponse({ success: false, error: "Le paiement sur place n'est plus disponible, réglez en ligne par carte.", code: "cash-not-allowed" }, 400);
      }
      const bookingPaymentStatus = isZeroTotal ? "paid" : body.paymentStatus;

      // Log price mismatch (telemetry)
      const clientTotal = body.price || 0;
      if (Math.abs(clientTotal - serverNetTotal) > 1) {
        console.warn(`[booking] Price mismatch for ${body.bookingRef}: client=${clientTotal}, server=${serverNetTotal}, diff=${(clientTotal - serverNetTotal).toFixed(2)}`);
      }

      // ── Create booking ────────────────────────────────────────────────────
      const createBookingData = {
        booking_ref: body.bookingRef,
        user_id: userId,
        band_name: bookingBandName,
        client_type: resolved.clientType,
        legal_name: resolved.legalName || null,
        siret: resolved.siret || null,
        rna: resolved.rna || null,
        instagram_accounts: resolved.instagramAccounts || null,
        studio_id: body.studioId,
        date: body.date,
        start_time: body.startTime,
        end_time: body.endTime,
        group_type: body.groupType,
        status: "confirmed" as const,
        base_price: serverBasePrice,
        equipment_price: serverEquipmentPrice,
        total_price: serverTotalPrice,
        equipment: JSON.stringify(quote.equipmentLines.filter((line) => line.quantity > 0)),
        payment_method: body.paymentMethod,
        payment_status: bookingPaymentStatus,
        notes: body.notes || null,
        round_mode: body.round_mode || "none",
        round_value: null,
        promo_code: body.promoCode || null,
        promo_discount: serverPromoDiscount,
        promo_type: promoType,
        cancelled_at: null,
        cancel_reason: null,
      };

      const booking = await createBooking(env.DB, createBookingData) as unknown as DbBooking;

      // Auto-create a 0€ payment record for fully discounted bookings
      if (isZeroTotal) {
        await addPayment(env.DB, {
          booking_id: booking.id,
          amount: 0,
          method: body.paymentMethod,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
      }

      if (body.promoCode) {
        await env.DB.prepare(
          "UPDATE promo_codes SET usage_count = usage_count + 1 WHERE code = ?",
        ).bind(body.promoCode.trim().toUpperCase()).run();
      }

      // ── Email (consolidated on last cart request) ─────────────────────────
      const isLastInCart = body.isLastInCart === true;
      const cartBookingRefs: string[] = Array.isArray(body.cartBookingRefs) ? body.cartBookingRefs : [booking.booking_ref];

      if (env.RESEND_API_KEY && bookingPaymentStatus !== "pending") {
        if (isLastInCart) {
          let allSlots: BookingSlot[] = [];
          if (cartBookingRefs.length > 1) {
            for (const ref of cartBookingRefs) {
              const b = await getBookingByRef(env.DB, ref);
              if (b) {
                allSlots.push({
                  bookingRef: b.booking_ref,
                  studioId: b.studio_id,
                  date: b.date,
                  startTime: b.start_time,
                  endTime: b.end_time,
                  groupType: b.group_type,
                  equipment: parseBookingEquipmentLines(b.equipment),
                  equipmentPrice: b.equipment_price,
                  totalPrice: b.total_price,
                });
              }
            }
          }

          const cartGrossTotal = allSlots.reduce((sum, slot) => sum + slot.totalPrice, 0);

          const emailData: BookingConfirmationData = {
            bookingRef: booking.booking_ref,
            studioId: body.studioId,
            date: body.date,
            startTime: body.startTime,
            endTime: body.endTime,
            groupType: body.groupType,
            equipment: quote.equipmentLines,
            equipmentPrice: serverEquipmentPrice,
            // Server-authoritative totals: multi-slot emails show the cart net
            // total, single-slot the booking net — never client-supplied amounts.
            totalPrice: allSlots.length > 1 ? cartGrossTotal - cartPromoDiscountTotal : serverNetTotal,
            paymentMethod: body.paymentMethod,
            paymentStatus: bookingPaymentStatus,
            userName: name,
            userEmail: email,
            userPhone: phone,
            // Confirmation echoes the identity as booked (D8): a wrong client
            // type is far cheaper to spot here than on the invoice.
            clientType: resolved.clientType,
            legalName: resolved.legalName,
            promoCode: body.promoCode,
            promoDiscount: cartPromoDiscountTotal,
            promoType: promoType,
            promoValue,
            allSlots: allSlots.length > 1 ? allSlots : undefined,
          };

          const emailPromise = sendBookingConfirmationEmail(env.RESEND_API_KEY, emailData)
            .catch((err) => { console.error("Failed to send booking confirmation email:", err); });
          waitUntil(emailPromise);
        }
      }

      // ── Response with accountStatus ───────────────────────────────────────
      // On the last cart request, also return the server-confirmed cart-wide
      // promo (code + aggregate reduction) and the net total, so the UI can
      // present ONE "Réduction (CODE)" next to the total — never the client
      // cart fields (intentionally 0/null after create).
      const responseData: Record<string, unknown> = { bookingId: booking.id, ref: booking.booking_ref, accountStatus };
      if (isLastInCart) {
        const finalCartRefs = [...new Set(cartBookingRefs.map((r) => r.trim()).filter(Boolean))];
        const cartRows = finalCartRefs.length > 0
          ? (await getBookingsByRefs(env.DB, finalCartRefs)).filter((b) => b.user_id === userId)
          : [];
        const cartGrossTotal = cartRows.reduce((sum, b) => sum + (b.base_price || 0) + (b.equipment_price || 0), 0);
        responseData.promoCode = body.promoCode || null;
        responseData.promoDiscount = cartPromoDiscountTotal;
        responseData.netTotal = Math.max(0, cartGrossTotal - cartPromoDiscountTotal);
      }

      if (newSessionToken) {
        return jsonResponse({ success: true, data: responseData }, 200, {
          "Set-Cookie": buildClientSessionCookie(newSessionToken),
        });
      }

      return jsonSuccess(responseData);
    } catch (error) {
      console.error("POST /api/bookings error:", error);
      return jsonError(error instanceof Error ? error.message : "Booking failed", 500);
    }
  }),

  route("/api/public-holidays", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const raw = await getSetting(env.DB, "public_holidays");
      const holidays: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      return jsonSuccess(holidays);
    } catch (error) {
      console.error("GET /api/public-holidays error:", error);
      return jsonError("Failed to fetch public holidays", 500);
    }
  }),

  route("/api/pricing", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const rows = await getPricing(env.DB);
      const maxAdvanceDays = parseInt(await getSetting(env.DB, "booking.max_advance_days") || "90", 10);
      const allowCash = parseAllowCash(await getSetting(env.DB, "booking.allow_cash"));

      // Build grid: studio_id × group_type × { peak, offPeak } in €/hour
      // DB stores price_per_half_hour in cents → €/h = cents * 2 / 100 = cents / 50
      const grid: Record<string, Record<string, { peak: number; offPeak: number }>> = {};
      const groupTypes = new Set<string>();

      for (const row of rows) {
        if (!grid[row.studio_id]) grid[row.studio_id] = {};
        if (!grid[row.studio_id][row.group_type]) {
          grid[row.studio_id][row.group_type] = { peak: 0, offPeak: 0 };
          groupTypes.add(row.group_type);
        }
        const hourly = row.price_per_half_hour * 2 / 100;
        if (row.is_peak) {
          grid[row.studio_id][row.group_type].peak = hourly;
        } else {
          grid[row.studio_id][row.group_type].offPeak = hourly;
        }
      }

      // Compute min/max per group type across all studios and peak/offPeak
      const minMaxByGroupType: Record<string, { min: number; max: number }> = {};
      for (const gt of groupTypes) {
        let min = Infinity;
        let max = -Infinity;
        for (const studioId of Object.keys(grid)) {
          const entry = grid[studioId][gt];
          if (entry) {
            if (entry.peak < min) min = entry.peak;
            if (entry.offPeak < min) min = entry.offPeak;
            if (entry.peak > max) max = entry.peak;
            if (entry.offPeak > max) max = entry.offPeak;
          }
        }
        minMaxByGroupType[gt] = { min, max };
      }

      // Include opening hours so the client can update its slot store
      const openingHours = buildOpeningHoursMap(await getOpeningHours(env.DB));

      // Admin pricing edits must be visible on next page load — never cache.
      const res = jsonSuccess({ grid, minMaxByGroupType, maxAdvanceDays, openingHours, allowCash });
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (error) {
      console.error("GET /api/pricing error:", error);
      return jsonError("Failed to fetch pricing", 500);
    }
  }),

  route("/api/peak-hours", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const raw = await getSetting(env.DB, "peak_start_hour");
      const peakStartHour = raw ? parseInt(raw, 10) : 18;
      return jsonSuccess({ peakStartHour });
    } catch (error) {
      console.error("GET /api/peak-hours error:", error);
      return jsonError("Failed to fetch peak hours config", 500);
    }
  }),

  route("/api/materiel", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const raw = await getSetting(env.DB, "materiel.v1");
      const materiel = parseMaterielSetting(raw) ?? DEFAULT_MATERIEL;
      return jsonSuccess(materiel);
    } catch (error) {
      console.error("GET /api/materiel error:", error);
      return jsonError("Failed to fetch materiel", 500);
    }
  }),

  route("/api/promo-codes/validate", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);
    try {
      const body = await request.json() as { code: string; total: number };
      if (!body.code || typeof body.total !== "number") return jsonError("Paramètres invalides", 400);
      const result = await validatePromoCode(env.DB, body.code, body.total);
      if (!result.valid || !result.promo) {
        return jsonSuccess({ valid: false, error: result.error });
      }
      const p = result.promo;
      const description = p.type === "percentage" ? `${p.value}% de réduction` : `${p.value}€ TTC de réduction`;
      // Utiliser la réduction arrondie si disponible
      const discount = result.roundedDiscount ?? (p.type === "percentage"
        ? body.total * p.value / 100
        : Math.min(p.value, body.total));
      return jsonSuccess({
        valid: true,
        promo: { code: p.code, type: p.type, value: p.value, description, minTotal: p.min_total > 0 ? p.min_total : undefined, round_mode: p.round_mode ?? "none" },
        discount,
      });
    } catch (error) {
      console.error("POST /api/promo-codes/validate error:", error);
      return jsonError(error instanceof Error ? error.message : "Validation failed", 500);
    }
  }),

  // ─── Public Equipment API ─────────────────────────────────────────────────

  route("/api/equipment", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);
    try {
      const { results } = await env.DB
        .prepare("SELECT equipment_id, name, max_per_session, stock_total, pricing_type, session_pricing, price_per_hour FROM equipment ORDER BY name")
        .all<{
          equipment_id: string;
          name: string;
          max_per_session: number;
          stock_total: number;
          pricing_type: string;
          session_pricing: string;
          price_per_hour: number;
        }>();

      const equipment = results.map((eq) => ({
        id: eq.equipment_id,
        name: eq.name,
        maxPerSession: eq.max_per_session,
        stockTotal: eq.stock_total,
        pricingType: eq.pricing_type,
        sessionPricing: eq.session_pricing ? JSON.parse(eq.session_pricing) : null,
        pricePerHour: eq.price_per_hour,
      }));

      return new Response(JSON.stringify({ success: true, equipment }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("GET /api/equipment error:", error);
      return jsonError("Failed to fetch equipment", 500);
    }
  }),

  // ─── Admin Auth API ────────────────────────────────────────────────────────

  route("/api/admin/login", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return jsonError("Email et mot de passe requis", 400);
      }

      const normalizedEmail = body.email.trim().toLowerCase();
      const user = await env.DB
        .prepare("SELECT id, email, password_hash, name, role, is_active FROM admin_users WHERE LOWER(TRIM(email)) = ?")
        .bind(normalizedEmail)
        .first<{
          id: string;
          email: string;
          password_hash: string;
          name: string;
          role: AdminRole;
          is_active: number;
        }>();

      if (!user || !user.is_active) {
        return jsonError("Identifiants invalides", 401);
      }

      const valid = await verifyPassword(body.password, user.password_hash);
      if (!valid) {
        return jsonError("Identifiants invalides", 401);
      }

      const token = await createSession(env.DB, user.id);

      return new Response(JSON.stringify({
        success: true,
        data: { id: user.id, email: user.email, name: user.name, role: user.role },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildSessionCookie(token),
        },
      });
    } catch (error) {
      console.error("POST /api/admin/login error:", error);
      return jsonError(error instanceof Error ? error.message : "Login failed", 500);
    }
  }),

  route("/api/admin/logout", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const cookieHeader = request.headers.get("Cookie") || "";
      const match = cookieHeader.match(/h3_session=([^;]+)/);
      if (match?.[1]) {
        await deleteSession(env.DB, match[1]);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    } catch (error) {
      console.error("POST /api/admin/logout error:", error);
      return jsonError(error instanceof Error ? error.message : "Logout failed", 500);
    }
  }),

  route("/api/admin/me", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const user = await requireAuth(request);
      return jsonSuccess(user);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("GET /api/admin/me error:", error);
      return jsonError(error instanceof Error ? error.message : "Auth check failed", 500);
    }
  }),

  route("/api/admin/forgot-password", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { email?: string };
      if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return jsonError("Email invalide", 400);
      }

      const admin = await env.DB
        .prepare("SELECT id, email, name FROM admin_users WHERE LOWER(TRIM(email)) = ? AND is_active = 1")
        .bind(body.email.trim().toLowerCase())
        .first<{ id: string; email: string; name: string }>();

      if (!admin) {
        return jsonSuccess({ sent: true });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await env.DB
        .prepare(
          "INSERT INTO admin_password_reset_tokens (id, admin_user_id, token, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind(`aprt-${generateId()}`, admin.id, token, expiresAt)
        .run();

      const resetUrl = new URL(`/admin/reinitialiser?token=${token}`, request.url).toString();
      const emailHtml = `
        <h2>Réinitialisation de votre mot de passe admin</h2>
        <p>Bonjour ${admin.name},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe administrateur. Cliquez sur le lien ci-dessous :</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Ce lien est valable pendant 1 heure.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "H3 Studios <contact@h3-studios.fr>",
          to: admin.email,
          subject: "Réinitialisation de votre mot de passe admin H3 Studios",
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error("Resend API error:", errorData);
        return jsonError("Échec de l'envoi de l'email", 500);
      }

      return jsonSuccess({ sent: true });
    } catch (error) {
      console.error("POST /api/admin/forgot-password error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/admin/reset-password", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { token?: string; password?: string };
      if (!body.token || !body.password) {
        return jsonError("Token et mot de passe requis", 400);
      }
      if (body.password.length < 6) {
        return jsonError("Le mot de passe doit contenir au moins 6 caractères", 400);
      }

      const row = await env.DB
        .prepare(
          "SELECT admin_user_id, expires_at, used FROM admin_password_reset_tokens WHERE token = ?",
        )
        .bind(body.token)
        .first<{ admin_user_id: string; expires_at: string; used: number }>();

      if (!row || row.used || new Date(row.expires_at) < new Date()) {
        return jsonError("Token invalide ou expiré", 400);
      }

      const passwordHash = await hashPassword(body.password);
      await env.DB
        .prepare("UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(passwordHash, new Date().toISOString(), row.admin_user_id)
        .run();

      await env.DB
        .prepare("UPDATE admin_password_reset_tokens SET used = 1 WHERE token = ?")
        .bind(body.token)
        .run();

      return jsonSuccess({ reset: true });
    } catch (error) {
      console.error("POST /api/admin/reset-password error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  // ─── Admin Bookings API ──────────────────────────────────────────────────────

  // Min-advance enforcement is intentionally omitted: admins may book at any time.
  route("/api/admin/bookings", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        const filters: BookingFilters = {};
        const statusFilter = url.searchParams.get("status");
        const studioId = url.searchParams.get("studio");
        if (studioId) filters.studioId = studioId;
        const userIdFilter = url.searchParams.get("userId");
        if (userIdFilter) filters.userId = userIdFilter;
        const dateFrom = url.searchParams.get("dateFrom");
        if (dateFrom) filters.dateFrom = dateFrom;
        const dateTo = url.searchParams.get("dateTo");
        if (dateTo) filters.dateTo = dateTo;
        const search = url.searchParams.get("search");
        if (search) filters.search = search;
        const paymentStatus = url.searchParams.get("paymentStatus");
        const dateDirection = url.searchParams.get("dateDirection");
        if (dateDirection) {
          (filters as Record<string, unknown>).dateDirection = dateDirection;
        }
        const sortBy = url.searchParams.get("sortBy");
        if (sortBy) filters.sortBy = sortBy as BookingFilters["sortBy"];
        const sortOrder = url.searchParams.get("sortOrder");
        if (sortOrder) filters.sortOrder = sortOrder as BookingFilters["sortOrder"];

        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const all = url.searchParams.get("all") === "true";

        const needsPostFilter = statusFilter || paymentStatus === "paid" || paymentStatus === "remaining";
        const fetchLimit = all ? 5000 : needsPostFilter ? 1000 : limit;

        const result = await getBookings(env.DB, filters, 1, fetchLimit);

        let bookingsWithPaymentStatus = await Promise.all(
          result.data.map(async (booking) => {
            const payments = await getPaymentsByBookingId(env.DB, booking.id);
            const totalCollected = payments
              .filter((p) => p.status === "paid" || p.status === "refunded" || p.status === "partial-refund")
              .reduce((acc, p) => acc + p.amount, 0);
            const totalRefunded = payments
              .filter((p) => p.status === "refunded" || p.status === "partial-refund")
              .reduce((acc, p) => acc + (Number(p.refunded_amount) || 0), 0);
            const totalPaid = totalCollected - totalRefunded;
            const finalTotal = getBookingAmountDue(booking);
            const isFullyPaid = totalPaid >= finalTotal;

            return {
              ...booking,
              payment_status: isFullyPaid ? "paid" : booking.payment_status,
              total_paid: totalPaid,
              total_collected: totalCollected,
              total_refunded: totalRefunded,
              remaining: Math.max(0, finalTotal - totalPaid),
            };
          })
        );

        if (statusFilter) {
          bookingsWithPaymentStatus = bookingsWithPaymentStatus.filter(
            (b) => b.status === statusFilter
          );
        }

        if (paymentStatus === "paid") {
          bookingsWithPaymentStatus = bookingsWithPaymentStatus.filter(
            (b) => b.payment_status === "paid"
          );
        } else if (paymentStatus === "remaining") {
          bookingsWithPaymentStatus = bookingsWithPaymentStatus.filter(
            (b) => b.payment_status !== "paid"
          );
        }

        if (all) {
          return jsonSuccess({
            data: bookingsWithPaymentStatus,
            total: bookingsWithPaymentStatus.length,
            page: 1,
            limit: bookingsWithPaymentStatus.length,
          });
        }

        if (needsPostFilter) {
          const total = bookingsWithPaymentStatus.length;
          const offset = (page - 1) * limit;
          bookingsWithPaymentStatus = bookingsWithPaymentStatus.slice(offset, offset + limit);
          return jsonSuccess({
            data: bookingsWithPaymentStatus,
            total,
            page,
            limit,
          });
        }

        return jsonSuccess({
          ...result,
          data: bookingsWithPaymentStatus,
        });
      } catch (error) {
        console.error("GET /api/admin/bookings error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch bookings", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          booking_ref: string;
          user_id: string;
          studio_id: string;
          date: string;
          start_time: string;
          end_time: string;
          group_type: string;
          equipment?: string | null;
          payment_method?: string | null;
          notes?: string | null;
        };

        if (!body.booking_ref || !body.user_id || !body.studio_id || !body.date || !body.start_time || !body.end_time || !body.group_type) {
          return jsonError("Champs obligatoires manquants", 400);
        }

        // Admin may force overlapping / blocked / off-hours / sub-1h slots.
        // Public POST /api/bookings still rejects those.

        const user = await env.DB.prepare("SELECT band_name, client_type, legal_name, siret, rna, instagram_accounts FROM users WHERE id = ?").bind(body.user_id).first<{ band_name: string | null; client_type: string | null; legal_name: string | null; siret: string | null; rna: string | null; instagram_accounts: string | null }>();
        const bookingBandName = user?.band_name ?? null;
        const adminClientType = isClientType(user?.client_type) ? user.client_type : DEFAULT_CLIENT_TYPE;
        const adminIdentity = pruneToClientType({
          legalName: user?.legal_name ?? "",
          siret: user?.siret ?? "",
          rna: user?.rna ?? "",
          firstName: "",
          lastName: "",
          userEmail: "",
          userPhone: "",
          bandName: bookingBandName ?? "",
          instagramAccounts: user?.instagram_accounts ?? "",
          billingAddress: "",
          billingPostalCode: "",
          billingCity: "",
        } satisfies BookingUserFields, adminClientType);

        // Server-authoritative quote, identical to the public booking flow
        // (computeBookingQuote). Removes the previous hard-coded 18:00 peak
        // threshold / weekend-only rule so admin-created bookings respect
        // peak_start_hour and public_holidays exactly like public ones.
        const peakStartHour = parseInt(await getSetting(env.DB, "peak_start_hour") || "18", 10);
        const publicHolidaysRaw = await getSetting(env.DB, "public_holidays") || "[]";
        const publicHolidays = JSON.parse(publicHolidaysRaw) as string[];

        const peakRate = await getPricingForBooking(env.DB, body.studio_id, body.group_type, true);
        const offPeakRate = await getPricingForBooking(env.DB, body.studio_id, body.group_type, false);

        const allEquipment = await getEquipment(env.DB);
        const equipmentCatalogue: QuoteEquipmentCatalogueItem[] = allEquipment.map((e) => ({
          id: e.equipment_id,
          name: e.name,
          pricingType: e.pricing_type,
          sessionPricing: e.session_pricing ? (JSON.parse(e.session_pricing) as number[]) : null,
          pricePerHour: e.price_per_hour,
        }));

        const equipmentList: QuoteEquipmentItem[] = body.equipment
          ? (JSON.parse(body.equipment) as Array<{ id: string; quantity: number }>)
          : [];

        const quote = computeBookingQuote({
          studioId: body.studio_id as StudioId,
          groupType: body.group_type as GroupType,
          date: body.date,
          startTime: body.start_time,
          endTime: body.end_time,
          equipment: equipmentList,
          peakStartHour,
          publicHolidays,
          peakRatePerHalfHour: peakRate,
          offPeakRatePerHalfHour: offPeakRate,
          equipmentCatalogue,
        });

        // Refus des créneaux invalides/vides : aucune réservation 0€ silencieuse.
        if (quote.halfHours === 0 || quote.slotBreakdown.length === 0) {
          return jsonError("Créneau invalide — l'heure de fin doit être après l'heure de début", 400);
        }

        const basePrice = quote.basePrice;
        const equipmentPrice = quote.equipmentPrice;
        const durationHours = quote.durationHours;
        const subtotal = quote.totalPrice;

        const promoDiscount = Math.max(0, Math.min((body as { promo_discount?: number }).promo_discount || 0, subtotal));
        const promoCode = (body as { promo_code?: string }).promo_code || null;
        let promoType: string | null = null;
        if (promoCode) {
          const promoRow = await env.DB.prepare(
            "SELECT type FROM promo_codes WHERE code = ?"
          ).bind(promoCode.trim().toUpperCase()).first<{ type: string }>();
          if (promoRow) {
            promoType = promoRow.type;
          }
        }

        const booking = await createBooking(env.DB, {
          booking_ref: body.booking_ref,
          user_id: body.user_id,
          band_name: bookingBandName,
          client_type: adminClientType,
          legal_name: adminIdentity.legalName || null,
          siret: adminIdentity.siret || null,
          rna: adminIdentity.rna || null,
          instagram_accounts: adminIdentity.instagramAccounts || null,
          studio_id: body.studio_id,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          group_type: body.group_type,
          status: "confirmed",
          base_price: basePrice,
          equipment_price: equipmentPrice,
          total_price: subtotal,
          equipment: JSON.stringify(quote.equipmentLines.filter((line) => line.quantity > 0)),
          payment_method: body.payment_method || null,
          payment_status: body.payment_method === "card" ? "paid" : "pay-on-site",
          notes: body.notes || null,
          round_mode: "none",
          round_value: null,
          promo_code: promoCode,
          promo_discount: promoDiscount,
          promo_type: promoType,
          cancelled_at: null,
          cancel_reason: null,
        });

        await addAuditLog(env.DB, "booking", booking.id, "create", {
          booking_ref: booking.booking_ref,
          studio_id: booking.studio_id,
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time,
        }, request.headers.get("X-Admin-User-Id") || "admin");

        // Send booking confirmation email to client
        if (env.RESEND_API_KEY) {
          const userRow = await env.DB.prepare(
            "SELECT name, email, phone FROM users WHERE id = ?"
          ).bind(body.user_id).first<{ name: string; email: string | null; phone: string | null }>();

          if (userRow?.email) {
            const equipmentSelections = quote.equipmentLines;

            const emailPromise = sendBookingConfirmationEmail(env.RESEND_API_KEY, {
              bookingRef: booking.booking_ref,
              studioId: body.studio_id,
              date: body.date,
              startTime: body.start_time,
              endTime: body.end_time,
              groupType: body.group_type,
              equipment: equipmentSelections,
              equipmentPrice,
              totalPrice: subtotal - promoDiscount,
              paymentMethod: body.payment_method || "cash",
              paymentStatus: body.payment_method === "card" ? "paid" : "pay-on-site",
              userName: userRow.name,
              userEmail: userRow.email,
              userPhone: userRow.phone || "",
              promoCode,
              promoDiscount,
              promoType,
            }).catch((err) => {
              console.error("Failed to send admin booking confirmation email:", err);
            });
            waitUntil(emailPromise);
          }
        }

        return jsonSuccess(booking);
      } catch (error) {
        console.error("POST /api/admin/bookings error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create booking", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // Devis serveur pour la création admin — même calcul que la création
  // publique (computeBookingQuote). Évite une troisième copie côté client du
  // calcul de prix (dérive peak_start_hour + public_holidays comprise).
  route("/api/admin/bookings/quote", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const studioId = url.searchParams.get("studioId") || "";
      const groupType = url.searchParams.get("groupType") || "";
      const date = url.searchParams.get("date") || "";
      const startTime = url.searchParams.get("startTime") || "";
      const endTime = url.searchParams.get("endTime") || "";
      const equipmentRaw = url.searchParams.get("equipment");

      const validStudios = ["la-scene", "le-podium"];
      const validGroupTypes = ["solo", "duo", "group"];
      if (!validStudios.includes(studioId)) return jsonError("Studio invalide", 400);
      if (!validGroupTypes.includes(groupType)) return jsonError("Type de groupe invalide", 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError("Format de date invalide", 400);
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return jsonError("Format d'heure invalide", 400);

      let equipment: QuoteEquipmentItem[] = [];
      if (equipmentRaw) {
        try {
          const parsed = JSON.parse(equipmentRaw);
          if (Array.isArray(parsed)) {
            equipment = parsed.filter((e) => e && typeof e.id === "string" && Number.isFinite(e.quantity));
          }
        } catch {
          return jsonError("Équipement invalide", 400);
        }
      }

      const peakStartHour = parseInt(await getSetting(env.DB, "peak_start_hour") || "18", 10);
      const publicHolidaysRaw = await getSetting(env.DB, "public_holidays") || "[]";
      const publicHolidays = JSON.parse(publicHolidaysRaw) as string[];

      const peakRate = await getPricingForBooking(env.DB, studioId, groupType, true);
      const offPeakRate = await getPricingForBooking(env.DB, studioId, groupType, false);

      const allEquipment = await getEquipment(env.DB);
      const equipmentCatalogue: QuoteEquipmentCatalogueItem[] = allEquipment.map((e) => ({
        id: e.equipment_id,
        name: e.name,
        pricingType: e.pricing_type,
        sessionPricing: e.session_pricing ? (JSON.parse(e.session_pricing) as number[]) : null,
        pricePerHour: e.price_per_hour,
      }));

      const quote = computeBookingQuote({
        studioId: studioId as StudioId,
        groupType: groupType as GroupType,
        date,
        startTime,
        endTime,
        equipment,
        peakStartHour,
        publicHolidays,
        peakRatePerHalfHour: peakRate,
        offPeakRatePerHalfHour: offPeakRate,
        equipmentCatalogue,
      });

      // Refus des créneaux invalides/vides : pas de devis 0€ silencieux.
      if (quote.halfHours === 0 || quote.slotBreakdown.length === 0) {
        return jsonError("Créneau invalide — l'heure de fin doit être après l'heure de début", 400);
      }

      const equipmentLines = equipment
        .map((eq) => {
          const eqData = equipmentCatalogue.find((e) => e.id === eq.id);
          if (!eqData || eq.quantity <= 0) return null;
          const price = eqData.pricingType === "session" && eqData.sessionPricing
            ? eqData.sessionPricing[eq.quantity - 1] || 0
            : eqData.pricePerHour * eq.quantity * quote.durationHours;
          const name = allEquipment.find((e) => e.equipment_id === eq.id)?.name || eq.id;
          return { id: eq.id, name, quantity: eq.quantity, price };
        })
        .filter((line): line is { id: string; name: string; quantity: number; price: number } => line !== null);

      return jsonSuccess({
        basePrice: quote.basePrice,
        equipmentPrice: quote.equipmentPrice,
        totalPrice: quote.totalPrice,
        durationHours: quote.durationHours,
        equipment: equipmentLines,
      });
    } catch (error) {
      console.error("GET /api/admin/bookings/quote error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to compute quote", 500);
    }
  }),

  route("/api/admin/bookings/:id", async ({ request, params }) => {
    const { id } = params;

    if (request.method === "GET") {
      try {
        const booking = await env.DB.prepare(`
          SELECT b.*, pc.type as promo_code_type, pc.value as promo_code_value
          FROM bookings b
          LEFT JOIN promo_codes pc ON b.promo_code = pc.code
          WHERE b.id = ?
        `).bind(id).first<DbBooking & { promo_code_type: string | null; promo_code_value: number | null }>();
        if (!booking) return jsonError("Réservation introuvable", 404);
        return jsonSuccess(booking);
      } catch (error) {
        console.error("GET /api/admin/bookings/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch booking", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const rawBody = await request.json() as Record<string, unknown>;

        // Whitelist runtime — empêche la modification de champs sensibles
        // (payment_status, user_id, id, etc.). total_price est volontairement
        // exclu : le serveur est l'opérateur d'invariance. Le client ne peut
        // jamais persister un montant dérivé/net — le brut est toujours
        // recalculé depuis base_price + equipment_price.
        const ALLOWED_BOOKING_FIELDS = ["date", "start_time", "end_time", "studio_id", "notes", "base_price",
          "equipment_price", "equipment", "promo_discount", "cancelled_at", "cancel_reason"] as const;
        const body = Object.fromEntries(
          Object.entries(rawBody).filter(([k]) => (ALLOWED_BOOKING_FIELDS as readonly string[]).includes(k))
        ) as {
          date?: string;
          start_time?: string;
          end_time?: string;
          studio_id?: string;
          notes?: string;
          base_price?: number;
          equipment_price?: number;
          equipment?: string;
          promo_discount?: number;
          cancelled_at?: string;
          cancel_reason?: string;
          // Défini côté serveur uniquement (jamais accepté depuis le client).
          total_price?: number;
          promo_code?: string | null;
          promo_type?: string | null;
        };

        // Une lecture n'est nécessaire que si un champ dépend de l'existant
        // (déplacement, recalcul du brut, plafonnement de la remise).
        const needsExisting = Boolean(
          body.date || body.start_time || body.end_time || body.studio_id ||
          body.base_price !== undefined || body.equipment_price !== undefined ||
          body.promo_discount !== undefined || body.equipment !== undefined,
        );
        const existing = needsExisting ? await getBookingById(env.DB, id) : null;
        if (needsExisting && !existing) return jsonError("Réservation introuvable", 404);
        if (body.studio_id && body.studio_id !== "la-scene" && body.studio_id !== "le-podium") {
          return jsonError("Studio invalide", 400);
        }

        if (body.equipment !== undefined) {
          const catalogue = await getEquipment(env.DB);
          const ex = existing!;
          const start = body.start_time || ex.start_time;
          const end = body.end_time || ex.end_time;
          const slots = parseBookingEquipmentLines(body.equipment);
          const startIdx = ALL_TIME_SLOTS.indexOf(start);
          let endIdx = end === "00:00" ? ALL_TIME_SLOTS.length : ALL_TIME_SLOTS.indexOf(end);
          if (endIdx < 0) endIdx = ALL_TIME_SLOTS.length;
          const hours = Math.max(0, endIdx - startIdx) * 0.5;
          const lines = slots.flatMap(line => {
            const item = catalogue.find(e => e.equipment_id === line.id);
            if (!item) return [];
            const sessionPricing = item.session_pricing ? (JSON.parse(item.session_pricing) as number[]) : null;
            const lineTotal = item.pricing_type === "session"
              ? (sessionPricing?.[line.quantity - 1] || 0)
              : (Number(item.price_per_hour) || 0) * line.quantity * hours;
            const offeredUnits = item.pricing_type === "session"
              ? getOfferedUnits(sessionPricing, line.quantity)
              : [];
            return [{ id: item.equipment_id, name: item.name, quantity: line.quantity, lineTotal, ...(offeredUnits.length ? { offeredUnits } : {}) }];
          });
          body.equipment = JSON.stringify(lines);
          body.equipment_price = lines.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0);
        }

        // Admin may force overlapping / blocked / off-hours / sub-1h slots
        // when rescheduling. Public booking creation still rejects those.

        // Invariant de stockage : total_price = base_price + equipment_price (brut),
        // promo_discount séparé. Toute modification de base/équipement recalcule
        // le brut côté serveur. Un simple déplacement conserve le prix historique
        // (aucune mise à jour de base_price/equipment_price → pas de recalcul).
        if (body.base_price !== undefined || body.equipment_price !== undefined) {
          body.total_price = getBookingGrossTotal({
            base_price: Number(body.base_price ?? existing!.base_price) || 0,
            equipment_price: Number(body.equipment_price ?? existing!.equipment_price) || 0,
          });
        }
        if (body.promo_discount !== undefined) {
          if (existing!.status === "cancelled") return jsonError(getManualDiscountBlockMessage("cancelled"), 400);
          // Une remise manuelle remplace le code promo : on retire le code et
          // on décrémente son usage, comme à l'annulation.
          const existingPromo = typeof existing!.promo_code === "string" ? existing!.promo_code.trim() : "";
          if (existingPromo) {
            await env.DB.prepare(
              "UPDATE promo_codes SET usage_count = MAX(0, usage_count - 1) WHERE code = ?"
            ).bind(existingPromo).run();
            body.promo_code = null;
            body.promo_type = null;
          }
        }

        // Brut canonique = base_price + equipment_price (jamais le total_price
        // hérité, potentiellement corrompu sur les lignes legacy post-remise).
        const canonicalGross = getBookingGrossTotal({
          base_price: body.base_price ?? existing!.base_price,
          equipment_price: body.equipment_price ?? existing!.equipment_price,
        });

        // La remise reste séparée du brut et est plafonnée au brut canonique
        // pour garder un grand livre sain (due = max(0, brut - remise)).
        if (body.promo_discount !== undefined) {
          body.promo_discount = Math.max(0, Math.min(Number(body.promo_discount) || 0, canonicalGross));
        } else if (body.base_price !== undefined || body.equipment_price !== undefined) {
          // Le brut a baissé : re-plafonner la remise existante pour qu'elle ne
          // dépasse jamais le nouveau brut canonique.
          const existingDiscount = Number(existing!.promo_discount) || 0;
          if (existingDiscount > canonicalGross) {
            body.promo_discount = canonicalGross;
          }
        }

        const result = await updateBooking(env.DB, id, body);
        if (!result.success) return jsonError(result.error || "Update failed", 400);

        // Recalcule payment_status après modification de prix/remise (idempotent).
        await recomputeBookingPaymentStatus(env.DB, id);

        await addAuditLog(env.DB, "booking", id, "update", body, request.headers.get("X-Admin-User-Id") || "admin");

        const updated = await getBookingById(env.DB, id);
        return jsonSuccess(updated);
      } catch (error) {
        console.error("PUT /api/admin/bookings/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update booking", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/bookings/:id/cancel", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as {
        reason?: string;
        refundMode?: "none" | "refund";
        keepBalanceDue?: boolean;
        refunds?: { paymentId: string; amount: number }[];
      };
      if (body.refundMode !== "none" && body.refundMode !== "refund") {
        return jsonError("Choix de remboursement requis : 'none' ou 'refund'", 400);
      }
      if (body.refundMode === "refund" && (!Array.isArray(body.refunds) || body.refunds.length === 0 || body.refunds.some((item) =>
        !item || typeof item.paymentId !== "string" || item.paymentId.trim() === "" || typeof item.amount !== "number" || item.amount <= 0
      ))) {
        return jsonError("Aucun paiement à rembourser n'a été fourni", 400);
      }
      const booking = await getBookingById(env.DB, params.id);
      if (!booking) return jsonError("Réservation introuvable", 404);

      const existingPayments = await getPaymentsByBookingId(env.DB, params.id);
      const remaining = getBookingBalance(booking, existingPayments);
      let keepBalanceDue = 0;
      if (body.refundMode === "none" && remaining > 0.005) {
        if (body.keepBalanceDue !== true && body.keepBalanceDue !== false) {
          return jsonError("Précisez si le solde reste dû : keepBalanceDue true ou false", 400);
        }
        keepBalanceDue = body.keepBalanceDue ? 1 : 0;
      }

      if (booking.status !== "cancelled") {
        const result = await updateBooking(env.DB, params.id, {
          status: "cancelled",
          cancelled_at: new Date().toISOString().replace("T", " ").slice(0, 19),
          cancel_reason: body.reason || "Annulée par l'admin",
          keep_balance_due: keepBalanceDue,
        });

        if (!result.success) return jsonError(result.error || "Cancel failed", 400);

        // Décrémenter usage_count du promo code si applicable
        if (booking.promo_code) {
          await env.DB.prepare(
            "UPDATE promo_codes SET usage_count = MAX(0, usage_count - 1) WHERE code = ?"
          ).bind(booking.promo_code).run();
        }

        await addAuditLog(env.DB, "booking", params.id, "cancel", {
          reason: body.reason || "Annulée par l'admin",
          keepBalanceDue: keepBalanceDue === 1,
        }, request.headers.get("X-Admin-User-Id") || "admin");

        const client = await getUserById(env.DB, booking.user_id);
        if (client?.email && env.RESEND_API_KEY) {
          waitUntil(
            sendBookingCancellationEmail(env.RESEND_API_KEY, {
              bookingRef: booking.booking_ref,
              studioId: booking.studio_id,
              date: booking.date,
              startTime: booking.start_time,
              endTime: booking.end_time,
              userName: client.name || "",
              userEmail: client.email,
              keepBalanceDue: keepBalanceDue === 1,
              remaining: keepBalanceDue === 1 ? remaining : 0,
              reason: body.reason,
            }).catch((error) => {
              console.error("PUT /api/admin/bookings/:id/cancel email error:", error);
            }),
          );
        }
      }

      const updated = await getBookingById(env.DB, params.id);
      if (body.refundMode === "refund") {
        const payments = await getPaymentsByBookingId(env.DB, params.id);
        const paymentIds = new Set(payments.map((payment) => payment.id));
        const ownershipError = body.refunds!.some((refund) => !paymentIds.has(refund.paymentId));
        if (ownershipError) {
          const errorOutcome = {
            ok: false,
            paymentId: "",
            requestedAmount: 0,
            refundedAmount: 0,
            refundableAfter: 0,
            code: "not_in_booking" as const,
            message: "Un paiement demandé n'appartient pas à cette réservation",
          };
          return jsonSuccess({
            ...updated,
            refund: { refunded: 0, outcomes: [], errors: [errorOutcome] },
          });
        }
        let refund: Awaited<ReturnType<typeof refundPayments>>;
        try {
          refund = await refundPayments({
            db: env.DB,
            secretKey: env.STRIPE_SECRET_KEY,
            performedBy: request.headers.get("X-Admin-User-Id") || "admin",
          }, body.refunds!, body.reason);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Échec du remboursement";
          refund = { refunded: 0, outcomes: [], errors: [{ ok: false, paymentId: "", requestedAmount: 0, refundedAmount: 0, refundableAfter: 0, code: "stripe_error", message }] };
        }
        return jsonSuccess({ ...updated, refund });
      }
      return jsonSuccess(updated);
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/cancel error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to cancel booking", 500);
    }
  }),

  route("/api/admin/bookings/:id/no-show", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const booking = await getBookingById(env.DB, params.id);
      if (!booking) return jsonError("Réservation introuvable", 404);

      const result = await updateBooking(env.DB, params.id, {
        status: "no-show",
      });

      if (!result.success) return jsonError(result.error || "No-show update failed", 400);

      await addAuditLog(env.DB, "booking", params.id, "no-show", {}, request.headers.get("X-Admin-User-Id") || "admin");

      const updated = await getBookingById(env.DB, params.id);
      return jsonSuccess(updated);
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/no-show error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to mark absent", 500);
    }
  }),

  route("/api/admin/bookings/:id/complete", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);
    try {
      const booking = await getBookingById(env.DB, params.id);
      if (!booking) return jsonError("Réservation introuvable", 404);
      if (booking.status === "cancelled" || booking.status === "no-show") {
        return jsonError("Impossible de marquer une réservation annulée ou absente comme terminée", 400);
      }
      // Refuse si la réservation est dans le futur
      const paris = getParisNow();
      const nowMinutes = paris.hours * 60 + paris.minutes;
      const [endH, endM] = booking.end_time.split(":").map(Number);
      const endMinutes = endH * 60 + endM;
      if (booking.date > paris.dateISO || (booking.date === paris.dateISO && endMinutes > nowMinutes)) {
        return jsonError("Impossible de marquer comme terminée une réservation qui n'est pas encore passée", 400);
      }
      const result = await updateBooking(env.DB, params.id, { status: "completed" });
      if (!result.success) return jsonError(result.error || "Échec", 400);
      await addAuditLog(env.DB, "booking", params.id, "complete", {}, request.headers.get("X-Admin-User-Id") || "admin");
      return jsonSuccess({ id: params.id, status: "completed" });
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/complete error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/admin/bookings/:id/mark-paid", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);
    try {
      const body = await request.json() as { method?: string };
      const method = body.method || "cash";
      const validMethods = ["cash", "transfer", "check"];
      if (!validMethods.includes(method)) {
        return jsonError("Méthode invalide (cash, transfer, check)", 400);
      }
      const booking = await getBookingById(env.DB, params.id);
      if (!booking) return jsonError("Réservation introuvable", 404);
      if (!bookingAllowsCollection(booking)) return jsonError("Impossible de payer une réservation annulée", 400);

      // Recompute remaining server-side
      const payments = await getPaymentsByBookingId(env.DB, params.id);
      const totalPaid = payments
        .filter((p) => p.status === "paid" || p.status === "refunded" || p.status === "partial-refund")
        .reduce((acc, p) => acc + p.amount - (Number(p.refunded_amount) || 0), 0);
      const finalTotal = getBookingAmountDue(booking);
      const remaining = finalTotal - totalPaid;

      if (remaining <= 0) return jsonError("Cette réservation est déjà soldée", 400);

      const paymentResult = await addPayment(env.DB, {
        booking_id: params.id,
        amount: remaining,
        method,
        status: "paid",
      });
      if (!paymentResult.success) return jsonError("Échec de l'enregistrement du paiement", 500);

      // payment_status recalculé automatiquement par recomputeBookingPaymentStatus dans addPayment
      await addAuditLog(env.DB, "booking", params.id, "mark-paid", { amount: remaining, method }, request.headers.get("X-Admin-User-Id") || "admin");
      return jsonSuccess({ id: params.id, paymentId: paymentResult.id, amount: remaining });
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/mark-paid error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/admin/bookings/:id/payments", async ({ request, params }) => {
    if (request.method === "GET") {
      try {
        const payments = await getPaymentsByBookingId(env.DB, params.id);
        return jsonSuccess(payments);
      } catch (error) {
        console.error("GET /api/admin/bookings/:id/payments error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch payments", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as { amount: number; method: string; status: string };
        if (!body.amount || !body.method || !body.status) {
          return jsonError("Champs obligatoires manquants: amount, method, status", 400);
        }

        const booking = await getBookingById(env.DB, params.id);
        if (!booking) {
          return jsonError("Réservation introuvable", 404);
        }
        if (!bookingAllowsCollection(booking)) {
          return jsonError("Impossible d'ajouter un paiement à une réservation annulée", 400);
        }

        const validMethods = ["cash", "card", "transfer", "check"] as const;
        if (!validMethods.includes(body.method as (typeof validMethods)[number])) {
          return jsonError("Méthode de paiement invalide", 400);
        }

        // Seuls pending/paid autorisés à la création — les refunds passent par /refund
        const validStatus = ["pending", "paid"] as const;
        if (!validStatus.includes(body.status as (typeof validStatus)[number])) {
          return jsonError("Statut invalide — utiliser 'pending' ou 'paid' (les remboursements passent par /refund)", 400);
        }

        const result = await addPayment(env.DB, {
          booking_id: params.id,
          amount: body.amount,
          method: body.method as (typeof validMethods)[number],
          status: body.status as (typeof validStatus)[number],
        });

        return jsonSuccess(result);
      } catch (error) {
        console.error("POST /api/admin/bookings/:id/payments error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to add payment", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Orphaned Bookings API ───────────────────────────────────────

  route("/api/admin/orphaned-bookings", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const orphaned = await getOrphanedBookings(env.DB);
      return jsonSuccess({ count: orphaned.length, bookings: orphaned });
    } catch (error) {
      console.error("GET /api/admin/orphaned-bookings error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch orphaned bookings", 500);
    }
  }),

  route("/api/admin/orphaned-bookings/delete", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const result = await deleteOrphanedBookings(env.DB);
      await addAuditLog(env.DB, "booking", "orphaned", "bulk-delete", {
        bookingsDeleted: result.count,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ success: true, count: result.count });
    } catch (error) {
      console.error("POST /api/admin/orphaned-bookings/delete error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to delete orphaned bookings", 500);
    }
  }),

  route("/api/admin/calendar", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const summary = url.searchParams.get("summary") === "1";

      if (summary) {
        const select = `SELECT
          b.id,
          b.booking_ref,
          b.user_id,
          b.band_name,
          u.name as user_name,
          u.band_name as user_band_name,
          b.studio_id,
          b.date,
          b.start_time,
          b.end_time,
          b.status,
          b.total_price
        FROM bookings b
        LEFT JOIN users u ON u.id = b.user_id`;

        if (date) {
          const bookings = await env.DB.prepare(
            `${select}
             WHERE b.date = ?
             ORDER BY b.start_time ASC`,
          ).bind(date).all();
          return jsonSuccess({ bookings: bookings.results, blockedSlots: [] });
        }

        if (startDate && endDate) {
          const bookings = await env.DB.prepare(
            `${select}
             WHERE b.date >= ? AND b.date <= ?
             ORDER BY b.date ASC, b.start_time ASC`,
          ).bind(startDate, endDate).all();
          return jsonSuccess({ bookings: bookings.results, blockedSlots: [] });
        }

        const today = getParisDateISO();
        const bookings = await env.DB.prepare(
          `${select}
           WHERE b.date = ?
           ORDER BY b.start_time ASC`,
        ).bind(today).all();
        return jsonSuccess({ bookings: bookings.results, blockedSlots: [] });
      }

      if (date) {
        const [bookings, blockedSlots] = await Promise.all([
          getBookingsByDate(env.DB, date),
          getBlockedSlots(env.DB, undefined, date),
        ]);
        return jsonSuccess({ bookings, blockedSlots });
      }

      if (startDate && endDate) {
        const [bookings, blockedSlots] = await Promise.all([
          getBookingsByDateRange(env.DB, startDate, endDate),
          getBlockedSlotsByDateRange(env.DB, startDate, endDate),
        ]);
        return jsonSuccess({ bookings, blockedSlots });
      }

      const today = getParisDateISO();
      const [bookings, blockedSlots] = await Promise.all([
        getBookingsByDate(env.DB, today),
        getBlockedSlots(env.DB, undefined, today),
      ]);
      return jsonSuccess({ bookings, blockedSlots });
    } catch (error) {
      console.error("GET /api/admin/calendar error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch calendar", 500);
    }
  }),

  // ─── Admin Users API ─────────────────────────────────────────────────────────

  route("/api/admin/users", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const all = url.searchParams.get("all") === "true";
        const search = url.searchParams.get("search") || undefined;
        const blockedParam = url.searchParams.get("blocked");
        const isBlocked = blockedParam === "true" ? true : blockedParam === "false" ? false : undefined;

        const hasBookingsParam = url.searchParams.get("hasBookings");
        const hasBookings = hasBookingsParam === "true" ? true : hasBookingsParam === "false" ? false : undefined;

        const sortByRaw = url.searchParams.get("sortBy") || undefined;
        const sortOrderRaw = url.searchParams.get("sortOrder") || undefined;

        const validSortBy = ["created_at", "name", "total_bookings", "total_spent"] as const;
        const validSortOrder = ["asc", "desc"] as const;

        const sortBy = sortByRaw && validSortBy.includes(sortByRaw as (typeof validSortBy)[number])
          ? (sortByRaw as (typeof validSortBy)[number])
          : undefined;
        const sortOrder = sortOrderRaw && validSortOrder.includes(sortOrderRaw as (typeof validSortOrder)[number])
          ? (sortOrderRaw as (typeof validSortOrder)[number])
          : undefined;

        const result = await getUsers(
          env.DB,
          { search, isBlocked, hasBookings, sortBy, sortOrder },
          all ? 1 : page,
          all ? 9999 : limit,
        );
        return jsonSuccess(result);
      } catch (error) {
        console.error("GET /api/admin/users error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch users", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          name?: string;
          email?: string;
          phone?: string;
          band_name?: string;
          notes?: string;
          address_line1?: string;
          address_line2?: string;
          postal_code?: string;
          city?: string;
          country?: string;
        };
        if (!body.name) {
          return jsonError("Champ obligatoire manquant: name", 400);
        }

        const user = await createUser(env.DB, {
          name: body.name,
          email: body.email,
          phone: body.phone,
          band_name: body.band_name,
          notes: body.notes,
          address_line1: body.address_line1,
          address_line2: body.address_line2,
          postal_code: body.postal_code,
          city: body.city,
          country: body.country,
        });

        await addAuditLog(env.DB, "user", user.id, "create", {
          name: user.name,
          email: user.email,
        }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess(user);
      } catch (error) {
        console.error("POST /api/admin/users error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create user", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/users/merge", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { sourceId?: string; targetId?: string };
      if (!body.sourceId || !body.targetId) {
        return jsonError("Champs obligatoires manquants: sourceId, targetId", 400);
      }

      const result = await mergeUsers(env.DB, body.targetId, [body.sourceId]);
      if (!result.success) {
        return jsonError(result.error || "Merge failed", 400);
      }

      return jsonSuccess({ merged: true, targetId: body.targetId, sourceId: body.sourceId });
    } catch (error) {
      console.error("POST /api/admin/users/merge error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to merge users", 500);
    }
  }),

  route("/api/admin/users/:id/block", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { blocked?: boolean };
      if (body.blocked === undefined) {
        return jsonError("Champ obligatoire manquant: blocked", 400);
      }

      const result = await blockUser(env.DB, params.id, body.blocked);
      if (!result.success) {
        return jsonError(result.error || "Block failed", 400);
      }

      await addAuditLog(env.DB, "user", params.id, body.blocked ? "block" : "unblock", {
        blocked: body.blocked,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, blocked: body.blocked });
    } catch (error) {
      console.error("PUT /api/admin/users/:id/block error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to block/unblock user", 500);
    }
  }),

  route("/api/admin/users/:id", async ({ request, params }) => {
    const { id } = params;

    if (request.method === "GET") {
      try {
        const user = await getUserById(env.DB, id);
        if (!user) return jsonError("Utilisateur introuvable", 404);
        return jsonSuccess(user);
      } catch (error) {
        console.error("GET /api/admin/users/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch user", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const rawBody = await request.json() as Record<string, unknown>;

        // Whitelist runtime — empêche la modification de password_hash, total_bookings, total_spent, etc.
        const ALLOWED_USER_FIELDS = ["name", "first_name", "last_name", "email", "phone", "band_name",
          "notes", "address_line1", "address_line2", "postal_code", "city", "country", "is_blocked", "client_type", "legal_name", "siret", "rna", "instagram_accounts"] as const;
        const body = Object.fromEntries(
          Object.entries(rawBody).filter(([k]) => (ALLOWED_USER_FIELDS as readonly string[]).includes(k))
        ) as {
          name?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          band_name?: string;
          notes?: string;
          address_line1?: string;
          address_line2?: string;
          postal_code?: string;
          city?: string;
          country?: string;
          is_blocked?: number;
          client_type?: string;
          legal_name?: string;
          siret?: string;
          rna?: string;
          instagram_accounts?: string;
        };

        if (body.email) {
          body.email = body.email.trim().toLowerCase();
        }
        if (body.client_type !== undefined && !isClientType(body.client_type)) return jsonError("Type de client invalide", 400);
        if (body.siret !== undefined && isValidSiret(body.siret)) body.siret = normalizeSiret(body.siret);
        if (body.rna !== undefined && isValidRna(body.rna)) body.rna = normalizeRna(body.rna);

        const result = await updateUser(env.DB, id, body);
        if (!result.success) {
          return jsonError(result.error || "Update failed", 400);
        }

        await addAuditLog(env.DB, "user", id, "update", body, request.headers.get("X-Admin-User-Id") || "admin");

        const updated = await getUserById(env.DB, id);
        return jsonSuccess(updated);
      } catch (error) {
        console.error("PUT /api/admin/users/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update user", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Payments API ─────────────────────────────────────────────────────

  route("/api/admin/payments", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const filters = {} as {
        status?: "pending" | "paid" | "refunded" | "partial-refund";
        method?: "card" | "cash" | "transfer" | "check";
        paymentType?: "on-site" | "online";
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        sortBy?: "created_at" | "booking_date" | "amount" | "status" | "method" | "payment_type";
        sortOrder?: "asc" | "desc";
      };

      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const all = url.searchParams.get("all") === "true";

      const status = url.searchParams.get("status");
      if (status) filters.status = status as typeof filters.status;
      const method = url.searchParams.get("method");
      if (method) filters.method = method as typeof filters.method;
      const paymentType = url.searchParams.get("paymentType");
      if (paymentType) filters.paymentType = paymentType as typeof filters.paymentType;
      const search = url.searchParams.get("search");
      if (search) filters.search = search;
      const dateFrom = url.searchParams.get("dateFrom");
      if (dateFrom) filters.dateFrom = dateFrom;
      const dateTo = url.searchParams.get("dateTo");
      if (dateTo) filters.dateTo = dateTo;
      const sortBy = url.searchParams.get("sortBy");
      if (sortBy) filters.sortBy = sortBy as typeof filters.sortBy;
      const sortOrder = url.searchParams.get("sortOrder");
      if (sortOrder) filters.sortOrder = sortOrder as typeof filters.sortOrder;

      const result = await getPayments(env.DB, filters, all ? 1 : page, all ? 9999 : limit);
      return jsonSuccess(result);
    } catch (error) {
      console.error("GET /api/admin/payments error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch payments", 500);
    }
  }),

  route("/api/admin/payments/:id", async ({ request, params }) => {
    if (request.method === "DELETE") {
      try {
        const result = await deletePayment(env.DB, params.id);
        if (!result.success) {
          return jsonError(result.error || "Delete failed", 400);
        }
        return jsonSuccess({ id: params.id, deleted: true });
      } catch (error) {
        console.error("DELETE /api/admin/payments/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to delete payment", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as { amount?: number; method?: string };
        if (!body.amount && !body.method) {
          return jsonError("Au moins un champ à modifier est requis (amount ou method)", 400);
        }
        if (body.amount !== undefined && (typeof body.amount !== "number" || body.amount <= 0)) {
          return jsonError("Le montant doit être un nombre positif", 400);
        }

        const result = await updatePayment(env.DB, params.id, body);
        if (!result.success) {
          return jsonError(result.error || "Update failed", 400);
        }

        return jsonSuccess({ id: params.id, updated: true });
      } catch (error) {
        console.error("PUT /api/admin/payments/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update payment", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/payments/:id/pay", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const result = await markPaymentPaid(env.DB, params.id);
      if (!result.success) {
        return jsonError(result.error || "Pay failed", 400);
      }

      return jsonSuccess({ id: params.id, status: "paid" });
    } catch (error) {
      console.error("PUT /api/admin/payments/:id/pay error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to mark payment paid", 500);
    }
  }),

  route("/api/admin/payments/:id/refund", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { amount?: number; reason?: string };
      if (typeof body.amount !== "number" || body.amount <= 0) {
        return jsonError("Champ obligatoire manquant: amount (> 0)", 400);
      }

      const payment = await getPaymentById(env.DB, params.id);
      if (!payment) return jsonError("Paiement introuvable", 404);

      if (payment.method === "card") {
        const outcome = await refundCardPayment({
          db: env.DB,
          secretKey: env.STRIPE_SECRET_KEY,
          performedBy: request.headers.get("X-Admin-User-Id") || "admin",
        }, params.id, body.amount, body.reason);
        if (!outcome.ok) {
          return jsonResponse({ success: false, error: outcome.message || "Refund failed", code: outcome.code, outcome }, 400);
        }
        return jsonSuccess(outcome);
      }

      const result = await refundPayment(env.DB, params.id, body.amount);
      if (!result.success) return jsonError(result.error || "Refund failed", 400);
      return jsonSuccess({ id: params.id, refundedAmount: body.amount, reason: body.reason });
    } catch (error) {
      console.error("PUT /api/admin/payments/:id/refund error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to refund payment", 500);
    }
  }),

  // ─── Admin Blocked Slots API ────────────────────────────────────────────────

  route("/api/admin/blocked-slots", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        const studioId = url.searchParams.get("studio_id") || undefined;
        const date = url.searchParams.get("date") || undefined;

        const result = await getBlockedSlots(env.DB, studioId, date);
        return jsonSuccess(result);
      } catch (error) {
        console.error("GET /api/admin/blocked-slots error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch blocked slots", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          studioId?: string | null;
          date?: string;
          dateFrom?: string;
          dateTo?: string;
          wholeDay?: boolean;
          startTime?: string;
          endTime?: string;
          reason?: string;
        };

        const dateFrom = body.dateFrom ?? body.date;
        const dateTo = body.dateTo ?? dateFrom;
        const reason = body.reason?.trim() || "";
        const wholeDay = body.wholeDay === true;

        const startTime = wholeDay ? ALL_TIME_SLOTS[0] : body.startTime;
        const endTime = wholeDay ? "00:00" : body.endTime;

        if (!dateFrom || !dateTo || !reason) {
          return jsonError("Champs obligatoires manquants: dateFrom/date, dateTo, reason", 400);
        }

        const mFrom = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateFrom);
        const mTo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTo);
        if (!mFrom || !mTo) {
          return jsonError("Format de date invalide (YYYY-MM-DD)", 400);
        }

        const fromMs = Date.UTC(Number(mFrom[1]), Number(mFrom[2]) - 1, Number(mFrom[3]));
        const toMs = Date.UTC(Number(mTo[1]), Number(mTo[2]) - 1, Number(mTo[3]));
        if (toMs < fromMs) {
          return jsonError("La date de fin doit être après la date de début", 400);
        }

        const totalDays = Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
        if (totalDays > 90) {
          return jsonError("La période ne peut pas dépasser 90 jours", 400);
        }

        if (!wholeDay) {
          if (!startTime || !endTime) {
            return jsonError("Champs obligatoires manquants: startTime, endTime", 400);
          }

          const validStart = ALL_TIME_SLOTS.includes(startTime);
          const validEnd = endTime === "00:00" || ALL_TIME_SLOTS.includes(endTime);
          if (!validStart || !validEnd) {
            return jsonError("Heures invalides", 400);
          }

          if (startTime >= endTime && endTime !== "00:00") {
            return jsonError("L'heure de fin doit être après l'heure de début", 400);
          }
        }

        const createdIds: string[] = [];
        for (let i = 0; i < totalDays; i++) {
          const date = new Date(fromMs + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const result = await addBlockedSlot(env.DB, {
            studio_id: body.studioId ?? null,
            date,
            start_time: startTime!,
            end_time: endTime!,
            reason,
          });
          createdIds.push(result.id);
        }

        await addAuditLog(env.DB, "blocked_slot", createdIds[0], totalDays > 1 ? "create-range" : "create", {
          studio_id: body.studioId,
          date_from: dateFrom,
          date_to: dateTo,
          whole_day: wholeDay,
          start_time: startTime,
          end_time: endTime,
          count: createdIds.length,
          reason,
        }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ success: true, count: createdIds.length });
      } catch (error) {
        console.error("POST /api/admin/blocked-slots error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to add blocked slot", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/blocked-slots/:id", async ({ request, params }) => {
    if (request.method !== "DELETE") return jsonError("Method not allowed", 405);

    try {
      const result = await removeBlockedSlot(env.DB, params.id);
      if (!result.success) {
        return jsonError("Créneau bloqué introuvable", 404);
      }

      await addAuditLog(env.DB, "blocked_slot", params.id, "delete", {}, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, removed: true });
    } catch (error) {
      console.error("DELETE /api/admin/blocked-slots/:id error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to remove blocked slot", 500);
    }
  }),

  // ─── Admin Settings API ─────────────────────────────────────────────────────

  route("/api/admin/settings", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const settings = await getAllSettings(env.DB);
      return jsonSuccess(settings);
    } catch (error) {
      console.error("GET /api/admin/settings error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch settings", 500);
    }
  }),

  route("/api/admin/settings/:key", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { value?: string };
      if (body.value === undefined) {
        return jsonError("Champ obligatoire manquant: value", 400);
      }

      if (typeof body.value !== "string") {
        return jsonError("Champ invalide: value doit être une chaîne", 400);
      }

      const validated = validateAdminSettingValue(params.key, body.value);
      if (!validated.ok) {
        return jsonError(validated.error, 400);
      }

      const previousValue = await getSetting(env.DB, params.key);
      if (previousValue === validated.value) {
        return jsonSuccess({ key: params.key, value: validated.value });
      }

      const result = await setSetting(env.DB, params.key, validated.value);
      if (!result.success) {
        return jsonError("Update failed", 400);
      }

      await addAuditLog(env.DB, "setting", params.key, previousValue === null ? "create" : "update", {
        key: params.key,
        value: validated.value,
        previous_value: previousValue,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ key: params.key, value: validated.value });
    } catch (error) {
      console.error("PUT /api/admin/settings/:key error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to update setting", 500);
    }
  }),

  route("/api/admin/materiel", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const raw = await getSetting(env.DB, "materiel.v1");
        const materiel = parseMaterielSetting(raw) ?? DEFAULT_MATERIEL;
        return jsonSuccess(materiel);
      } catch (error) {
        console.error("GET /api/admin/materiel error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch materiel", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as { materiel?: unknown };
        const input = body.materiel ?? body;
        const normalized = parseMaterielSetting(JSON.stringify(input));
        if (!normalized) {
          return jsonError("Données matériel invalides", 400);
        }

        await setSetting(env.DB, "materiel.v1", JSON.stringify(normalized));
        await addAuditLog(env.DB, "setting", "materiel.v1", "update", { key: "materiel.v1" }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess(normalized);
      } catch (error) {
        console.error("PUT /api/admin/materiel error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update materiel", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Users (operators) API ───────────────────────────────────────────

  route("/api/admin/admin-users", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const result = await env.DB
          .prepare("SELECT id, email, name, role, is_active, created_at, updated_at FROM admin_users ORDER BY created_at ASC")
          .all<{
            id: string;
            email: string;
            name: string;
            role: AdminRole;
            is_active: number;
            created_at: string;
            updated_at: string;
          }>();
        return jsonSuccess(result.results);
      } catch (error) {
        console.error("GET /api/admin/admin-users error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch admin users", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          email?: string;
          name?: string;
          password?: string;
          role?: AdminRole;
        };

        if (!body.email || !body.name || !body.password) {
          return jsonError("Champs obligatoires manquants: email, name, password", 400);
        }

        const normalizedEmail = body.email.trim().toLowerCase();

        const existing = await env.DB
          .prepare("SELECT id FROM admin_users WHERE LOWER(TRIM(email)) = ?")
          .bind(normalizedEmail)
          .first();

        if (existing) {
          return jsonError("Un compte avec cet email existe déjà", 409);
        }

        const id = `adm-${crypto.randomUUID().slice(0, 8)}`;
        const passwordHash = await hashPassword(body.password);
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

        await env.DB.prepare(
          "INSERT INTO admin_users (id, email, password_hash, name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        ).bind(id, normalizedEmail, passwordHash, body.name, body.role || "operator", timestamp, timestamp).run();

        await addAuditLog(env.DB, "admin_user", id, "create", {
          email: normalizedEmail,
          name: body.name,
          role: body.role || "operator",
        }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ id, email: normalizedEmail, name: body.name, role: body.role || "operator", is_active: 1 });
      } catch (error) {
        console.error("POST /api/admin/admin-users error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create admin user", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/admin-users/:id/role", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const currentUserId = request.headers.get("X-Admin-User-Id");
      if (!currentUserId) return jsonError("Unauthorized", 401);
      if (params.id === currentUserId) return jsonError("Vous ne pouvez pas modifier votre propre rôle", 400);

      const body = await request.json() as { role?: AdminRole };
      if (!body.role || (body.role !== "super-admin" && body.role !== "operator")) {
        return jsonError("Rôle invalide", 400);
      }

      const target = await env.DB
        .prepare("SELECT id, role, is_active FROM admin_users WHERE id = ?")
        .bind(params.id)
        .first<{ id: string; role: AdminRole; is_active: number }>();

      if (!target) return jsonError("Utilisateur admin introuvable", 404);

      if (target.role === "super-admin" && body.role !== "super-admin" && target.is_active) {
        const countRow = await env.DB
          .prepare("SELECT COUNT(*) as count FROM admin_users WHERE role = 'super-admin' AND is_active = 1")
          .first<{ count: number | string }>();
        const count = typeof countRow?.count === "string" ? parseInt(countRow.count, 10) : (countRow?.count ?? 0);

        if (count <= 1) {
          return jsonError("Impossible : vous devez conserver au moins un super-admin actif", 400);
        }
      }

      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

      await env.DB.prepare(
        "UPDATE admin_users SET role = ?, updated_at = ? WHERE id = ?",
      ).bind(body.role, timestamp, params.id).run();

      await addAuditLog(env.DB, "admin_user", params.id, "role_update", {
        role: body.role,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, role: body.role });
    } catch (error) {
      console.error("PUT /api/admin/admin-users/:id/role error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to update admin user role", 500);
    }
  }),

  route("/api/admin/admin-users/:id", async ({ request, params }) => {
    if (request.method !== "DELETE") return jsonError("Method not allowed", 405);

    try {
      const currentUserId = request.headers.get("X-Admin-User-Id");
      if (!currentUserId) return jsonError("Unauthorized", 401);
      if (params.id === currentUserId) return jsonError("Vous ne pouvez pas supprimer votre propre compte", 400);

      const target = await env.DB
        .prepare("SELECT id, role, is_active FROM admin_users WHERE id = ?")
        .bind(params.id)
        .first<{ id: string; role: AdminRole; is_active: number }>();

      if (!target) return jsonError("Utilisateur admin introuvable", 404);

      if (target.role === "super-admin" && target.is_active) {
        const countRow = await env.DB
          .prepare("SELECT COUNT(*) as count FROM admin_users WHERE role = 'super-admin' AND is_active = 1")
          .first<{ count: number | string }>();
        const count = typeof countRow?.count === "string" ? parseInt(countRow.count, 10) : (countRow?.count ?? 0);

        if (count <= 1) {
          return jsonError("Impossible : vous devez conserver au moins un super-admin actif", 400);
        }
      }

      await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(params.id).run();
      const result = await env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(params.id).run();
      if (result.meta.changes === 0) return jsonError("Utilisateur admin introuvable", 404);

      await addAuditLog(env.DB, "admin_user", params.id, "delete", {}, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, deleted: true });
    } catch (error) {
      console.error("DELETE /api/admin/admin-users/:id error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to delete admin user", 500);
    }
  }),

  route("/api/admin/admin-users/:id/toggle", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const currentUserId = request.headers.get("X-Admin-User-Id");
      if (!currentUserId) return jsonError("Unauthorized", 401);
      if (params.id === currentUserId) return jsonError("Vous ne pouvez pas désactiver votre propre compte", 400);

      const user = await env.DB
        .prepare("SELECT id, is_active FROM admin_users WHERE id = ?")
        .bind(params.id)
        .first<{ id: string; is_active: number }>();

      if (!user) return jsonError("Utilisateur admin introuvable", 404);

      const newStatus = user.is_active ? 0 : 1;

      if (newStatus === 0) {
        const roleRow = await env.DB
          .prepare("SELECT role FROM admin_users WHERE id = ?")
          .bind(params.id)
          .first<{ role: AdminRole }>();
        if (roleRow?.role === "super-admin") {
          const countRow = await env.DB
            .prepare("SELECT COUNT(*) as count FROM admin_users WHERE role = 'super-admin' AND is_active = 1")
            .first<{ count: number | string }>();
          const count = typeof countRow?.count === "string" ? parseInt(countRow.count, 10) : (countRow?.count ?? 0);
          if (count <= 1) {
            return jsonError("Impossible : vous devez conserver au moins un super-admin actif", 400);
          }
        }
      }

      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

      await env.DB.prepare(
        "UPDATE admin_users SET is_active = ?, updated_at = ? WHERE id = ?",
      ).bind(newStatus, timestamp, params.id).run();

      if (!newStatus) {
        await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(params.id).run();
      }

      await addAuditLog(env.DB, "admin_user", params.id, newStatus ? "activate" : "deactivate", {
        is_active: newStatus,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, is_active: newStatus });
    } catch (error) {
      console.error("PUT /api/admin/admin-users/:id/toggle error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to toggle admin user", 500);
    }
  }),

  route("/api/admin/change-password", async ({ request }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);
    try {
      const adminUserId = request.headers.get("X-Admin-User-Id");
      if (!adminUserId) return jsonError("Non authentifié", 401);

      const body = await request.json() as { currentPassword?: string; newPassword?: string };
      if (!body.currentPassword || !body.newPassword) {
        return jsonError("Champs obligatoires manquants: currentPassword, newPassword", 400);
      }
      if (body.newPassword.length < 8) {
        return jsonError("Le nouveau mot de passe doit contenir au moins 8 caractères", 400);
      }

      // Fetch current admin user
      const adminUser = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?")
        .bind(adminUserId).first<{ id: string; email: string; password_hash: string; name: string }>();
      if (!adminUser) return jsonError("Utilisateur introuvable", 404);

      // Verify current password
      const isValid = await verifyPassword(body.currentPassword, adminUser.password_hash);
      if (!isValid) return jsonError("Mot de passe actuel incorrect", 400);

      // Hash new password
      const newHash = await hashPassword(body.newPassword);
      await env.DB.prepare("UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(newHash, new Date().toISOString(), adminUserId).run();

      await addAuditLog(env.DB, "admin_user", adminUserId, "change-password", {}, adminUserId);
      return jsonSuccess({ success: true });
    } catch (error) {
      console.error("PUT /api/admin/change-password error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  // ─── Admin Audit Log API ────────────────────────────────────────────────────

  route("/api/admin/audit", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const filters: AuditLogFilters = {};

      const entityType = url.searchParams.get("entity_type");
      if (entityType) filters.entityType = entityType;
      const action = url.searchParams.get("action");
      if (action) filters.action = action;
      const adminId = url.searchParams.get("admin_id");
      if (adminId) filters.performedBy = adminId;
      const dateFrom = url.searchParams.get("from_date");
      if (dateFrom) filters.dateFrom = dateFrom;
      const dateTo = url.searchParams.get("to_date");
      if (dateTo) filters.dateTo = dateTo;

      const sortBy = url.searchParams.get("sort_by") || "date";
      const sortOrder = url.searchParams.get("sort_order") || "desc";
      const result = await getAuditLogs(env.DB, filters, page, limit, sortBy, sortOrder);
      return jsonSuccess(result);
    } catch (error) {
      console.error("GET /api/admin/audit error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch audit logs", 500);
    }
  }),

  // ─── Admin Pricing API ──────────────────────────────────────────────────────

  route("/api/admin/pricing", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const pricing = await getPricing(env.DB);
      return jsonSuccess(pricing);
    } catch (error) {
      console.error("GET /api/admin/pricing error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch pricing", 500);
    }
  }),

  route("/api/admin/pricing/:id", async ({ request, params }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { price?: number };
      if (body.price === undefined || body.price < 0) {
        return jsonError("Champ obligatoire manquant: price (>= 0)", 400);
      }

      const result = await updatePricing(env.DB, params.id, body.price);
      if (!result.success) {
        return jsonError("Tarif introuvable", 404);
      }

      await addAuditLog(env.DB, "pricing", params.id, "update", {
        price_per_half_hour: body.price,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ id: params.id, price: body.price });
    } catch (error) {
      console.error("PUT /api/admin/pricing/:id error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to update pricing", 500);
    }
  }),

  // ─── Admin Equipment API ────────────────────────────────────────────────────

  route("/api/admin/equipment", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const equipment = await getEquipment(env.DB);
        return jsonSuccess(equipment);
      } catch (error) {
        console.error("GET /api/admin/equipment error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch equipment", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          name?: string;
          equipment_id?: string;
          max_per_session?: number;
          stock_total?: number;
          pricing_type?: string;
          session_pricing?: string;
          price_per_hour?: number;
        };

        if (!body.name || !body.equipment_id) {
          return jsonError("Champs obligatoires manquants: name, equipment_id", 400);
        }
        if (body.stock_total !== undefined && (!Number.isFinite(body.stock_total) || body.stock_total < 1)) {
          return jsonError("Le stock physique doit être au moins 1", 400);
        }

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

        await env.DB.prepare(`
          INSERT INTO equipment (id, equipment_id, name, max_per_session, stock_total, pricing_type, session_pricing, price_per_hour, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.equipment_id,
          body.name,
          body.max_per_session ?? 1,
          body.stock_total ?? 1,
          body.pricing_type ?? "per_session",
          body.session_pricing ?? null,
          body.price_per_hour ?? 0,
          timestamp,
        ).run();

        await addAuditLog(env.DB, "equipment", id, "create", {
          name: body.name,
          equipment_id: body.equipment_id,
        }, request.headers.get("X-Admin-User-Id") || "admin");

        const created = await env.DB.prepare("SELECT * FROM equipment WHERE id = ?").bind(id).first();
        return jsonSuccess(created);
      } catch (error) {
        console.error("POST /api/admin/equipment error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create equipment", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/equipment/:id", async ({ request, params }) => {
    const { id } = params;

    if (request.method === "PUT") {
      try {
        const body = await request.json() as {
          name?: string;
          max_per_session?: number;
          stock_total?: number;
          pricing_type?: string;
          session_pricing?: string;
          price_per_hour?: number;
        };

        if (body.stock_total !== undefined && (!Number.isFinite(body.stock_total) || body.stock_total < 1)) {
          return jsonError("Le stock physique doit être au moins 1", 400);
        }

        const result = await updateEquipment(env.DB, id, body);
        if (!result.success) {
          return jsonError("Équipement introuvable", 404);
        }

        await addAuditLog(env.DB, "equipment", id, "update", body, request.headers.get("X-Admin-User-Id") || "admin");

        const updated = await env.DB.prepare("SELECT * FROM equipment WHERE id = ?").bind(id).first();
        return jsonSuccess(updated);
      } catch (error) {
        console.error("PUT /api/admin/equipment/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update equipment", 500);
      }
    }

    if (request.method === "DELETE") {
      try {
        const result = await env.DB.prepare("DELETE FROM equipment WHERE id = ?").bind(id).run();
        if (result.meta.changes === 0) {
          return jsonError("Équipement introuvable", 404);
        }

        await addAuditLog(env.DB, "equipment", id, "delete", {}, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ id, deleted: true });
      } catch (error) {
        console.error("DELETE /api/admin/equipment/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to delete equipment", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Promo Codes API ──────────────────────────────────────────────────

  route("/api/admin/promo-codes", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const codes = await getPromoCodes(env.DB);
        return jsonSuccess(codes);
      } catch (error) {
        console.error("GET /api/admin/promo-codes error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch promo codes", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as {
          code?: string;
          type?: "percentage" | "fixed";
          value?: number;
          min_total?: number;
          expires_at?: string;
          max_usage?: number;
          round_mode?: "down" | "up" | "none";
        };

        if (!body.code || !body.type || body.value === undefined) {
          return jsonError("Champs obligatoires manquants: code, type, value", 400);
        }

        const result = await createPromoCode(env.DB, {
          code: body.code,
          type: body.type,
          value: body.value,
          min_total: body.min_total,
          expires_at: body.expires_at,
          max_usage: body.max_usage,
          round_mode: body.round_mode,
        });

        // Record the full promo configuration exactly as persisted by
        // createPromoCode (defaults applied), so the audit entry faithfully
        // reflects the initial state: is_active is always 1 on create, code is
        // stored uppercased, and min_total/max_usage/expires_at default to
        // null-unlimited when omitted.
        await addAuditLog(env.DB, "promo", result.id, "create", {
          code: body.code.toUpperCase(),
          type: body.type,
          value: body.value,
          min_total: body.min_total ?? 0,
          is_active: 1,
          expires_at: body.expires_at ?? null,
          max_usage: body.max_usage ?? null,
          round_mode: body.round_mode ?? "none",
        }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess(result);
      } catch (error) {
        console.error("POST /api/admin/promo-codes error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create promo code", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/promo-codes/:id", async ({ request, params }) => {
    const { id } = params;

    if (request.method === "PUT") {
      try {
        const body = await request.json() as {
          code?: string;
          type?: "percentage" | "fixed";
          value?: number;
          min_total?: number;
          is_active?: number;
          expires_at?: string;
          max_usage?: number;
          round_mode?: "down" | "up" | "none";
        };

        const result = await updatePromoCode(env.DB, id, body);
        if (!result.success) {
          return jsonError("Code promo introuvable", 404);
        }

        // Preserve the existing changed-fields semantics: only the keys present
        // in the request body were applied by updatePromoCode, so the audit
        // records exactly those (restricted to known promo config fields).
        // max_usage is guaranteed to be captured whenever it is part of the
        // update payload.
        const changes: Record<string, unknown> = {};
        if (body.code !== undefined) changes.code = body.code;
        if (body.type !== undefined) changes.type = body.type;
        if (body.value !== undefined) changes.value = body.value;
        if (body.min_total !== undefined) changes.min_total = body.min_total;
        if (body.is_active !== undefined) changes.is_active = body.is_active;
        if (body.expires_at !== undefined) changes.expires_at = body.expires_at;
        if (body.max_usage !== undefined) changes.max_usage = body.max_usage;
        if (body.round_mode !== undefined) changes.round_mode = body.round_mode;

        await addAuditLog(env.DB, "promo", id, "update", changes, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ id, updated: true });
      } catch (error) {
        console.error("PUT /api/admin/promo-codes/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update promo code", 500);
      }
    }

    if (request.method === "DELETE") {
      try {
        const result = await env.DB.prepare("DELETE FROM promo_codes WHERE id = ?").bind(id).run();
        if (result.meta.changes === 0) {
          return jsonError("Code promo introuvable", 404);
        }

        await addAuditLog(env.DB, "promo", id, "delete", {}, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ id, deleted: true });
      } catch (error) {
        console.error("DELETE /api/admin/promo-codes/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to delete promo code", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Opening Hours API ────────────────────────────────────────────────

  route("/api/admin/opening-hours", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const hours = await getOpeningHours(env.DB);
        return jsonSuccess(hours);
      } catch (error) {
        console.error("GET /api/admin/opening-hours error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch opening hours", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as Array<{
          id: string;
          open_time?: string;
          close_time?: string;
          is_closed?: number;
        }>;

        if (!Array.isArray(body) || body.length === 0) {
          return jsonError("Body doit être un tableau non vide", 400);
        }

        for (const entry of body) {
          if (!entry.id) {
            return jsonError("Chaque entrée doit avoir un id", 400);
          }
          await updateOpeningHours(env.DB, entry.id, {
            open_time: entry.open_time,
            close_time: entry.close_time,
            is_closed: entry.is_closed,
          });
        }

        await addAuditLog(env.DB, "opening_hours", "batch", "batch-update", {
          count: body.length,
          ids: body.map(e => e.id),
        }, request.headers.get("X-Admin-User-Id") || "admin");

        const updated = await getOpeningHours(env.DB);
        return jsonSuccess(updated);
      } catch (error) {
        console.error("PUT /api/admin/opening-hours error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update opening hours", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/public-holidays", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const raw = await getSetting(env.DB, "public_holidays");
        const holidays: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        return jsonSuccess(holidays);
      } catch (error) {
        console.error("GET /api/admin/public-holidays error:", error);
        return jsonError("Failed to fetch public holidays", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as string[];
        if (!Array.isArray(body)) return jsonError("Body doit être un tableau de dates", 400);
        const validated = body.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
        const sorted = [...new Set(validated)].sort();
        await setSetting(env.DB, "public_holidays", JSON.stringify(sorted));
        await addAuditLog(env.DB, "setting", "public_holidays", "update", { count: sorted.length }, request.headers.get("X-Admin-User-Id") || "admin");
        return jsonSuccess(sorted);
      } catch (error) {
        console.error("PUT /api/admin/public-holidays error:", error);
        return jsonError("Failed to update public holidays", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/peak-hours", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const raw = await getSetting(env.DB, "peak_start_hour");
        const peakStartHour = raw ? parseInt(raw, 10) : 18;
        return jsonSuccess({ peakStartHour });
      } catch (error) {
        console.error("GET /api/admin/peak-hours error:", error);
        return jsonError("Failed to fetch peak hours config", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as { peakStartHour: number };
        const hour = Math.round(body.peakStartHour);
        if (typeof hour !== "number" || hour < 10 || hour > 23) {
          return jsonError("Heure invalide (10-23)", 400);
        }
        await setSetting(env.DB, "peak_start_hour", String(hour));
        await addAuditLog(env.DB, "setting", "peak_start_hour", "update", { peakStartHour: hour }, request.headers.get("X-Admin-User-Id") || "admin");
        return jsonSuccess({ peakStartHour: hour });
      } catch (error) {
        console.error("PUT /api/admin/peak-hours error:", error);
        return jsonError("Failed to update peak hours config", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Stats API ────────────────────────────────────────────────────────

  route("/api/admin/stats/meta", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const row = await env.DB.prepare(
        "SELECT MIN(date) as min_date, MAX(date) as max_date FROM bookings",
      ).first<{ min_date: string | null; max_date: string | null }>();

      const minYear = row?.min_date ? parseInt(row.min_date.slice(0, 4), 10) : null;
      const maxYear = row?.max_date ? parseInt(row.max_date.slice(0, 4), 10) : null;

      return jsonSuccess({
        minYear: Number.isFinite(minYear) ? minYear : null,
        maxYear: Number.isFinite(maxYear) ? maxYear : null,
      });
    } catch (error) {
      console.error("GET /api/admin/stats/meta error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch stats meta", 500);
    }
  }),

  route("/api/admin/stats", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const monthRaw = url.searchParams.get("month");
      const yearRaw = url.searchParams.get("year");
      const weekRaw = url.searchParams.get("week");
      const modeRaw = url.searchParams.get("mode");
      const periodRaw = url.searchParams.get("period");

      const month = monthRaw ? parseInt(monthRaw, 10) : undefined;
      const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
      const week = weekRaw ? parseInt(weekRaw, 10) : undefined;

      const mode = (modeRaw === "today" || modeRaw === "rolling" || modeRaw === "week" || modeRaw === "month" || modeRaw === "year" || modeRaw === "custom")
        ? modeRaw
        : undefined;
      const period = (periodRaw === "week" || periodRaw === "month" || periodRaw === "quarter" || periodRaw === "year")
        ? periodRaw
        : undefined;

      const dateFromRaw = url.searchParams.get("dateFrom");
      const dateToRaw = url.searchParams.get("dateTo");
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      const dateFrom = dateFromRaw && ISO_DATE_RE.test(dateFromRaw) ? dateFromRaw : undefined;
      const dateTo = dateToRaw && ISO_DATE_RE.test(dateToRaw) ? dateToRaw : undefined;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return jsonError("dateFrom must be <= dateTo", 400);
      }

      const stats = await getDashboardStats(env.DB, { month, year, week, mode, period, dateFrom, dateTo });
      return jsonSuccess(stats);
    } catch (error) {
      console.error("GET /api/admin/stats error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch stats", 500);
    }
  }),

  route("/api/admin/stats/revenue", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const mode = url.searchParams.get("mode") || "rolling";
      const period = url.searchParams.get("period") || "month";
      const monthRaw = url.searchParams.get("month");
      const yearRaw = url.searchParams.get("year");

      const month = monthRaw ? parseInt(monthRaw, 10) : undefined;
      const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
      const weekRaw = url.searchParams.get("week");
      const week = weekRaw ? parseInt(weekRaw, 10) : undefined;

      const dateFromRaw = url.searchParams.get("dateFrom");
      const dateToRaw = url.searchParams.get("dateTo");
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      const dateFrom = dateFromRaw && ISO_DATE_RE.test(dateFromRaw) ? dateFromRaw : undefined;
      const dateTo = dateToRaw && ISO_DATE_RE.test(dateToRaw) ? dateToRaw : undefined;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return jsonError("dateFrom must be <= dateTo", 400);
      }

      const { from: fromStr, to: toStr, groupByMonth } = resolveStatsRange({
        mode: mode as any,
        period: period as any,
        year,
        month,
        week,
        dateFrom,
        dateTo,
      });

      if (groupByMonth) {
        const rows = await env.DB.prepare(
          `SELECT substr(date, 1, 7) as date, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue
           FROM bookings
           WHERE date >= ? AND date <= ? AND status != 'cancelled'
           GROUP BY substr(date, 1, 7)
           ORDER BY substr(date, 1, 7) ASC`,
        ).bind(fromStr, toStr).all<{ date: string; revenue: number }>();

        return jsonSuccess(rows.results.map((row) => ({ date: row.date, revenue: row.revenue })));
      }

      const bookings = await env.DB.prepare(
        "SELECT date, COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled' GROUP BY date ORDER BY date ASC",
      ).bind(fromStr, toStr).all<{ date: string; revenue: number }>();

      return jsonSuccess(bookings.results.map((row) => ({ date: row.date, revenue: row.revenue })));
    } catch (error) {
      console.error("GET /api/admin/stats/revenue error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch revenue stats", 500);
    }
  }),

  route("/api/admin/stats/charts", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const mode = url.searchParams.get("mode") || "rolling";
      const period = url.searchParams.get("period") || "month";
      const monthRaw = url.searchParams.get("month");
      const yearRaw = url.searchParams.get("year");

      const month = monthRaw ? parseInt(monthRaw, 10) : undefined;
      const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
      const weekRaw = url.searchParams.get("week");
      const week = weekRaw ? parseInt(weekRaw, 10) : undefined;

      const dateFromRaw = url.searchParams.get("dateFrom");
      const dateToRaw = url.searchParams.get("dateTo");
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      const dateFrom = dateFromRaw && ISO_DATE_RE.test(dateFromRaw) ? dateFromRaw : undefined;
      const dateTo = dateToRaw && ISO_DATE_RE.test(dateToRaw) ? dateToRaw : undefined;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return jsonError("dateFrom must be <= dateTo", 400);
      }

      const { from: fromStr, to: toStr } = resolveStatsRange({
        mode: mode as any,
        period: period as any,
        year,
        month,
        week,
        dateFrom,
        dateTo,
      });

      const occupancyStmt = env.DB.prepare(
        `SELECT date, studio_id, start_time, end_time
         FROM bookings
         WHERE date >= ? AND date <= ? AND status != 'cancelled'
         ORDER BY date ASC, start_time ASC`,
      ).bind(fromStr, toStr);

       const [occupancyResult, studioResult, onSitePaidResult, onlineCardResult, upcomingResult] = await env.DB.batch([
         occupancyStmt,
        // Studio distribution
        env.DB.prepare(
          `SELECT studio_id, COUNT(*) as count, SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)) as revenue
           FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'
           GROUP BY studio_id`,
        ).bind(fromStr, toStr),
        env.DB.prepare(
          `SELECT
            p.method as method,
            COUNT(*) as count,
            COALESCE(SUM(p.amount - COALESCE(p.refunded_amount, 0)), 0) as revenue
          FROM payments p
          JOIN bookings b ON b.id = p.booking_id
          WHERE b.date >= ? AND b.date <= ?
            AND b.status != 'cancelled'
            AND p.status IN ('paid', 'refunded', 'partial-refund')
          GROUP BY p.method`,
        ).bind(fromStr, toStr),
        env.DB.prepare(
          `SELECT
            COUNT(*) as count,
            COALESCE(SUM(MAX(total_price - COALESCE(promo_discount, 0), 0)), 0) as revenue
          FROM bookings
          WHERE date >= ? AND date <= ?
            AND status != 'cancelled'
            AND payment_method = 'card'
            AND payment_status = 'paid'
            AND id NOT IN (SELECT booking_id FROM payments WHERE status = 'paid')`,
         ).bind(fromStr, toStr),
         env.DB.prepare(
           `SELECT
              b.id,
              b.booking_ref,
              b.user_id,
              b.studio_id,
              b.date,
              b.start_time,
              b.end_time,
              b.total_price,
              u.name as user_name
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.date >= ? AND b.date <= ? AND b.status != 'cancelled'
            ORDER BY b.date DESC, b.start_time DESC
            LIMIT 10`,
         ).bind(fromStr, toStr),
       ]);

      type BookingSlotRow = { date: string; studio_id: string; start_time: string; end_time: string };
      type StudioRow = { studio_id: string; count: number; revenue: number };
      type PaymentRow = { method: string; count: number; revenue: number };
      type OnlineCardRow = { count: number; revenue: number };

      function parseDateISOToUTCNoon(dateISO: string): Date {
        const [y, m, d] = dateISO.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      }

      function getStudioOpenSlotsCount(studioId: StudioId, dayOfWeek: number): number {
        const hours = STUDIO_HOURS[studioId][dayOfWeek];
        const openIdx = ALL_TIME_SLOTS.indexOf(hours.open);
        const closeIdx = hours.close === "00:00" ? ALL_TIME_SLOTS.length : ALL_TIME_SLOTS.indexOf(hours.close);
        if (openIdx === -1) return 0;
        const safeClose = closeIdx === -1 ? ALL_TIME_SLOTS.length : closeIdx;
        return Math.max(0, safeClose - openIdx);
      }

      const occupancyData = (() => {
        const bookings = occupancyResult.results as unknown as BookingSlotRow[];

        const bucketForDate = (dateISO: string): string => {
          if (mode === "year") return dateISO.slice(0, 7);

          if (mode === "month") {
            const d = parseDateISOToUTCNoon(dateISO);
            const mondayOffset = (d.getUTCDay() + 6) % 7;
            const monday = new Date(d);
            monday.setUTCDate(d.getUTCDate() - mondayOffset);
            const weekStartISO = getParisDateISO(monday);
            return weekStartISO < fromStr ? fromStr : weekStartISO;
          }

          return dateISO;
        };

        const bookedSlotsByBucket = new Map<string, number>();
        for (const row of bookings) {
          const bucket = bucketForDate(row.date);
          const startIdx = ALL_TIME_SLOTS.indexOf(row.start_time);
          let endIdx = ALL_TIME_SLOTS.indexOf(row.end_time);
          if (endIdx === -1 && row.end_time === "00:00") endIdx = ALL_TIME_SLOTS.length;
          if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) continue;

          bookedSlotsByBucket.set(bucket, (bookedSlotsByBucket.get(bucket) ?? 0) + (endIdx - startIdx));
        }

        const openSlotsByBucket = new Map<string, number>();
        const dayBucketsInOrder: string[] = [];
        const weekBucketsInOrder: string[] = [];

        const from = parseDateISOToUTCNoon(fromStr);
        const to = parseDateISOToUTCNoon(toStr);
        for (let d = new Date(from); d.getTime() <= to.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
          const dateISO = getParisDateISO(d);
          const bucket = bucketForDate(dateISO);
          const dayOfWeek = d.getUTCDay();
          const openSlots =
            getStudioOpenSlotsCount("la-scene", dayOfWeek) +
            getStudioOpenSlotsCount("le-podium", dayOfWeek);

          openSlotsByBucket.set(bucket, (openSlotsByBucket.get(bucket) ?? 0) + openSlots);

          if (mode === "month") {
            if (weekBucketsInOrder.length === 0 || weekBucketsInOrder[weekBucketsInOrder.length - 1] !== bucket) {
              weekBucketsInOrder.push(bucket);
            }
          } else if (mode !== "year") {
            dayBucketsInOrder.push(bucket);
          }
        }

        const pct = (bookedSlots: number, openSlots: number): number => {
          if (openSlots <= 0) return 0;
          const raw = (bookedSlots / openSlots) * 100;
          const clamped = Math.max(0, Math.min(raw, 100));
          return Math.round(clamped * 10) / 10;
        };

        if (mode === "year") {
          const yr = year ?? parseInt(fromStr.slice(0, 4), 10);
          const items: Array<{ day: string; occupancyPct: number; bookedSlots: number; openSlots: number }> = [];
          for (let m = 1; m <= 12; m++) {
            const key = `${String(yr).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
            const openSlots = openSlotsByBucket.get(key) ?? 0;
            const bookedSlots = bookedSlotsByBucket.get(key) ?? 0;
            items.push({ day: key, occupancyPct: pct(bookedSlots, openSlots), bookedSlots, openSlots });
          }
          return items;
        }

        if (mode === "month") {
          return weekBucketsInOrder.map((bucket) => {
            const openSlots = openSlotsByBucket.get(bucket) ?? 0;
            const bookedSlots = bookedSlotsByBucket.get(bucket) ?? 0;
            return { day: bucket, occupancyPct: pct(bookedSlots, openSlots), bookedSlots, openSlots };
          });
        }

        return dayBucketsInOrder.map((bucket) => {
          const openSlots = openSlotsByBucket.get(bucket) ?? 0;
          const bookedSlots = bookedSlotsByBucket.get(bucket) ?? 0;
          return { day: bucket, occupancyPct: pct(bookedSlots, openSlots), bookedSlots, openSlots };
        });
      })();

      const studioData = (studioResult.results as unknown as StudioRow[]).map(row => ({
        studio: studioLabel(row.studio_id),
        count: row.count,
        revenue: row.revenue,
      }));

      const onSitePayments = (onSitePaidResult.results as unknown as PaymentRow[]);
      const onlineCard = (onlineCardResult.results as unknown as OnlineCardRow[])[0] ?? { count: 0, revenue: 0 };
      const merged: Record<string, { count: number; revenue: number }> = {};
      for (const row of onSitePayments) {
        const method = row.method === "cheque" ? "check" : row.method;
        merged[method] = {
          count: (merged[method]?.count ?? 0) + (row.count ?? 0),
          revenue: (merged[method]?.revenue ?? 0) + (row.revenue ?? 0),
        };
      }
      merged.card = {
        count: (merged.card?.count ?? 0) + onlineCard.count,
        revenue: (merged.card?.revenue ?? 0) + onlineCard.revenue,
      };

      const paymentMethods = ["cash", "card", "transfer", "check"] as const;
      const paymentData = paymentMethods.map((method) => ({
        method: paymentMethodLabelShort(method),
        count: merged[method]?.count ?? 0,
        revenue: merged[method]?.revenue ?? 0,
      }));

      return jsonSuccess({
        occupancy: occupancyData,
        studios: studioData,
        payments: paymentData,
        upcomingBookings: upcomingResult.results,
      });
    } catch (error) {
      console.error("GET /api/admin/stats/charts error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch chart data", 500);
    }
  }),

  route("/api/admin/stats/report", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    const url = new URL(request.url);
    const month = parseInt(url.searchParams.get("month") || "1", 10);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);

    try {
      const data = await getMonthlyReportData(env.DB, month, year);
      return jsonSuccess(data);
    } catch (error) {
      console.error("GET /api/admin/stats/report error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to generate report", 500);
    }
  }),

  // ─── Public Google Reviews API ──────────────────────────────────────────────

  route("/api/reviews", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const reviews = await getStoredReviews(env.DB);
      const syncData = await getReviewsSyncData(env.DB);

      return jsonSuccess({
        reviews,
        totalReviews: syncData?.totalReviews ?? reviews.length,
        averageRating: syncData?.averageRating ?? 5,
        lastSync: syncData?.lastSync ?? null,
      });
    } catch (error) {
      console.error("GET /api/reviews error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch reviews", 500);
    }
  }),

  route("/api/reviews/sync", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const apiKey = (env as any).GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return jsonError("GOOGLE_PLACES_API_KEY not configured", 500);
      }

      const result = await syncGoogleReviews(env.DB, apiKey);

      if (!result.success) {
        return jsonError(result.error || "Sync failed", 500);
      }

      return jsonSuccess({
        success: true,
        reviewsCount: result.reviewsCount,
        averageRating: result.averageRating,
        totalReviews: result.totalReviews,
      });
    } catch (error) {
      console.error("POST /api/reviews/sync error:", error);
      return jsonError(error instanceof Error ? error.message : "Sync failed", 500);
    }
  }),

  route("/api/instagram/feed", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    const cacheHeaders = {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    };
    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    try {
      // 1. Read cached data
      const cachedPosts = await getCachedInstagramFeed(env.DB);
      const cacheMeta = await env.DB
        .prepare("SELECT updated_at FROM settings WHERE key = ?")
        .bind("instagram_feed_cache")
        .first<{ updated_at: string }>();
      
      const cacheAge = cacheMeta?.updated_at 
        ? Date.now() - new Date(cacheMeta.updated_at).getTime() 
        : Infinity;

      // 2. If cache is fresh, return it immediately
      if (cachedPosts.length > 0 && cacheAge < CACHE_TTL) {
        return new Response(JSON.stringify({ success: true, data: cachedPosts }), {
          headers: cacheHeaders,
        });
      }

      // 3. Cache is stale or missing — fetch fresh data and update cache
      const token = await getInstagramToken(env.DB, env.INSTAGRAM_ACCESS_TOKEN);
      let freshPosts: Awaited<ReturnType<typeof fetchInstagramFeedFromAPI>> | null = null;

      try {
        freshPosts = token
          ? await fetchInstagramFeedFromAPI(token)
          : await fetchInstagramFeedFromRSS();

        if (freshPosts.length > 0) {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))"
          ).bind("instagram-feed", "instagram_feed_cache", JSON.stringify({
            data: freshPosts,
            last_updated: new Date().toISOString()
          })).run();
        } else {
          console.warn("Instagram feed fetch returned zero posts; keeping existing cache");
        }
      } catch (fetchError) {
        console.error("Instagram fetch failed, falling back to cache:", fetchError);
      }

      // 4. Return fresh data if available, otherwise fall back to stale cache
      if (freshPosts && freshPosts.length > 0) {
        return new Response(JSON.stringify({ success: true, data: freshPosts }), {
          headers: cacheHeaders,
        });
      }

      if (cachedPosts.length > 0) {
        return new Response(JSON.stringify({ success: true, data: cachedPosts, stale: true }), {
          headers: cacheHeaders,
        });
      }

      return jsonError("Aucune publication disponible. Vérifiez le token Instagram dans l'administration.", 503);
    } catch (error) {
      console.error("GET /api/instagram/feed error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch feed", 500);
    }
  }),

  route("/api/instagram/proxy-image", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const imageUrl = url.searchParams.get("url");
      
      if (!imageUrl) {
        return jsonError("URL parameter required", 400);
      }

      let parsedImageUrl: URL;
      try {
        parsedImageUrl = new URL(imageUrl);
      } catch {
        return jsonError("Invalid image URL", 400);
      }

      if (!isAllowedInstagramMediaUrl(parsedImageUrl)) {
        console.error("Rejected Instagram proxy media host:", parsedImageUrl.hostname);
        return new Response(null, { status: 403 });
      }

      const range = request.headers.get("Range");
      const fetchMedia = (target: URL) => {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };
        if (range) headers.Range = range;
        return fetch(target, {
          redirect: "manual",
          headers,
        });
      };
      let mediaResponse = await fetchMedia(parsedImageUrl);

      if (mediaResponse.status >= 300 && mediaResponse.status < 400) {
        const location = mediaResponse.headers.get("Location");
        if (!location) return new Response(null, { status: 502 });

        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, parsedImageUrl);
        } catch {
          return new Response(null, { status: 502 });
        }
        if (!isAllowedInstagramMediaUrl(redirectUrl)) return new Response(null, { status: 502 });

        mediaResponse = await fetchMedia(redirectUrl);
      }

      if (!mediaResponse.ok && mediaResponse.status !== 206) {
        return new Response(null, { status: 502 });
      }

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", mediaResponse.headers.get("Content-Type") || "application/octet-stream");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
      responseHeaders.set("Accept-Ranges", mediaResponse.headers.get("Accept-Ranges") || "bytes");
      const contentLength = mediaResponse.headers.get("Content-Length");
      if (contentLength) responseHeaders.set("Content-Length", contentLength);
      const contentRange = mediaResponse.headers.get("Content-Range");
      if (contentRange) responseHeaders.set("Content-Range", contentRange);

      return new Response(mediaResponse.body, {
        status: mediaResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("GET /api/instagram/proxy-image error:", error);
      return new Response(null, { status: 502 });
    }
  }),

  route("/api/admin/instagram/sync", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const token = await getInstagramToken(env.DB, env.INSTAGRAM_ACCESS_TOKEN);
      const result = await syncInstagram(env.DB, token);
      if (!result.success) return jsonError(result.error || "Sync failed", 500);

      await addAuditLog(env.DB, "instagram", "feed", "sync", { count: result.count }, request.headers.get("X-Admin-User-Id") || "admin");
      return jsonSuccess(result);
    } catch (error) {
      console.error("POST /api/admin/instagram/sync error:", error);
      return jsonError(error instanceof Error ? error.message : "Sync failed", 500);
    }
  }),

  route("/api/admin/instagram/token", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const { token } = await request.json() as { token: string };
      const normalizedToken = token?.trim();
      if (!normalizedToken) return jsonError("Token requis", 400);

      const validationResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(normalizedToken)}`
      );
      if (!validationResponse.ok) {
        const validationBody = await validationResponse.text();
        let message = "Token Instagram invalide";
        try {
          const parsed = JSON.parse(validationBody) as { error?: { message?: string } };
          message = parsed.error?.message || message;
        } catch {
          // Keep a safe generic message when Graph does not return JSON.
        }
        return jsonError(message, 400);
      }

      await persistInstagramToken(env.DB, normalizedToken, INSTAGRAM_LONG_LIVED_TOKEN_SECONDS);
      await addAuditLog(env.DB, "settings", "instagram", "update_token", {}, request.headers.get("X-Admin-User-Id") || "admin");

      const result = await syncInstagram(env.DB, normalizedToken);

      return jsonSuccess({ success: true, sync: result });
    } catch (error) {
      console.error("POST /api/admin/instagram/token error:", error);
      return jsonError(error instanceof Error ? error.message : "Update failed", 500);
    }
  }),

  route("/api/admin/instagram/status", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const token = await getInstagramToken(env.DB, env.INSTAGRAM_ACCESS_TOKEN);
      const cache = await env.DB
        .prepare("SELECT value, updated_at FROM settings WHERE key = ?")
        .bind("instagram_feed_cache")
        .first<{ value: string; updated_at: string }>();
      let postCount = 0;
      if (cache?.value) {
        try {
          postCount = (JSON.parse(cache.value) as { data?: unknown[] }).data?.length || 0;
        } catch {
          postCount = 0;
        }
      }

      let tokenValid: boolean | null = null;
      let tokenError: string | null = null;
      if (token) {
        const response = await fetch(
          `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(token)}`
        );
        tokenValid = response.ok;
        if (!response.ok) {
          try {
            const body = await response.json() as { error?: { message?: string } };
            tokenError = body.error?.message || "Token Instagram invalide";
          } catch {
            tokenError = "Token Instagram invalide";
          }
        }
      }

      const parsedTimestamp = parseDbTimestamp(cache?.updated_at);
      const lastSyncedAt = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
        ? parsedTimestamp.toISOString()
        : null;
      const expiresAt = await getSetting(env.DB, INSTAGRAM_TOKEN_EXPIRES_AT_SETTING);
      const lastRefreshedAt = await getSetting(env.DB, INSTAGRAM_TOKEN_REFRESHED_AT_SETTING);
      return jsonSuccess({
        lastSyncedAt,
        postCount,
        tokenConfigured: Boolean(token),
        tokenValid,
        tokenError,
        expiresAt,
        lastRefreshedAt,
      });
    } catch (error) {
      console.error("GET /api/admin/instagram/status error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to get Instagram status", 500);
    }
  }),

  // ─── Admin Google Reviews Sync API ──────────────────────────────────────────

  route("/api/admin/reviews/sync", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const apiKey = (env as any).GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return jsonError("GOOGLE_PLACES_API_KEY not configured", 500);
      }

      const result = await syncGoogleReviews(env.DB, apiKey);

      if (!result.success) {
        return jsonError(result.error || "Sync failed", 500);
      }

      await addAuditLog(env.DB, "reviews", "google", "sync", {
        reviewsCount: result.reviewsCount,
        averageRating: result.averageRating,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({
        success: true,
        reviewsCount: result.reviewsCount,
        averageRating: result.averageRating,
        totalReviews: result.totalReviews,
      });
    } catch (error) {
      console.error("POST /api/admin/reviews/sync error:", error);
      return jsonError(error instanceof Error ? error.message : "Sync failed", 500);
    }
  }),

  // ─── Client Auth API ────────────────────────────────────────────────────────

  route("/api/client/register", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        bandName?: string;
        addressLine1?: string;
        postalCode?: string;
        city?: string;
        password?: string;
      };

      const firstName = body.firstName?.trim() || "";
      const lastName = body.lastName?.trim() || "";
      const addressLine1 = body.addressLine1?.trim() || "";
      const postalCode = body.postalCode?.trim() || "";
      const city = body.city?.trim() || "";
      const name = `${firstName} ${lastName}`.trim();

      if (!firstName || !lastName || !body.email || !body.password || !body.phone?.trim() || !addressLine1 || !postalCode || !city) {
        return jsonError("Prénom, nom, email, mot de passe, téléphone, adresse, code postal et ville requis", 400);
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return jsonError("Format d'email invalide", 400);
      }

      if (body.password.length < 8) {
        return jsonError("Le mot de passe doit contenir au moins 8 caractères", 400);
      }

      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email.trim().toLowerCase()).first();
      if (existing) {
        return jsonError("Un compte avec cet email existe déjà", 409);
      }

      const passwordHash = await hashPassword(body.password);
      const user = await createUser(env.DB, {
        name,
        first_name: firstName,
        last_name: lastName,
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || undefined,
        band_name: body.bandName?.trim() || undefined,
        address_line1: addressLine1,
        postal_code: postalCode,
        city: city,
      });

      await updateUserPassword(env.DB, user.id, passwordHash);

      const token = await createClientSession(env.DB, user.id);

      return new Response(JSON.stringify({
        success: true,
        data: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildClientSessionCookie(token),
        },
      });
    } catch (error) {
      console.error("POST /api/client/register error:", error);
      return jsonError(error instanceof Error ? error.message : "Registration failed", 500);
    }
  }),

  route("/api/client/login", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { email?: string; password?: string };

      if (!body.email || !body.password) {
        return jsonError("Email et mot de passe requis", 400);
      }

      const row = await env.DB.prepare("SELECT id, email, password_hash, name, phone, is_blocked FROM users WHERE email = ?")
        .bind(body.email.trim().toLowerCase())
        .first<{ id: string; email: string | null; password_hash: string | null; name: string; phone: string | null; is_blocked: number }>();

      if (!row || !row.password_hash) {
        return jsonError("Identifiants invalides", 401);
      }

      if (row.is_blocked) {
        return jsonError("Compte bloqué", 403);
      }

      const valid = await verifyPassword(body.password, row.password_hash);
      if (!valid) {
        return jsonError("Identifiants invalides", 401);
      }

      const token = await createClientSession(env.DB, row.id);

      return new Response(JSON.stringify({
        success: true,
        data: { id: row.id, email: row.email, name: row.name, phone: row.phone },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": buildClientSessionCookie(token),
        },
      });
    } catch (error) {
      console.error("POST /api/client/login error:", error);
      return jsonError(error instanceof Error ? error.message : "Login failed", 500);
    }
  }),

  route("/api/client/logout", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const token = getClientSessionToken(request);
      if (token) {
        await deleteClientSession(env.DB, token);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearClientSessionCookie(),
        },
      });
    } catch (error) {
      console.error("POST /api/client/logout error:", error);
      return jsonError(error instanceof Error ? error.message : "Logout failed", 500);
    }
  }),

  route("/api/client/me", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const user = await requireClientAuth(request, env.DB);
      return jsonSuccess(user);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("GET /api/client/me error:", error);
      return jsonError(error instanceof Error ? error.message : "Auth check failed", 500);
    }
  }),

  route("/api/client/check-email", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const rawEmail = url.searchParams.get("email");
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return jsonError("Email invalide", 400);
      }

      const normalizedEmail = rawEmail.trim().toLowerCase();
      const user = await env.DB
        .prepare("SELECT id FROM users WHERE email = ? AND password_hash IS NOT NULL")
        .bind(normalizedEmail)
        .first<{ id: string }>();

      return jsonResponse(
        { success: true, data: { hasAccount: user !== null } },
        200,
        { "Cache-Control": "no-store" },
      );
    } catch (error) {
      console.error("GET /api/client/check-email error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/client/forgot-password", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { email?: string };
      if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return jsonError("Email invalide", 400);
      }

      const user = await env.DB
        .prepare("SELECT id, email, name FROM users WHERE email = ?")
        .bind(body.email.trim().toLowerCase())
        .first<{ id: string; email: string; name: string }>();

      if (!user) {
        return jsonSuccess({ sent: true });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await env.DB
        .prepare(
          "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
        )
        .bind(`prt-${generateId()}`, user.id, token, expiresAt)
        .run();

      const resetUrl = new URL(`/mon-compte/reinitialiser?token=${token}`, request.url).toString();

      if (!env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY not configured");
        return jsonError("Service d'email non configuré", 500);
      }

      const emailResult = await sendPasswordResetEmail(
        env.RESEND_API_KEY,
        user.email,
        user.name,
        resetUrl,
        "Réinitialisation de votre mot de passe H3 Studios",
      );

      if (!emailResult.success) {
        return jsonError("Échec de l'envoi de l'email", 500);
      }

      return jsonSuccess({ sent: true });
    } catch (error) {
      console.error("POST /api/client/forgot-password error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/client/reset-password", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { token?: string; password?: string };
      if (!body.token || !body.password) {
        return jsonError("Token et mot de passe requis", 400);
      }
      if (body.password.length < 8) {
        return jsonError("Le mot de passe doit contenir au moins 8 caractères", 400);
      }

      const row = await env.DB
        .prepare(
          "SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
        )
        .bind(body.token)
        .first<{ user_id: string; expires_at: string; used: number }>();

      if (!row || row.used || new Date(row.expires_at) < new Date()) {
        return jsonError("Token invalide ou expiré", 400);
      }

      // Check if the user account is blocked (ora-2 finding 1)
      const resetUser = await getUserById(env.DB, row.user_id);
      if (resetUser?.is_blocked) {
        return jsonError("Compte bloqué", 403);
      }

      const passwordHash = await hashPassword(body.password);
      await updateUserPassword(env.DB, row.user_id, passwordHash);

      // Invalidate ALL reset tokens for this user
      await env.DB
        .prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?")
        .bind(row.user_id)
        .run();

      // Delete existing CLIENT sessions only (cls- prefix filter on shared sessions table)
      await env.DB
        .prepare("DELETE FROM sessions WHERE user_id = ? AND id LIKE 'cls-%'")
        .bind(row.user_id)
        .run();

      // Create fresh client session and set cookie (same as /api/client/login)
      const sessionToken = await createClientSession(env.DB, row.user_id);

      return jsonResponse(
        { success: true, data: { reset: true } },
        200,
        { "Set-Cookie": buildClientSessionCookie(sessionToken) },
      );
    } catch (error) {
      console.error("POST /api/client/reset-password error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed", 500);
    }
  }),

  route("/api/client/bookings", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const user = await requireClientAuth(request, env.DB);
      const bookings = await getBookings(env.DB, { userId: user.id }, 1, 500);

      // Grand livre par réservation (une seule requête agrégée) pour permettre
      // à la fiche client de présenter correctement les annulations
      // (Annulée / Payée avant annulation / Remboursé / Reste à payer si dû).
      const bookingIds = bookings.data.map((b) => b.id);
      let paymentTotals = new Map<string, { totalPaid: number; totalCollected: number; totalRefunded: number }>();
      if (bookingIds.length > 0) {
        const placeholders = bookingIds.map(() => "?").join(", ");
        const rows = await env.DB.prepare(
          `SELECT booking_id,
             COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN amount - refunded_amount ELSE 0 END), 0) as totalPaid,
             COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded', 'partial-refund') THEN amount ELSE 0 END), 0) as totalCollected,
             COALESCE(SUM(CASE WHEN status IN ('refunded', 'partial-refund') THEN refunded_amount ELSE 0 END), 0) as totalRefunded
           FROM payments
           WHERE booking_id IN (${placeholders})
           GROUP BY booking_id`,
        ).bind(...bookingIds).all<{ booking_id: string; totalPaid: number; totalCollected: number; totalRefunded: number }>();
        paymentTotals = new Map(rows.results.map((r) => [r.booking_id, { totalPaid: r.totalPaid, totalCollected: r.totalCollected, totalRefunded: r.totalRefunded }]));
      }

      // Transform past confirmed bookings to completed (same logic as admin API)
      const parisNow = getParisNow();
      const nowTimeStr = `${String(parisNow.hours).padStart(2, "0")}:${String(parisNow.minutes).padStart(2, "0")}`;
      const bookingsWithStatus = bookings.data.map((booking) => {
        let b: (typeof booking) & { total_paid?: number; total_collected?: number; total_refunded?: number; remaining?: number } = booking;
        if (booking.status === "confirmed") {
          const isPast =
            booking.date < parisNow.dateISO ||
            (booking.date === parisNow.dateISO && booking.end_time <= nowTimeStr);
          if (isPast) {
            b = { ...booking, status: "completed" as const };
          }
        }
        const totals = paymentTotals.get(b.id);
        const totalPaid = totals?.totalPaid ?? 0;
        return {
          ...b,
          total_paid: totalPaid,
          total_collected: totals?.totalCollected ?? 0,
          total_refunded: totals?.totalRefunded ?? 0,
          remaining: Math.max(0, getBookingAmountDue(b) - totalPaid),
        };
      });

      return jsonSuccess(bookingsWithStatus);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("GET /api/client/bookings error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch bookings", 500);
    }
  }),

  route("/api/client/profile", async ({ request }) => {
    if (request.method !== "PUT") return jsonError("Method not allowed", 405);

    try {
      const user = await requireClientAuth(request, env.DB);
      const body = await request.json() as {
        first_name?: string;
        last_name?: string;
        name?: string;
        email?: string;
        password?: string;
        phone?: string;
        band_name?: string;
        address_line1?: string;
        address_line2?: string;
        postal_code?: string;
        city?: string;
        client_type?: string;
        legal_name?: string;
        siret?: string;
        rna?: string;
        instagram_accounts?: string;
      };

      const allowedFields: Partial<Pick<typeof body, "first_name" | "last_name" | "name" | "phone" | "band_name" | "address_line1" | "address_line2" | "postal_code" | "city" | "client_type" | "legal_name" | "siret" | "rna" | "instagram_accounts">> = {};
      if (body.first_name !== undefined) allowedFields.first_name = body.first_name;
      if (body.last_name !== undefined) allowedFields.last_name = body.last_name;
      if (body.name !== undefined) allowedFields.name = body.name;
      if (body.phone !== undefined) allowedFields.phone = body.phone;
      if (body.band_name !== undefined) allowedFields.band_name = body.band_name;
      if (body.address_line1 !== undefined) allowedFields.address_line1 = body.address_line1;
      if (body.address_line2 !== undefined) allowedFields.address_line2 = body.address_line2;
      if (body.postal_code !== undefined) allowedFields.postal_code = body.postal_code;
      if (body.city !== undefined) allowedFields.city = body.city;
      if (body.client_type !== undefined) {
        if (!isClientType(body.client_type)) return jsonError("Type de client invalide", 400);
        (allowedFields as Record<string, unknown>).client_type = body.client_type;
      }
      if (body.legal_name !== undefined) (allowedFields as Record<string, unknown>).legal_name = body.legal_name;
      if (body.siret !== undefined) (allowedFields as Record<string, unknown>).siret = isValidSiret(body.siret) ? normalizeSiret(body.siret) : body.siret;
      if (body.rna !== undefined) (allowedFields as Record<string, unknown>).rna = isValidRna(body.rna) ? normalizeRna(body.rna) : body.rna;
      if (body.instagram_accounts !== undefined) (allowedFields as Record<string, unknown>).instagram_accounts = body.instagram_accounts;

      const normalizedEmail = body.email?.trim().toLowerCase();
      const currentEmail = user.email?.trim().toLowerCase();
      if (normalizedEmail && normalizedEmail !== currentEmail) {
        const existing = await getUserByEmail(env.DB, normalizedEmail);
        if (existing && existing.id !== user.id) {
          return jsonError("Cet email est déjà utilisé", 400);
        }
        (allowedFields as Record<string, unknown>).email = normalizedEmail;
      }

      if (body.password !== undefined && body.password.length > 0) {
      if (body.password.length < 8) {
        return jsonError("Le mot de passe doit contenir au moins 8 caractères", 400);
      }
        const passwordHash = await hashPassword(body.password);
        (allowedFields as Record<string, unknown>).password_hash = passwordHash;
      }

      if (Object.keys(allowedFields).length === 0) {
        return jsonError("Aucun champ à mettre à jour", 400);
      }

      const result = await updateUser(env.DB, user.id, allowedFields);
      if (!result.success) return jsonError("Mise à jour échouée", 400);

      const updated = await getUserById(env.DB, user.id);
      return jsonSuccess({
        id: updated!.id,
        email: updated!.email,
        name: updated!.name,
        first_name: updated!.first_name,
        last_name: updated!.last_name,
        phone: updated!.phone,
        band_name: updated!.band_name,
        address_line1: updated!.address_line1,
        address_line2: updated!.address_line2,
        postal_code: updated!.postal_code,
        city: updated!.city,
        client_type: updated!.client_type,
        legal_name: updated!.legal_name,
        siret: updated!.siret,
        rna: updated!.rna,
        instagram_accounts: updated!.instagram_accounts,
      });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("PUT /api/client/profile error:", error);
      return jsonError(error instanceof Error ? error.message : "Profile update failed", 500);
    }
  }),

  // ─── Client Pages ───────────────────────────────────────────────────────────

  render(({ children, rw }) => <DocumentWithPath path="/mon-compte/connexion" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mon-compte/connexion", ClientLogin),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/mon-compte/mot-de-passe-oublie" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mon-compte/mot-de-passe-oublie", ForgotPassword),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/mon-compte/reinitialiser" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mon-compte/reinitialiser", ResetPassword),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/mon-compte" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mon-compte", ClientAccount),
    ]),
  ]),

  render(({ children, rw }) => <DocumentWithPath path="/mon-compte/profil" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/mon-compte/profil", ClientProfile),
    ]),
  ]),

  // ─── Payment & Webhook API ─────────────────────────────────────────────────

  route("/api/payment/webhook", async (info) => {
    const { request } = info;
    
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const payload = await request.text();
      const signature = request.headers.get("stripe-signature") || "";
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET || "";

      const event = await constructWebhookEvent(payload, signature, webhookSecret);
      
      if (!event) {
        return new Response(JSON.stringify({ error: "Invalid webhook" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object;
          const bookingRefs = (session.metadata.booking_refs || "").split(",").map((r) => r.trim()).filter(Boolean);

          if (bookingRefs.length === 0) {
            return new Response("OK", { status: 200 });
          }

          // Finalisation idempotente partagée avec le flux de récupération
          // (session lookup). Ne finalise que si Stripe rapporte payment_status
          // === "paid" ; gère l'idempotence par session, l'audit de l'écart de
          // montant et le refus de réintégrer une réservation annulée.
          const outcome = await finalizePaidCheckoutSession(session, bookingRefs, buildFinalizeDeps());
          console.log(`Webhook ${event.type} for refs:`, bookingRefs, "outcome:", outcome.status, {
            paymentsAdded: outcome.status === "finalized" ? outcome.paymentsAdded : undefined,
            cancelledSkipped: outcome.status === "finalized" ? outcome.cancelledSkipped : undefined,
            emailSent: outcome.status === "finalized" ? outcome.emailSent : undefined,
          });

          return new Response("OK", { status: 200 });
        }

        case "refund.updated":
        case "refund.failed":
        case "charge.refund.updated": {
          const refund = event.data.object as unknown as {
            id: string;
            amount: number;
            status: string;
            metadata?: Record<string, string>;
          };
          const paymentId = refund.metadata?.payment_id;
          if (!paymentId) return new Response("OK", { status: 200 });
          const payment = await getPaymentById(env.DB, paymentId);
          if (!payment) return new Response("OK", { status: 200 });
          await upsertPaymentRefund(env.DB, {
            stripeRefundId: refund.id,
            paymentId,
            bookingId: payment.booking_id,
            amountCents: refund.amount,
            status: refund.status,
            now: new Date().toISOString(),
          });
          await recomputePaymentRefundState(env.DB, paymentId);
          await recomputeBookingPaymentStatus(env.DB, payment.booking_id);
          await addAuditLog(env.DB, "payment", paymentId, "refund-reconciled", {
            stripe_refund_id: refund.id,
            status: refund.status,
          }, "stripe-webhook");
          return new Response("OK", { status: 200 });
        }

        case "checkout.session.expired": {
          const session = event.data.object;
          const bookingRefsStr = session.metadata?.booking_refs;
          if (bookingRefsStr) {
            const refs = bookingRefsStr.split(",").filter(Boolean);
            console.log("Payment expired for refs:", refs);
            for (const ref of refs) {
              try {
                const booking = await getBookingByRef(env.DB, ref);
                if (booking && booking.status === "confirmed") {
                  await updateBooking(env.DB, booking.id, {
                    status: "cancelled",
                    cancelled_at: new Date().toISOString().replace("T", " ").slice(0, 19),
                    cancel_reason: "Paiement expiré",
                  });
                  await addAuditLog(env.DB, "booking", booking.id, "cancel", { reason: "Paiement expiré" }, "stripe-webhook");
                  // Une session expirée n'a jamais été payée : aucun remboursement n'est nécessaire.
                }
              } catch (e) {
                console.error(`Failed to cancel expired booking ${ref}:`, e);
              }
            }
          }
          return jsonSuccess({ received: true });
        }

        default:
          return new Response("OK", { status: 200 });
      }
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
    }
  }),
]);

/** Dépendances partagées du finaliseur de paiement (webhook + session lookup). */
function buildFinalizeDeps(): FinalizePaidSessionDeps {
  return {
    getBookingsByRef: (refs) => getBookingsByRefs(env.DB, refs),
    completePayment: (data) => addPaymentIdempotent(env.DB, data as Parameters<typeof addPaymentIdempotent>[1]),
    addAuditLog: (entityType, entityId, action, changes, performedBy) =>
      addAuditLog(env.DB, entityType, entityId, action, changes, performedBy ?? "stripe-webhook"),
    claimConfirmation: (sessionId, refs) => claimPaymentConfirmation(env.DB, sessionId, refs),
    getConfirmation: (sessionId) => getPaymentConfirmation(env.DB, sessionId),
    claimEmail: (sessionId) => claimPaymentConfirmationEmail(env.DB, sessionId),
    releaseEmailClaim: (sessionId, claimedAt) => releasePaymentConfirmationEmail(env.DB, sessionId, claimedAt),
    getUserById: (userId) => getUserById(env.DB, userId),
    sendEmail: async (data) => {
      if (!env.RESEND_API_KEY) return { success: false };
      return sendBookingConfirmationEmail(env.RESEND_API_KEY, data);
    },
    nowISO: () => new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}

async function handleScheduled(controller: ScheduledController) {
  console.log(`[Cron] Triggered: ${controller.cron} at ${new Date().toISOString()}`);

  const apiKey = (env as any).GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    const result = await syncGoogleReviews(env.DB as D1Database, apiKey);
    if (result.success) {
      console.log(`[Cron] Reviews synced: ${result.reviewsCount} reviews, ${result.averageRating}/5`);
    } else {
      console.error(`[Cron] Reviews sync failed: ${result.error}`);
    }
  }

  const igRefresh = await refreshAndPersistInstagramToken(
    env.DB as D1Database,
    (env as any).INSTAGRAM_ACCESS_TOKEN,
  );
  if (igRefresh.refreshed) {
    console.log("[Cron] Instagram token refreshed");
  } else if (igRefresh.skipped) {
    console.log("[Cron] Instagram token refresh skipped (too recent)");
  } else if (igRefresh.error) {
    console.error(`[Cron] Instagram token refresh failed: ${igRefresh.error}`);
  }
  const igToken = igRefresh.token;
  const igResult = await syncInstagram(env.DB as D1Database, igToken);
  if (igResult.success) {
    console.log(`[Cron] Instagram synced: ${igResult.count} posts`);
  } else {
    console.error(`[Cron] Instagram sync failed: ${igResult.error}`);
    try {
      const errorBody = igResult.error?.match(/\{[\s\S]*\}$/)?.[0];
      const parsed = errorBody ? JSON.parse(errorBody) as {
        error?: {
          code?: number;
          error_subcode?: number;
          type?: string;
          message?: string;
          is_transient?: boolean;
          fbtrace_id?: string;
        };
      } : null;
      console.error("[Cron] Instagram Graph API error details:", parsed?.error || { message: igResult.error });
    } catch {
      console.error("[Cron] Instagram Graph API error details:", { message: igResult.error });
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
