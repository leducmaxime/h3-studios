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
      "Idempotency-Key": [...params.bookingRefs].sort().join(","),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(`Stripe API error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

export async function getCheckoutSession(
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
  const elements = signatureHeader.split(",");
  const signatureMap: Record<string, string[]> = {};
  let timestamp: number | undefined;

  for (const element of elements) {
    const [key, value] = element.split("=");
    if (key === "t") {
      timestamp = parseInt(value, 10);
    } else if (key && value) {
      if (!signatureMap[key]) {
        signatureMap[key] = [];
      }
      signatureMap[key].push(value);
    }
  }

  if (!timestamp || !signatureMap["v1"] || signatureMap["v1"].length === 0) {
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
  const valid = signatureMap["v1"].some(sig => timingSafeEqual(sig, expectedSignature));

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
): Promise<{ event: StripeWebhookEvent | null; error?: string }> {
  if (!webhookSecret) {
    return { event: null, error: "Webhook secret not configured" };
  }

  const valid = await verifyWebhookSignature(payload, signatureHeader, webhookSecret);
  if (!valid) {
    return { event: null, error: "Invalid webhook signature" };
  }

  try {
    return { event: JSON.parse(payload) };
  } catch {
    return { event: null, error: "Invalid JSON payload" };
  }
}
