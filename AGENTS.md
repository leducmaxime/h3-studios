# H3 Studios - Agent Instructions

> French music studio booking platform. Built with RedwoodSDK on Cloudflare Workers.

## Stack

- **Framework**: RedwoodSDK (React SSR + routing, `rwsdk`)
- **Runtime**: Cloudflare Workers (`wrangler.jsonc`)
- **Database**: Cloudflare D1 (SQLite)
- **Build**: Vite 7 + `@cloudflare/vite-plugin`
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), custom fonts (Now, Blanka)
- **Package manager**: pnpm
- **Node**: Requires Node.js 22+ (Promise.withResolvers polyfill in `vite.config.mts` for older versions)

## Key Commands

```bash
# Build (outputs to dist/, produces worker bundle)
pnpm build

# Type check (runs generate first, then tsc)
pnpm check        # = generate + types
pnpm generate     # rw-scripts ensure-env + wrangler types
pnpm types        # tsc --noEmit

# Deploy
pnpm release:staging   # clean:vite + build + wrangler deploy --env staging
pnpm release:prod      # clean:vite + build + wrangler deploy --env production

# Password hashing (for admin user creation)
npx tsx scripts/hash-password.ts "your-password"
```

> **Note:** `pnpm dev` exists but is not used. See Deployment Rules below.

## Architecture

### Entry Points

| File | Role |
|------|------|
| `src/worker.tsx` | **Cloudflare Worker entry** — routing, API handlers, auth middleware, D1 queries |
| `src/client.tsx` | **Browser entry** — `initClientNavigation()` for RedwoodSDK SPA hydration |
| `src/app/Document.tsx` | HTML shell — loads CSS, fonts, GTM, client.tsx script |

### Routing

RedwoodSDK file-based routing via `defineApp([...])` in `src/worker.tsx`:

- **Public pages**: `/`, `/les-studios`, `/le-materiel`, `/tarifs`, `/reservation`, `/a-propos`, `/avis`, `/equipe`, `/actualites`
- **Admin panel**: `/admin/*` (protected by auth middleware)
- **API routes**: `/api/*` — bookings, payments, contact, admin CRUD
- **SEO**: `/sitemap.xml`, `/robots.txt` generated dynamically

### Auth

- **Admin auth**: PBKDF2 password hashing (`src/lib/auth.ts`), session cookies (`h3_session`), D1 sessions table
- **Roles**: `super-admin` (full access) vs `operator` (bookings/calendar/users only)
- **Middleware**: `adminAuthMiddleware()` in `src/worker.tsx` — checks session, enforces role-based access, injects `X-Admin-User-*` headers

### Database

- **D1 SQLite** with migrations in `migrations/` (numbered SQL files)
- **Key tables**: `bookings`, `users`, `admin_users`, `sessions`, `payments`, `equipment`, `pricing`, `blocked_slots`, `promo_codes`, `settings`, `audit_logs`, `google_reviews`
- **Seed data**: `seed.sql` (50 mock users, pricing, equipment, opening hours)
- **Types**: `src/lib/db-types.ts` mirrors schema — booleans are `INTEGER (0/1)`, dates are `TEXT` (ISO strings)

### State Management

- **No global state library** — React hooks + localStorage for booking flow
- **Booking state**: `useBookingWithRouter.ts` — URL-synced, persisted to `localStorage` (`h3-studios-booking-state`)
- **Admin state**: Server-rendered, fetched via API on each page load

## Directory Structure

```
src/
  worker.tsx          # Worker entry: routes, API, auth middleware
  client.tsx          # Browser entry: hydration
  app/
    Document.tsx      # HTML shell with SEO meta, CSP, GTM
    headers.ts        # Security headers (CSP, HSTS, etc.)
    seo.ts            # Sitemap, robots, JSON-LD
    layouts/
      MainLayout.tsx  # Public site layout (splash screen, header)
      AdminLayout.tsx # Admin dashboard layout (sidebar, auth check)
    pages/
      Home.tsx        # Landing page
      Reservation.tsx # Multi-step booking flow
      admin/          # Dashboard, Calendar, Bookings, Users, etc.
  components/
    booking/          # 20+ booking flow components (see AGENTS.md below)
    ui/               # shadcn/ui components (button, dialog, table, etc.)
    common/           # SplashScreen, ScrollUp, ImageCarousel, Map
    Header/           # Navigation header
  lib/
    db.ts             # D1 database queries (all CRUD)
    db-types.ts       # TypeScript types for DB tables
    auth.ts           # Password hashing, session management
    booking.ts        # Pricing logic, time slots, equipment, promo codes
    utils.ts          # cn(), date formatting (Paris timezone)
    stripe.ts         # Stripe Checkout API (no SDK, raw fetch)
    export.ts         # CSV/PDF export for admin
    google-reviews.ts # Google Places API sync
    instagram.ts      # Instagram Graph API sync
    materiel.ts       # Equipment list data + parser
    admin-store.ts    # Mock data generator (legacy, used for seed patterns)
```

## Important Conventions

### Time & Dates

- **All business logic uses Paris timezone** (`Europe/Paris`) — see `getParisDateISO()`, `getParisNow()` in `src/lib/utils.ts`
- **Time slots**: 30-minute increments from 10:00 to 00:00 (`ALL_TIME_SLOTS` in `src/lib/booking.ts`)
- **Peak hours**: 18:00+ on weekdays, all day on weekends — affects pricing

### Pricing

- Stored per studio × group type × peak/off-peak in `pricing` table (half-hour rates)
- **Group types**: `solo` (1 person), `duo` (2 people), `group` (3+)
- **Studios**: `la-scene` (42m², higher rates), `le-podium` (35m²)
- Equipment pricing: either per-session (fixed per quantity) or per-hour

### Booking Flow

Multi-step wizard in `src/components/booking/`:
1. Flow choice (time-first vs studio-first)
2. Date picker (week calendar)
3. Time slot picker (drag-to-select)
4. Studio + group type selection
5. User info + equipment
6. Cart review + promo code
7. Payment (Stripe card or cash on-site)

**Key files**: `useBookingWithRouter.ts` (state + URL sync), `TimeSlotPicker.tsx` (complex drag selection), `StripeRedirect.tsx` (payment)

### Admin Panel

- **Dashboard**: Stats, charts (recharts), monthly PDF reports
- **Calendar**: Week/day views, drag-to-reschedule
- **Bookings**: Filterable list, detail view, payments, cancel/no-show
- **Users**: Client list, merge duplicates, block/unblock
- **Settings**: Pricing, equipment, opening hours, promo codes, maintenance mode

### Security

- **CSP** in `headers.ts` — allows `unsafe-eval` + `unsafe-inline` with nonces for scripts
- **HSTS** enabled in production (not dev)
- **Session cookies**: `HttpOnly`, `Secure`, `SameSite=Lax`, 7-day expiry

## Environment Variables

Stored in `.dev.vars` (local) and Cloudflare dashboard (production):

- `STRIPE_SECRET_KEY` — Stripe payments
- `RESEND_API_KEY` — Contact form emails
- `GOOGLE_PLACES_API_KEY` — Google reviews sync
- `INSTAGRAM_ACCESS_TOKEN` — Instagram feed sync

## Testing

- **Vitest** tests in `src/__tests__/`:
  - `auth.test.ts` — PBKDF2 password hashing
  - `conflict.test.ts` — Booking slot conflict detection
  - `pricing.test.ts` — Price calculation, peak hours, promo codes
- Run: `npx vitest` (not configured in package.json scripts)

## Gotchas

1. **Vite dev server runs on port 5173** — Cloudflare Workers local dev is integrated via `@cloudflare/vite-plugin`
2. **CSS imports use `?url`** — `import styles from "@/styles/globals.css?url"` in Document.tsx
3. **D1 migrations** — Apply with `wrangler d1 migrations apply h3-studios-db` (not automated on deploy)
4. **Worker types** — Run `pnpm generate` after schema changes to update `worker-configuration.d.ts`
5. **Booking state persists in localStorage** — Key: `h3-studios-booking-state`. Cleared on non-reservation page navigation.
6. **Group bookings displace solo/duo** — If a group books a slot occupied by solo/duo, the smaller booking is auto-moved to the other studio (see `checkConflictWithGroupType` in `src/lib/db.ts`)
7. **Admin nav items marked `superAdminOnly`** — Some routes restricted to `super-admin` role (equipment, pricing, settings, audit log)

## Deployment Rules

**CRITICAL — These rules are mandatory for every session:**

- **Never deploy to production unless explicitly asked.**
- **When asked to deploy to production, always ask for confirmation before doing so.**
- **When asked to deploy without environment precision, always assume staging — never production.**
- **The staging environment is used as the development server.** I do not use local development servers (`pnpm dev`). You may build locally (`pnpm build`) to verify compilation, but all functional testing happens on staging.
- **After every change:** commit, then deploy to staging, then provide the staging URL (or a direct link to the affected page if applicable).
- **Staging URL:** `https://h3-studios-staging.amis-harmonie-sucy.workers.dev`
- **Production URL:** `https://h3-studios.amis-harmonie-sucy.workers.dev`

> **Note:** These deployment rules are non-negotiable. Always follow them in every session.

## Related Docs

- `src/components/booking/AGENTS.md` — Detailed booking component knowledge base
- `migrations/0001_initial_schema.sql` — Full database schema
- `seed.sql` — Seed data for local development
