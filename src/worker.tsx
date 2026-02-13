import { render, route, layout, prefix } from "rwsdk/router";
import type { RouteMiddleware } from "rwsdk/router";
import { defineApp, requestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { MainLayout } from "@/app/layouts/MainLayout";
import { Home } from "@/app/pages/Home";
import { LesStudios } from "@/app/pages/LesStudios";
import { LeMateriel } from "@/app/pages/LeMateriel";
import { Tarifs } from "@/app/pages/Tarifs";
import { Reservation } from "@/app/pages/Reservation";
import { APropos } from "@/app/pages/APropos";
import { Avis } from "@/app/pages/Avis";
import { Equipe } from "@/app/pages/Equipe";
import { generateSitemap, generateRobotsTxt } from "@/app/seo";
import { AdminDashboard } from "@/app/pages/admin/Dashboard";
import { AdminCalendar } from "@/app/pages/admin/Calendar";
import { AdminBookings } from "@/app/pages/admin/Bookings";
import { AdminBookingDetail } from "@/app/pages/admin/BookingDetail";
import { AdminUsers } from "@/app/pages/admin/Users";
import { AdminUserDetail } from "@/app/pages/admin/UserDetail";
import { AdminPayments } from "@/app/pages/admin/Payments";
import { AdminStudios } from "@/app/pages/admin/Studios";
import { AdminSettings } from "@/app/pages/admin/Settings";
import { Login } from "@/app/pages/admin/Login";
import { PaymentSuccess } from "@/app/pages/PaymentSuccess";
import { PaymentCancel } from "@/app/pages/PaymentCancel";
import { getStripeConfig, createCheckoutSession, constructWebhookEvent } from "@/lib/stripe";
import {
  type AdminRole,
  verifyPassword,
  createSession,
  validateSession,
  deleteSession,
  requireAuth,
  buildSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  checkConflict,
  getBookingsByDate,
  getBookingsByDateRange,
  addAuditLog,
  getPricingForBooking,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  blockUser,
  mergeUsers,
  getPayments,
  markPaymentPaid,
  refundPayment,
  getBlockedSlots,
  addBlockedSlot,
  removeBlockedSlot,
  getAllSettings,
  setSetting,
  getAuditLogs,
  getPricing,
  updatePricing,
  getEquipment,
  updateEquipment,
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  getOpeningHours,
  updateOpeningHours,
  getDashboardStats,
} from "@/lib/db";
import { type BookingFilters, type AuditLogFilters } from "@/lib/db-types";

const DocumentWithPath = ({ children, path }: { children: React.ReactNode; path: string }) => (
  <Document path={path}>{children}</Document>
);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonSuccess(data: unknown): Response {
  return jsonResponse({ success: true, data });
}

function jsonError(error: string, status = 400): Response {
  return jsonResponse({ success: false, error }, status);
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const SUPER_ADMIN_ROUTE_PREFIXES = [
  "/api/admin/pricing",
  "/api/admin/equipment",
  "/api/admin/promo-codes",
  "/api/admin/settings",
  "/api/admin/opening-hours",
  "/admin/studios",
  "/admin/settings",
];

const AUTH_EXCLUDED_PATHS = [
  "/api/admin/login",
  "/admin/login",
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
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set("X-Admin-User-Id", user.id);
    modifiedHeaders.set("X-Admin-User-Email", user.email);
    modifiedHeaders.set("X-Admin-User-Role", user.role);
    modifiedHeaders.set("X-Admin-User-Name", user.name);
    rInfo.request = new Request(request, { headers: modifiedHeaders });
  };

export default defineApp([
  setCommonHeaders(),
  adminAuthMiddleware(),
  
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

  render(({ children }) => <DocumentWithPath path="/">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/", Home),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/les-studios">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/les-studios", LesStudios),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/le-materiel">{children}</DocumentWithPath>, [
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

  render(({ children }) => <DocumentWithPath path="/tarifs">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/tarifs", Tarifs),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/reservation">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/reservation", () => <Reservation />),
      route("/reservation/:step", ({ params }) => <Reservation step={params.step} />),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/a-propos">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/a-propos", APropos),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/avis">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/avis", Avis),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/equipe">{children}</DocumentWithPath>, [
    layout(MainLayout, [
      route("/equipe", Equipe),
    ]),
  ]),

  render(({ children }) => <DocumentWithPath path="/admin/login">{children}</DocumentWithPath>, [
    route("/admin/login", Login),
  ]),

  render(({ children }) => <DocumentWithPath path="/admin">{children}</DocumentWithPath>, [
    route("/admin", AdminDashboard),
    route("/admin/calendar", AdminCalendar),
    route("/admin/bookings", AdminBookings),
    route("/admin/bookings/:id", ({ params }) => <AdminBookingDetail bookingId={params.id} />),
    route("/admin/users", AdminUsers),
    route("/admin/users/:id", ({ params }) => <AdminUserDetail userId={params.id} />),
    route("/admin/payments", AdminPayments),
    route("/admin/studios", AdminStudios),
    route("/admin/settings", AdminSettings),
  ]),

  render(({ children }) => <DocumentWithPath path="/payment">{children}</DocumentWithPath>, [
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
        amount: number;
        firstName: string;
        lastName: string;
        email: string;
        bookingRefs: string[];
      };

      const config = getStripeConfig({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY });
      
      if (!config.secretKey) {
        return new Response(JSON.stringify({ error: "Stripe not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const baseUrl = new URL(request.url).origin;
      
      const session = await createCheckoutSession(config, {
        amountCents: Math.round(body.amount * 100),
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

  // ─── Admin Auth API ────────────────────────────────────────────────────────

  route("/api/admin/login", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return jsonError("Email et mot de passe requis", 400);
      }

      const user = await env.DB
        .prepare("SELECT id, email, password_hash, name, role, is_active FROM admin_users WHERE email = ?")
        .bind(body.email)
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

  // ─── Admin Bookings API ──────────────────────────────────────────────────────

  route("/api/admin/bookings", async ({ request }) => {
    if (request.method === "GET") {
      try {
        const url = new URL(request.url);
        const filters: BookingFilters = {};
        const status = url.searchParams.get("status");
        if (status) filters.status = status as BookingFilters["status"];
        const studioId = url.searchParams.get("studio");
        if (studioId) filters.studioId = studioId;
        const dateFrom = url.searchParams.get("dateFrom");
        if (dateFrom) filters.dateFrom = dateFrom;
        const dateTo = url.searchParams.get("dateTo");
        if (dateTo) filters.dateTo = dateTo;
        const search = url.searchParams.get("search");
        if (search) filters.search = search;
        const paymentStatus = url.searchParams.get("paymentStatus");
        if (paymentStatus) filters.paymentStatus = paymentStatus;

        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);

        const result = await getBookings(env.DB, filters, page, limit);
        return jsonSuccess(result);
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

        const conflict = await checkConflict(env.DB, body.studio_id, body.date, body.start_time, body.end_time);
        if (conflict) {
          return jsonError("Conflit avec une autre réservation", 409);
        }

        const isPeak = body.start_time >= "18:00" || new Date(body.date).getDay() === 0 || new Date(body.date).getDay() === 6;
        const pricePerHalfHour = await getPricingForBooking(env.DB, body.studio_id, body.group_type, isPeak);

        const startParts = body.start_time.split(":").map(Number);
        const endParts = body.end_time.split(":").map(Number);
        const halfHours = ((endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])) / 30;
        const basePrice = pricePerHalfHour * halfHours;

        const booking = await createBooking(env.DB, {
          booking_ref: body.booking_ref,
          user_id: body.user_id,
          studio_id: body.studio_id,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          group_type: body.group_type,
          status: "confirmed",
          base_price: basePrice,
          equipment_price: 0,
          total_price: basePrice,
          equipment: body.equipment || null,
          payment_method: body.payment_method || null,
          payment_status: body.payment_method === "card" ? "paid" : "pending",
          notes: body.notes || null,
          cancelled_at: null,
          cancel_reason: null,
        });

        await addAuditLog(env.DB, "booking", booking.id, "create", {
          booking_ref: booking.booking_ref,
          studio_id: booking.studio_id,
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time,
        });

        return jsonSuccess(booking);
      } catch (error) {
        console.error("POST /api/admin/bookings error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to create booking", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  route("/api/admin/bookings/:id", async ({ request, params }) => {
    const { id } = params;

    if (request.method === "GET") {
      try {
        const booking = await getBookingById(env.DB, id);
        if (!booking) return jsonError("Réservation introuvable", 404);
        return jsonSuccess(booking);
      } catch (error) {
        console.error("GET /api/admin/bookings/:id error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch booking", 500);
      }
    }

    if (request.method === "PUT") {
      try {
        const body = await request.json() as {
          date?: string;
          start_time?: string;
          end_time?: string;
          notes?: string;
          base_price?: number;
          equipment_price?: number;
          total_price?: number;
          equipment?: string;
        };

        // If rescheduling, check for conflicts
        if (body.date || body.start_time || body.end_time) {
          const existing = await getBookingById(env.DB, id);
          if (!existing) return jsonError("Réservation introuvable", 404);

          const newDate = body.date || existing.date;
          const newStart = body.start_time || existing.start_time;
          const newEnd = body.end_time || existing.end_time;

          const conflict = await checkConflict(env.DB, existing.studio_id, newDate, newStart, newEnd, id);
          if (conflict) {
            return jsonError("Conflit avec une autre réservation", 409);
          }
        }

        const result = await updateBooking(env.DB, id, body);
        if (!result.success) return jsonError(result.error || "Update failed", 400);

        await addAuditLog(env.DB, "booking", id, "update", body);

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
      const body = await request.json() as { reason?: string };
      const booking = await getBookingById(env.DB, params.id);
      if (!booking) return jsonError("Réservation introuvable", 404);

      const result = await updateBooking(env.DB, params.id, {
        status: "cancelled",
        cancelled_at: new Date().toISOString().replace("T", " ").slice(0, 19),
        cancel_reason: body.reason || "Annulée par l'admin",
      });

      if (!result.success) return jsonError(result.error || "Cancel failed", 400);

      await addAuditLog(env.DB, "booking", params.id, "cancel", {
        reason: body.reason || "Annulée par l'admin",
      });

      const updated = await getBookingById(env.DB, params.id);
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

      await addAuditLog(env.DB, "booking", params.id, "no-show", {});

      const updated = await getBookingById(env.DB, params.id);
      return jsonSuccess(updated);
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/no-show error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to mark no-show", 500);
    }
  }),

  route("/api/admin/calendar", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      if (date) {
        const bookings = await getBookingsByDate(env.DB, date);
        return jsonSuccess(bookings);
      }

      if (startDate && endDate) {
        const bookings = await getBookingsByDateRange(env.DB, startDate, endDate);
        return jsonSuccess(bookings);
      }

      // Default: today
      const today = new Date().toISOString().slice(0, 10);
      const bookings = await getBookingsByDate(env.DB, today);
      return jsonSuccess(bookings);
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
        const search = url.searchParams.get("search") || undefined;
        const blockedParam = url.searchParams.get("blocked");
        const isBlocked = blockedParam === "true" ? true : blockedParam === "false" ? false : undefined;

        const result = await getUsers(env.DB, { search, isBlocked }, page, limit);
        return jsonSuccess(result);
      } catch (error) {
        console.error("GET /api/admin/users error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to fetch users", 500);
      }
    }

    if (request.method === "POST") {
      try {
        const body = await request.json() as { name?: string; email?: string; phone?: string; band_name?: string; notes?: string };
        if (!body.name) {
          return jsonError("Champ obligatoire manquant: name", 400);
        }

        const user = await createUser(env.DB, {
          name: body.name,
          email: body.email,
          phone: body.phone,
          band_name: body.band_name,
          notes: body.notes,
        });

        await addAuditLog(env.DB, "user", user.id, "create", {
          name: user.name,
          email: user.email,
        });

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
      });

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
        const body = await request.json() as {
          name?: string;
          email?: string;
          phone?: string;
          band_name?: string;
          notes?: string;
        };

        const result = await updateUser(env.DB, id, body);
        if (!result.success) {
          return jsonError(result.error || "Update failed", 400);
        }

        await addAuditLog(env.DB, "user", id, "update", body);

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
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);

      const result = await getPayments(env.DB, page, limit);
      return jsonSuccess(result);
    } catch (error) {
      console.error("GET /api/admin/payments error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch payments", 500);
    }
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
      if (!body.amount || body.amount <= 0) {
        return jsonError("Champ obligatoire manquant: amount (> 0)", 400);
      }

      const result = await refundPayment(env.DB, params.id, body.amount);
      if (!result.success) {
        return jsonError(result.error || "Refund failed", 400);
      }

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
          studio_id?: string | null;
          date?: string;
          start_time?: string;
          end_time?: string;
          reason?: string;
        };

        if (!body.date || !body.start_time || !body.end_time || !body.reason) {
          return jsonError("Champs obligatoires manquants: date, start_time, end_time, reason", 400);
        }

        const result = await addBlockedSlot(env.DB, {
          studio_id: body.studio_id ?? null,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          reason: body.reason,
        });

        await addAuditLog(env.DB, "blocked_slot", result.id, "create", {
          studio_id: body.studio_id,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          reason: body.reason,
        });

        return jsonSuccess(result);
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

      await addAuditLog(env.DB, "blocked_slot", params.id, "delete", {});

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

      const result = await setSetting(env.DB, params.key, body.value);
      if (!result.success) {
        return jsonError("Update failed", 400);
      }

      await addAuditLog(env.DB, "setting", params.key, "update", {
        key: params.key,
        value: body.value,
      });

      return jsonSuccess({ key: params.key, value: body.value });
    } catch (error) {
      console.error("PUT /api/admin/settings/:key error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to update setting", 500);
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
      const dateFrom = url.searchParams.get("from_date");
      if (dateFrom) filters.dateFrom = dateFrom;
      const dateTo = url.searchParams.get("to_date");
      if (dateTo) filters.dateTo = dateTo;

      const result = await getAuditLogs(env.DB, filters, page, limit);
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
      });

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
          pricing_type?: string;
          session_pricing?: string;
          price_per_hour?: number;
        };

        if (!body.name || !body.equipment_id) {
          return jsonError("Champs obligatoires manquants: name, equipment_id", 400);
        }

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

        await env.DB.prepare(`
          INSERT INTO equipment (id, equipment_id, name, max_per_session, pricing_type, session_pricing, price_per_hour, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.equipment_id,
          body.name,
          body.max_per_session ?? 1,
          body.pricing_type ?? "per_session",
          body.session_pricing ?? null,
          body.price_per_hour ?? 0,
          timestamp,
        ).run();

        await addAuditLog(env.DB, "equipment", id, "create", {
          name: body.name,
          equipment_id: body.equipment_id,
        });

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
          pricing_type?: string;
          session_pricing?: string;
          price_per_hour?: number;
        };

        const result = await updateEquipment(env.DB, id, body);
        if (!result.success) {
          return jsonError("Équipement introuvable", 404);
        }

        await addAuditLog(env.DB, "equipment", id, "update", body);

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

        await addAuditLog(env.DB, "equipment", id, "delete", {});

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
        });

        await addAuditLog(env.DB, "promo", result.id, "create", {
          code: body.code,
          type: body.type,
          value: body.value,
        });

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
        };

        const result = await updatePromoCode(env.DB, id, body);
        if (!result.success) {
          return jsonError("Code promo introuvable", 404);
        }

        await addAuditLog(env.DB, "promo", id, "update", body);

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

        await addAuditLog(env.DB, "promo", id, "delete", {});

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
        });

        const updated = await getOpeningHours(env.DB);
        return jsonSuccess(updated);
      } catch (error) {
        console.error("PUT /api/admin/opening-hours error:", error);
        return jsonError(error instanceof Error ? error.message : "Failed to update opening hours", 500);
      }
    }

    return jsonError("Method not allowed", 405);
  }),

  // ─── Admin Stats API ────────────────────────────────────────────────────────

  route("/api/admin/stats", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const stats = await getDashboardStats(env.DB);
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
      const period = url.searchParams.get("period") || "month";

      let days: number;
      switch (period) {
        case "week": days = 7; break;
        case "year": days = 365; break;
        default: days = 30; break;
      }

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = new Date().toISOString().slice(0, 10);

      const bookings = await env.DB.prepare(
        "SELECT date, SUM(total_price) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled' GROUP BY date ORDER BY date ASC",
      ).bind(fromStr, toStr).all<{ date: string; revenue: number }>();

      const chartData = bookings.results.map(row => ({
        date: row.date,
        revenue: row.revenue,
      }));

      return jsonSuccess(chartData);
    } catch (error) {
      console.error("GET /api/admin/stats/revenue error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch revenue stats", 500);
    }
  }),

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

      const { event, error } = await constructWebhookEvent(payload, signature, webhookSecret);
      
      if (error || !event) {
        console.error("Webhook verification failed:", error);
        return new Response(JSON.stringify({ error: error || "Invalid webhook" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (event.type !== "checkout.session.completed") {
        return new Response("OK", { status: 200 });
      }

      const session = event.data.object;
      console.log("Payment confirmed:", {
        sessionId: session.id,
        bookingRefs: session.metadata.booking_refs,
        email: session.customer_email || session.metadata.customer_email,
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("OK", { status: 200 });
    }
  }),
]);
