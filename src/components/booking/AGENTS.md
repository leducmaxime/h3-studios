# BOOKING COMPONENTS - KNOWLEDGE BASE

Multi-step booking flow for studio reservations. Simplified single-flow architecture (refactor May 2026).

## OVERVIEW

State machine: group type → date → slots (2 studios stacked, implicit studio) → user info → cart → payment → confirmation.

## STRUCTURE

```
booking/
├── useBookingWithRouter.ts # Hook: URL sync + persistence + API fetching
│
├── GroupTypeToggle.tsx     # Step 0: Solo/Duo/Group
├── WeekCalendar.tsx        # Step 1: Date picker (week view)
├── TimeSlotPicker.tsx      # Step 1: Slots stacked (La Scène + Le Podium) per-studio
├── StudioCard.tsx          # Studio card (visual only)
│
├── BookingForm.tsx         # Step 2: User info form
├── EquipmentSelector.tsx   # Optional equipment add-ons
├── CartSummary.tsx         # Multi-booking cart
├── FinalCheckout.tsx       # Step 5: Confirmation
│
├── PaymentChoice.tsx       # Step 4: Card vs Cash
├── StripeRedirect.tsx      # Step 4: Stripe checkout
│
├── ProgressIndicator.tsx   # Type → Créneaux → Coordonnées → Panier → Paiement → Terminé
├── StickyBookingCTA.tsx    # Mobile sticky CTA
└── PromoCodeInput.tsx      # Promo code
```

**Removed**: `FlowChoice.tsx` (no more time-first vs studio-first). Studio is implicit: selecting a slot on La Scène = booking La Scène.

## STEP FLOW

```
0: GroupTypeToggle → 1: WeekCalendar + TimeSlotPicker (2 studios stacked)
   → 2: BookingForm → 3: CartSummary → 4: PaymentChoice → 5: FinalCheckout
```

## STATE (`useBookingWithRouter.ts`)

```typescript
interface ExtendedBookingState {
  step: 0 | 1 | 2 | 3 | 4 | 5;
  selectedDate: Date | null;
  startTime / endTime: string | null;
  studioId: "la-scene" | "le-podium" | null; // implicit from slot
  groupType: "solo" | "duo" | "group" | null;
  // ... user info, cart, payment, equipment
}
```

## KEY CHANGES (2026 refactor)

- **Removed**: `flow` field, `FlowChoice.tsx`, `assignStudioForSoloDuo()`, `isStudioAvailable()`, `isStudioAvailableForGroup()`
- **Added**: `createBookingWithDisplacement()` (DB) — atomic group booking with solo/duo displacement
- **Added**: `canDisplaceBooking()` — 24h rule (Paris time)
- **Added**: Displacement/cancellation emails via Resend
- **Changed**: API `/api/availability` → `{ slots: { "la-scene": [...], "le-podium": [...] } }`
- **Changed**: TimeSlotPicker — 2 blocks stacked, no side-by-side grid
- **Changed**: Groups see displaceable slots as plain "available" (silent displacement)
