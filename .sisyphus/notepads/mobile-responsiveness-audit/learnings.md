# Learnings - Mobile Responsiveness Audit

## 2026-02-12 Session Start

### Scope
- Pages publiques uniquement (excludes admin)
- Viewport cible: 375px (iPhone SE/Mini)
- Vérification desktop: 1280px

### Key Components with Issues
- WeekCalendar: `grid-cols-7` - 7 columns at 375px
- GroupTypeToggle: `grid-cols-3` with pricing text
- TimeSlotPicker: `flex-wrap` time slots
- Tables: Already partially responsive

### Conventions Observed
- Breakpoints: sm: (640px), md: (768px), lg: (1024px)
- Mobile menu: `lg:hidden` for hamburger
- Tables: `hidden sm:table-cell` pattern

## 2026-02-12 WeekCalendar Mobile Fix

### Problem
- At 375px, 7 columns with `gap-2 p-3` created ~43px wide buttons
- Text too small and cramped: day names, date numbers, "Disponible" text

### Solution Applied
- **Grid gap**: `gap-2` → `gap-1 lg:gap-2`
- **Button padding**: `p-3` → `p-1.5 lg:p-3`
- **Button min-height**: `min-h-[100px]` → `min-h-[72px] lg:min-h-[100px]`
- **Border radius**: `rounded-xl` → `rounded-lg lg:rounded-xl`
- **Ring offset**: `ring-offset-2` → `ring-offset-1 lg:ring-offset-2`
- **Day name font**: `text-xs` → `text-[10px] lg:text-xs`
- **Date number font**: `text-2xl` → `text-lg lg:text-2xl`
- **Availability text**: `text-xs` → `text-[9px] lg:text-xs`
- **Text abbreviation**: "Disponible" → "Dispo" on mobile only using:
  ```tsx
  <span className="lg:hidden">{disabled ? "Complet" : "Dispo"}</span>
  <span className="hidden lg:inline">{disabled ? "Complet" : "Disponible"}</span>
  ```

### Pattern for Responsive Text
To show abbreviated text on mobile and full text on desktop:
```tsx
<span className="lg:hidden">Abbrev.</span>
<span className="hidden lg:inline">Full Text</span>
```
This keeps both texts in DOM but only one visible at any breakpoint.

## 2026-02-12 GroupTypeToggle Mobile Fix

### Problem
- At 375px, 3 columns with `gap-2 p-3` and price text like "6€ - 22€/h" was cramped
- Each card has 4 elements: icon, label, sublabel, price range

### Solution Applied
- **Grid gap**: `gap-2` → `gap-1 lg:gap-2`
- **Button padding**: `p-3` → `p-2 lg:p-3`
- **Internal gap**: `gap-1` → `gap-0.5 lg:gap-1`
- **Icon size**: `h-5 w-5` → `h-4 w-4 lg:h-5 lg:w-5`
- **Label font**: `font-semibold` → `text-sm lg:text-base font-semibold`
- **Sublabel font**: `text-xs` → `text-[10px] lg:text-xs`
- **Price font**: `text-xs` → `text-[10px] lg:text-xs`
- **Price margin**: `mt-1` → `mt-0.5 lg:mt-1`
- **Ring offset**: `ring-offset-2` → `ring-offset-1 lg:ring-offset-2`

### Key Takeaway
For 3-column grids at 375px, reduce all padding/gaps and use `text-[10px]` as minimum readable size. Keep touch targets adequate by not reducing padding below `p-2`.

## 2026-02-12 TimeSlotPicker Mobile Fix

### Problem
At 375px, the TimeSlotPicker component had:
- Duration buttons with `gap-2`, `px-4 py-2`, `text-sm` - potentially too wide
- Time slot buttons with `min-w-[70px]`, `text-sm`, `px-3 py-2` - could cause cramping
- Legend with 5 items at `gap-3` - risk of horizontal overflow

### Solution Applied

#### Duration buttons row
- **Gap**: `gap-2` → `gap-1.5 lg:gap-2`
- **Padding**: `px-4 py-2` → `px-3 py-1.5 lg:px-4 lg:py-2`
- **Font size**: `text-sm` → `text-xs lg:text-sm`
- **+/- button icon**: `text-lg` → `text-base lg:text-lg`

#### Time slot buttons grid
- **Gap**: `gap-2` → `gap-1.5 lg:gap-2`
- **Padding**: `px-3 py-2` → `px-2 py-1.5 lg:px-3 lg:py-2`
- **Min-width**: `min-w-[70px]` → `min-w-[60px] lg:min-w-[70px]`
- **Font size**: `text-sm` → `text-xs lg:text-sm`
- **End time text**: `text-[10px]` → `text-[9px] lg:text-[10px]`

#### Legend items
- **Gap**: `gap-3 sm:gap-4` → `gap-2 lg:gap-3 xl:gap-4`
- **Font size**: `text-xs` → `text-[10px] lg:text-xs`
- **Icon size**: `h-5 w-5` → `h-4 w-4 lg:h-5 lg:w-5`
- **Icon font**: `text-[8-10px]` → reduced by 1px on mobile

### Key Takeaway
For flex-wrap button grids at 375px, reduce min-width constraints and use `text-xs` as the minimum. The `lg:` breakpoint (992px) ensures desktop layout remains unchanged.

## BookingForm.tsx - Mobile Layout (375px)

**Date**: 2026-02-12

### Changements appliqués
- Grille principale: `gap-4` → `gap-3 sm:gap-4` (espacement réduit sur mobile)
- Inputs: `px-4 py-3` → `px-3 py-2.5 sm:px-4 sm:py-3` (padding réduit)
- Ajouté `text-base` explicite sur inputs pour éviter le zoom iOS
- Titre: `text-lg` → `text-base sm:text-lg` (taille réduite sur mobile)
- Header gap: `gap-4` → `gap-3 sm:gap-4`
- Container gap: `gap-6` → `gap-5 sm:gap-6`
- Bouton CTA: `py-4 text-lg` → `py-3.5 text-base sm:py-4 sm:text-lg`

### Pattern responsive validé
- `sm:grid-cols-2` passe automatiquement en colonne unique sous 575px
- Aucune modification nécessaire au breakpoint - Tailwind gère ça nativement

### Bonnes pratiques
- Toujours utiliser `text-base` (16px) sur les inputs pour éviter le zoom automatique iOS
- Réduire le padding horizontal sur mobile pour maximiser l'espace disponible

## 2026-02-12 - ORCHESTRATION COMPLETE

### Summary
- **15/15 tasks completed**
- **5 files modified with responsive fixes**
- **7 pages already responsive (no changes needed)**

### Commits Made
1. `419fc51` - fix: improve WeekCalendar mobile layout at 375px
2. `4f12ba6` - fix(booking): improve GroupTypeToggle mobile layout at 375px
3. `bfb8371` - fix(booking): improve TimeSlotPicker mobile layout at 375px
4. `2f8b78b` - fix(booking): improve BookingForm mobile layout at 375px
5. `47190b1` - fix(booking): improve PaymentChoice mobile layout at 375px

### Files Modified
- `src/components/booking/WeekCalendar.tsx`
- `src/components/booking/GroupTypeToggle.tsx`
- `src/components/booking/TimeSlotPicker.tsx`
- `src/components/booking/BookingForm.tsx`
- `src/components/booking/PaymentChoice.tsx`

### Files Already Responsive (No Changes)
- `src/app/pages/Home.tsx`
- `src/app/pages/LesStudios.tsx`
- `src/app/pages/LeMateriel.tsx`
- `src/app/pages/Tarifs.tsx`
- `src/app/pages/APropos.tsx`
- `src/app/pages/PaymentSuccess.tsx`
- `src/app/pages/PaymentCancel.tsx`
- `src/components/Header/Header.tsx`

### Consistent Pattern Applied
For all components, the responsive pattern was:
| Property | Mobile (375px) | Desktop (lg: 992px+) |
|----------|----------------|----------------------|
| Gap | `gap-1` / `gap-1.5` | `lg:gap-2` |
| Padding | `p-2` / `px-3 py-1.5` | `lg:p-3` / `lg:px-4 lg:py-2` |
| Font size | `text-xs` / `text-[10px]` | `lg:text-sm` / `lg:text-xs` |
| Min-width | Reduced values | Original values |
| Ring offset | `ring-offset-1` | `lg:ring-offset-2` |

### Key Takeaways
1. **Text abbreviation pattern**: Use `<span className="lg:hidden">Short</span><span className="hidden lg:inline">Full Text</span>` for mobile-abbreviated text
2. **Grid constraints**: At 375px with `grid-cols-7` or `grid-cols-3`, reduce gaps/padding to minimum viable
3. **Flex-wrap buttons**: Reduce min-width and use `text-xs` minimum for button grids
4. **iOS zoom prevention**: Always use `text-base` (16px) on input fields
5. **Breakpoint convention**: Use `lg:` (992px) for desktop overrides to maintain consistency
