import { render, route, layout, prefix } from "rwsdk/router";
import type { RouteMiddleware } from "rwsdk/router";
import { defineApp, requestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";

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
import { generateSitemap, generateRobotsTxt } from "@/app/seo";
import { AdminDashboard } from "@/app/pages/admin/Dashboard";
import { AdminCalendar } from "@/app/pages/admin/Calendar";
import { AdminBookings } from "@/app/pages/admin/Bookings";
import { AdminBookingDetail } from "@/app/pages/admin/BookingDetail";
import { AdminBlockedSlots } from "@/app/pages/admin/BlockedSlots";
import { AdminUsers } from "@/app/pages/admin/Users";
import { AdminUserDetail } from "@/app/pages/admin/UserDetail";
import { AdminPayments } from "@/app/pages/admin/Payments";
import { AdminStudios } from "@/app/pages/admin/Studios";
import { AdminEquipements } from "@/app/pages/admin/Equipements";
import { AdminPricing } from "@/app/pages/admin/Pricing";
import { AdminSettings } from "@/app/pages/admin/Settings";
import { AdminAuditLog } from "@/app/pages/admin/AuditLog";
import { AdminBookingNew } from "@/app/pages/admin/BookingNew";
import { Login } from "@/app/pages/admin/Login";
import { PaymentSuccess } from "@/app/pages/PaymentSuccess";
import { PaymentCancel } from "@/app/pages/PaymentCancel";
import { getStripeConfig, createCheckoutSession, constructWebhookEvent } from "@/lib/stripe";
import { DEFAULT_MATERIEL, parseMaterielSetting, type MaterielData } from "@/lib/materiel";
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
} from "@/lib/auth";
import {
  getBookings,
  getBookingById,
  getBookingByRef,
  createBooking,
  updateBooking,
  getBookingsByDate,
  getBookingsByDateRange,
  getBookingsByUser,
  checkConflict,
  checkConflictWithGroupType,
  checkBlockedSlotConflict,
  moveBookingToOtherStudio,
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  blockUser,
  mergeUsers,
  getPayments,
  getPaymentsByBookingId,
  getPaymentByBookingId,
  addPayment,
  markPaymentPaid,
  refundPayment,
  getBlockedSlots,
  getBlockedSlotsByDateRange,
  addBlockedSlot,
  removeBlockedSlot,
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
  getSetting,
} from "@/lib/db";
import { type BookingFilters, type AuditLogFilters } from "@/lib/db-types";

import { ALL_TIME_SLOTS, STUDIO_HOURS, type StudioId } from "@/lib/booking";
import {
  formatDateISO,
  getParisDateISO,
  getParisNow,
} from "@/lib/utils";
import {
  getStoredReviews,
  getReviewsSyncData,
  syncGoogleReviews,
} from "@/lib/google-reviews";
import {
  getCachedInstagramFeed,
  syncInstagram,
} from "@/lib/instagram";

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

function getISOWeekStartUTCNoon(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
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

  render(({ children, rw }) => <DocumentWithPath path="/admin/login" nonce={rw.nonce}>{children}</DocumentWithPath>, [
    route("/admin/login", Login),
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
        return jsonError("Échec de l'envoi du message", 500);
      }

      return jsonSuccess({ sent: true });
    } catch (error) {
      console.error("POST /api/contact error:", error);
      return jsonError(error instanceof Error ? error.message : "Contact form failed", 500);
    }
  }),

  // ─── Public Booking API ──────────────────────────────────────────────────────

  route("/api/availability", async ({ request }) => {
    if (request.method !== "GET") return jsonError("Method not allowed", 405);

    try {
      const url = new URL(request.url);
      const date = url.searchParams.get("date");
      if (!date) return jsonError("Date requise", 400);

      const bookings = await getBookingsByDate(env.DB, date);
      const blockedSlots = await getBlockedSlots(env.DB, undefined, date);

      const bookedSlots: Array<{ studioId: string; time: string; groupType?: string; bookingId?: string }> = [];

      for (const b of bookings) {
        const slots = getSlotsForBooking(b.start_time, b.end_time);
        slots.forEach((time) => {
          bookedSlots.push({
            studioId: b.studio_id,
            time,
            groupType: b.group_type,
            bookingId: b.id,
          });
        });
      }

      for (const s of blockedSlots) {
        const slots = getSlotsForBooking(s.start_time, s.end_time);
        if (s.studio_id) {
          slots.forEach((time) => {
            bookedSlots.push({
              studioId: s.studio_id as string,
              time,
              groupType: "blocked",
            });
          });
        } else {
          slots.forEach(time => {
            bookedSlots.push({ studioId: "la-scene", time, groupType: "blocked" });
            bookedSlots.push({ studioId: "le-podium", time, groupType: "blocked" });
          });
        }
      }

      // Block slots that fall within min_advance_hours from now
      const paris = getParisNow();
      if (date === paris.dateISO) {
        const minAdvanceHours = parseInt(await getSetting(env.DB, "booking.min_advance_hours") || "2", 10);
        const cutoffMinutes = (paris.hours * 60 + paris.minutes) + minAdvanceHours * 60;

        for (const slot of ALL_TIME_SLOTS) {
          const [h, m] = slot.split(":").map(Number);
          if (h * 60 + m < cutoffMinutes) {
            bookedSlots.push({ studioId: "la-scene", time: slot, groupType: "blocked" });
            bookedSlots.push({ studioId: "le-podium", time: slot, groupType: "blocked" });
          }
        }
      }

      return jsonSuccess(bookedSlots);
    } catch (error) {
      console.error("GET /api/availability error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch availability", 500);
    }
  }),

  route("/api/bookings", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const body = await request.json() as {
        bookingRef: string;
        userId?: string;
        user: {
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
        promoType?: "percentage" | "fixed";
        promoDiscount?: number;
        notes?: string;
      };

      const name = body.user?.name?.trim() || "";
      const email = body.user?.email?.trim() || "";
      const phone = body.user?.phone?.trim() || "";
      const bandNameRaw = body.user?.bandName?.trim() || "";
      const bookingBandName = bandNameRaw ? bandNameRaw : null;
      const addressLine1 = body.user?.addressLine1?.trim() || "";
      const postalCode = body.user?.postalCode?.trim() || "";
      const city = body.user?.city?.trim() || "";

      if (!name || !email || !phone) {
        return jsonError("Merci de renseigner nom, email et téléphone.", 400);
      }

      let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<{ id: string }>();
      
      if (!user) {
        user = await createUser(env.DB, {
          name,
          email,
          phone,
          band_name: bookingBandName ?? undefined,
          address_line1: addressLine1 || undefined,
          postal_code: postalCode || undefined,
          city: city || undefined,
        });
      } else {
        await updateUser(env.DB, user.id, {
          name,
          phone,
          ...(bandNameRaw ? { band_name: bandNameRaw } : {}),
          ...(addressLine1 ? { address_line1: addressLine1 } : {}),
          ...(postalCode ? { postal_code: postalCode } : {}),
          ...(city ? { city: city } : {}),
        });
      }

      // Check for conflicts - groups can displace solo/duo bookings
      const conflict = await checkConflictWithGroupType(env.DB, body.studioId, body.date, body.startTime, body.endTime);
      if (conflict) {
        // If group booking conflicts with solo/duo, try to move the solo/duo
        if (body.groupType === "group" && (conflict.group_type === "solo" || conflict.group_type === "duo")) {
          const otherStudioId = body.studioId === "la-scene" ? "le-podium" : "la-scene";

          // Check if other studio is available for the full duration
          const otherStudioConflict = await checkConflict(env.DB, otherStudioId, body.date, body.startTime, body.endTime, conflict.id);
          if (otherStudioConflict) {
            return jsonError("Ce créneau n'est plus disponible - l'autre studio est également occupé", 409);
          }

          // Move the solo/duo booking to the other studio
          const moveResult = await moveBookingToOtherStudio(env.DB, conflict.id, otherStudioId);
          if (!moveResult.success) {
            return jsonError(`Impossible de déplacer la réservation existante: ${moveResult.error}`, 409);
          }

          // Log the move in audit
          await addAuditLog(env.DB, "booking", conflict.id, "move-for-group", {
            fromStudio: body.studioId,
            toStudio: otherStudioId,
            reason: "Group booking displaced solo/duo",
          }, request.headers.get("X-Admin-User-Id") || "admin");
        } else {
          return jsonError("Ce créneau n'est plus disponible", 409);
        }
      }

      // Check for blocked slots
      const blockedSlot = await checkBlockedSlotConflict(env.DB, body.studioId, body.date, body.startTime, body.endTime);
      if (blockedSlot) {
        return jsonError(`Ce créneau est bloqué${blockedSlot.reason ? ` : ${blockedSlot.reason}` : ""}`, 409);
      }

      const paris = getParisNow();
      if (body.date === paris.dateISO) {
        const minAdvanceHours = parseInt(await getSetting(env.DB, "booking.min_advance_hours") || "2", 10);
        const cutoffMinutes = (paris.hours * 60 + paris.minutes) + minAdvanceHours * 60;
        const [startH, startM] = body.startTime.split(":").map(Number);
        if (startH * 60 + startM < cutoffMinutes) {
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

      const booking = await createBooking(env.DB, {
        booking_ref: body.bookingRef,
        user_id: user.id,
        band_name: bookingBandName,
        studio_id: body.studioId,
        date: body.date,
        start_time: body.startTime,
        end_time: body.endTime,
        group_type: body.groupType,
        status: "confirmed",
        base_price: body.price - body.equipmentPrice + (body.promoDiscount || 0),
        equipment_price: body.equipmentPrice,
        total_price: body.price,
        equipment: JSON.stringify(body.equipment),
        payment_method: body.paymentMethod,
        payment_status: body.paymentStatus,
        notes: body.notes || null,
        promo_code: body.promoCode || null,
        promo_type: body.promoType || null,
        promo_discount: body.promoDiscount || 0,
        cancelled_at: null,
        cancel_reason: null,
      });

      if (body.promoCode) {
        await env.DB.prepare(
          "UPDATE promo_codes SET usage_count = usage_count + 1 WHERE code = ?",
        ).bind(body.promoCode.trim().toUpperCase()).run();
      }

      return jsonSuccess({ success: true, bookingId: booking.id, ref: booking.booking_ref });
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
      const description = p.type === "percentage" ? `${p.value}% de réduction` : `${p.value}€ de réduction`;
      const discount = p.type === "percentage"
        ? body.total * p.value / 100
        : Math.min(p.value, body.total);
      return jsonSuccess({
        valid: true,
        promo: { code: p.code, type: p.type, value: p.value, description, minTotal: p.min_total > 0 ? p.min_total : undefined },
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
        .prepare("SELECT equipment_id, name, max_per_session, pricing_type, session_pricing, price_per_hour FROM equipment ORDER BY name")
        .all<{
          equipment_id: string;
          name: string;
          max_per_session: number;
          pricing_type: string;
          session_pricing: string;
          price_per_hour: number;
        }>();

      const equipment = results.map((eq) => ({
        id: eq.equipment_id,
        name: eq.name,
        maxPerSession: eq.max_per_session,
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
        const userIdFilter = url.searchParams.get("userId");
        if (userIdFilter) filters.userId = userIdFilter;
        const dateFrom = url.searchParams.get("dateFrom");
        if (dateFrom) filters.dateFrom = dateFrom;
        const dateTo = url.searchParams.get("dateTo");
        if (dateTo) filters.dateTo = dateTo;
        const search = url.searchParams.get("search");
        if (search) filters.search = search;
        const paymentStatus = url.searchParams.get("paymentStatus");
        if (paymentStatus) filters.paymentStatus = paymentStatus;
        const sortBy = url.searchParams.get("sortBy");
        if (sortBy) filters.sortBy = sortBy as BookingFilters["sortBy"];
        const sortOrder = url.searchParams.get("sortOrder");
        if (sortOrder) filters.sortOrder = sortOrder as BookingFilters["sortOrder"];

        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);

        const result = await getBookings(env.DB, filters, page, limit);
        
        // Calculate actual payment status for each booking
        const bookingsWithPaymentStatus = await Promise.all(
          result.data.map(async (booking) => {
            const payments = await getPaymentsByBookingId(env.DB, booking.id);
            const totalPaid = payments
              .filter((p) => p.status === "paid")
              .reduce((acc, p) => acc + p.amount, 0);
            const isFullyPaid = totalPaid >= booking.total_price;
            
            return {
              ...booking,
              payment_status: isFullyPaid ? "paid" : booking.payment_status,
              total_paid: totalPaid,
            };
          })
        );
        
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

        const conflict = await checkConflict(env.DB, body.studio_id, body.date, body.start_time, body.end_time);
        if (conflict) {
          return jsonError("Conflit avec une autre réservation", 409);
        }

        // Check for blocked slots
        const blockedSlot = await checkBlockedSlotConflict(env.DB, body.studio_id, body.date, body.start_time, body.end_time);
        if (blockedSlot) {
          return jsonError(`Ce créneau est bloqué${blockedSlot.reason ? ` : ${blockedSlot.reason}` : ""}`, 409);
        }

        const user = await env.DB.prepare("SELECT band_name FROM users WHERE id = ?").bind(body.user_id).first<{ band_name: string | null }>();
        const bookingBandName = user?.band_name ?? null;

        const isPeak = body.start_time >= "18:00" || new Date(body.date).getDay() === 0 || new Date(body.date).getDay() === 6;
        const pricePerHalfHour = await getPricingForBooking(env.DB, body.studio_id, body.group_type, isPeak);

        const startParts = body.start_time.split(":").map(Number);
        const endParts = body.end_time.split(":").map(Number);
        const halfHours = ((endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])) / 30;
        const durationHours = halfHours * 0.5;
        const basePrice = pricePerHalfHour * halfHours;

        // Calculate equipment price
        let equipmentPrice = 0;
        if (body.equipment) {
          const equipmentList = JSON.parse(body.equipment) as Array<{ id: string; quantity: number }>;
          const allEquipment = await getEquipment(env.DB);
          for (const eq of equipmentList) {
            const eqData = allEquipment.find((e) => e.equipment_id === eq.id);
            if (eqData && eq.quantity > 0) {
              if (eqData.pricing_type === "session" && eqData.session_pricing) {
                const prices = JSON.parse(eqData.session_pricing) as number[];
                equipmentPrice += prices[eq.quantity - 1] || 0;
              } else {
                equipmentPrice += eqData.price_per_hour * eq.quantity * durationHours;
              }
            }
          }
        }

        const promoDiscount = (body as { promo_discount?: number }).promo_discount || 0;
        const promoCode = (body as { promo_code?: string }).promo_code || null;
        const subtotal = basePrice + equipmentPrice;

        const booking = await createBooking(env.DB, {
          booking_ref: body.booking_ref,
          user_id: body.user_id,
          band_name: bookingBandName,
          studio_id: body.studio_id,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          group_type: body.group_type,
          status: "confirmed",
          base_price: basePrice,
          equipment_price: equipmentPrice,
          total_price: subtotal,
          equipment: body.equipment || null,
          payment_method: body.payment_method || null,
          payment_status: body.payment_method === "card" ? "paid" : "pay-on-site",
          notes: body.notes || null,
          promo_code: promoCode,
          promo_type: promoCode ? "percentage" : null,
          promo_discount: promoDiscount,
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

          // Check for blocked slots when rescheduling
          const blockedSlot = await checkBlockedSlotConflict(env.DB, existing.studio_id, newDate, newStart, newEnd);
          if (blockedSlot) {
            return jsonError(`Ce créneau est bloqué${blockedSlot.reason ? ` : ${blockedSlot.reason}` : ""}`, 409);
          }
        }

        const result = await updateBooking(env.DB, id, body);
        if (!result.success) return jsonError(result.error || "Update failed", 400);

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
      }, request.headers.get("X-Admin-User-Id") || "admin");

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

      await addAuditLog(env.DB, "booking", params.id, "no-show", {}, request.headers.get("X-Admin-User-Id") || "admin");

      const updated = await getBookingById(env.DB, params.id);
      return jsonSuccess(updated);
    } catch (error) {
      console.error("PUT /api/admin/bookings/:id/no-show error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to mark no-show", 500);
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

        const validMethods = ["cash", "card", "transfer", "check"] as const;
        if (!validMethods.includes(body.method as (typeof validMethods)[number])) {
          return jsonError("Méthode de paiement invalide", 400);
        }

        if (booking.payment_method === "card" && body.method !== "card") {
          return jsonError("En ligne, les paiements sont uniquement par CB", 400);
        }

        const validStatus = ["pending", "paid", "refunded", "partial-refund"] as const;
        if (!validStatus.includes(body.status as (typeof validStatus)[number])) {
          return jsonError("Statut de paiement invalide", 400);
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
          page,
          limit,
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

      const result = await getPayments(env.DB, filters, page, limit);
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

      const result = await setSetting(env.DB, params.key, body.value);
      if (!result.success) {
        return jsonError("Update failed", 400);
      }

      await addAuditLog(env.DB, "setting", params.key, "update", {
        key: params.key,
        value: body.value,
      }, request.headers.get("X-Admin-User-Id") || "admin");

      return jsonSuccess({ key: params.key, value: body.value });
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

        const existing = await env.DB
          .prepare("SELECT id FROM admin_users WHERE email = ?")
          .bind(body.email)
          .first();

        if (existing) {
          return jsonError("Un compte avec cet email existe déjà", 409);
        }

        const id = `adm-${crypto.randomUUID().slice(0, 8)}`;
        const passwordHash = await hashPassword(body.password);
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

        await env.DB.prepare(
          "INSERT INTO admin_users (id, email, password_hash, name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        ).bind(id, body.email, passwordHash, body.name, body.role || "operator", timestamp, timestamp).run();

        await addAuditLog(env.DB, "admin_user", id, "create", {
          email: body.email,
          name: body.name,
          role: body.role || "operator",
        }, request.headers.get("X-Admin-User-Id") || "admin");

        return jsonSuccess({ id, email: body.email, name: body.name, role: body.role || "operator", is_active: 1 });
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
          pricing_type?: string;
          session_pricing?: string;
          price_per_hour?: number;
        };

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
        };

        const result = await updatePromoCode(env.DB, id, body);
        if (!result.success) {
          return jsonError("Code promo introuvable", 404);
        }

        await addAuditLog(env.DB, "promo", id, "update", body, request.headers.get("X-Admin-User-Id") || "admin");

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

      const mode = (modeRaw === "today" || modeRaw === "rolling" || modeRaw === "week" || modeRaw === "month" || modeRaw === "year")
        ? modeRaw
        : undefined;
      const period = (periodRaw === "week" || periodRaw === "month" || periodRaw === "quarter" || periodRaw === "year")
        ? periodRaw
        : undefined;

      const stats = await getDashboardStats(env.DB, { month, year, week, mode, period });
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

      const today = getParisDateISO();
      let fromStr = today;
      let toStr = today;
      let groupByMonth = false;

      if (mode === "today") {
        fromStr = today;
        toStr = today;
      } else if (mode === "month" && month && year) {
        const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
        const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
        fromStr = getParisDateISO(from);
        toStr = getParisDateISO(to);
      } else if (mode === "week" && week && year) {
        const monday = getISOWeekStartUTCNoon(year, week);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        fromStr = getParisDateISO(monday);
        toStr = getParisDateISO(sunday);
      } else if (mode === "year" && year) {
        const from = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
        const to = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
        fromStr = getParisDateISO(from);
        toStr = getParisDateISO(to);
        groupByMonth = true;
      } else {
        let days: number;
        switch (period) {
          case "week": days = 7; break;
          case "month": days = 30; break;
          case "quarter": days = 90; break;
          case "year": days = 365; break;
          default: days = 30; break;
        }

        if (period === "year") {
          groupByMonth = true;
        }
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - Math.max(days - 1, 0));
        fromStr = getParisDateISO(fromDate);
        toStr = today;
      }

      if (groupByMonth) {
        const rows = await env.DB.prepare(
          `SELECT substr(date, 1, 7) as date, COALESCE(SUM(total_price), 0) as revenue
           FROM bookings
           WHERE date >= ? AND date <= ? AND status != 'cancelled'
           GROUP BY substr(date, 1, 7)
           ORDER BY substr(date, 1, 7) ASC`,
        ).bind(fromStr, toStr).all<{ date: string; revenue: number }>();

        return jsonSuccess(rows.results.map((row) => ({ date: row.date, revenue: row.revenue })));
      }

      const bookings = await env.DB.prepare(
        "SELECT date, COALESCE(SUM(total_price), 0) as revenue FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled' GROUP BY date ORDER BY date ASC",
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

      const today = getParisDateISO();
      let fromStr = today;
      let toStr = today;

      if (mode === "today") {
        fromStr = today;
        toStr = today;
      } else if (mode === "month" && month && year) {
        const from = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
        const to = new Date(Date.UTC(year, month, 0, 12, 0, 0));
        fromStr = getParisDateISO(from);
        toStr = getParisDateISO(to);
      } else if (mode === "week" && week && year) {
        const monday = getISOWeekStartUTCNoon(year, week);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        fromStr = getParisDateISO(monday);
        toStr = getParisDateISO(sunday);
      } else if (mode === "year" && year) {
        const from = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
        const to = new Date(Date.UTC(year, 11, 31, 12, 0, 0));
        fromStr = getParisDateISO(from);
        toStr = getParisDateISO(to);
      } else {
        let days: number;
        switch (period) {
          case "week": days = 7; break;
          case "quarter": days = 90; break;
          case "year": days = 365; break;
          default: days = 30; break;
        }

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - Math.max(days - 1, 0));
        fromStr = getParisDateISO(fromDate);
        toStr = today;
      }

      const occupancyStmt = env.DB.prepare(
        `SELECT date, studio_id, start_time, end_time
         FROM bookings
         WHERE date >= ? AND date <= ? AND status != 'cancelled'
         ORDER BY date ASC, start_time ASC`,
      ).bind(fromStr, toStr);

       const [occupancyResult, studioResult, onSitePaidResult, onlineCardResult, upcomingResult, pendingPayResult] = await env.DB.batch([
         occupancyStmt,
        // Studio distribution
        env.DB.prepare(
          `SELECT studio_id, COUNT(*) as count, SUM(total_price) as revenue
           FROM bookings WHERE date >= ? AND date <= ? AND status != 'cancelled'
           GROUP BY studio_id`,
        ).bind(fromStr, toStr),
        env.DB.prepare(
          `SELECT
            p.method as method,
            COUNT(*) as count,
            COALESCE(SUM(p.amount), 0) as revenue
          FROM payments p
          JOIN bookings b ON b.id = p.booking_id
          WHERE b.date >= ? AND b.date <= ?
            AND b.status != 'cancelled'
            AND b.payment_status = 'pay-on-site'
            AND p.status = 'paid'
          GROUP BY p.method`,
        ).bind(fromStr, toStr),
        env.DB.prepare(
          `SELECT
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as revenue
          FROM bookings
          WHERE date >= ? AND date <= ?
            AND status != 'cancelled'
            AND payment_status != 'pay-on-site'`,
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
         env.DB.prepare(
           `WITH paid_by_booking AS (
             SELECT booking_id, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
             FROM payments
             GROUP BY booking_id
           )
           SELECT
             id,
             booking_id,
             amount,
             user_name,
             booking_date,
             start_time,
             studio_id,
             kind
           FROM (
             SELECT
               'on-site:' || b.id as id,
               b.id as booking_id,
               (b.total_price - COALESCE(paid.paid_amount, 0)) as amount,
               u.name as user_name,
               b.date as booking_date,
               b.start_time as start_time,
               b.studio_id as studio_id,
               'on-site' as kind
             FROM bookings b
             LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
             LEFT JOIN users u ON u.id = b.user_id
             WHERE b.status != 'cancelled'
               AND b.payment_status = 'pay-on-site'
               AND b.date >= ? AND b.date <= ?
               AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0

             UNION ALL

             SELECT
               'card:' || b.id as id,
               b.id as booking_id,
               (b.total_price - COALESCE(paid.paid_amount, 0)) as amount,
               u.name as user_name,
               b.date as booking_date,
               b.start_time as start_time,
               b.studio_id as studio_id,
               'card' as kind
             FROM bookings b
             LEFT JOIN paid_by_booking paid ON paid.booking_id = b.id
             LEFT JOIN users u ON u.id = b.user_id
             WHERE b.status != 'cancelled'
               AND b.payment_method = 'card'
               AND b.payment_status = 'pending'
               AND b.date >= ? AND b.date <= ?
               AND (b.total_price - COALESCE(paid.paid_amount, 0)) > 0
           )
           ORDER BY booking_date ASC, start_time ASC
           LIMIT 5`,
         ).bind(fromStr, toStr, fromStr, toStr),
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
        studio: row.studio_id === "la-scene" ? "La Scène" : row.studio_id === "le-podium" ? "Le Podium" : row.studio_id,
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

      const methodLabels: Record<string, string> = {
        cash: "Espèces",
        card: "CB",
        transfer: "Virement",
        check: "Chèque",
      };

      const paymentMethods = ["cash", "card", "transfer", "check"] as const;
      const paymentData = paymentMethods.map((method) => ({
        method: methodLabels[method],
        count: merged[method]?.count ?? 0,
        revenue: merged[method]?.revenue ?? 0,
      }));

      return jsonSuccess({
        occupancy: occupancyData,
        studios: studioData,
        payments: paymentData,
        upcomingBookings: upcomingResult.results,
        pendingPayments: pendingPayResult.results,
      });
    } catch (error) {
      console.error("GET /api/admin/stats/charts error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch chart data", 500);
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

    try {
      const posts = await getCachedInstagramFeed(env.DB);
      return jsonSuccess(posts);
    } catch (error) {
      console.error("GET /api/instagram/feed error:", error);
      return jsonError(error instanceof Error ? error.message : "Failed to fetch feed", 500);
    }
  }),

  route("/api/admin/instagram/sync", async ({ request }) => {
    if (request.method !== "POST") return jsonError("Method not allowed", 405);

    try {
      const result = await syncInstagram(env.DB);
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
      if (!token) return jsonError("Token requis", 400);

      await setSetting(env.DB, "instagram_access_token", token);
      await addAuditLog(env.DB, "settings", "instagram", "update_token", {}, request.headers.get("X-Admin-User-Id") || "admin");

      const result = await syncInstagram(env.DB);

      return jsonSuccess({ success: true, sync: result });
    } catch (error) {
      console.error("POST /api/admin/instagram/token error:", error);
      return jsonError(error instanceof Error ? error.message : "Update failed", 500);
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
      const bookingRefs = (session.metadata.booking_refs || "").split(",").filter(Boolean);
      
      console.log("Payment confirmed for refs:", bookingRefs);

      for (const ref of bookingRefs) {
        const booking = await getBookingByRef(env.DB, ref);
        if (!booking) {
          console.error(`Webhook error: Booking not found for ref ${ref}`);
          continue;
        }

        await addPayment(env.DB, {
          booking_id: booking.id,
          amount: booking.total_price,
          method: "card",
          status: "paid",
          paid_at: new Date().toISOString().replace("T", " ").slice(0, 19),
        });
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("OK", { status: 200 });
    }
  }),
]);

async function handleScheduled(controller: ScheduledController) {
  console.log(`[Cron] Triggered: ${controller.cron} at ${new Date().toISOString()}`);

  const apiKey = (env as any).GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    const result = await syncGoogleReviews(env.DB, apiKey);
    if (result.success) {
      console.log(`[Cron] Reviews synced: ${result.reviewsCount} reviews, ${result.averageRating}/5`);
    } else {
      console.error(`[Cron] Reviews sync failed: ${result.error}`);
    }
  }

  const igResult = await syncInstagram(env.DB);
  if (igResult.success) {
    console.log(`[Cron] Instagram synced: ${igResult.count} posts`);
  } else {
    console.error(`[Cron] Instagram sync failed: ${igResult.error}`);
  }
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
