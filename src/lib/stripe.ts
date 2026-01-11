/**
 * Stripe Configuration Placeholder
 * 
 * When you have a Stripe account, replace MockPaymentForm with real Stripe Elements.
 * 
 * Setup steps:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your publishable key from the Stripe Dashboard
 * 3. Install Stripe packages: pnpm add @stripe/stripe-js @stripe/react-stripe-js
 * 4. Set up environment variables:
 *    - STRIPE_PUBLISHABLE_KEY (client-side)
 *    - STRIPE_SECRET_KEY (server-side, in Cloudflare Workers secrets)
 * 5. Create a payment intent endpoint in your worker
 * 6. Replace MockPaymentForm with Stripe Elements
 */

export const STRIPE_CONFIG = {
  publishableKey: "", // Set from environment: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  currency: "eur",
  locale: "fr" as const,
};

export const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#eab308",
    colorBackground: "#0a0a0a",
    colorText: "#ffffff",
    colorDanger: "#ef4444",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "8px",
  },
};
