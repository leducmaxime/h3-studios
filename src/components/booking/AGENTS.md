# BOOKING COMPONENTS - KNOWLEDGE BASE

Multi-step booking flow for studio reservations. 20 files, ~120KB total.

## OVERVIEW

State machine managing: flow choice -> date -> time slots -> studio -> user info -> cart -> payment -> confirmation.

## STRUCTURE

```
booking/
├── BookingWidget.tsx       # Main orchestrator (step router)
├── useBooking.ts           # Simple state hook (no URL sync)
├── useBookingWithRouter.ts # Full hook with URL sync + persistence
│
├── FlowChoice.tsx          # Step 0: time-first vs studio-first
├── WeekCalendar.tsx        # Step 1: Date picker (week view)
├── TimeSlotPicker.tsx      # Step 2: Time slot grid (largest: 500+ lines)
├── StudioPicker.tsx        # Step 3: Studio selection
├── StudioCard.tsx          # Studio display card
├── GroupTypeToggle.tsx     # Solo/Duo/Group selector
│
├── BookingForm.tsx         # Step 4: User info form
├── EquipmentSelector.tsx   # Optional equipment add-ons
├── BookingConfirmation.tsx # Step 5: Single booking confirmed
├── CartSummary.tsx         # Multi-booking cart display
├── FinalCheckout.tsx       # Step 6: Cart review
│
├── PaymentChoice.tsx       # Step 7: Card vs Cash
├── MockPaymentForm.tsx     # Step 8: Demo card form
├── StripeRedirect.tsx      # Real Stripe checkout redirect
│
├── ProgressIndicator.tsx   # Progress bar
├── StickyBookingCTA.tsx    # Mobile sticky CTA
└── AlternativeSuggestions.tsx # Suggest alternatives if slot taken
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Modify step flow | `useBookingWithRouter.ts` | STEP_URL_MAP + state transitions |
| Change time grid | `TimeSlotPicker.tsx` | Complex: drag selection, availability |
| Add form field | `BookingForm.tsx` | Update + `updateUserInfo` in hook |
| Payment logic | `PaymentChoice.tsx`, `StripeRedirect.tsx` | Stripe vs mock |
| Persist booking state | `useBookingWithRouter.ts` | BOOKING_STORAGE_KEY localStorage |

## STEP FLOW

```
0: FlowChoice (time-first | studio-first)
   |
   v
1: WeekCalendar (select date)
   |
   v
2: TimeSlotPicker (select time range)
   |
   v
3: StudioPicker (select studio + group type)
   |
   v
4: BookingForm (user info + equipment)
   |
   v
5: BookingConfirmation (add to cart or checkout)
   |
   v
6: FinalCheckout (review cart)
   |
   v
7: PaymentChoice (card/cash)
   |
   +--[card]--> 8: StripeRedirect --> external
   |
   +--[cash]--> 9: Done (pay-on-site)
```

## STATE

```typescript
// useBookingWithRouter.ts
interface ExtendedBookingState {
  flow: "time-first" | "studio-first" | null;
  step: 0-9;
  selectedDate: Date | null;
  startTime: string | null;    // "14:00"
  endTime: string | null;      // "16:00"
  studioId: "la-scene" | "le-podium" | null;
  groupType: "solo" | "duo" | "group" | null;
  userName, userEmail, userPhone, bandName: string;
  cart: CompletedBooking[];
  equipment: EquipmentSelection[];
  paymentMethod: "card" | "cash" | null;
}
```

## CONVENTIONS

- **URL sync**: Steps map to `/reservation/{slug}` (creneau, studio, coordonnees, etc.)
- **Persistence**: State saved to localStorage on every change
- **Back navigation**: `goBack()` handles browser back button
- **User prefs**: Email/phone auto-filled from previous visits

## ANTI-PATTERNS

- **NO direct step mutation** - Always use hook methods (setStep, selectStudio, etc.)
- **NO prop drilling state** - BookingWidget passes hook return to children
- **NO skipping steps** - Each step validates before proceeding

## COMPLEXITY HOTSPOTS

### TimeSlotPicker.tsx (500+ lines)
- Drag-to-select time range
- Availability overlay (both studios)
- Peak/off-peak pricing display
- Conflict detection with existing bookings

### useBookingWithRouter.ts (500+ lines)
- URL <-> state synchronization
- localStorage persistence with date serialization
- Browser history management (popstate)
- Step transition logic for both flows
