import { render, route, layout, prefix } from "rwsdk/router";
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
import { PaymentSuccess } from "@/app/pages/PaymentSuccess";
import { PaymentCancel } from "@/app/pages/PaymentCancel";
import { getStripeConfig, createCheckoutSession, constructWebhookEvent } from "@/lib/stripe";

const DocumentWithPath = ({ children, path }: { children: React.ReactNode; path: string }) => (
  <Document path={path}>{children}</Document>
);

export default defineApp([
  setCommonHeaders(),
  
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
