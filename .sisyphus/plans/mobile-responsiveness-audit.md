# Mobile Responsiveness Audit & Fixes

## TL;DR

> **Quick Summary**: Audit complet de la version mobile (375px) de toutes les pages publiques et du flux de réservation, avec corrections des problèmes de layout et vérification que les fixes ne cassent pas la vue desktop (1280px).
> 
> **Deliverables**: 
> - Screenshots avant/après pour chaque page corrigée
> - Corrections de layout responsive sur toutes les pages publiques
> - Vérification de non-régression sur desktop
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - séquentiel (audit → fix → verify)
> **Critical Path**: Baseline Screenshots → Audit Mobile → Fixes → Verify Desktop

---

## Context

### Original Request
"Look at the mobile version of every page and every step in the reservation flow, and fix responsiveness. don't forget to re-check that the fixes in mobile view did not break the desktop view"

### Interview Summary
**Key Discussions**:
- **Scope**: Pages publiques uniquement (Home, Studios, Matériel, Tarifs, À Propos, Réservation, Payment)
- **Viewport cible**: 375px (iPhone SE/Mini) - le plus petit viewport commun
- **Exclusions**: Toutes les pages admin (Dashboard, Calendar, Bookings, etc.)
- **Vérification**: Screenshots automatiques via Chrome DevTools MCP

**Research Findings**:
- `WeekCalendar.tsx`: `grid-cols-7` - 7 colonnes potentiellement trop serrées à 375px
- `GroupTypeToggle.tsx`: `grid-cols-3` avec prix - risque d'overflow
- `TimeSlotPicker.tsx`: Grille de créneaux avec `flex-wrap` - à vérifier
- Tables `Tarifs.tsx` et `LeMateriel.tsx`: Déjà partiellement responsive avec `hidden sm:table-cell`
- Header: Menu hamburger existe avec `lg:hidden`

### Metis Review
**Identified Gaps** (addressed):
- **Landscape mode**: Non inclus dans scope (décision: portrait only)
- **Touch targets 44px**: Best-effort, pas une exigence stricte
- **Tablettes (768px)**: Non inclus - focus sur 375px puis vérification 1280px
- **États d'erreur**: À vérifier lors de l'audit
- **Clavier virtuel**: À tester sur les formulaires

---

## Work Objectives

### Core Objective
Corriger tous les problèmes de layout responsive sur les pages publiques à 375px, sans casser l'affichage desktop à 1280px.

### Concrete Deliverables
- 7 pages publiques auditées et corrigées
- 8+ composants du flux réservation audités et corrigés
- Screenshots de documentation dans `.sisyphus/evidence/`
- Aucune régression sur desktop

### Definition of Done
- [x] Toutes les pages publiques affichent correctement à 375px (pas de scroll horizontal)
- [x] Toutes les étapes du flux réservation sont utilisables à 375px
- [x] Tous les textes sont lisibles sans zoom
- [x] Tous les boutons sont tappables
- [x] Desktop (1280px) n'a aucune régression visuelle

### Must Have
- Layout fixes uniquement (overflow, cramming, positioning)
- Screenshots avant/après pour chaque modification
- Vérification desktop après chaque fix mobile

### Must NOT Have (Guardrails)
- NE PAS toucher aux pages admin
- NE PAS redesigner les composants
- NE PAS ajouter de nouvelles fonctionnalités
- NE PAS modifier les couleurs ou typographie
- NE PAS ajouter de nouvelles dépendances
- NE PAS restructurer le code adjacent
- NE PAS "améliorer" le code non lié au responsive

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (pas de test framework)
- **Automated tests**: None
- **Framework**: N/A
- **Agent-Executed QA**: ALWAYS - Chrome DevTools MCP pour screenshots et navigation

### Agent-Executed QA Scenarios (MANDATORY)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **Pages publiques** | Chrome DevTools MCP | Navigate, resize to 375px, take screenshot, check for horizontal scroll |
| **Booking flow** | Chrome DevTools MCP | Navigate through each step, interact with components, screenshot |
| **Desktop verification** | Chrome DevTools MCP | Resize to 1280px, screenshot, compare with baseline |

**Evidence Requirements:**
- Baseline screenshots: `.sisyphus/evidence/baseline-{page}-375px.png`
- After fix screenshots: `.sisyphus/evidence/fixed-{page}-375px.png`
- Desktop verification: `.sisyphus/evidence/verify-{page}-1280px.png`

---

## Execution Strategy

### Sequential Execution Flow

```
Phase 1: Baseline Capture
├── Task 1: Capture baseline mobile (375px) for all pages
└── Task 2: Capture baseline desktop (1280px) for all pages

Phase 2: Audit & Fix (by priority)
├── Task 3: Fix WeekCalendar (blocking - 7 columns issue)
├── Task 4: Fix GroupTypeToggle (blocking - 3 columns + pricing)
├── Task 5: Fix TimeSlotPicker (blocking - time slot grid)
├── Task 6: Fix BookingForm (major - form fields)
├── Task 7: Fix PaymentChoice (major - payment options)
├── Task 8: Fix Tarifs page tables (major - pricing tables)
├── Task 9: Fix LeMateriel page tables (major - equipment tables)
├── Task 10: Fix LesStudios page (minor - studio cards)
├── Task 11: Fix APropos page (minor - text layout)
├── Task 12: Fix Home page (minor - hero layout)
├── Task 13: Fix PaymentSuccess/Cancel pages (minor)
└── Task 14: Fix Header mobile menu (if needed)

Phase 3: Final Verification
└── Task 15: Full desktop regression check
```

---

## TODOs

### Phase 1: Baseline Capture

- [x] 1. Capture Baseline Screenshots (Mobile 375px) ✓ COMPLETED

  **What to do**:
  - Naviguer vers chaque page publique à 375px
  - Capturer screenshot de l'état actuel
  - Documenter les problèmes visibles

  **Pages à capturer**:
  1. `/` (Home)
  2. `/les-studios`
  3. `/le-materiel`
  4. `/tarifs`
  5. `/a-propos`
  6. `/reservation` (toutes les étapes du flux)
  7. `/payment/success`
  8. `/payment/cancel`

  **Must NOT do**:
  - NE PAS modifier de code
  - NE PAS encore corriger les problèmes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Screenshots uniquement, pas de code
  - **Skills**: [`playwright`, `dev-browser`]
    - `playwright`: Navigation et screenshots via Chrome DevTools
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Pas de modification UI

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 3-15 (all fixes depend on baseline)
  - **Blocked By**: None

  **References**:
  - `src/worker.tsx:53-114` - Routes publiques définies
  - `src/components/booking/AGENTS.md` - Structure du flux réservation

  **Acceptance Criteria**:
  - [ ] 8 screenshots saved to `.sisyphus/evidence/baseline-*-375px.png`
  - [ ] List of visible issues documented

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Capture mobile baseline for Home
    Tool: Chrome DevTools MCP
    Preconditions: Dev server running on staging
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/")
      3. take_snapshot() → Check for horizontal scroll
      4. take_screenshot(filePath=".sisyphus/evidence/baseline-home-375px.png")
    Expected Result: Screenshot captured, issues noted
    Evidence: .sisyphus/evidence/baseline-home-375px.png

  Scenario: Capture mobile baseline for Reservation flow
    Tool: Chrome DevTools MCP
    Preconditions: Dev server running
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/reservation")
      3. take_screenshot(filePath=".sisyphus/evidence/baseline-reservation-step0-375px.png")
      4. Click on "Groupe" option
      5. take_screenshot(filePath=".sisyphus/evidence/baseline-reservation-step1-375px.png")
      6. Continue through each visible step...
    Expected Result: All booking steps captured
    Evidence: Multiple screenshots in .sisyphus/evidence/
  ```

  **Commit**: NO

---

- [x] 2. Capture Baseline Screenshots (Desktop 1280px) ✓ COMPLETED

  **What to do**:
  - Mêmes pages que Task 1, mais à 1280px
  - Servira de référence pour vérifier non-régression

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: Task 15 (final verification)
  - **Blocked By**: Task 1

  **Acceptance Criteria**:
  - [ ] 8 screenshots saved to `.sisyphus/evidence/baseline-*-1280px.png`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Capture desktop baseline for all pages
    Tool: Chrome DevTools MCP
    Preconditions: Task 1 complete
    Steps:
      1. resize_page(width=1280, height=800)
      2. For each page: navigate → take_screenshot
    Expected Result: All desktop baselines captured
    Evidence: .sisyphus/evidence/baseline-*-1280px.png
  ```

  **Commit**: NO

---

### Phase 2: Audit & Fix

- [x] 3. Fix WeekCalendar Mobile Layout ✓ COMPLETED
  - Commit: 419fc51 - fix: improve WeekCalendar mobile layout at 375px

  **What to do**:
  - Analyser le problème: `grid-cols-7` à 375px
  - Options: scroll horizontal, réduire padding, ou adapter le layout
  - Implémenter le fix minimal
  - Vérifier à 375px ET 1280px

  **Must NOT do**:
  - NE PAS redesigner le calendrier
  - NE PAS ajouter de nouvelles fonctionnalités

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component modification
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Responsive design patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None (independent fix)
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/booking/WeekCalendar.tsx:118` - `grid grid-cols-7 gap-2`
  - `src/components/booking/WeekCalendar.tsx:130-166` - Date button styles

  **Acceptance Criteria**:
  - [ ] Calendar fully visible at 375px without horizontal scroll on container
  - [ ] Date numbers readable (min ~20px visible area per cell)
  - [ ] Navigation arrows tappable
  - [ ] Desktop 1280px unchanged from baseline

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: WeekCalendar displays correctly at 375px
    Tool: Chrome DevTools MCP
    Preconditions: Task fix applied, dev server running
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/reservation")
      3. Click "Groupe" to proceed to calendar
      4. take_snapshot() → Assert: no horizontal scroll on calendar container
      5. Assert: all 7 day names visible
      6. Assert: date numbers readable
      7. take_screenshot(filePath=".sisyphus/evidence/fixed-weekcalendar-375px.png")
    Expected Result: Calendar usable at 375px
    Evidence: .sisyphus/evidence/fixed-weekcalendar-375px.png

  Scenario: WeekCalendar unchanged at 1280px
    Tool: Chrome DevTools MCP
    Preconditions: Fix applied
    Steps:
      1. resize_page(width=1280, height=800)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/reservation")
      3. Click "Groupe" to proceed
      4. take_screenshot(filePath=".sisyphus/evidence/verify-weekcalendar-1280px.png")
      5. Compare with baseline-weekcalendar-1280px.png
    Expected Result: No visual regression
    Evidence: .sisyphus/evidence/verify-weekcalendar-1280px.png
  ```

  **Commit**: YES
  - Message: `fix(booking): improve WeekCalendar mobile layout at 375px`
  - Files: `src/components/booking/WeekCalendar.tsx`

---

- [x] 4. Fix GroupTypeToggle Mobile Layout ✓ COMPLETED
  - Commit: 4f12ba6 - fix(booking): improve GroupTypeToggle mobile layout at 375px

  **What to do** (COMPLETED):
  - Analyser `grid-cols-3` avec 3 cartes (Solo, Duo, Groupe)
  - Chaque carte a: icône, label, sublabel, prix
  - À 375px: potentiellement trop étroit
  - Options: stack vertical, réduire padding, ou scroll horizontal

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 5)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/booking/GroupTypeToggle.tsx:71` - `grid grid-cols-3 gap-2`
  - `src/components/booking/GroupTypeToggle.tsx:76-96` - Button card styles

  **Acceptance Criteria**:
  - [ ] All 3 options visible and readable at 375px
  - [ ] Price text doesn't overflow
  - [ ] Each card has adequate touch target
  - [ ] Desktop 1280px unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: GroupTypeToggle displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/reservation")
      3. take_snapshot()
      4. Assert: all 3 cards (Solo, Duo, Groupe) visible
      5. Assert: price text readable ("6€ - 22€/h" etc)
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-grouptype-375px.png")
    Expected Result: All options clearly visible
    Evidence: .sisyphus/evidence/fixed-grouptype-375px.png
  ```

  **Commit**: YES
  - Message: `fix(booking): improve GroupTypeToggle mobile layout at 375px`
  - Files: `src/components/booking/GroupTypeToggle.tsx`

---

- [x] 5. Fix TimeSlotPicker Mobile Layout ✓ COMPLETED
  - Commit: bfb8371 - fix(booking): improve TimeSlotPicker mobile layout at 375px

  **What to do**:
  - Grille de créneaux horaires avec `flex-wrap`
  - Boutons durée + boutons créneaux
  - Peut créer overflow horizontal
  - Légende en bas (prix, réservé, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/booking/TimeSlotPicker.tsx:247-273` - Duration buttons
  - `src/components/booking/TimeSlotPicker.tsx:280-365` - Time slot buttons
  - `src/components/booking/TimeSlotPicker.tsx:367-415` - Legend

  **Acceptance Criteria**:
  - [ ] Duration buttons wrap properly at 375px
  - [ ] Time slot buttons readable and tappable
  - [ ] Legend visible and aligned
  - [ ] No horizontal scroll on container
  - [ ] Desktop 1280px unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: TimeSlotPicker displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. Navigate to reservation → select Groupe → select date
      3. take_snapshot()
      4. Assert: duration buttons visible and readable
      5. Click "2h" duration button
      6. Assert: time slots appear, no horizontal overflow
      7. take_screenshot(filePath=".sisyphus/evidence/fixed-timeslotpicker-375px.png")
    Expected Result: Time picker fully usable
    Evidence: .sisyphus/evidence/fixed-timeslotpicker-375px.png
  ```

  **Commit**: YES
  - Message: `fix(booking): improve TimeSlotPicker mobile layout at 375px`
  - Files: `src/components/booking/TimeSlotPicker.tsx`

---

- [x] 6. Fix BookingForm Mobile Layout ✓ COMPLETED
  - Commit: 2f8b78b - fix(booking): improve BookingForm mobile layout at 375px

  **What to do**:
  - Formulaire avec `sm:grid-cols-2` pour champs en grille
  - À 375px: passage en single column
  - Vérifier labels, inputs, validation errors
  - Tester avec clavier virtuel

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/booking/BookingForm.tsx:62-118` - Form grid layout
  - `src/components/booking/BookingForm.tsx:135-162` - Billing address section

  **Acceptance Criteria**:
  - [ ] All form fields full width at 375px
  - [ ] Labels readable above inputs
  - [ ] Input fields properly sized
  - [ ] CTA button visible at bottom
  - [ ] Desktop 1280px shows 2-column layout unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: BookingForm displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. Navigate through booking to form step
      3. take_snapshot()
      4. Assert: all form fields visible
      5. Assert: input fields full width
      6. Click on email input → virtual keyboard appears (if real device)
      7. take_screenshot(filePath=".sisyphus/evidence/fixed-bookingform-375px.png")
    Expected Result: Form fully usable at 375px
    Evidence: .sisyphus/evidence/fixed-bookingform-375px.png
  ```

  **Commit**: YES
  - Message: `fix(booking): improve BookingForm mobile layout at 375px`
  - Files: `src/components/booking/BookingForm.tsx`

---

- [x] 7. Fix PaymentChoice Mobile Layout ✓ COMPLETED
  - Commit: 47190b1 - fix(booking): improve PaymentChoice mobile layout at 375px

  **What to do**:
  - 2 cartes de paiement (Card vs Cash)
  - `md:grid-cols-2` actuel
  - À 375px: stack vertical
  - Badge "Recommandé" sur carte supérieure

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 9)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/booking/PaymentChoice.tsx:25-71` - Payment option cards

  **Acceptance Criteria**:
  - [ ] Payment cards stack vertically at 375px
  - [ ] All text and icons visible
  - [ ] CTA buttons tappable
  - [ ] Desktop 1280px shows 2-column layout

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: PaymentChoice displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. Navigate through booking to payment choice step
      3. take_snapshot()
      4. Assert: 2 cards stack vertically
      5. Assert: "Recommandé" badge visible on first card
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-paymentchoice-375px.png")
    Expected Result: Payment options clearly presented
    Evidence: .sisyphus/evidence/fixed-paymentchoice-375px.png
  ```

  **Commit**: YES
  - Message: `fix(booking): improve PaymentChoice mobile layout at 375px`
  - Files: `src/components/booking/PaymentChoice.tsx`

---

- [x] 8. Fix Tarifs Page Tables ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - Tables de tarification avec `hidden sm:table-cell`
  - Vérifier que le contenu mobile est lisible
  - 2 tables: grille tarifaire + enregistrement/locations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 9)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/Tarifs.tsx:24-94` - Main pricing table
  - `src/app/pages/Tarifs.tsx:101-137` - Recording/rental table

  **Acceptance Criteria**:
  - [ ] Tables readable at 375px
  - [ ] All prices visible
  - [ ] Peak/off-peak distinction clear
  - [ ] Desktop table unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Tarifs page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/tarifs")
      3. take_snapshot()
      4. Assert: table content readable
      5. Assert: all prices visible
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-tarifs-375px.png")
    Expected Result: Pricing information accessible
    Evidence: .sisyphus/evidence/fixed-tarifs-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve Tarifs page mobile layout at 375px`
  - Files: `src/app/pages/Tarifs.tsx`

---

- [x] 9. Fix LeMateriel Page Tables ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - Tables d'équipement avec switch mobile/desktop (`hidden lg:block` / `lg:hidden`)
  - Vérifier que les tables mobiles sont correctement affichées
  - 4 sections: équipement studios, enregistrement, location instruments

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/LeMateriel.tsx:106-163` - Mobile tables (lg:hidden)
  - `src/app/pages/LeMateriel.tsx:166-202` - Recording/instrument tables

  **Acceptance Criteria**:
  - [ ] Mobile tables visible at 375px
  - [ ] All equipment info readable
  - [ ] Desktop tables unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: LeMateriel page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/le-materiel")
      3. take_snapshot()
      4. Assert: mobile tables visible (not desktop tables)
      5. take_screenshot(filePath=".sisyphus/evidence/fixed-materiel-375px.png")
    Expected Result: Equipment lists accessible
    Evidence: .sisyphus/evidence/fixed-materiel-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve LeMateriel page mobile layout at 375px`
  - Files: `src/app/pages/LeMateriel.tsx`

---

- [x] 10. Fix LesStudios Page ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - 2 cartes studio avec images et descriptions
  - `lg:flex-row` pour layout desktop
  - Vérifier le stack vertical mobile

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/LesStudios.tsx:35-58` - Studio cards layout

  **Acceptance Criteria**:
  - [ ] Studio cards stack vertically at 375px
  - [ ] Images properly sized
  - [ ] CTA buttons visible
  - [ ] Desktop side-by-side layout unchanged

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: LesStudios page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/les-studios")
      3. take_snapshot()
      4. Assert: 2 studio cards stack vertically
      5. Assert: carousels work
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-studios-375px.png")
    Expected Result: Studio information accessible
    Evidence: .sisyphus/evidence/fixed-studios-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve LesStudios page mobile layout at 375px`
  - Files: `src/app/pages/LesStudios.tsx`

---

- [x] 11. Fix APropos Page ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - Page "À Propos" avec texte, image, contact, localisation
  - `lg:flex-row` pour map/layout
  - Vérifier le layout mobile

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 12, 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/APropos.tsx:51-76` - Location section with map

  **Acceptance Criteria**:
  - [ ] Text readable at 375px
  - [ ] Image properly sized
  - [ ] Map visible below text
  - [ ] Contact info accessible

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: APropos page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/a-propos")
      3. take_snapshot()
      4. Assert: text readable without scroll horizontal
      5. take_screenshot(filePath=".sisyphus/evidence/fixed-apropos-375px.png")
    Expected Result: About page information accessible
    Evidence: .sisyphus/evidence/fixed-apropos-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve APropos page mobile layout at 375px`
  - Files: `src/app/pages/APropos.tsx`

---

- [x] 12. Fix Home Page ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - Page d'accueil avec images hero et services
  - CTA "Réservation" principal
  - Vérifier le layout mobile des images et texte

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/Home.tsx:13-48` - Home page layout

  **Acceptance Criteria**:
  - [ ] Hero images sized appropriately at 375px
  - [ ] Services list readable
  - [ ] CTA button visible and tappable

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Home page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/")
      3. take_snapshot()
      4. Assert: hero images visible
      5. Assert: CTA button tappable
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-home-375px.png")
    Expected Result: Home page engaging on mobile
    Evidence: .sisyphus/evidence/fixed-home-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve Home page mobile layout at 375px`
  - Files: `src/app/pages/Home.tsx`

---

- [x] 13. Fix Payment Success/Cancel Pages ✓ COMPLETED (already responsive - no changes needed)

  **What to do**:
  - Pages de confirmation après paiement
  - Vérifier le layout mobile du message de succès
  - Boutons de navigation

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/app/pages/PaymentSuccess.tsx:43-109` - Success page layout

  **Acceptance Criteria**:
  - [ ] Success message visible at 375px
  - [ ] Booking reference readable
  - [ ] Navigation buttons tappable

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: PaymentSuccess page displays correctly at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/payment/success")
      3. take_snapshot()
      4. Assert: checkmark icon visible
      5. Assert: buttons tappable
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-paymentsuccess-375px.png")
    Expected Result: Success page clear on mobile
    Evidence: .sisyphus/evidence/fixed-paymentsuccess-375px.png
  ```

  **Commit**: YES
  - Message: `fix(pages): improve Payment pages mobile layout at 375px`
  - Files: `src/app/pages/PaymentSuccess.tsx`, `src/app/pages/PaymentCancel.tsx`

---

- [x] 14. Fix Header Mobile Menu ✓ COMPLETED (no changes needed - existing code works correctly)

  **What to do**:
  - Vérifier le menu hamburger mobile
  - S'assurer que le menu s'ouvre correctement
  - Vérifier la navigation

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`, `playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/components/Header/Header.tsx:103-126` - Hamburger button
  - `src/components/Header/Header.tsx:127-159` - Mobile nav menu

  **Acceptance Criteria**:
  - [ ] Hamburger button visible and tappable at 375px
  - [ ] Menu opens on tap
  - [ ] All nav links visible in menu
  - [ ] Menu closes on link tap or outside click

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Header mobile menu works at 375px
    Tool: Chrome DevTools MCP
    Steps:
      1. resize_page(width=375, height=667)
      2. navigate_page(url="https://h3-studios-staging.workers.dev/")
      3. take_snapshot()
      4. Click hamburger button (aria-label="Mobile Menu")
      5. Assert: menu appears
      6. take_screenshot(filePath=".sisyphus/evidence/fixed-header-menuopen-375px.png")
      7. Click nav link "Les Studios"
      8. Assert: navigated to /les-studios
    Expected Result: Mobile menu functional
    Evidence: .sisyphus/evidence/fixed-header-*.png
  ```

  **Commit**: YES (if changes needed)
  - Message: `fix(header): improve mobile menu at 375px`
  - Files: `src/components/Header/Header.tsx`

---

### Phase 3: Final Verification

- [x] 15. Final Desktop Regression Check ✓ COMPLETED

  **What to do**:
  - Vérifier TOUTES les pages à 1280px
  - Comparer avec les baselines
  - Documenter toute régression

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final step)
  - **Blocks**: None
  - **Blocked By**: All fix tasks (3-14)

  **References**:
  - All baseline screenshots from Tasks 1, 2

  **Acceptance Criteria**:
  - [ ] All pages display correctly at 1280px
  - [ ] No visual regressions from baseline
  - [ ] No horizontal scroll introduced
  - [ ] All functionality preserved

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full desktop regression check at 1280px
    Tool: Chrome DevTools MCP
    Preconditions: All fixes complete
    Steps:
      1. resize_page(width=1280, height=800)
      2. For each page:
         a. navigate to page
         b. take_screenshot(filePath=".sisyphus/evidence/final-verify-{page}-1280px.png")
         c. compare with baseline-{page}-1280px.png
      3. Document any differences
    Expected Result: No regressions
    Evidence: .sisyphus/evidence/final-verify-*-1280px.png
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 3 | `fix(booking): improve WeekCalendar mobile layout at 375px` | `WeekCalendar.tsx` |
| 4 | `fix(booking): improve GroupTypeToggle mobile layout at 375px` | `GroupTypeToggle.tsx` |
| 5 | `fix(booking): improve TimeSlotPicker mobile layout at 375px` | `TimeSlotPicker.tsx` |
| 6 | `fix(booking): improve BookingForm mobile layout at 375px` | `BookingForm.tsx` |
| 7 | `fix(booking): improve PaymentChoice mobile layout at 375px` | `PaymentChoice.tsx` |
| 8 | `fix(pages): improve Tarifs page mobile layout at 375px` | `Tarifs.tsx` |
| 9 | `fix(pages): improve LeMateriel page mobile layout at 375px` | `LeMateriel.tsx` |
| 10 | `fix(pages): improve LesStudios page mobile layout at 375px` | `LesStudios.tsx` |
| 11 | `fix(pages): improve APropos page mobile layout at 375px` | `APropos.tsx` |
| 12 | `fix(pages): improve Home page mobile layout at 375px` | `Home.tsx` |
| 13 | `fix(pages): improve Payment pages mobile layout at 375px` | `PaymentSuccess.tsx`, `PaymentCancel.tsx` |
| 14 | `fix(header): improve mobile menu at 375px` | `Header.tsx` (if needed) |

---

## Success Criteria

### Verification Commands
```bash
# Verify no horizontal scroll at 375px
# All pages should pass this check via Chrome DevTools

# Deploy to staging after all fixes
pnpm release:staging
```

### Final Checklist
- [x] All 7 public pages display correctly at 375px
- [x] All booking flow steps usable at 375px
- [x] No horizontal scrolling on any page at 375px
- [x] All text readable without zoom
- [x] All buttons tappable (adequate touch targets)
- [x] Desktop 1280px has no regressions
- [x] All screenshots documented in `.sisyphus/evidence/`
- [x] All commits pushed to staging
