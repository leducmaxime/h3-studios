# H3 STUDIOS - PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-15
**Commit:** 278bfb6
**Branch:** master

## OVERVIEW

Music rehearsal studio booking website for H3 Studios (Sucy-en-Brie, France). Built with RedwoodSDK + Cloudflare Workers + React 19 + Tailwind CSS 4.

## STRUCTURE

```
h3-studios/
├── src/
│   ├── worker.tsx          # Main entry - ALL routes + API handlers
│   ├── client.tsx          # Client hydration (5 lines)
│   ├── app/
│   │   ├── Document.tsx    # HTML shell + SEO meta tags
│   │   ├── seo.ts          # SEO config + JSON-LD
│   │   ├── headers.ts      # Security headers
│   │   ├── layouts/        # MainLayout, AdminLayout
│   │   └── pages/          # Public pages + admin/
│   ├── components/
│   │   ├── booking/        # [20 files] Multi-step booking flow
│   │   ├── ui/             # Button, Table, Carousel (shadcn-style)
│   │   ├── common/         # Map, ImageCarousel, ScrollUp
│   │   └── Header/         # Site header
│   ├── lib/
│   │   ├── booking.ts      # Domain logic: pricing, types, availability
│   │   ├── admin-store.ts  # Mock admin data + CRUD
│   │   ├── stripe.ts       # Stripe Checkout (no SDK)
│   │   └── utils.ts        # cn() helper
│   └── styles/
│       └── globals.css     # Tailwind + custom fonts
├── public/                 # Static assets (fonts, images)
├── types/                  # TypeScript declarations
└── wrangler.jsonc          # CF Workers config (staging/prod envs)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new public page | `src/worker.tsx` | Add route + render block |
| Modify booking flow | `src/components/booking/` | See AGENTS.md there |
| Change pricing/hours | `src/lib/booking.ts` | PRICING, TIME_SLOTS constants |
| Admin functionality | `src/app/pages/admin/` + `src/lib/admin-store.ts` | Mock data, no real DB |
| Payment integration | `src/lib/stripe.ts` + `src/worker.tsx` | API routes at /api/payment/* |
| SEO/meta tags | `src/app/seo.ts` + `src/app/Document.tsx` | Per-page SEO config |
| Styling/theming | `src/styles/globals.css` | primary=#ffde59, fonts=Now/Blanka |

## CONVENTIONS

### Routing (RedwoodSDK)
```tsx
// worker.tsx - NOT file-based routing
render(({ children }) => <Document>{children}</Document>, [
  layout(MainLayout, [
    route("/path", Component),
  ]),
]);
```

### Component Pattern
- `"use client"` directive for client-side state/hooks
- Collocate hooks: `useBooking.ts` next to `BookingWidget.tsx`
- No prop drilling - use hooks for shared state

### Imports
- Path alias: `@/` maps to `./src/`
- CSS: `import styles from "@/styles/globals.css?url"`

### Tailwind
- Primary color: `text-primary`, `bg-primary` (#ffde59)
- Custom fonts: `font-sans` (Now), `font-blanka` (logo)
- Container: custom responsive breakpoints in globals.css

## ANTI-PATTERNS

- **NO database** - localStorage + mock data only. Don't assume persistent storage.
- **NO Stripe SDK** - Raw fetch() to Stripe API. Don't npm install stripe.
- **NO file-based routing** - All routes in worker.tsx
- **NO SSR state** - State hydrates on client. Avoid server-side useState.

## UNIQUE STYLES

### Date/Time Formatting
```typescript
// Always French locale
date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
formatPrice(42); // Returns "42EUR" not "$42"
```

### Booking References
```typescript
// Format: H3-YYYYMMDD-XXXX
generateBookingRef(); // "H3-20260115-A3B2"
```

## COMMANDS

```bash
# Development
pnpm dev                    # Local dev server (Vite + Wrangler)

# Build & Deploy
pnpm build                  # Build for production
pnpm release:staging        # Deploy to h3-studios-staging
pnpm release:prod           # Deploy to h3-studios-prod

# Types
pnpm check                  # Generate types + typecheck
pnpm types                  # TypeScript check only
```

## AGENT WORKFLOW (MANDATORY)

After completing ANY task, execute this verification loop:

```
┌─────────────────────────────────────────────────────────────┐
│  1. LINT & TYPE CHECK                                       │
│     pnpm check                                              │
│     → Fix any errors before proceeding                      │
├─────────────────────────────────────────────────────────────┤
│  2. BUILD                                                   │
│     pnpm build                                              │
│     → Must succeed with exit code 0                         │
├─────────────────────────────────────────────────────────────┤
│  3. COMMIT                                                  │
│     git add . && git commit -m "descriptive message"        │
│     → Only if lint/build pass                               │
├─────────────────────────────────────────────────────────────┤
│  4. DEPLOY TO STAGING                                       │
│     pnpm release:staging                                    │
│     → Wait for deployment to complete                       │
├─────────────────────────────────────────────────────────────┤
│  5. VISUAL & FUNCTIONAL TESTING                             │
│     Use chrome-devtools MCP to:                             │
│     - Navigate to https://h3-studios-staging.workers.dev    │
│     - Take snapshots of affected pages                      │
│     - Verify UI renders correctly                           │
│     - Test user flows end-to-end                            │
│     - Check console for errors                              │
├─────────────────────────────────────────────────────────────┤
│  6. ISSUES DETECTED?                                        │
│     YES → Formulate fix plan → Implement → GOTO Step 1      │
│     NO  → Task complete                                     │
└─────────────────────────────────────────────────────────────┘
```

**DO NOT STOP** until:
- All lint/type errors resolved
- Build succeeds
- Staging deployment works
- Visual/functional tests pass in browser

This loop is NON-NEGOTIABLE for every task completion.

## NOTES

- **Admin is demo-only**: All admin data is mock/localStorage. No auth.
- **Stripe**: Needs STRIPE_SECRET_KEY env var. Test keys work.
- **Two studios**: "La Scene" (42m2) and "Le Podium" (35m2). Hardcoded in booking.ts.
- **Peak pricing**: Evenings (18h+) and weekends have higher rates.
- **Multi-booking cart**: Users can book multiple slots before checkout.
