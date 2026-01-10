import { RouteMiddleware } from "rwsdk/router";

export const setCommonHeaders =
  (): RouteMiddleware =>
  ({ response, rw: { nonce } }) => {
    if (!import.meta.env.VITE_IS_DEV_SERVER) {
      response.headers.set(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
    }

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
    response.headers.set(
      "Permissions-Policy",
      "geolocation=(self), microphone=(), camera=()",
    );

    response.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' https://challenges.cloudflare.com https://www.googletagmanager.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com https://*.google.com https://*.ggpht.com; frame-ancestors 'self'; frame-src 'self' https://challenges.cloudflare.com https://www.google.com; connect-src 'self' https://maps.googleapis.com https://www.google-analytics.com https://www.googletagmanager.com; object-src 'none';`,
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=31536000, must-revalidate",
    );
    
    response.headers.set("CDN-Cache-Control", "max-age=31536000");
    
    response.headers.set("Cloudflare-CDN-Cache-Control", "max-age=31536000");
  };
