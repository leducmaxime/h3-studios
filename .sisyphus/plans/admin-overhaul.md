# Refonte Complète de l'Administration H3 Studios

## TL;DR

> **Résumé** : Reconstruction totale du panneau admin H3 Studios — migration localStorage → Cloudflare D1, système d'authentification avec rôles (super-admin + opérateurs), design system shadcn/ui, analytics avec Recharts, gestion tarifaire/équipements dynamique, création de réservation admin, exports CSV/PDF, vue audit log, vue calendrier mois, settings fonctionnels, et infrastructure de tests vitest.
>
> **Livrables** :
> - Base de données Cloudflare D1 avec schéma complet (8 tables)
> - API REST admin (15+ endpoints dans worker.tsx)
> - Système d'auth avec cookie signé + rôles super-admin/opérateur
> - 12+ composants shadcn/ui intégrés (Dialog, Toast, Tabs, DropdownMenu, etc.)
> - 9 pages admin refondues + 4 nouvelles pages/vues
> - Dashboard analytics avec 4 charts Recharts
> - Exports CSV (3 types) + PDF (factures + rapport mensuel)
> - Suite de tests vitest pour la logique backend
>
> **Effort estimé** : XL (5 phases, 25+ tâches)
> **Exécution parallèle** : OUI — 5 vagues après la fondation séquentielle
> **Chemin critique** : D1 Setup → API Layer → Auth → Pages refondues → Analytics/Exports

---

## Context

### Requête originale
L'utilisateur demande de « revoir complètement les pages d'admin » pour avoir « une admin très complète qui contiendrait tout ce qu'il faudrait pour correctement administrer le site et gérer les réservations ».

### Résumé de l'interview
**Décisions clés** :
- **Scope** : TOUT — UI/UX + fonctionnalités + infrastructure
- **DB** : Migration localStorage → Cloudflare D1
- **Auth** : Super-admin (tout accès) + Opérateurs (accès limité : réservations, clients, calendrier — PAS settings/tarifs)
- **UI** : Vrais composants shadcn/ui (@radix-ui) avec thème dark existant
- **Charts** : Recharts (line, bar, pie simples)
- **Pricing** : TOUT dynamique — prix base, peak/off-peak, promos, équipements, horaires
- **Exports** : CSV (réservations, clients, paiements) + PDF (factures, rapport mensuel)
- **Tests** : Setup vitest + @cloudflare/vitest-pool-workers pour logique backend
- **Hors scope** : Notifications email, backup/restore, websockets, flow de réservation public

### Résultats de recherche
**Codebase actuel** :
- 9 pages admin (~3000 lignes), tout en useState + localStorage
- `admin-store.ts` (704 lignes) : 15 fonctions CRUD, mock data, audit log
- `booking.ts` (670 lignes) : prix/studios/équipement hardcodés
- 3 composants UI seulement (Button CVA, Table, Carousel)
- Aucun binding D1 dans `wrangler.jsonc`
- Aucun middleware auth dans `worker.tsx`

**Findings technologiques** :
- shadcn/ui canary supporte Tailwind v4 (`npx shadcn@canary add`)
- Recharts v3+ compatible React 19
- jsPDF/pdf-lib ne marchent PAS sur Workers → génération PDF côté client
- `@cloudflare/vitest-pool-workers` pour tests D1
- Raw D1 (`env.DB.prepare()`) recommandé sur Prisma pour ce cas d'usage simple

### Revue Metis
**Lacunes identifiées (adressées)** :
- L'API layer n'existe pas — il faut créer 15-20 endpoints AVANT de toucher aux pages
- PDF doit être généré côté client (jsPDF), pas côté serveur
- Auth via cookie signé + table D1, pas via Durable Objects (éviter Workers Paid requirement)
- Le bouton Dashboard « Nouvelle réservation » pointe vers `/admin/bookings/new` qui n'existe pas
- Les prix hardcodés dans `booking.ts` doivent rester synchronisés avec D1 pricing
- Risque de scope creep sur pricing (verrouiller à CRUD simple)

---

## Objectifs de travail

### Objectif principal
Transformer l'admin H3 Studios d'un prototype localStorage/mock en un panneau d'administration complet, fonctionnel et sécurisé avec persistance D1, authentification, analytics, et gestion opérationnelle complète.

### Livrables concrets
- `wrangler.jsonc` avec binding D1
- 8+ fichiers migration SQL dans `migrations/`
- `src/lib/db.ts` — couche d'accès D1 avec fonctions helper
- `src/lib/auth.ts` — logique auth (hash, session, rôles)
- 15+ routes API dans `src/worker.tsx`
- 12+ composants shadcn/ui dans `src/components/ui/`
- 9 pages admin refondues dans `src/app/pages/admin/`
- Nouvelles pages : Login, AuditLog, BookingNew, PricingManagement
- `src/lib/export.ts` — génération CSV + PDF côté client
- Suite de tests dans `src/__tests__/`

### Définition de Done
- [x] `pnpm check` passe sans erreur
- [x] `pnpm build` passe sans erreur
- [x] `pnpm test` passe sans erreur (tests vitest)
- [x] `pnpm release:staging` déploie avec succès
- [x] Navigation complète de toutes les pages admin sans erreur console
- [x] Login/logout fonctionnel
- [x] CRUD réservations via D1 (pas localStorage)
- [x] Dashboard avec au moins 3 charts Recharts

### Must Have
- Migration complète localStorage → D1 pour TOUTES les données admin
- Auth cookie signé avec 2 rôles (super-admin, opérateur)
- Toutes les 9 pages admin refondues avec shadcn/ui
- Dashboard analytics avec charts
- Gestion tarifaire dynamique (prix, peak/off-peak, promos, équipements, horaires)
- Création de réservation depuis l'admin
- Exports CSV (réservations, clients, paiements)
- Vue audit log
- Vue calendrier mois
- Settings fonctionnels et persistants

### Must NOT Have (Gardes-fous)
- **NE PAS toucher au flow de réservation public** (`useBookingWithRouter.ts`, `BookingWidget.tsx`, etc.)
- **NE PAS utiliser Prisma** — raw D1 uniquement (`env.DB.prepare()`)
- **NE PAS générer de PDF côté serveur** — jsPDF côté client uniquement
- **NE PAS construire de système d'email/notifications**
- **NE PAS utiliser Durable Objects** pour l'auth (dépendance Workers Paid)
- **NE PAS construire un moteur de règles pricing** — CRUD simple sur tables fixes
- **NE PAS installer de composants shadcn/ui non nécessaires** — installer au besoin, page par page
- **NE PAS créer de système de self-registration admin** — comptes créés par seed ou super-admin
- **NE PAS ajouter de drag-and-drop** sur le calendrier
- **NE PAS over-engineer l'auth** (pas de JWT, refresh tokens, rate limiting, CSRF — juste cookie signé HttpOnly)
- **NE PAS migrer les données localStorage vers D1** — la DB prod démarre vide, le seeding est pour dev/staging

---

## Stratégie de vérification (MANDATORY)

> **RÈGLE UNIVERSELLE : ZÉRO INTERVENTION HUMAINE**
>
> TOUTES les tâches de ce plan DOIVENT être vérifiables SANS aucune action humaine.
> Toute vérification est exécutée par l'agent via des outils (Playwright, curl, bash, etc.).

### Décision test
- **Infrastructure existante** : NON
- **Tests automatisés** : OUI (tests-after)
- **Framework** : vitest + @cloudflare/vitest-pool-workers

### Setup test (inclus dans Phase 1)
- Installer vitest + @cloudflare/vitest-pool-workers
- Configurer vitest.config.ts pour Cloudflare Workers
- Tests sur : opérations DB, logique auth, calcul pricing, détection conflits

### Agent-Executed QA Scenarios (MANDATORY — toutes tâches)
- **Frontend/UI** : Chrome DevTools MCP — navigate, snapshot, click, fill, assert
- **API/Backend** : Bash (curl) — send requests, parse JSON, assert fields
- **Build** : `pnpm check && pnpm build` → exit code 0
- **Staging** : `pnpm release:staging` → Chrome DevTools sur https://h3-studios-staging.workers.dev

---

## Stratégie d'exécution

### Vagues d'exécution parallèle

```
Vague 1 (Démarrage immédiat — FONDATION) :
├── Tâche 1: Setup D1 + schéma + migrations
├── Tâche 2: Setup vitest + test infra
└── Tâche 3: Install composants shadcn/ui de base

Vague 2 (Après Vague 1 — API & AUTH) :
├── Tâche 4: Couche d'accès DB (lib/db.ts)
├── Tâche 5: Système d'auth (lib/auth.ts + routes login)
└── Tâche 6: API REST admin endpoints — Réservations & Calendrier

Vague 3 (Après Vague 2 — API COMPLÈTE + PAGES CORE) :
├── Tâche 7: API REST admin endpoints — Users, Payments, Studios, Settings
├── Tâche 8: Middleware auth + protection des routes
├── Tâche 9: Page Login admin
└── Tâche 10: AdminLayout refondu + navigation par rôle

Vague 4 (Après Vague 3 — PAGES REFONDUES) :
├── Tâche 11: Dashboard refondu + Analytics Recharts
├── Tâche 12: Calendrier refondu + vue mois
├── Tâche 13: Page Réservations refondues + page création réservation
├── Tâche 14: Pages Users + UserDetail refondues
├── Tâche 15: Page Paiements refondues
└── Tâche 16: Page Studios refondues

Vague 5 (Après Vague 4 — NOUVELLES FEATURES) :
├── Tâche 17: Gestion tarifaire dynamique (prix, peak/off-peak)
├── Tâche 18: Gestion codes promo
├── Tâche 19: Gestion équipements
├── Tâche 20: Gestion horaires d'ouverture
├── Tâche 21: Settings fonctionnels
├── Tâche 22: Vue Audit Log
├── Tâche 23: Exports CSV
├── Tâche 24: Exports PDF (factures + rapport mensuel)
└── Tâche 25: Tests backend complets + QA finale staging

Chemin critique: Tâche 1 → 4 → 5 → 8 → 11-16 → 17-24 → 25
```

### Matrice de dépendances

| Tâche | Dépend de | Bloque | Parallélisable avec |
|-------|-----------|--------|---------------------|
| 1 | Aucune | 4, 5, 6, 7 | 2, 3 |
| 2 | Aucune | 25 | 1, 3 |
| 3 | Aucune | 9, 10, 11-16 | 1, 2 |
| 4 | 1 | 5, 6, 7 | — |
| 5 | 4 | 8, 9 | 6 |
| 6 | 4 | 11, 12, 13 | 5, 7 |
| 7 | 4 | 14, 15, 16, 17-22 | 5, 6 |
| 8 | 5 | 9, 10 | 7 |
| 9 | 3, 8 | 11-16 | 10 |
| 10 | 3, 8 | 11-16 | 9 |
| 11 | 6, 9, 10 | 25 | 12, 13, 14, 15, 16 |
| 12 | 6, 9, 10 | 25 | 11, 13, 14, 15, 16 |
| 13 | 6, 9, 10 | 25 | 11, 12, 14, 15, 16 |
| 14 | 7, 9, 10 | 25 | 11, 12, 13, 15, 16 |
| 15 | 7, 9, 10 | 25 | 11, 12, 13, 14, 16 |
| 16 | 7, 9, 10 | 25 | 11, 12, 13, 14, 15 |
| 17 | 7 | 25 | 18, 19, 20, 21, 22, 23 |
| 18 | 7 | 25 | 17, 19, 20, 21, 22, 23 |
| 19 | 7 | 25 | 17, 18, 20, 21, 22, 23 |
| 20 | 7 | 25 | 17, 18, 19, 21, 22, 23 |
| 21 | 7 | 25 | 17, 18, 19, 20, 22, 23 |
| 22 | 7 | 25 | 17, 18, 19, 20, 21, 23 |
| 23 | 7 | 24 | 17, 18, 19, 20, 21, 22 |
| 24 | 23 | 25 | — |
| 25 | Toutes | Aucune | — |

### Résumé dispatch agents

| Vague | Tâches | Agents recommandés |
|-------|--------|-------------------|
| 1 | 1, 2, 3 | 3× quick en parallèle |
| 2 | 4, 5, 6 | séquentiel (4 d'abord) puis 5+6 parallèle |
| 3 | 7, 8, 9, 10 | 7+8 parallèle, puis 9+10 parallèle |
| 4 | 11-16 | 6× visual-engineering en parallèle |
| 5 | 17-25 | multiples en parallèle, 25 en dernier |

---

## TODOs

### PHASE 1 — FONDATION INFRASTRUCTURE

- [x] 1. Setup Cloudflare D1 + Schéma + Migrations

  **Ce qu'il faut faire** :
  - Ajouter le binding D1 dans `wrangler.jsonc` :
    ```json
    "d1_databases": [{ "binding": "DB", "database_name": "h3-studios-db", "database_id": "..." }]
    ```
  - Créer la base D1 : `wrangler d1 create h3-studios-db`
  - Créer le dossier `migrations/` avec fichiers SQL incrémentaux
  - **Table `admin_users`** : id, email, password_hash, name, role ("super-admin" | "operator"), is_active, created_at, updated_at
  - **Table `sessions`** : id, user_id, token, expires_at, created_at
  - **Table `users`** (clients) : id, email, name, phone, band_name, notes, is_blocked, total_bookings, total_spent, created_at, updated_at
  - **Table `bookings`** : id, booking_ref, user_id, studio_id, date, start_time, end_time, group_type, status, base_price, equipment_price, total_price, equipment (JSON), payment_method, payment_status, notes, created_at, updated_at, cancelled_at, cancel_reason
  - **Table `payments`** : id, booking_id, amount, method, status, refunded_amount, paid_at, created_at
  - **Table `blocked_slots`** : id, studio_id (nullable = all), date, start_time, end_time, reason, created_at
  - **Table `pricing`** : id, studio_id, group_type, is_peak, price_per_half_hour, updated_at
  - **Table `equipment`** : id, equipment_id, name, max_per_session, pricing_type, session_pricing (JSON), price_per_hour, updated_at
  - **Table `promo_codes`** : id, code, type ("percentage" | "fixed"), value, min_total, is_active, expires_at, usage_count, max_usage, created_at
  - **Table `opening_hours`** : id, studio_id, day_of_week (0-6), open_time, close_time, is_closed
  - **Table `settings`** : id, key, value (JSON), updated_at
  - **Table `audit_logs`** : id, entity_type, entity_id, action, changes (JSON), performed_by, created_at
  - Script de seed pour dev/staging : 1 super-admin (admin@h3studios.fr / admin123), 1 opérateur (operateur@h3studios.fr / oper123), 50 clients, ~600 bookings, payments, pricing initial (copié de booking.ts PRICING), équipements (copié de booking.ts EQUIPMENT), horaires (copié de booking.ts STUDIO_HOURS)
  - Appliquer migrations : `wrangler d1 migrations apply h3-studios-db --local`
  - Mettre à jour les types Cloudflare : `pnpm run types` (ajouter DB dans Env)

  **Ne PAS faire** :
  - Utiliser Prisma ou un ORM
  - Créer des relations avec des FOREIGN KEY complexes (garder simple, les JOINs se feront dans le code)
  - Toucher à un fichier existant SAUF `wrangler.jsonc` (ajouter binding)

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-high`
    - Raison : Infrastructure DB + migrations SQL, pas de l'UI
  - **Skills** : aucun skill spécifique nécessaire
  - **Skills évalués mais omis** :
    - `frontend-ui-ux` : pas d'UI dans cette tâche
    - `playwright` : pas de tests browser

  **Parallélisation** :
  - **En parallèle** : OUI
  - **Groupe** : Vague 1 (avec Tâches 2, 3)
  - **Bloque** : Tâches 4, 5, 6, 7
  - **Bloquée par** : Aucune

  **Références** :

  **Pattern References** :
  - `wrangler.jsonc` — Structure actuelle du fichier config Cloudflare, ajouter le binding D1 ici
  - `src/lib/admin-store.ts:1-100` — Types TypeScript actuels (AdminUser, AdminBooking, AdminPayment, BlockedSlot, AuditLog) à mapper vers le schéma SQL
  - `src/lib/admin-store.ts:100-250` — Fonction `createInitialStore()` avec la logique de génération mock data à reproduire dans le script de seed
  - `src/lib/booking.ts:1-50` — Types StudioId, GroupType, PaymentMethod, PaymentStatus à réutiliser
  - `src/lib/booking.ts:50-120` — STUDIOS, PRICING, EQUIPMENT constantes à copier dans le seed
  - `src/lib/booking.ts:120-180` — STUDIO_HOURS à copier dans la table opening_hours

  **Documentation** :
  - Cloudflare D1 docs : https://developers.cloudflare.com/d1/
  - `wrangler d1 migrations` : https://developers.cloudflare.com/d1/reference/migrations/

  **Critères d'acceptance** :

  - [ ] `wrangler.jsonc` contient un binding `d1_databases` avec nom "DB"
  - [ ] Le dossier `migrations/` contient au moins 1 fichier `.sql` avec les 12 tables
  - [ ] `wrangler d1 migrations apply h3-studios-db --local` réussit (exit 0)
  - [ ] `pnpm check` passe (les types Env incluent DB: D1Database)

  **Agent-Executed QA** :

  ```
  Scenario: Migrations D1 s'appliquent correctement en local
    Tool: Bash
    Preconditions: wrangler installé, wrangler.jsonc configuré
    Steps:
      1. wrangler d1 create h3-studios-db (ou vérifier qu'elle existe)
      2. wrangler d1 migrations apply h3-studios-db --local
      3. Assert: exit code 0
      4. wrangler d1 execute h3-studios-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
      5. Assert: output contient admin_users, sessions, users, bookings, payments, blocked_slots, pricing, equipment, promo_codes, opening_hours, settings, audit_logs
    Expected Result: 12 tables créées
    Evidence: Output terminal capturé

  Scenario: Seed data inséré correctement
    Tool: Bash
    Preconditions: Migrations appliquées
    Steps:
      1. Exécuter le script de seed (wrangler d1 execute --local --file seed.sql)
      2. wrangler d1 execute h3-studios-db --local --command "SELECT COUNT(*) FROM admin_users"
      3. Assert: count >= 2 (admin + operateur)
      4. wrangler d1 execute h3-studios-db --local --command "SELECT COUNT(*) FROM users"
      5. Assert: count >= 50
      6. wrangler d1 execute h3-studios-db --local --command "SELECT COUNT(*) FROM pricing"
      7. Assert: count >= 12 (2 studios × 3 groups × 2 peak/off-peak)
    Expected Result: Données de seed présentes
    Evidence: Output terminal capturé

  Scenario: Types TypeScript valides
    Tool: Bash
    Steps:
      1. pnpm check
      2. Assert: exit code 0, pas d'erreur liée à DB/D1Database
    Expected Result: TypeScript compile sans erreur
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): setup Cloudflare D1 database schema and migrations`
  - Fichiers : `wrangler.jsonc`, `migrations/*.sql`, `seed.sql`
  - Pre-commit : `pnpm check`

---

- [x] 2. Setup infrastructure de tests vitest

  **Ce qu'il faut faire** :
  - Installer `vitest` et `@cloudflare/vitest-pool-workers` en dev dependencies
  - Créer `vitest.config.ts` configuré pour Cloudflare Workers pool
  - Créer un test exemple `src/__tests__/example.test.ts` qui vérifie le setup
  - Ajouter script `"test": "vitest run"` et `"test:watch": "vitest"` dans `package.json`
  - Vérifier que `pnpm test` exécute le test exemple avec succès

  **Ne PAS faire** :
  - Écrire des tests pour la logique métier (ce sera dans les tâches suivantes)
  - Installer des librairies de test UI (testing-library, etc.)

  **Profil agent recommandé** :
  - **Catégorie** : `quick`
    - Raison : Installation + config simple, 1-2 fichiers
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI
  - **Groupe** : Vague 1 (avec Tâches 1, 3)
  - **Bloque** : Tâche 25
  - **Bloquée par** : Aucune

  **Références** :
  - `package.json` — Scripts existants, y ajouter test/test:watch
  - `wrangler.jsonc` — Config Workers nécessaire pour le pool vitest

  **Documentation** :
  - https://developers.cloudflare.com/workers/testing/vitest-integration/

  **Critères d'acceptance** :
  - [ ] `pnpm test` exécute au moins 1 test et réussit (exit 0)
  - [ ] `vitest.config.ts` existe et utilise `@cloudflare/vitest-pool-workers`
  - [ ] `pnpm check` passe toujours

  **Agent-Executed QA** :
  ```
  Scenario: Vitest fonctionne avec le pool Workers
    Tool: Bash
    Steps:
      1. pnpm test
      2. Assert: exit code 0
      3. Assert: output contient "1 passed" ou similaire
    Expected Result: Test runner fonctionnel
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `chore(test): setup vitest with Cloudflare Workers pool`
  - Fichiers : `vitest.config.ts`, `src/__tests__/example.test.ts`, `package.json`
  - Pre-commit : `pnpm check`

---

- [x] 3. Installation composants shadcn/ui de base

  **Ce qu'il faut faire** :
  - Initialiser shadcn/ui avec la CLI canary : `npx shadcn@canary init`
  - Configurer pour Tailwind v4, thème dark, style "new-york"
  - Installer les composants de base nécessaires à plusieurs pages :
    - `dialog` — Modals de confirmation (remplace browser prompt())
    - `dropdown-menu` — Menus d'actions par ligne (remplace le custom actuel)
    - `tabs` — Onglets (calendar views, settings sections)
    - `badge` — Badges de statut (remplace les spans custom)
    - `toast` / `sonner` — Notifications de succès/erreur (remplace rien — manquant actuellement)
    - `select` — Selects améliorés (remplace les <select> natifs)
    - `input` — Inputs stylisés
    - `label` — Labels pour formulaires
    - `separator` — Séparateurs visuels
    - `popover` — Base pour date picker futur
  - Adapter le thème dark existant (zinc-950, primary #ffde59) dans la config shadcn
  - Vérifier que les composants installés fonctionnent avec le thème dark admin

  **Ne PAS faire** :
  - Installer des composants qui ne seront pas utilisés immédiatement
  - Modifier les pages admin existantes (ce sera dans les tâches 11-16)
  - Installer un date picker complexe (le HTML natif suffit pour l'instant)
  - Installer `form` component (react-hook-form est trop lourd pour ce projet)

  **Profil agent recommandé** :
  - **Catégorie** : `quick`
    - Raison : Installation via CLI + ajustement config
  - **Skills** : [`frontend-ui-ux`]
    - `frontend-ui-ux` : Pour l'adaptation du thème shadcn au design dark existant

  **Parallélisation** :
  - **En parallèle** : OUI
  - **Groupe** : Vague 1 (avec Tâches 1, 2)
  - **Bloque** : Tâches 9, 10, 11-16
  - **Bloquée par** : Aucune

  **Références** :
  - `src/components/ui/button.tsx` — Pattern CVA existant, shadcn/ui Button le remplacera ou le complétera
  - `src/components/ui/table.tsx` — Table composable existante, garder ce composant (déjà bon)
  - `src/styles/globals.css` — Thème actuel avec `@theme { --color-primary: #ffde59 }`, adapter la config shadcn pour utiliser cette couleur
  - `src/lib/utils.ts` — Fonction `cn()` déjà présente (utilisée par shadcn)

  **Documentation** :
  - https://ui.shadcn.com/docs/installation/manual (version canary pour Tailwind v4)
  - https://ui.shadcn.com/docs/dark-mode

  **Critères d'acceptance** :
  - [ ] `components.json` existe à la racine (config shadcn)
  - [ ] Au moins 10 composants shadcn/ui dans `src/components/ui/`
  - [ ] Les composants utilisent la couleur primary #ffde59
  - [ ] `pnpm check` passe
  - [ ] `pnpm build` passe

  **Agent-Executed QA** :
  ```
  Scenario: Composants shadcn installés et build OK
    Tool: Bash
    Steps:
      1. ls src/components/ui/
      2. Assert: fichiers dialog.tsx, dropdown-menu.tsx, tabs.tsx, badge.tsx, toast.tsx ou sonner.tsx existent
      3. pnpm check && pnpm build
      4. Assert: exit code 0
    Expected Result: Composants présents et build réussi
    Evidence: Output terminal + listing fichiers
  ```

  **Commit** : OUI
  - Message : `feat(ui): install shadcn/ui base components with dark theme`
  - Fichiers : `components.json`, `src/components/ui/*.tsx`, `src/styles/globals.css` (si modifié)
  - Pre-commit : `pnpm check`

---

### PHASE 2 — API & AUTH

- [x] 4. Couche d'accès D1 (`src/lib/db.ts`)

  **Ce qu'il faut faire** :
  - Créer `src/lib/db.ts` avec des fonctions helper pour chaque entité :
    - **Bookings** : `getBookings(db, filters, page, limit)`, `getBookingById(db, id)`, `createBooking(db, data)`, `updateBooking(db, id, data)`, `getBookingsByDate(db, date)`, `getBookingsByDateRange(db, start, end)`, `getBookingsByUser(db, userId)`, `checkConflict(db, studioId, date, startTime, endTime, excludeId?)`
    - **Users** : `getUsers(db, filters, page, limit)`, `getUserById(db, id)`, `createUser(db, data)`, `updateUser(db, id, data)`, `blockUser(db, id, blocked)`, `mergeUsers(db, primaryId, duplicateIds)`
    - **Payments** : `getPayments(db, filters, page, limit)`, `markPaymentPaid(db, id)`, `refundPayment(db, id, amount)`
    - **Blocked Slots** : `getBlockedSlots(db)`, `addBlockedSlot(db, data)`, `removeBlockedSlot(db, id)`
    - **Pricing** : `getPricing(db)`, `updatePricing(db, id, price)`, `getPricingForBooking(db, studioId, groupType, isPeak)`
    - **Equipment** : `getEquipment(db)`, `updateEquipment(db, id, data)`
    - **Promo Codes** : `getPromoCodes(db)`, `createPromoCode(db, data)`, `updatePromoCode(db, id, data)`, `validatePromoCode(db, code, total)`
    - **Opening Hours** : `getOpeningHours(db)`, `updateOpeningHours(db, data)`
    - **Settings** : `getSetting(db, key)`, `setSetting(db, key, value)`, `getAllSettings(db)`
    - **Audit Log** : `addAuditLog(db, data)`, `getAuditLogs(db, filters, page, limit)`
    - **Stats** : `getDashboardStats(db)` — revenus jour/semaine/mois, bookings today, occupation, pending payments
  - Créer `src/lib/db-types.ts` avec les types TypeScript correspondant au schéma D1
  - Chaque fonction utilise `db.prepare(SQL).bind(...params)` directement
  - Les filtres supportent : recherche texte, status, studio, date range, pagination (LIMIT/OFFSET)
  - Retourner toujours `{ data, total, page, limit }` pour les listes paginées

  **Ne PAS faire** :
  - Créer un ORM ou une couche d'abstraction complexe
  - Utiliser des ORMs comme Prisma ou Drizzle
  - Modifier les fichiers existants (admin-store.ts reste intact pour l'instant)

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-high`
    - Raison : Beaucoup de fonctions à écrire, logique SQL, mais patterns répétitifs
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : NON — séquentiel après Tâche 1
  - **Groupe** : Début Vague 2
  - **Bloque** : Tâches 5, 6, 7
  - **Bloquée par** : Tâche 1

  **Références** :
  - `src/lib/admin-store.ts:400-700` — Toutes les fonctions CRUD existantes (rescheduleBooking, cancelBooking, markNoShow, markPaymentPaid, refundPayment, blockUser, mergeUsers, etc.) — la logique métier est identique, seul le storage change
  - `src/lib/admin-store.ts:300-400` — Fonctions de requête (getBookingsByUser, getBookingsByDate, getBookingsByDateRange, checkConflict, getStats) — reproduire en SQL
  - `src/lib/booking.ts:200-350` — calculatePrice(), calculateEquipmentPrice() — la logique de calcul de prix reste dans booking.ts mais doit lire les prix depuis D1 au lieu des constantes
  - `src/lib/booking.ts:50-120` — Types StudioId, GroupType, PaymentMethod, PaymentStatus — réutiliser ces types

  **Documentation** :
  - D1 client API : https://developers.cloudflare.com/d1/worker-api/d1-database/
  - D1 prepared statements : https://developers.cloudflare.com/d1/worker-api/d1-prepared-statement/

  **Critères d'acceptance** :
  - [ ] `src/lib/db.ts` existe avec 30+ fonctions exportées
  - [ ] `src/lib/db-types.ts` existe avec types pour toutes les tables
  - [ ] `pnpm check` passe sans erreur
  - [ ] Chaque fonction utilise des prepared statements (pas de string interpolation SQL)

  **Agent-Executed QA** :
  ```
  Scenario: Types et fonctions DB compilent
    Tool: Bash
    Steps:
      1. pnpm check
      2. Assert: exit code 0
      3. grep -c "export function\|export async function" src/lib/db.ts
      4. Assert: count >= 30
    Expected Result: 30+ fonctions DB exportées, TypeScript valide
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): add D1 database access layer with CRUD operations`
  - Fichiers : `src/lib/db.ts`, `src/lib/db-types.ts`
  - Pre-commit : `pnpm check`

---

- [x] 5. Système d'authentification (`src/lib/auth.ts` + routes)

  **Ce qu'il faut faire** :
  - Créer `src/lib/auth.ts` avec :
    - `hashPassword(password)` — utiliser Web Crypto API `PBKDF2` (disponible sur Workers)
    - `verifyPassword(password, hash)` — vérifier le hash
    - `createSession(db, userId)` — créer une session dans la table sessions, retourner un token
    - `validateSession(db, token)` — vérifier validité de session (non expirée), retourner l'user
    - `deleteSession(db, token)` — supprimer la session (logout)
    - `requireAuth(request, env)` — middleware : lire le cookie, valider la session, retourner l'user ou throw 401
    - `requireRole(user, role)` — vérifier que l'user a le rôle requis ou throw 403
    - Type `AuthUser = { id: string, email: string, name: string, role: "super-admin" | "operator" }`
  - Ajouter les routes API auth dans `worker.tsx` :
    - `POST /api/admin/login` — { email, password } → valider, créer session, set cookie HttpOnly
    - `POST /api/admin/logout` — supprimer session, clear cookie
    - `GET /api/admin/me` — retourner l'user courant (ou 401)
  - Cookie config : `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, durée 7 jours
  - Durée de session : 7 jours, nettoyage des sessions expirées à chaque login

  **Ne PAS faire** :
  - Utiliser JWT, refresh tokens, ou CSRF tokens
  - Utiliser Durable Objects
  - Utiliser bcrypt (pas disponible sur Workers, utiliser Web Crypto PBKDF2)
  - Ajouter rate limiting ou lockout (trop complexe pour ce scope)
  - Créer une page de login (ce sera Tâche 9)

  **Profil agent recommandé** :
  - **Catégorie** : `ultrabrain`
    - Raison : Logique de sécurité critique, hashing, sessions, cookies — demande de la rigueur
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâche 6
  - **Groupe** : Vague 2
  - **Bloque** : Tâches 8, 9
  - **Bloquée par** : Tâche 4

  **Références** :
  - `src/worker.tsx:1-30` — Structure actuelle des imports et du defineApp(), les routes auth s'ajoutent ici
  - `src/worker.tsx:60-100` — Routes API Stripe existantes (POST /api/create-checkout, POST /api/create-payment-intent) — suivre le même pattern pour les routes auth
  - `src/lib/admin-store.ts:30-50` — Type AdminUser existant, le nouveau AuthUser est un subset

  **Documentation** :
  - Web Crypto API PBKDF2 : https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
  - Cloudflare Workers cookies : https://developers.cloudflare.com/workers/examples/extract-cookie-value/

  **Critères d'acceptance** :
  - [ ] `src/lib/auth.ts` existe avec hashPassword, verifyPassword, createSession, validateSession, requireAuth, requireRole
  - [ ] Routes `/api/admin/login`, `/api/admin/logout`, `/api/admin/me` dans worker.tsx
  - [ ] Cookie HttpOnly, Secure, SameSite=Strict
  - [ ] `pnpm check` passe

  **Agent-Executed QA** :
  ```
  Scenario: Login avec credentials valides retourne un cookie session
    Tool: Bash
    Preconditions: Dev server running, seed data appliqué
    Steps:
      1. curl -s -D- -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d '{"email":"admin@h3studios.fr","password":"admin123"}'
      2. Assert: HTTP status 200
      3. Assert: Header Set-Cookie contient "session=" et "HttpOnly"
      4. Assert: body contient "success":true

  Scenario: Login avec credentials invalides retourne 401
    Tool: Bash
    Steps:
      1. curl -s -w "%{http_code}" -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d '{"email":"bad@test.com","password":"wrong"}'
      2. Assert: HTTP status 401
      3. Assert: body contient "error"

  Scenario: Accès /api/admin/me sans cookie retourne 401
    Tool: Bash
    Steps:
      1. curl -s -w "%{http_code}" http://localhost:5173/api/admin/me
      2. Assert: HTTP status 401

  Scenario: Accès /api/admin/me avec cookie valide retourne l'user
    Tool: Bash
    Steps:
      1. curl -s -c cookies.txt -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d '{"email":"admin@h3studios.fr","password":"admin123"}'
      2. curl -s -b cookies.txt http://localhost:5173/api/admin/me | jq '.role'
      3. Assert: output est "super-admin"
    Expected Result: Auth flow complet fonctionne
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): add authentication system with session cookies and roles`
  - Fichiers : `src/lib/auth.ts`, `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 6. API REST admin — Réservations & Calendrier

  **Ce qu'il faut faire** :
  - Ajouter les routes dans `worker.tsx` :
    - `GET /api/admin/bookings` — liste paginée avec filtres (status, studio, date, search, page, limit)
    - `GET /api/admin/bookings/:id` — détail d'une réservation
    - `POST /api/admin/bookings` — création d'une réservation (NOUVEAU)
    - `PUT /api/admin/bookings/:id` — mise à jour (reschedule)
    - `PUT /api/admin/bookings/:id/cancel` — annulation avec raison
    - `PUT /api/admin/bookings/:id/no-show` — marquer no-show
    - `GET /api/admin/calendar` — bookings par date (params: date, view=day|week|month)
  - Chaque route utilise les fonctions de `src/lib/db.ts`
  - Chaque mutation ajoute un audit log via `addAuditLog()`
  - La création de réservation : valide les conflits, calcule le prix (via pricing D1), crée le booking + payment associé

  **Ne PAS faire** :
  - Protéger les routes avec auth (ce sera Tâche 8 — middleware)
  - Modifier les pages admin existantes

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-high`
    - Raison : 7 endpoints, logique métier, validation
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâche 5
  - **Groupe** : Vague 2
  - **Bloque** : Tâches 11, 12, 13
  - **Bloquée par** : Tâche 4

  **Références** :
  - `src/worker.tsx:60-100` — Pattern des routes API existantes (POST Stripe) — suivre le même style
  - `src/lib/admin-store.ts:400-550` — Logique de rescheduleBooking, cancelBooking, markNoShow — reproduire dans les routes
  - `src/lib/admin-store.ts:300-370` — getBookingsByDate, getBookingsByDateRange, checkConflict — utiliser via db.ts
  - `src/lib/booking.ts:200-350` — calculatePrice() pour le calcul lors de la création

  **Critères d'acceptance** :
  - [ ] 7 routes API fonctionnelles dans worker.tsx
  - [ ] `pnpm check` passe
  - [ ] Chaque route retourne du JSON valide

  **Agent-Executed QA** :
  ```
  Scenario: GET /api/admin/bookings retourne une liste paginée
    Tool: Bash
    Preconditions: Dev server running, seed data
    Steps:
      1. curl -s "http://localhost:5173/api/admin/bookings?page=1&limit=5" | jq '{total: .total, count: (.data | length)}'
      2. Assert: count <= 5, total > 0
    Expected Result: Pagination fonctionne
    Evidence: Output terminal

  Scenario: POST /api/admin/bookings crée une réservation
    Tool: Bash
    Steps:
      1. Récupérer un userId existant via GET /api/admin/users?limit=1
      2. POST /api/admin/bookings avec userId, studioId, date future, startTime, endTime, groupType
      3. Assert: status 201, body contient id et bookingRef
      4. GET /api/admin/bookings/:newId
      5. Assert: réservation retrouvée
    Expected Result: CRUD création fonctionne
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): add REST API endpoints for bookings and calendar`
  - Fichiers : `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

### PHASE 3 — API COMPLÈTE + AUTH MIDDLEWARE + LOGIN

- [x] 7. API REST admin — Users, Payments, Studios, Settings, Audit, Pricing, Equipment, Promos, Hours

  **Ce qu'il faut faire** :
  - Ajouter TOUTES les routes restantes dans `worker.tsx` :
    - **Users** : GET list, GET :id, POST create, PUT :id update, PUT :id/block, POST merge
    - **Payments** : GET list, PUT :id/pay, PUT :id/refund
    - **Studios/Blocked Slots** : GET blocked, POST block, DELETE :id unblock
    - **Settings** : GET all, PUT :key
    - **Audit Log** : GET list (paginée, filtrable par entity_type, date range)
    - **Pricing** : GET all, PUT :id (update un prix)
    - **Equipment** : GET all, PUT :id, POST create, DELETE :id
    - **Promo Codes** : GET all, POST create, PUT :id, DELETE :id
    - **Opening Hours** : GET all, PUT update (batch update par studio)
    - **Stats** : GET /api/admin/stats (dashboard KPIs)
    - **Stats Charts** : GET /api/admin/stats/revenue?period=month (data pour Recharts)
  - Chaque mutation ajoute un audit log

  **Ne PAS faire** :
  - Protéger avec auth (Tâche 8)
  - Modifier les pages admin existantes

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-high`
    - Raison : Beaucoup de routes, mais patterns répétitifs
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 5 et 8
  - **Groupe** : Vague 3
  - **Bloque** : Tâches 14-22
  - **Bloquée par** : Tâche 4

  **Références** :
  - `src/lib/db.ts` (Tâche 4) — Toutes les fonctions DB à utiliser
  - `src/lib/admin-store.ts:550-700` — Logique blockUser, mergeUsers, addBlockedSlot, removeBlockedSlot
  - `src/worker.tsx` — Routes existantes (Tâche 6), suivre le même pattern

  **Critères d'acceptance** :
  - [ ] 20+ routes API supplémentaires dans worker.tsx
  - [ ] `pnpm check` passe

  **Agent-Executed QA** :
  ```
  Scenario: API Pricing retourne les tarifs
    Tool: Bash
    Steps:
      1. curl -s http://localhost:5173/api/admin/pricing | jq '. | length'
      2. Assert: >= 12
    Expected Result: Tarifs lisibles
    Evidence: Output terminal

  Scenario: API Settings CRUD fonctionne
    Tool: Bash
    Steps:
      1. PUT /api/admin/settings/min_advance_hours avec value: 24
      2. GET /api/admin/settings
      3. Assert: min_advance_hours = 24
    Expected Result: Settings persistants
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): add all remaining REST API endpoints`
  - Fichiers : `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 8. Middleware auth + protection des routes admin

  **Ce qu'il faut faire** :
  - Créer un middleware dans `worker.tsx` qui intercepte TOUTES les requêtes `/admin/*` et `/api/admin/*` (sauf `/api/admin/login`)
  - Le middleware :
    1. Lit le cookie `session`
    2. Appelle `validateSession()` pour vérifier la session
    3. Si invalide : redirige `/admin/*` vers `/admin/login`, retourne 401 pour `/api/admin/*`
    4. Attache l'user au contexte (request headers custom ou env)
  - Ajouter la vérification de rôle sur les routes sensibles :
    - Routes pricing/equipment/promo/settings/opening-hours : super-admin only
    - Routes bookings/users/payments/calendar/stats : tous les admins
  - Si un opérateur tente d'accéder à une route super-admin : retourne 403

  **Ne PAS faire** :
  - Ajouter rate limiting
  - Ajouter CSRF protection

  **Profil agent recommandé** :
  - **Catégorie** : `ultrabrain`
    - Raison : Logique de sécurité, middleware routing, gestion des rôles
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâche 7
  - **Groupe** : Vague 3
  - **Bloque** : Tâches 9, 10
  - **Bloquée par** : Tâche 5

  **Références** :
  - `src/worker.tsx` — Structure defineApp/render actuelle, le middleware doit s'intégrer dans le routing RedwoodSDK
  - `src/lib/auth.ts` (Tâche 5) — requireAuth(), requireRole()

  **Critères d'acceptance** :
  - [ ] `/admin` sans session redirige vers `/admin/login`
  - [ ] `/api/admin/bookings` sans session retourne 401
  - [ ] `/api/admin/pricing` avec session opérateur retourne 403
  - [ ] `/api/admin/pricing` avec session super-admin retourne 200
  - [ ] `pnpm check` passe

  **Agent-Executed QA** :
  ```
  Scenario: Middleware redirige vers login sans session
    Tool: Chrome DevTools MCP
    Steps:
      1. navigate_page url="http://localhost:5173/admin"
      2. take_snapshot
      3. Assert: URL contient "/admin/login"
    Expected Result: Redirection vers login
    Evidence: Snapshot

  Scenario: Opérateur ne peut pas accéder au pricing
    Tool: Bash
    Steps:
      1. Login en tant qu'opérateur (operateur@h3studios.fr)
      2. curl -s -b cookies.txt -w "%{http_code}" http://localhost:5173/api/admin/pricing
      3. Assert: HTTP 403
    Expected Result: Accès refusé
    Evidence: Output terminal
  ```

  **Commit** : OUI
  - Message : `feat(admin): add auth middleware with role-based access control`
  - Fichiers : `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 9. Page Login admin

  **Ce qu'il faut faire** :
  - Créer `src/app/pages/admin/Login.tsx` :
    - Formulaire email + mot de passe
    - Design cohérent avec le thème dark admin (zinc-950, primary #ffde59)
    - Utiliser les composants shadcn/ui (Input, Label, Button)
    - Validation côté client (email format, password non vide)
    - Affichage erreur (« Identifiants invalides »)
    - Appel POST `/api/admin/login`, redirection vers `/admin` en cas de succès
    - Logo H3 Studios en haut
  - Ajouter la route `/admin/login` dans `worker.tsx` (hors middleware auth)
  - La page Login n'utilise PAS AdminLayout (pas de sidebar)

  **Ne PAS faire** :
  - Formulaire d'inscription
  - "Mot de passe oublié"
  - OAuth / social login

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
    - Raison : Page UI avec design, formulaire, interactions
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâche 10
  - **Groupe** : Vague 3
  - **Bloque** : Tâches 11-16
  - **Bloquée par** : Tâches 3, 8

  **Références** :
  - `src/app/pages/admin/Dashboard.tsx:1-30` — Pattern d'import et structure d'une page admin
  - `src/styles/globals.css` — Thème et polices
  - Composants shadcn Input, Label, Button installés à la Tâche 3

  **Critères d'acceptance** :
  - [ ] `src/app/pages/admin/Login.tsx` existe
  - [ ] Route `/admin/login` dans worker.tsx
  - [ ] Login fonctionne et redirige vers `/admin`
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Login complet et redirection
    Tool: Chrome DevTools MCP
    Preconditions: Dev server running, seed data
    Steps:
      1. navigate_page url="http://localhost:5173/admin/login"
      2. take_snapshot
      3. Assert: champs email et password visibles
      4. fill email="admin@h3studios.fr"
      5. fill password="admin123"
      6. click bouton submit
      7. wait_for "Tableau de bord" (timeout: 10s)
      8. take_snapshot
      9. Assert: URL est /admin, contenu Dashboard visible
    Expected Result: Login réussi, dashboard affiché
    Evidence: Screenshots .sisyphus/evidence/task-9-login.png

  Scenario: Login échoué avec mauvais mot de passe
    Tool: Chrome DevTools MCP
    Steps:
      1. navigate_page url="http://localhost:5173/admin/login"
      2. fill email="admin@h3studios.fr" password="wrong"
      3. click submit
      4. take_snapshot
      5. Assert: message d'erreur visible, toujours sur /admin/login
    Expected Result: Erreur affichée
    Evidence: Screenshot
  ```

  **Commit** : OUI
  - Message : `feat(admin): add login page with authentication flow`
  - Fichiers : `src/app/pages/admin/Login.tsx`, `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 10. AdminLayout refondu + navigation par rôle

  **Ce qu'il faut faire** :
  - Refondre `src/app/layouts/AdminLayout.tsx` avec shadcn/ui :
    - Remplacer les liens custom par des composants shadcn/ui (ou garder le pattern actuel mais avec des menus plus propres)
    - Ajouter dans la sidebar : avatar/nom de l'admin connecté + son rôle
    - Masquer les items de navigation inaccessibles selon le rôle :
      - **Opérateur** : Dashboard, Calendrier, Réservations, Clients, Paiements — PAS Studios, Pricing, Settings
      - **Super-admin** : Tout
    - Ajouter bouton « Déconnexion » (appelle POST /api/admin/logout)
    - Ajouter un Toast provider (sonner ou shadcn toast) au layout pour les notifications globales
    - Garder le lien « Retour au site » existant
    - Supprimer le bouton « Réinitialiser démo » (plus de mock data)
  - Récupérer l'user connecté via GET /api/admin/me au mount du layout

  **Ne PAS faire** :
  - Changer le thème de couleurs (garder zinc-950 + #ffde59)
  - Changer la structure sidebar desktop + mobile toggle

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
    - Raison : Refonte UI avec logique de rôle
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâche 9
  - **Groupe** : Vague 3
  - **Bloque** : Tâches 11-16
  - **Bloquée par** : Tâches 3, 8

  **Références** :
  - `src/app/layouts/AdminLayout.tsx` — Fichier actuel complet (160 lignes) — base de la refonte
  - `src/app/layouts/AdminLayout.tsx:30-80` — Navigation items actuels et pattern active state via usePathname()
  - Composants shadcn Toast/Sonner installés à la Tâche 3

  **Critères d'acceptance** :
  - [ ] Nom + rôle de l'admin affiché dans la sidebar
  - [ ] Items de navigation masqués pour les opérateurs
  - [ ] Bouton déconnexion fonctionnel
  - [ ] Toast provider actif
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Navigation opérateur masque les items restreints
    Tool: Chrome DevTools MCP
    Steps:
      1. Login en tant qu'opérateur
      2. take_snapshot
      3. Assert: "Réservations", "Clients", "Paiements" visibles dans la sidebar
      4. Assert: "Paramètres" et "Tarification" NE SONT PAS visibles
    Expected Result: Navigation filtrée par rôle
    Evidence: Screenshot

  Scenario: Déconnexion redirige vers login
    Tool: Chrome DevTools MCP
    Steps:
      1. Login en tant qu'admin
      2. click "Déconnexion"
      3. wait_for "Connexion" (timeout: 5s)
      4. Assert: URL contient "/admin/login"
    Expected Result: Logout fonctionnel
    Evidence: Screenshot
  ```

  **Commit** : OUI
  - Message : `feat(admin): redesign AdminLayout with role-based navigation and auth`
  - Fichiers : `src/app/layouts/AdminLayout.tsx`
  - Pre-commit : `pnpm check`

---

### PHASE 4 — PAGES ADMIN REFONDUES

- [x] 11. Dashboard refondu + Analytics Recharts

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Dashboard.tsx` :
    - Remplacer les données localStorage par des appels API (`GET /api/admin/stats`)
    - Garder les 4 StatCards existants mais les alimenter depuis D1
    - Ajouter 3-4 charts Recharts :
      1. **LineChart** : Revenus sur les 30 derniers jours
      2. **BarChart** : Taux d'occupation par jour de la semaine
      3. **PieChart** : Répartition par studio (La Scène vs Le Podium)
      4. **BarChart** : Répartition par méthode de paiement (carte vs espèces)
    - Sélecteur de période (7j, 30j, 90j, 12 mois) pour les charts
    - Garder les sections « Réservations à venir » et « Paiements en attente » alimentées par D1
    - Utiliser shadcn Tabs pour organiser les sections
  - Installer Recharts si pas déjà fait

  **Ne PAS faire** :
  - Charts complexes (heatmap, comparaison N vs N-1)
  - Plus de 4 charts

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
    - Raison : UI complexe avec charts + data fetching
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 12-16
  - **Groupe** : Vague 4
  - **Bloque** : Tâche 25
  - **Bloquée par** : Tâches 6, 9, 10

  **Références** :
  - `src/app/pages/admin/Dashboard.tsx` — Page actuelle (285 lignes), StatCard component à réutiliser/adapter
  - `src/app/pages/admin/Dashboard.tsx:20-60` — StatCard component avec icon, title, value, subValue pattern
  - API stats (Tâche 7) : GET /api/admin/stats, GET /api/admin/stats/revenue

  **Documentation** :
  - Recharts : https://recharts.org/en-US/guide

  **Critères d'acceptance** :
  - [ ] Dashboard affiche 4 StatCards alimentés par D1
  - [ ] Au moins 3 charts Recharts visibles
  - [ ] Sélecteur de période fonctionne (change les données des charts)
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Dashboard avec charts
    Tool: Chrome DevTools MCP
    Steps:
      1. Login admin, naviguer vers /admin
      2. take_snapshot
      3. Assert: 4 StatCards visibles avec des chiffres
      4. Assert: au moins 3 éléments SVG (charts Recharts)
      5. take_screenshot → .sisyphus/evidence/task-11-dashboard.png
    Expected Result: Dashboard complet avec analytics
    Evidence: Screenshot
  ```

  **Commit** : OUI
  - Message : `feat(admin): redesign dashboard with Recharts analytics`
  - Fichiers : `src/app/pages/admin/Dashboard.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 12. Calendrier refondu + vue mois

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Calendar.tsx` :
    - Remplacer localStorage par appels API (`GET /api/admin/calendar?date=...&view=...`)
    - Garder vues jour et semaine existantes, améliorer avec shadcn/ui (Tabs pour les vues)
    - **Ajouter vue mois** : grille 7×5 jours, chaque cellule montre :
      - Nombre de réservations
      - Indicateur d'occupation (couleur : vert < 50%, jaune 50-80%, rouge > 80%)
      - Clic sur un jour → bascule en vue jour
    - Utiliser shadcn Badge pour les indicateurs de statut
    - Utiliser shadcn Dialog pour les détails rapides (clic sur une réservation dans la vue jour)

  **Ne PAS faire** :
  - Drag-and-drop
  - Création de réservation par clic sur le calendrier

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 11, 13-16
  - **Groupe** : Vague 4
  - **Bloque** : Tâche 25
  - **Bloquée par** : Tâches 6, 9, 10

  **Références** :
  - `src/app/pages/admin/Calendar.tsx` — Page actuelle (274 lignes), vues jour/semaine à préserver et améliorer
  - `src/app/pages/admin/Calendar.tsx:30-100` — Vue jour avec grille temps × studios
  - `src/app/pages/admin/Calendar.tsx:100-180` — Vue semaine avec 7 jours × 2 studios
  - `src/lib/booking.ts:130-180` — ALL_TIME_SLOTS et STUDIO_HOURS pour la structure de la grille

  **Critères d'acceptance** :
  - [ ] 3 vues : jour, semaine, mois (via Tabs)
  - [ ] Vue mois : grille avec indicateurs d'occupation colorés
  - [ ] Clic sur jour en vue mois → bascule en vue jour
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Navigation entre les 3 vues calendrier
    Tool: Chrome DevTools MCP
    Steps:
      1. Login, naviguer vers /admin/calendar
      2. take_snapshot → Assert: vue jour visible
      3. click onglet "Semaine" → take_snapshot → Assert: 7 colonnes
      4. click onglet "Mois" → take_snapshot → Assert: grille mois visible
      5. click sur un jour dans la grille mois
      6. Assert: bascule en vue jour pour ce jour
    Expected Result: 3 vues navigables
    Evidence: Screenshots
  ```

  **Commit** : OUI
  - Message : `feat(admin): redesign calendar with month view and occupation indicators`
  - Fichiers : `src/app/pages/admin/Calendar.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 13. Réservations refondues + page création réservation

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Bookings.tsx` :
    - Remplacer localStorage par appels API
    - Utiliser shadcn DropdownMenu pour les actions par ligne (remplace le menu custom)
    - Utiliser shadcn Dialog pour les confirmations (remplace browser prompt())
    - Utiliser shadcn Badge pour les statuts
    - Ajouter bouton « Exporter CSV » (fonctionnel — Tâche 23 pour la logique)
  - Refondre `src/app/pages/admin/BookingDetail.tsx` :
    - Alimenter par API
    - Modals shadcn pour reschedule/cancel au lieu de sections inline
    - Toast de confirmation après chaque action
  - Créer `src/app/pages/admin/BookingNew.tsx` :
    - Formulaire de création de réservation
    - Sélection client existant (search + select) OU création nouveau client inline
    - Sélection studio, date, créneau horaire
    - Vérification de conflit en temps réel (appel API checkConflict)
    - Calcul de prix automatique basé sur la tarification D1
    - Sélection équipements optionnels
    - Bouton « Créer la réservation » → POST /api/admin/bookings
    - Redirection vers le détail de la réservation créée
  - Ajouter route `/admin/bookings/new` dans worker.tsx

  **Ne PAS faire** :
  - Multi-booking (créer plusieurs réservations d'un coup)
  - Récurrence (réservation hebdomadaire)

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 11, 12, 14-16
  - **Groupe** : Vague 4
  - **Bloque** : Tâche 25
  - **Bloquée par** : Tâches 6, 9, 10

  **Références** :
  - `src/app/pages/admin/Bookings.tsx` — Page actuelle (400 lignes)
  - `src/app/pages/admin/BookingDetail.tsx` — Détail actuel (418 lignes) avec reschedule/cancel/no-show logic
  - `src/components/booking/BookingForm.tsx` — Pattern formulaire existant (262 lignes) avec validation inline
  - `src/lib/booking.ts:200-350` — calculatePrice(), calculateEquipmentPrice() pour le formulaire de création

  **Critères d'acceptance** :
  - [ ] Liste réservations avec shadcn DropdownMenu et Dialog
  - [ ] Détail réservation avec modals shadcn
  - [ ] Page création réservation fonctionnelle
  - [ ] Route `/admin/bookings/new` existe
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Création d'une réservation depuis l'admin
    Tool: Chrome DevTools MCP
    Steps:
      1. Login, naviguer vers /admin/bookings/new
      2. take_snapshot → Assert: formulaire de création visible
      3. Remplir : sélectionner un client, studio "La Scène", date future, 14:00-16:00, group
      4. Assert: prix calculé visible
      5. click "Créer la réservation"
      6. wait_for redirection vers /admin/bookings/:id
      7. take_snapshot → Assert: détail de la réservation créée
    Expected Result: Réservation créée et visible
    Evidence: Screenshots
  ```

  **Commit** : OUI
  - Message : `feat(admin): redesign bookings pages and add booking creation`
  - Fichiers : `src/app/pages/admin/Bookings.tsx`, `src/app/pages/admin/BookingDetail.tsx`, `src/app/pages/admin/BookingNew.tsx`, `src/worker.tsx`
  - Pre-commit : `pnpm check`

---

- [x] 14. Pages Users + UserDetail refondues

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Users.tsx` et `src/app/pages/admin/UserDetail.tsx`
  - Remplacer localStorage par API
  - Utiliser shadcn Dialog pour la fusion d'utilisateurs (remplace le modal custom)
  - Utiliser shadcn Badge pour "Bloqué", shadcn DropdownMenu pour les actions
  - Ajouter bouton « Nouveau client » avec Dialog de création rapide
  - UserDetail : utiliser shadcn Tabs pour organiser (Profil / Réservations / Historique)
  - Toast après chaque action (blocage, fusion, sauvegarde)

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 11-13, 15, 16
  - **Groupe** : Vague 4
  - **Bloquée par** : Tâches 7, 9, 10

  **Références** :
  - `src/app/pages/admin/Users.tsx` — Page actuelle (299 lignes)
  - `src/app/pages/admin/UserDetail.tsx` — Détail actuel (326 lignes)

  **Critères d'acceptance** :
  - [ ] Liste users avec shadcn components
  - [ ] Création client via Dialog
  - [ ] UserDetail avec Tabs
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): redesign users pages with shadcn/ui components`
  - Fichiers : `src/app/pages/admin/Users.tsx`, `src/app/pages/admin/UserDetail.tsx`

---

- [x] 15. Page Paiements refondue

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Payments.tsx`
  - API au lieu de localStorage
  - shadcn Dialog pour confirmation de remboursement (avec champ montant)
  - shadcn Badge pour statuts paiement
  - shadcn DropdownMenu pour actions
  - Toast après actions (mark paid, refund)

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 11-14, 16
  - **Groupe** : Vague 4
  - **Bloquée par** : Tâches 7, 9, 10

  **Références** :
  - `src/app/pages/admin/Payments.tsx` — Page actuelle (287 lignes)

  **Critères d'acceptance** :
  - [ ] Paiements alimentés par API D1
  - [ ] Dialog pour remboursement
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): redesign payments page with shadcn/ui components`

---

- [x] 16. Page Studios refondue

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Studios.tsx`
  - API pour les données studios et blocked slots
  - shadcn Dialog pour le formulaire de blocage de créneau (remplace le modal custom)
  - Afficher les prix actuels depuis D1 (en lecture seule — l'édition est dans Tâche 17)
  - shadcn Badge pour les features studios

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 11-15
  - **Groupe** : Vague 4
  - **Bloquée par** : Tâches 7, 9, 10

  **Références** :
  - `src/app/pages/admin/Studios.tsx` — Page actuelle (315 lignes)

  **Critères d'acceptance** :
  - [ ] Studios alimentés par API D1
  - [ ] Prix affichés depuis D1
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): redesign studios page with D1 data`

---

### PHASE 5 — NOUVELLES FONCTIONNALITÉS

- [x] 17. Gestion tarifaire dynamique

  **Ce qu'il faut faire** :
  - Créer `src/app/pages/admin/Pricing.tsx` (NOUVELLE PAGE) :
    - Table des prix : studio × groupe × peak/off-peak avec champs éditables inline
    - Bouton « Modifier » → les cellules deviennent des inputs numériques
    - Bouton « Sauvegarder » → PUT /api/admin/pricing/:id pour chaque prix modifié
    - Section définition peak/off-peak : configurer quelles heures sont peak (actuellement 18h+/weekend)
    - Toast de confirmation après sauvegarde
  - Ajouter route `/admin/pricing` dans worker.tsx
  - Ajouter lien dans AdminLayout (super-admin only)

  **Ne PAS faire** :
  - Moteur de règles complexe
  - Pricing saisonnier ou basé sur la demande
  - Historique des prix (trop complexe)

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 18-23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Références** :
  - `src/app/pages/admin/Studios.tsx:100-200` — Grille tarifs actuelle (lecture seule) — transformer en éditable
  - `src/lib/booking.ts:60-100` — PRICING constant actuel, structure à reproduire en éditable

  **Critères d'acceptance** :
  - [ ] Page /admin/pricing accessible (super-admin only)
  - [ ] Édition inline des prix fonctionne
  - [ ] Sauvegarde persiste en D1
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add dynamic pricing management page`

---

- [x] 18. Gestion codes promo

  **Ce qu'il faut faire** :
  - Ajouter une section dans la page Pricing OU créer un onglet séparé :
    - Liste des codes promo existants (table)
    - Bouton « Nouveau code promo » → Dialog avec formulaire :
      - Code (texte, unique)
      - Type : pourcentage ou montant fixe
      - Valeur (ex: 10% ou 5€)
      - Montant minimum d'achat (optionnel)
      - Date d'expiration (optionnel)
      - Nombre d'utilisations max (optionnel)
    - Actions par code : activer/désactiver, modifier, supprimer
  - CRUD via API /api/admin/promo-codes

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17, 19-23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Critères d'acceptance** :
  - [ ] Création d'un code promo fonctionne
  - [ ] Désactivation/suppression fonctionne
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add promo code management`

---

- [x] 19. Gestion équipements

  **Ce qu'il faut faire** :
  - Créer une page ou section dans Studios pour gérer les équipements :
    - Liste des équipements (table) avec nom, prix par session, quantité max
    - Formulaire d'ajout/modification (Dialog)
    - Bouton supprimer avec confirmation
  - CRUD via API /api/admin/equipment

  **Ne PAS faire** :
  - Gestion d'inventaire (disponibilité par studio)
  - Tracking de maintenance des équipements

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17, 18, 20-23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Références** :
  - `src/lib/booking.ts:100-130` — EQUIPMENT constant actuel, structure à reproduire en éditable

  **Critères d'acceptance** :
  - [ ] CRUD équipements fonctionne
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add equipment management`

---

- [x] 20. Gestion horaires d'ouverture

  **Ce qu'il faut faire** :
  - Ajouter dans Settings ou Studios une section « Horaires d'ouverture » :
    - Grille : 7 jours × 2 studios
    - Chaque cellule : heure ouverture + heure fermeture (ou « Fermé »)
    - Bouton sauvegarder → PUT /api/admin/opening-hours
  - Alimenter par API

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17-19, 21-23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Références** :
  - `src/lib/booking.ts:130-180` — STUDIO_HOURS constant actuel

  **Critères d'acceptance** :
  - [ ] Grille horaires éditable
  - [ ] Sauvegarde persiste en D1
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add opening hours management`

---

- [x] 21. Settings fonctionnels

  **Ce qu'il faut faire** :
  - Refondre `src/app/pages/admin/Settings.tsx` :
    - Remplacer le demo mode par de vrais settings persistés en D1
    - **Section Horaires** : lien vers gestion horaires (Tâche 20)
    - **Section Règles de réservation** : délai minimum (heures), durée max à l'avance (jours), téléphone requis, paiement espèces autorisé
    - **Section Sécurité** : Gestion des comptes admin (liste admin_users, créer/désactiver un opérateur) — super-admin only
    - Chaque modification → PUT /api/admin/settings/:key → Toast confirmation
    - Supprimer la mention « mode démo » et l'encart bleu
  - Utiliser shadcn Tabs pour les sections

  **Ne PAS faire** :
  - Templates email
  - Configuration Stripe
  - Branding/personnalisation UI

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17-20, 22-23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Références** :
  - `src/app/pages/admin/Settings.tsx` — Page actuelle (366 lignes) avec les 4 sections à rendre fonctionnelles

  **Critères d'acceptance** :
  - [ ] Settings persistés en D1
  - [ ] Gestion des comptes admin (super-admin only)
  - [ ] Plus de mention "demo mode"
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): make settings page fully functional with D1 persistence`

---

- [x] 22. Vue Audit Log

  **Ce qu'il faut faire** :
  - Créer `src/app/pages/admin/AuditLog.tsx` (NOUVELLE PAGE) :
    - Table paginée des audit logs
    - Colonnes : date, utilisateur, action, entité (type + ID), détails
    - Filtres : type d'entité (booking, user, payment), plage de dates, recherche
    - Clic sur un log → Dialog avec le détail des changements (JSON formaté)
  - Ajouter route `/admin/audit-log` dans worker.tsx
  - Ajouter lien dans AdminLayout (super-admin only)

  **Profil agent recommandé** :
  - **Catégorie** : `visual-engineering`
  - **Skills** : [`frontend-ui-ux`]

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17-21, 23
  - **Groupe** : Vague 5
  - **Bloquée par** : Tâche 7

  **Références** :
  - `src/lib/admin-store.ts:680-704` — Type AuditLog et fonction addAuditLog existante

  **Critères d'acceptance** :
  - [ ] Page /admin/audit-log accessible (super-admin only)
  - [ ] Table paginée avec filtres
  - [ ] Détails des changements dans un Dialog
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add audit log viewer page`

---

- [x] 23. Exports CSV

  **Ce qu'il faut faire** :
  - Créer `src/lib/export.ts` avec fonctions d'export :
    - `exportBookingsCSV(bookings)` — colonnes : Ref, Client, Email, Studio, Date, Heure, Durée, Groupe, Statut, Montant, Paiement
    - `exportUsersCSV(users)` — colonnes : Nom, Email, Téléphone, Groupe, Réservations, Total dépensé, Bloqué
    - `exportPaymentsCSV(payments)` — colonnes : Ref booking, Client, Méthode, Statut, Montant, Remboursé, Date paiement
  - Chaque fonction génère une string CSV et déclenche un téléchargement via `Blob` + `URL.createObjectURL`
  - Ajouter des boutons « Exporter CSV » dans les pages Bookings, Users, Payments
  - L'export respecte les filtres actuels (exporte ce qui est visible/filtré, pas tout)

  **Ne PAS faire** :
  - Export côté serveur
  - Formats autres que CSV

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-low`
    - Raison : Logique simple (string CSV + download), pas de UI complexe
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : OUI — avec Tâches 17-22
  - **Groupe** : Vague 5
  - **Bloque** : Tâche 24 (PDF utilise un pattern similaire)
  - **Bloquée par** : Tâche 7

  **Critères d'acceptance** :
  - [ ] `src/lib/export.ts` avec 3 fonctions d'export
  - [ ] Bouton export visible sur Bookings, Users, Payments
  - [ ] Clic déclenche un téléchargement CSV
  - [ ] `pnpm check && pnpm build` passent

  **Agent-Executed QA** :
  ```
  Scenario: Export CSV des réservations
    Tool: Chrome DevTools MCP
    Steps:
      1. Login, naviguer vers /admin/bookings
      2. click "Exporter CSV"
      3. Assert: téléchargement déclenché (ou vérifier via evaluate_script que Blob a été créé)
    Expected Result: Fichier CSV téléchargé
    Evidence: Console log ou snapshot
  ```

  **Commit** : OUI
  - Message : `feat(admin): add CSV export for bookings, users, and payments`
  - Fichiers : `src/lib/export.ts`, pages modifiées

---

- [x] 24. Exports PDF (factures + rapport mensuel)

  **Ce qu'il faut faire** :
  - Installer `jspdf` (client-side PDF generation)
  - Ajouter dans `src/lib/export.ts` :
    - `generateInvoicePDF(booking, payment, user)` — Facture individuelle :
      - Logo H3 Studios
      - Coordonnées H3 Studios (adresse Sucy-en-Brie)
      - Infos client
      - Détail réservation (date, studio, durée, équipements)
      - Sous-total, total, méthode de paiement, statut
      - Référence booking
    - `generateMonthlyReportPDF(stats, bookings, period)` — Rapport mensuel :
      - En-tête avec période
      - KPIs : revenu total, nb réservations, taux occupation, taux no-show
      - Tableau récapitulatif par studio
      - Tableau récapitulatif par semaine
  - Ajouter bouton « Facture PDF » dans BookingDetail
  - Ajouter bouton « Rapport mensuel » dans Dashboard (avec sélecteur de mois)

  **Ne PAS faire** :
  - Génération côté serveur
  - Templates configurables
  - Plus de 2 types de PDF

  **Profil agent recommandé** :
  - **Catégorie** : `unspecified-high`
    - Raison : Layout PDF avec jsPDF demande du positionnement précis
  - **Skills** : aucun

  **Parallélisation** :
  - **En parallèle** : NON — après Tâche 23
  - **Groupe** : Fin Vague 5
  - **Bloquée par** : Tâche 23

  **Documentation** :
  - jsPDF : https://github.com/parallax/jsPDF

  **Critères d'acceptance** :
  - [ ] Bouton « Facture PDF » dans BookingDetail génère un PDF
  - [ ] Bouton « Rapport mensuel » dans Dashboard génère un PDF
  - [ ] `pnpm check && pnpm build` passent

  **Commit** : OUI
  - Message : `feat(admin): add PDF invoice and monthly report generation`

---

- [x] 25. Tests backend complets + QA finale + déploiement staging

  **Ce qu'il faut faire** :
  - Écrire les tests vitest pour :
    - **DB operations** : CRUD bookings, users, payments (au moins 10 tests)
    - **Auth logic** : hashPassword, verifyPassword, createSession, validateSession (au moins 5 tests)
    - **Pricing logic** : calcul prix avec pricing D1, promo codes (au moins 5 tests)
    - **Conflict detection** : checkConflict avec cas normaux et edge cases (au moins 3 tests)
  - Vérifier : `pnpm test` → tous les tests passent
  - Vérifier : `pnpm check` → aucune erreur TypeScript
  - Vérifier : `pnpm build` → build réussi
  - Déployer : `pnpm release:staging`
  - QA staging via Chrome DevTools MCP :
    - Naviguer sur toutes les pages admin sur https://h3-studios-staging.workers.dev
    - Vérifier qu'il n'y a pas d'erreurs console
    - Vérifier que le login fonctionne
    - Prendre des screenshots de chaque page

  **Ne PAS faire** :
  - Viser 100% code coverage
  - Tests UI (pas de testing-library)

  **Profil agent recommandé** :
  - **Catégorie** : `deep`
    - Raison : Tests + QA exhaustive, besoin de rigueur et de thoroughness
  - **Skills** : [`playwright`]
    - `playwright` : Pour la QA staging via browser

  **Parallélisation** :
  - **En parallèle** : NON — dernière tâche
  - **Groupe** : Séquentielle (fin)
  - **Bloquée par** : Toutes les tâches 1-24

  **Références** :
  - `vitest.config.ts` (Tâche 2) — Configuration vitest
  - `src/lib/db.ts` (Tâche 4) — Fonctions à tester
  - `src/lib/auth.ts` (Tâche 5) — Logique auth à tester

  **Critères d'acceptance** :
  - [ ] `pnpm test` → 20+ tests, tous passent
  - [ ] `pnpm check` → exit 0
  - [ ] `pnpm build` → exit 0
  - [ ] `pnpm release:staging` → déploiement réussi
  - [ ] Navigation complète admin sur staging sans erreur console
  - [ ] Screenshots de toutes les pages admin dans .sisyphus/evidence/

  **Agent-Executed QA** :
  ```
  Scenario: Tests unitaires passent
    Tool: Bash
    Steps:
      1. pnpm test
      2. Assert: exit code 0
      3. Assert: output contient "20 passed" ou plus
    Expected Result: Tous les tests passent
    Evidence: Output terminal

  Scenario: Build et déploiement staging
    Tool: Bash
    Steps:
      1. pnpm check && pnpm build
      2. Assert: exit code 0
      3. pnpm release:staging
      4. Assert: exit code 0
    Expected Result: Déployé sur staging
    Evidence: Output terminal

  Scenario: QA complète staging
    Tool: Chrome DevTools MCP
    Steps:
      1. navigate_page https://h3-studios-staging.workers.dev/admin/login
      2. Login admin
      3. Pour chaque page (/admin, /admin/calendar, /admin/bookings, /admin/users, /admin/payments, /admin/studios, /admin/pricing, /admin/settings, /admin/audit-log):
         a. navigate_page
         b. take_screenshot → .sisyphus/evidence/task-25-{page}.png
         c. list_console_messages → Assert: aucune erreur
    Expected Result: Toutes les pages admin fonctionnelles sur staging
    Evidence: 10+ screenshots dans .sisyphus/evidence/
  ```

  **Commit** : OUI
  - Message : `test(admin): add comprehensive backend tests and staging QA`
  - Fichiers : `src/__tests__/*.test.ts`
  - Pre-commit : `pnpm test && pnpm check`

---

## Stratégie de commit

| Après tâche | Message | Vérification |
|-------------|---------|--------------|
| 1 | `feat(admin): setup Cloudflare D1 database schema and migrations` | `pnpm check` |
| 2 | `chore(test): setup vitest with Cloudflare Workers pool` | `pnpm check` |
| 3 | `feat(ui): install shadcn/ui base components with dark theme` | `pnpm check && pnpm build` |
| 4 | `feat(admin): add D1 database access layer with CRUD operations` | `pnpm check` |
| 5 | `feat(admin): add authentication system with session cookies and roles` | `pnpm check` |
| 6 | `feat(admin): add REST API endpoints for bookings and calendar` | `pnpm check` |
| 7 | `feat(admin): add all remaining REST API endpoints` | `pnpm check` |
| 8 | `feat(admin): add auth middleware with role-based access control` | `pnpm check` |
| 9 | `feat(admin): add login page with authentication flow` | `pnpm check && pnpm build` |
| 10 | `feat(admin): redesign AdminLayout with role-based navigation and auth` | `pnpm check && pnpm build` |
| 11 | `feat(admin): redesign dashboard with Recharts analytics` | `pnpm check && pnpm build` |
| 12 | `feat(admin): redesign calendar with month view and occupation indicators` | `pnpm check && pnpm build` |
| 13 | `feat(admin): redesign bookings pages and add booking creation` | `pnpm check && pnpm build` |
| 14 | `feat(admin): redesign users pages with shadcn/ui components` | `pnpm check && pnpm build` |
| 15 | `feat(admin): redesign payments page with shadcn/ui components` | `pnpm check && pnpm build` |
| 16 | `feat(admin): redesign studios page with D1 data` | `pnpm check && pnpm build` |
| 17 | `feat(admin): add dynamic pricing management page` | `pnpm check && pnpm build` |
| 18 | `feat(admin): add promo code management` | `pnpm check && pnpm build` |
| 19 | `feat(admin): add equipment management` | `pnpm check && pnpm build` |
| 20 | `feat(admin): add opening hours management` | `pnpm check && pnpm build` |
| 21 | `feat(admin): make settings page fully functional with D1 persistence` | `pnpm check && pnpm build` |
| 22 | `feat(admin): add audit log viewer page` | `pnpm check && pnpm build` |
| 23 | `feat(admin): add CSV export for bookings, users, and payments` | `pnpm check && pnpm build` |
| 24 | `feat(admin): add PDF invoice and monthly report generation` | `pnpm check && pnpm build` |
| 25 | `test(admin): add comprehensive backend tests and staging QA` | `pnpm test && pnpm check && pnpm build` |

---

## Critères de succès

### Commandes de vérification
```bash
pnpm check         # TypeScript strict — exit 0
pnpm build         # Build production — exit 0
pnpm test          # Vitest tests — 20+ tests passent
pnpm release:staging # Déploiement staging — exit 0
```

### Checklist finale
- [x] Toutes les données admin en D1 (zéro localStorage admin)
- [x] Login/logout fonctionnel avec sessions
- [x] 2 rôles (super-admin + opérateur) avec permissions vérifiées
- [x] 12+ pages admin fonctionnelles
- [x] Dashboard avec 3+ charts Recharts
- [x] Création de réservation depuis l'admin
- [x] Vue calendrier mois avec occupation
- [x] Gestion tarifaire dynamique (prix éditables)
- [x] Gestion codes promo CRUD
- [x] Gestion équipements CRUD
- [x] Gestion horaires d'ouverture
- [x] Settings persistants
- [x] Vue audit log
- [x] Export CSV (3 types)
- [x] Export PDF facture + rapport mensuel
- [x] 20+ tests backend passent
- [x] Déployé sur staging sans erreur console
- [x] Le flow de réservation public (non-admin) fonctionne toujours identiquement
