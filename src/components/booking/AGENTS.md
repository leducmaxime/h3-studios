# BOOKING COMPONENTS - KNOWLEDGE BASE

Multi-step booking flow for studio reservations (refactored Jul 2026).

## OVERVIEW

State machine: group type → date → slots (2 studios stacked, implicit studio) → cart → user info → payment → confirmation.

Slug-based step model with guard-based navigation, per-step URLs, and localStorage persistence (v2 key `h3-studios-booking-state-v2`).

## STEP FLOW

```
groupe → creneau → panier → coordonnees → paiement → termine
```

Each slug corresponds to its own URL path (`/reservation/<slug>`). Guards prevent direct access to unreachable steps (e.g., deep-linking to `/reservation/panier` with an empty cart redirects to `groupe`).

### Guard Logic (`applyStepGuards` in `useBookingWithRouter.ts`)

| Target Step | Guard Condition | Redirect To |
|---|---|---|
| `groupe` / `creneau` | Cart lock: `cart.length > 0 && !isAddingNew` | `panier` |
| `creneau` | No `groupType` selected | `groupe` |
| `panier` / `coordonnees` / `paiement` | Empty cart | `groupe` |
| `termine` | Always (terminal, direct → groupe) | `groupe` |

The cart lock prevents users from choosing a new group type or date while they have items in the cart. The lock is lifted when `isAddingNew` is true (user clicked "Ajouter une autre réservation").

## STRUCTURE

```
booking/
├── useBookingWithRouter.ts   # Hook: URL sync, persistence, API fetching, guard logic
├── GroupTypeToggle.tsx        # Step groupe: Solo/Duo/Group selection
├── WeekCalendar.tsx           # Step creneau: Date picker (week view with API-loaded availability)
├── TimeSlotPicker.tsx         # Step creneau: Time slot grid, 2 studios side-by-side (desktop), stacked (mobile)
├── BookingForm.tsx            # Step coordonnees: User info form + inline login + account creation
│   ├── LoginCard              # Subcomponent: inline login/logout card
│   └── AccountCreationCard    # Subcomponent: password creation with validation
├── EquipmentSelector.tsx      # Optional equipment add-ons (shown inline in creneau recap)
├── PromoCodeInput.tsx         # Promo code entry in cart
├── FinalCheckout.tsx          # Step termine: Confirmation + calendar downloads
├── PaymentChoice.tsx          # Step paiement: Card vs Cash choice
├── StripeRedirect.tsx         # Step paiement: Stripe Checkout redirect
├── ProgressIndicator.tsx      # Step progress bar (clickable via canNavigateToStep)
├── StickyBookingCTA.tsx       # Mobile sticky CTA for adding to cart
├── usePricing.ts              # Hook: fetch /api/pricing, wire DB-driven opening hours
├── useEquipment.ts            # Hook: fetch /api/equipment list
├── useBookingWithRouter.ts    # (hook, listed above)
└── AGENTS.md                  # This file
```

**Files removed**: StudioCard.tsx, CartSummary.tsx, FlowChoice.tsx — studio is implicit from selected slot, cart is inline in Reservation.tsx.

## STATE (`useBookingWithRouter.ts`)

```typescript
interface ExtendedBookingState {
  step: BookingStep;                      // "groupe" | "creneau" | "panier" | "coordonnees" | "paiement" | "termine"
  selectedDate: Date | null;
  startTime / endTime: string | null;
  studioId: "la-scene" | "le-podium" | null;  // implicit from selected slot
  groupType: "solo" | "duo" | "group" | null;
  // ... user info fields, cart, equipment, payment, promo, account
  isAddingNew: boolean;                   // true when adding extra booking to existing cart
  accountStatus: string | null;           // "created" | "activation-email-sent" from POST /api/bookings
}
```

### Persistence

- **localStorage key**: `h3-studios-booking-state-v2` (v2 = slug-based steps)
- Old `h3-studios-booking-state` is discarded on hydration (no migration)
- `termine` state is cleared on hydration (terminal states are stale)
- Account credentials (`accountPassword`, `accountPasswordConfirm`) are NEVER persisted
- User preferences (`userName`, `userEmail`, `userPhone`, `bandName`) persist separately under `h3-studios-user-prefs`

## KEY INTERACTION MODELS

### TimeSlotPicker

- **No dead clicks**: every click either selects, extends, changes studio, or deselects
- **Cross-studio**: clicking the other studio mid-selection moves the start there
- **Amber highlighting**: peak hours (evenings/weekends) shown in amber via grid-driven `isPeakTime`
- **Per-studio price legend**: exact DB rates from `/api/pricing` grid
- **1-hour minimum**: `slotDuration(selectedStart, endCandidate) >= 2` — enforced by `canBeEndTime`
- **Closing boundary**: last slot in `getStudioTimeSlots` (e.g. "00:00" for la-scene) is end-only; `canBeStartTime` excludes it, `hasBookableRun` excludes it
- **Occupied interior blocks**: a booking spanning the boundary renders the interior as filled, but the boundary slot itself can be the end of another booking

### Guest Checkout + Inline Login

- `/api/client/me` is fetched on hydration to detect logged-in clients
- Login card shows loading skeleton, connected state, or login form
- Account creation is optional, shown only for guests who check the checkbox
- Password validation: 8+ chars, letters+digits, passwords must match
- Account status ("created" / "activation-email-sent") shown on confirmation

## PRICING

- **DB-driven**: `/api/pricing` returns `{ grid, minMaxByGroupType, maxAdvanceDays, openingHours }`
- `usePricing` hook fetches on mount, feeds grid to `calculatePrice` from `@/lib/pricing`
- **Opening hours**: `setOpeningHours(data.openingHours)` called when pricing loads — falls back to `STUDIO_HOURS` defaults
- **Cart total recomputed** from grid each render (line items use `recomputeCartItemPrice`)
- **Promo codes**: `PROMO_CODES` in booking.ts (percentage/fixed), validated client-side

## MIN-ADVANCE RULES

- API returns `minAdvanceCutoffTime` and `todayFullyBlocked` per-date
- Hook applies via `applyMinAdvance(slots, cutoff, fullyBlocked)` — marks too-soon slots as unavailable
- `WeekCalendar.hasBookableAvailability` uses `hasBookableRun` with the cutoff
- Lexicographic "00:00" < any cutoff: when a cutoff is active, the midnight boundary slot is intentionally unavailable

## GUARDS + NAVIGATION

- `canNavigateToStep` derives from `applyStepGuards(…).isRedirect === false`
- paiement/termine are always excluded from clickability (user must proceed through flow)
- `navigateToStep` applies guards then sets step; groupe-reset (solo→duo→group) only fires when guard allows the navigation
- URL sync effect enforces guards reactively (except for termine which is terminal)

## STALE-FETCH GUARD

Both the selected-date availability fetch and the week calendar batch fetch use a generation counter (`useRef`) to discard outdated responses.

## VISUAL DESIGN

- Dark theme with primary accent (cyan/teal)
- Cards: rounded-xl, white/10 borders, white/5–20 backgrounds
- Progress indicator: circular icons with ping animation on current step
- Time slots: 3-row grid, 11px-12px font, borderline styles for states
- "DÉBUT"/"FIN" labels on selected range boundaries

## FORMER FEATURES (REMOVED)

- `FlowChoice.tsx` — no more time-first vs studio-first
- `StudioCard.tsx` — studio selection is implicit from slot click
- `CartSummary.tsx` — cart is inline in Reservation.tsx
- Group displacement/priority — occupied = unavailable for all group types
- Numeric step model — replaced with slug-based steps
