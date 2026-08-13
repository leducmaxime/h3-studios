// Stripe Checkout Session API (no SDK needed for Cloudflare Workers)

export interface CreateCheckoutSessionParams {
  amountCents: number;
  customerEmail: string;
  customerName: string;
  bookingRefs: string[];
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  amount_total?: number;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  metadata: Record<string, string>;
  customer_email: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession;
  };
}

const STRIPE_API_URL = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-06-20";

export interface StripeRefund {
  id: string;
  object?: string;
  amount: number;
  currency?: string;
  payment_intent?: string | null;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled" | null;
  reason?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, string>;
  created?: number;
}
export interface StripeErrorInfo {
  type?: string;
  code?: string;
  message: string;
  httpStatus?: number;
}
export type StripeResult<T> = { ok: true; data: T } | { ok: false; error: StripeErrorInfo };

function stripeHeaders(secretKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": STRIPE_API_VERSION, ...extra };
}

async function safeStripeResponse<T>(response: Response): Promise<StripeResult<T>> {
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  if (!response.ok) {
    const e = (body as { error?: { type?: string; code?: string; message?: string } } | undefined)?.error;
    return { ok: false, error: { type: e?.type, code: e?.code, message: e?.message || response.statusText, httpStatus: response.status } };
  }
  if (body === undefined) return { ok: false, error: { message: "Réponse Stripe invalide", httpStatus: response.status } };
  return { ok: true, data: body as T };
}

function networkError(error: unknown): StripeResult<never> {
  return { ok: false, error: { message: error instanceof Error ? error.message : String(error), code: "network_error" } };
}

export async function createRefund(secretKey: string, params: {
  paymentIntentId: string; amountCents: number; idempotencyKey: string;
  metadata?: Record<string, string>; reason?: "requested_by_customer" | "duplicate" | "fraudulent";
}): Promise<StripeResult<StripeRefund>> {
  try {
    const body = new URLSearchParams({ payment_intent: params.paymentIntentId, amount: params.amountCents.toString() });
    if (params.reason) body.set("reason", params.reason);
    for (const [key, value] of Object.entries(params.metadata ?? {})) body.set(`metadata[${key}]`, value);
    return await safeStripeResponse<StripeRefund>(await fetch(`${STRIPE_API_URL}/refunds`, { method: "POST", headers: stripeHeaders(secretKey, { "Idempotency-Key": params.idempotencyKey }), body: body.toString() }));
  } catch (error) { return networkError(error); }
}

export async function listRefundsForPaymentIntent(secretKey: string, paymentIntentId: string): Promise<StripeResult<StripeRefund[]>> {
  const refunds: StripeRefund[] = []; let startingAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    try {
      const query = new URLSearchParams({ payment_intent: paymentIntentId, limit: "100" });
      if (startingAfter) query.set("starting_after", startingAfter);
      const result = await safeStripeResponse<{ data?: StripeRefund[]; has_more?: boolean }>(await fetch(`${STRIPE_API_URL}/refunds?${query}`, { headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": STRIPE_API_VERSION } }));
      if (!result.ok) return result;
      refunds.push(...(result.data.data ?? []));
      if (!result.data.has_more) return { ok: true, data: refunds };
      const last = refunds[refunds.length - 1];
      if (!last?.id) return { ok: false, error: { code: "pagination_limit", message: "Pagination Stripe invalide" } };
      startingAfter = last.id;
    } catch (error) { return networkError(error); }
  }
  return { ok: false, error: { code: "pagination_limit", message: "Limite de pagination Stripe atteinte" } };
}

export async function retrievePaymentIntentIdForSession(secretKey: string, sessionId: string): Promise<StripeResult<string | null>> {
  try {
    const result = await safeStripeResponse<{ payment_intent?: string | { id?: string } | null }>(await fetch(`${STRIPE_API_URL}/checkout/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${secretKey}`, "Stripe-Version": STRIPE_API_VERSION } }));
    if (!result.ok) return result;
    const intent = result.data.payment_intent;
    return { ok: true, data: typeof intent === "string" ? intent : intent?.id ?? null };
  } catch (error) { return networkError(error); }
}

export function isRefundLedgerAccepted(r: Pick<StripeRefund, "id" | "status">): boolean { return Boolean(r.id) && (r.status === "succeeded" || r.status === "pending"); }
export function isRefundCommitted(r: Pick<StripeRefund, "id" | "status">): boolean { return Boolean(r.id) && (r.status === "succeeded" || r.status === "pending" || r.status === "requires_action"); }

export async function createCheckoutSession(
  secretKey: string,
  params: CreateCheckoutSessionParams
): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams({
    "mode": "payment",
    "currency": "eur",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": params.amountCents.toString(),
    "line_items[0][price_data][product_data][name]": "Reservation H3 Studios",
    "line_items[0][price_data][product_data][description]": `Reservation(s): ${params.bookingRefs.join(", ")}`,
    "line_items[0][quantity]": "1",
    "customer_email": params.customerEmail,
    "success_url": params.successUrl,
    "cancel_url": params.cancelUrl,
    "metadata[booking_refs]": params.bookingRefs.join(","),
    "metadata[customer_name]": params.customerName,
    "metadata[customer_email]": params.customerEmail,
  });

  const response = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      "Idempotency-Key": `${[...params.bookingRefs].sort().join(",")}-${params.amountCents}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Retrieve an existing Stripe Checkout Session (server-side).
 * Used by the payment success detail endpoint to fetch booking refs
 * from authenticated Stripe metadata — never trust client-supplied refs.
 */
export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string
): Promise<StripeCheckoutSession> {
  const response = await fetch(`${STRIPE_API_URL}/checkout/sessions/${sessionId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Verify Stripe webhook signature using HMAC-SHA256
 * Based on Stripe's signature verification: https://stripe.com/docs/webhooks/signatures
 */
export async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) {
    return false;
  }

  // Parse the signature header (format: t=timestamp,v1=signature,v1=signature2,...)
  const parts = new Map(signatureHeader.split(",").map(p => {
    const [k, v] = p.split("=");
    return [k, v] as const;
  }));
  const timestamp = parseInt(parts.get("t") ?? "", 10);

  if (!timestamp || !parts.has("v1")) {
    return false;
  }

  // Check timestamp tolerance (5 minutes)
  const tolerance = 300; // seconds
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  // Convert to hex string
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare signatures (timing-safe comparison)
  const valid = signatureHeader.split(",")
    .filter(p => p.startsWith("v1="))
    .map(p => p.slice(3))
    .some(sig => timingSafeEqual(sig, expectedSignature));

  return valid;
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Construct and verify a Stripe webhook event
 */
export async function constructWebhookEvent(
  payload: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<StripeWebhookEvent | null> {
  if (!webhookSecret) {
    console.error("Webhook secret not configured");
    return null;
  }

  const valid = await verifyWebhookSignature(payload, signatureHeader, webhookSecret);
  if (!valid) {
    console.error("Invalid webhook signature");
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    console.error("Invalid JSON payload in webhook");
    return null;
  }
}
