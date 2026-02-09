## LANGUE — OBLIGATOIRE

**Toutes les réponses doivent être rédigées en français.** L'utilisateur de ce projet ne parle pas anglais.
- Répondre en français dans tous les cas : explications, questions, résumés, messages de progression, etc.
- Les messages de commit git restent en anglais (convention technique).
- Le code source (noms de variables, commentaires techniques) reste en anglais (convention technique).
- En cas de doute, toujours privilégier le français.

---

# H3 STUDIOS - AGENT KNOWLEDGE BASE

Music rehearsal studio booking website for H3 Studios (Sucy-en-Brie, France).
RedwoodSDK + Cloudflare Workers + React 19 + Tailwind CSS 4. No database — localStorage + mock data only.

## COMMANDS

```bash
pnpm dev                    # Local dev server (Vite + Wrangler)
pnpm build                  # Production build
pnpm check                  # Generate CF types + typecheck (run BEFORE build)
pnpm types                  # TypeScript check only (no type generation)
pnpm release:staging        # Build + deploy to h3-studios-staging
pnpm release:prod           # Build + deploy to h3-studios-prod
```

**No test framework exists.** No vitest, jest, or any test runner is configured.
**No linter/formatter exists.** No eslint, prettier, or biome config. `pnpm check` (tsc strict mode) is the only code quality gate.

## STRUCTURE

```
src/
├── worker.tsx              # ALL routes + API handlers (not file-based routing)
├── client.tsx              # Client hydration entry
├── app/
│   ├── Document.tsx        # HTML shell + SEO meta
│   ├── seo.ts              # SEO config + JSON-LD
│   ├── headers.ts          # Security headers middleware
│   ├── layouts/            # MainLayout, AdminLayout
│   └── pages/              # Public pages + admin/
├── components/
│   ├── booking/            # [20 files] Multi-step booking flow (see AGENTS.md there)
│   ├── ui/                 # Button, Table, Carousel (shadcn-style, CVA)
│   ├── common/             # Map, ImageCarousel, ScrollUp
│   └── Header/             # Site header + nav
├── lib/
│   ├── booking.ts          # Domain logic: pricing, types, availability
│   ├── admin-store.ts      # Mock admin data + CRUD
│   ├── stripe.ts           # Stripe Checkout via raw fetch (no SDK)
│   └── utils.ts            # cn() helper
└── styles/
    └── globals.css         # Tailwind 4 + custom fonts + container
```

## CODE STYLE

### Imports — 3 groups separated by blank lines
```typescript
// 1. Framework/library imports
import { useState, useCallback } from "react";
import { render, route, layout } from "rwsdk/router";
import { ChevronRight } from "lucide-react";

// 2. Internal @/ alias imports
import { Button } from "@/components/ui/button";
import { type BookingState, calculatePrice } from "@/lib/booking";

// 3. Relative imports (sibling files)
import { useBooking } from "./useBooking";
```

Use `type` keyword in imports: `import { type BookingState } from "@/lib/booking"`.
Path alias `@/` maps to `./src/`.

### Naming
- **Files:** PascalCase for components (`BookingWidget.tsx`), camelCase for non-components (`useBooking.ts`, `booking.ts`, `admin-store.ts`)
- **Components:** `export function ComponentName()` — named export, PascalCase, matches filename
- **Hooks:** `export function useHookName()` — camelCase with `use` prefix
- **Types/Interfaces:** PascalCase (`StudioId`, `BookingState`)
- **Constants:** UPPER_SNAKE_CASE for domain values (`TIME_SLOTS`, `PRICING`, `SLOT_DURATION_MINUTES`)

### Types
- **`interface`** for object shapes (props, state, configs):
  ```typescript
  interface FlowChoiceProps { onSelect: (flow: BookingFlow) => void; disabled?: boolean; }
  ```
- **`type`** for unions, aliases, utility types:
  ```typescript
  export type StudioId = "la-scene" | "le-podium";
  export type GroupType = "solo" | "duo" | "group";
  ```
- Inline type annotations for simple sub-component props:
  ```typescript
  function StatCard({ title, value }: { title: string; value: string | number }) { ... }
  ```

### Formatting (no enforced config — follow existing patterns)
- 2-space indentation
- Double quotes for strings
- Semicolons always
- Trailing commas in multi-line structures
- ~100-120 char line length

### Exports
- **Named exports everywhere** — no default exports (except `vite.config.mts` and `worker.tsx` which use framework-required defaults)
- UI components: grouped exports at bottom (`export { Button, buttonVariants }`)
- Hook return types: `export type UseBookingReturn = ReturnType<typeof useBooking>`

### `"use client"` Directive
Required at top of files using React hooks (useState, useEffect, etc.) or browser APIs.
NOT used in: server-rendered pages without state, layouts without state, library/utility files, `Document.tsx`, `worker.tsx`.

### Error Handling
```typescript
// API errors: try/catch with instanceof check
catch (error) {
  console.error("Payment creation error:", error);
  return new Response(JSON.stringify({
    error: error instanceof Error ? error.message : "Payment creation failed"
  }), { status: 500, headers: { "Content-Type": "application/json" } });
}

// localStorage: silent catch with graceful degradation
try { localStorage.setItem(KEY, JSON.stringify(data)); }
catch { console.error("Failed to save"); }

// CRUD operations return: { success: boolean; error?: string }
```

### Comments
- Minimal — code should be self-documenting with descriptive names
- JSDoc only for complex library functions
- `//` inline comments for section headers in long files

## ANTI-PATTERNS — DO NOT

- **Add a database** — localStorage + mock data only, no persistent storage
- **Install Stripe SDK** — raw `fetch()` to Stripe API, keep it that way
- **Use file-based routing** — all routes defined in `worker.tsx`
- **Use server-side useState** — state hydrates on client only
- **Use default exports** — named exports everywhere

## DOMAIN SPECIFICS

- **French locale always**: `date.toLocaleDateString("fr-FR", { ... })`, `formatPrice(42)` → `"42EUR"`
- **Booking ref format**: `H3-YYYYMMDD-XXXX` (e.g., `H3-20260115-A3B2`)
- **Two studios**: "La Scene" (42m2), "Le Podium" (35m2) — hardcoded in `booking.ts`
- **Peak pricing**: evenings (18h+) and weekends have higher rates
- **Primary color**: `#ffde59` — use `text-primary`, `bg-primary`
- **Custom fonts**: `font-sans` (Now), `font-blanka` (logo only)

## ROUTING PATTERN

```tsx
// worker.tsx — RedwoodSDK declarative routing
render(({ children }) => <Document>{children}</Document>, [
  layout(MainLayout, [
    route("/", Home),
    route("/reservation", Reservation),
    route("/reservation/:slug", Reservation),
  ]),
  layout(AdminLayout, [
    route("/admin", AdminDashboard),
  ]),
]);
```

## AGENT WORKFLOW (MANDATORY)

After completing ANY task, execute this loop:

1. **Type check** — `pnpm check` → fix all errors
2. **Build** — `pnpm build` → must exit 0
3. **Commit** — `git add . && git commit -m "descriptive message"`
4. **Deploy staging** — `pnpm release:staging`
5. **Visual test** — use chrome-devtools MCP to navigate https://h3-studios-staging.workers.dev, take snapshots, verify UI, check console errors
6. **Issues?** → fix and restart from step 1

**DO NOT STOP** until all steps pass. This loop is non-negotiable.
