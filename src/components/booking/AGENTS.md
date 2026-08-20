# BOOKING COMPONENTS - KNOWLEDGE BASE

Multi-step booking flow for studio reservations (refactored Jul 2026).

## OVERVIEW

State machine: group type → date → slots (2 studios stacked, implicit studio) → options → cart → user info → payment → confirmation.

Slug-based step model with guard-based navigation, per-step URLs, and localStorage persistence (v2 key `h3-studios-booking-state-v2`).

## STEP FLOW

```
groupe → creneau → options → panier → coordonnees → paiement → termine
```

Each slug corresponds to its own URL path (`/reservation/<slug>`). Guards prevent direct access to unreachable steps (e.g., deep-linking to `/reservation/panier` with an empty cart redirects to `groupe`).

### Guard Logic (`applyStepGuards` in `useBookingWithRouter.ts`)

| Target Step | Guard Condition | Redirect To |
|---|---|---|
| `groupe` / `creneau` / `options` | Cart lock: `cart.length > 0 && !isAddingNew` | `panier` |
| `creneau` | No `groupType` selected | `groupe` |
| `options` | No group, then incomplete date/time/studio selection | `groupe`, then `creneau` |
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
├── EquipmentSelector.tsx      # Optional equipment add-ons
├── BookingOptionsStep.tsx     # Included equipment, add-ons, recap and add-to-cart CTA
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
  step: BookingStep;                      // "groupe" | "creneau" | "options" | "panier" | "coordonnees" | "paiement" | "termine"
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
- The v2 state key remains the source of truth; stale `termine` state is cleared on hydration (no migration from v1).
- `termine` state is cleared on hydration (terminal states are stale)
- Account credentials (`accountPassword`, `accountPasswordConfirm`) are NEVER persisted
- User preferences (`userName`, `userEmail`, `userPhone`, `bandName`) persist separately under `h3-studios-user-prefs`

## KEY INTERACTION MODELS

### TimeSlotPicker

- **No dead clicks**: every click either selects, extends, changes studio, or deselects
- **Cross-studio**: clicking the other studio mid-selection moves the start there
- **Peak highlighting**: peak hours (evenings/weekends) shown via an amber outline only (`border-amber-400/*` on the neutral `bg-white/5–10`, no amber fill, white text like off-peak) via grid-driven `isPeakTime` — the fill is reserved for the selection so unselected peak slots never read as selected; hover brightens the neutral bg and the border instead
- **End-only slots**: free slots that can't open a range (no 1h runway, closing boundary), the slot right after a selected start, and end-capable occupied boundaries render in a softened hue tinted by time of day (amber outline for peak hours, neutral otherwise — dimmed border, dimmed white text, never greyed out), keep `cursor-not-allowed` visually, and show a min-duration tooltip (« Durée minimum de réservation : 1 heure ») on hover/focus-visible with `aria-disabled` + `aria-describedby`
- **Dead free slots**: a free slot whose maximal contiguous free run holds fewer than 2 real slots (the closing-boundary slot never counts as runway — mirrors `canBeStartTime`'s `slice(0,-1)`) can never belong to any booking → renders occupied-red in ALL modes, no tooltip (below the selection/confirmed-range branches)
- **Occupied-boundary rule**: the first slot of an occupied block is end-capable iff the free run immediately before it holds ≥ 2 real slots → soft + min-1h tooltip in start/done and end other-studio modes; a dead boundary (run < 2) renders red instead. End same-studio mode is unchanged (the boundary may be a valid end candidate). No special case for the last visible slot — the same run rule decides soft vs red
- **Per-studio price legend**: exact DB rates from `/api/pricing` grid
- **1-hour minimum**: `slotDuration(selectedStart, endCandidate) >= 2` — enforced by `canBeEndTime`
- **Closing boundary**: last slot in `getStudioTimeSlots` (e.g. "00:00" for la-scene) is end-only; `canBeStartTime` excludes it, `hasBookableRun` excludes it
- **Occupied interior blocks**: a booking spanning the boundary renders the interior as filled, but the boundary slot itself can be the end of another booking

### Admin override (`allowOverride`)

- `TimeSlotPicker` and `WeekCalendar` accept `allowOverride?: boolean` (default `false`). When `false`, behavior is unchanged — the public tunnel never passes it.
- When `true` (admin only, via `src/components/admin/AdminSlotPicker.tsx`):
  - Slot grid uses the full `ALL_TIME_SLOTS` range, not `getStudioTimeSlots` — closed hours render dashed with a « Hors horaires » tooltip and stay clickable
  - `checkSlotBooked` ignores `todayFullyBlocked`; a slot missing from the API payload is treated as free, not booked
  - Occupied slots stay red but are selectable (`cursor-pointer`)
  - Range validity collapses to `isOverrideRangeValid` (end after start) — the 1h minimum, opening hours, and occupancy checks do not apply, so 30-min bookings are allowed
  - `"00:00"` remains end-only
  - The calendar allows past dates, full days, and ±730 days of navigation, and snaps to the week holding `selectedDate`
- Styling is isolated in `getOverrideSlotStyle`; the public `getSlotStyle` is untouched.
- Admin surfaces show warnings from `getAdminSlotWarnings` (`src/lib/booking.ts`) instead of blocking — `POST/PUT /api/admin/bookings` no longer reject conflicts or blocked slots. Public `POST /api/bookings` still rejects them.

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
- **Promo codes**: validated server-side via `POST /api/promo-codes/validate` (`src/lib/db.ts` `validatePromoCode` + `applyDiscountRounding`). The public tunnel displays the returned `discount` and does not recompute rounding.
- **CGV**: public checkout requires an explicit checkbox on the `paiement` step (`acceptedCgv`). A 0 € cart still goes through `paiement` (confirm CTA) instead of submitting from `coordonnees`. `POST /api/bookings` rejects without `acceptedCgv: true`. Admin booking creation is unchanged.
- **Equipment stock**: physical pool shared by both studios. Public ceiling is `min(maxPerSession, available)`. `no-show` releases stock (only `confirmed` + `completed` hold). Public `POST /api/bookings` rejects over-stock.

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
- `options` backs to `creneau` while retaining date/time/studio and equipment. The next back clears the range; a creneau back without a date returns to groupe.
- Equipment is cleared whenever a date or range is cleared (`selectDate`, `clearTimeRange`, group-type advance, or creneau back that clears the date). Options back does not clear it.

## STALE-FETCH GUARD

Both the selected-date availability fetch and the week calendar batch fetch use a generation counter (`useRef`) to discard outdated responses.

## VISUAL DESIGN

- Dark theme with primary accent (cyan/teal)
- Cards: rounded-xl, white/10 borders, white/5–20 backgrounds
- Progress indicator: circular icons with ping animation on current step
- Time slots: 3-row grid with shared fixed columns and `box-border` cells for identical dimensions, 11px-12px font, borderline styles for states
- "DÉBUT"/"FIN" labels on selected range boundaries

## LOADING STATES

### TimeSlotPicker – slot grid skeleton + pricing error banner

- **`slotsLoading`**: set synchronously when `selectedDate` changes (the availability fetch fires in a `useEffect` in `useBookingWithRouter`). Cleared on both success and error via a generation counter (`useRef`) that discards stale responses — the flag stays `true` until the response for the *current* generation arrives.
- **Grid skeleton gate**: `slotsLoading || (!pricingGrid && !pricingError)` — the skeleton replaces the slot grid while either availability is loading **or** the pricing grid is missing *without* a prior error. Once `pricingError` is set, the skeleton disappears and the error banner renders instead.
- **Pricing error banner**: when `pricingError && !pricingGrid`, each studio block renders a red-bordered banner (`border-red-500/40 bg-red-500/10`) with the text « Impossible de charger les tarifs. » and a « Réessayer » button wired to `refetchPricing`. The banner replaces the slot grid (skeleton is hidden, no overlap). Studio photos and price legends remain visible.

### EquipmentSelector – inline loading

- **`loading` prop**: passed from `useEquipment().loading`, shows a single skeleton row in place of the equipment list (matched height to reduce layout shift).
- **Availability + clamp**: optional `availability` map (per-id `{ available, reserved, reservedOnOtherStudio, stockTotal }`) caps the + stepper at `min(maxPerSession, available)`; capped rows show a short reason line (« N unités déjà réservées sur l'autre studio sur ce créneau » / « Plus d'unité disponible sur ce créneau »), zero-stock rows stay visible with + disabled; `clampMessage` renders a one-line amber notice above the list (parent clears it); `availabilityLoading` only dims the reason lines, never swaps in the skeleton.

### WeekCalendar – per-day pending state

- **Per-day pending**: derived from `!weekOccupancy.has(dateKey)` — when the batch-fetch response hasn't arrived for a given date, the day cell renders a subtle shimmer. On fetch error the cell falls back to `useOptimisticFallback(dateKey)`, which returns an optimistic availability (all slots free) so the user can still interact with the calendar.

## FORMER FEATURES (REMOVED)

- `FlowChoice.tsx` — no more time-first vs studio-first
- `StudioCard.tsx` — studio selection is implicit from slot click
- `CartSummary.tsx` — cart is inline in Reservation.tsx
- Group displacement/priority — occupied = unavailable for all group types
- Numeric step model — replaced with slug-based steps
