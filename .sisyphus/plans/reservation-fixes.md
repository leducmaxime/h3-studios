# Plan de Correction: Système de Réservation H3 Studios

## TL;DR

> **Objectif**: Corriger tous les bugs, incohérences et problèmes UX identifiés dans le système de réservation.
> 
> **Livrables**:
> - Navigation SPA fonctionnelle
> - URLs cohérentes sur tout le site
> - Feedback utilisateur clair (code promo, créneaux, tarifs)
> - Interface accessible (0 warnings console)
> - Distinction visuelle des tarifs normaux/pointe
> 
> **Effort estimé**: Moyen
> **Exécution parallèle**: OUI - 3 vagues
> **Chemin critique**: Navigation SPA → URLs → Code promo → UX → Polish

---

## Contexte

### Requête Originale
Audit complet du système de réservation pour identifier tous les bugs, incohérences, problèmes UX et améliorer l'expérience utilisateur.

### Résumé de l'Audit
**Méthodologie**: Test exhaustif via Chrome DevTools MCP de toutes les pages et flows de réservation.

**Flows testés**:
- Solo: Date → Créneau → Panier → Paiement (confirmé)
- Duo: Date → Créneau (flow limité intentionnel)
- Groupe: Studio → Date → Créneau
- Navigation générale du site

### Décisions Confirmées
- **Flow Studio→Date désactivé pour Solo/Duo**: Intentionnel (business rule: priorité aux groupes)
- **Portée**: Correction complète (P0+P1+P2)

### Review Metis
**Gaps identifiés et adressés**:
- Critères d'acceptation agent-exécutables ajoutés
- Edge cases documentés
- Guardrails définis contre le scope creep

---

## Objectifs de Travail

### Objectif Principal
Corriger les 10 problèmes identifiés et améliorer l'UX du système de réservation.

### Livrables Concrets
1. URLs cohérentes (pas de /reservation/reservation)
2. Navigation SPA fonctionnelle sans reload
3. Message d'erreur pour code promo invalide
4. Interface sans éléments dupliqués
5. Légende visuelle correspondant aux créneaux
6. Distinction visuelle tarifs normaux/pointe
7. Explication pour créneaux désactivés
8. Accessibilité (0 warnings console)

### Définition de Fini
- [x] `pnpm check` passe sans erreur
- [x] `pnpm build` passe sans erreur
- [x] Test manuel complet du flow réservation via Chrome DevTools
- [x] 0 erreurs dans la console
- [x] Navigation SPA testée sur toutes les pages
- [x] Deploy staging et vérification visuelle

### Must Have
- Toutes les corrections listées dans les TODOs
- Validation après chaque correction

### Must NOT Have (Guardrails)
- NOUVELLES fonctionnalités (ex: réservation récurrente)
- Refactoring global de l'architecture
- Ajout de tests automatisés (pas de framework configuré)
- Changement de design global
- "Tant qu'on y est..." improvements

---

## Stratégie de Vérification

### Décision Tests
- **Infrastructure existe**: NON (pas de framework de test)
- **Tests automatisés**: NON
- **QA principal**: Agent-Executed QA Scenarios (Chrome DevTools MCP)

### Scénarios QA Agent-Exécutés (MANDATOIRES)

Chaque tâche sera validée via Chrome DevTools MCP avec des scénarios ultra-détaillés.

---

## Stratégie d'Exécution

### Vagues Parallèles

```
Wave 1 (Critique - Start Immediately):
├── Task 1: Fix double /reservation (routing)
├── Task 2: Fix URLs incohérentes
└── Task 3: Fix navigation SPA

Wave 2 (UX - Après Wave 1):
├── Task 4: Fix code promo feedback
├── Task 5: Fix double bouton Retour
├── Task 6: Fix message résiduel
└── Task 7: Fix légende visuelle

Wave 3 (Polish - Après Wave 2):
├── Task 8: Distinction tarifs normaux/pointe
├── Task 9: Explication créneaux désactivés
└── Task 10: Warning console accessibilité
```

### Matrice de Dépendances

| Task | Dépend De | Bloque | Parallélisable Avec |
|------|-----------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | None | None | 1, 3 |
| 3 | None | None | 1, 2 |
| 4 | None | None | 5, 6, 7 |
| 5 | None | None | 4, 6, 7 |
| 6 | None | None | 4, 5, 7 |
| 7 | None | None | 4, 5, 6 |
| 8 | None | None | 9, 10 |
| 9 | None | None | 8, 10 |
| 10 | None | None | 8, 9 |

---

## TODOs

### Phase 1: Stabilisation (P0)

- [x] 1. Fix URL double /reservation/reservation

  **Description**: Quand on navigue vers `/reservation`, l'URL affichée est `/reservation/reservation`.

  **What to do**:
  - Analyser le routing dans `worker.tsx`
  - Identifier pourquoi le path est dupliqué
  - Corriger la logique de routing ou de navigation

  **Must NOT do**:
  - Ne pas réécrire tout le système de routing
  - Ne pas changer la structure des pages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Bug simple de routing, correction localisée
  - **Skills**: []
    - Pas de skills spécifiques nécessaires

  **Parallelization**:
  - **Can Run In Parallel**: NON
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, 3
  - **Blocked By**: None

  **References**:
  - `src/worker.tsx` - Fichier de routing principal
  - `src/components/booking/` - Composants de réservation

  **Acceptance Criteria**:
  - [x] Naviguer vers /reservation affiche /reservation dans l'URL
  - [x] Pas de pattern /reservation/reservation dans aucun lien

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Navigation vers /reservation affiche URL correcte
    Tool: Chrome DevTools MCP
    Preconditions: Serveur staging actif
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Wait for: page load complete
      3. Assert: URL equals "https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation"
      4. Assert: URL does NOT contain "/reservation/reservation"
    Expected Result: URL est exactement /reservation
    Evidence: Screenshot de la barre d'adresse

  Scenario: Liens de navigation n'ont pas double reservation
    Tool: Chrome DevTools MCP
    Preconditions: Page /reservation chargée
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/
      2. Click: link "Réservation" in nav
      3. Assert: URL equals ".../reservation" (single)
      4. Check: All links on page have valid href (no double)
    Expected Result: Tous les liens sont corrects
  ```

  **Commit**: YES
  - Message: `fix(routing): prevent double /reservation in URL`
  - Files: `src/worker.tsx` or related routing files

---

- [x] 2. Fix URLs incohérentes (/tarifs-et-reservation vs /reservation)

  **Description**: Certains liens pointent vers `/tarifs-et-reservation` au lieu de `/reservation`.

  **Pages concernées**:
  - Page "Les Studios" - boutons "Réservation"
  - Page d'accueil - bouton "Réservation"

  **What to do**:
  - Chercher toutes les occurrences de `/tarifs-et-reservation`
  - Remplacer par `/reservation`
  - Vérifier que la route n'existe pas (ou redirige)

  **Must NOT do**:
  - Ne pas créer de nouvelles routes
  - Ne pas changer la structure des pages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple search and replace
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 1 (avec Tasks 1, 3)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/pages/les-studios.tsx` - Boutons réservation
  - `src/app/pages/home.tsx` - Bouton réservation
  - `src/app/pages/tarifs.tsx` - Lien "Réserver un créneau"

  **Acceptance Criteria**:
  - [x] Tous les liens "Réservation" pointent vers /reservation
  - [x] Pas de lien vers /tarifs-et-reservation
  - [x] Page /tarifs-et-reservation redirige vers /reservation (ou 404)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Liens réservation sont cohérents
    Tool: Chrome DevTools MCP
    Preconditions: None
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/les-studios
      2. Find: all links with text "Réservation"
      3. Assert: each link href equals "/reservation" or full URL with /reservation
      4. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/
      5. Find: link "Réservation"
      6. Assert: href equals "/reservation"
    Expected Result: Tous les liens sont cohérents

  Scenario: Ancienne URL redirige correctement
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/tarifs-et-reservation
      2. Assert: Either redirects to /reservation OR shows 404 (not broken page)
    Expected Result: Pas de page cassée
  ```

  **Commit**: YES
  - Message: `fix(navigation): use consistent /reservation URL everywhere`
  - Files: All pages with reservation links

---

- [x] 3. Fix navigation SPA défaillante

  **Description**: Les clics sur les liens de navigation ne mettent pas toujours à jour le contenu. Un reload est nécessaire.

  **What to do**:
  - Analyser le comportement de navigation SPA
  - Vérifier les gestionnaires de clic sur les liens
  - S'assurer que le contenu se met à jour correctement

  **Must NOT do**:
  - Ne pas réécrire le système de routing
  - Ne pas ajouter de dépendances

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Problème potentiellement complexe de state management SPA
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 1 (avec Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/worker.tsx` - Routing
  - `src/app/Document.tsx` - Shell HTML
  - `src/components/Header/` - Navigation

  **Acceptance Criteria**:
  - [x] Cliquer sur "Les Studios" depuis /reservation change le contenu
  - [x] Cliquer sur "Tarifs" change le contenu
  - [x] Pas besoin de reload pour voir le nouveau contenu

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Navigation SPA fonctionne
    Tool: Chrome DevTools MCP
    Preconditions: Page /reservation chargée
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Snapshot: Note current page content (contains "Combien êtes-vous ?")
      3. Click: link "Les Studios" in navigation
      4. Wait for: page content change (timeout: 3s)
      5. Assert: page title contains "La Scène" or "Le Podium"
      6. Assert: URL is /les-studios
      7. Click: link "Tarifs" in navigation
      8. Wait for: page content change (timeout: 3s)
      9. Assert: page contains "GRILLE TARIFAIRE"
      10. Assert: URL is /tarifs
    Expected Result: Navigation change le contenu sans reload
    Evidence: Snapshots avant/après chaque navigation
  ```

  **Commit**: YES
  - Message: `fix(navigation): ensure SPA navigation updates content`
  - Files: Related navigation components

---

### Phase 2: UX Cleanup (P1)

- [x] 4. Fix code promo sans feedback d'erreur

  **Description**: Entrer un code promo invalide ne montre aucun message d'erreur.

  **What to do**:
  - Ajouter un message d'erreur visible quand le code est invalide
  - Le message doit être clair: "Code promo invalide" ou similaire
  - Le champ code promo doit avoir un attribut id/name (accessibilité)

  **Must NOT do**:
  - Ne pas ajouter de nouveaux types de promotions
  - Ne pas changer la logique de validation des codes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Ajout simple de message d'erreur
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 2 (avec Tasks 5, 6, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/PromoCodeInput.tsx` - Composant code promo
  - `src/lib/booking.ts` - Logique des codes promo (validatePromoCode)

  **Acceptance Criteria**:
  - [x] Code invalide affiche message d'erreur visible
  - [x] Champ code promo a attribut id ou name
  - [x] Message disparaît quand on corrige le code

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Code promo invalide affiche erreur
    Tool: Chrome DevTools MCP
    Preconditions: Panier avec au moins une réservation
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation/panier
      2. Fill: code promo input with "INVALIDCODE123"
      3. Click: button "Appliquer"
      4. Wait for: error message visible (timeout: 3s)
      5. Assert: page contains text "invalide" OR "incorrect" OR "inconnu"
      6. Assert: error message is visible (not hidden)
    Expected Result: Message d'erreur visible
    Evidence: Screenshot avec message d'erreur

  Scenario: Champ code promo a attribut id/name
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation/panier
      2. Find: input "Code promo"
      3. Assert: element has "id" OR "name" attribute
    Expected Result: Champ accessible
  ```

  **Commit**: YES
  - Message: `fix(cart): show error message for invalid promo code`
  - Files: `src/components/booking/PromoCodeInput.tsx`

---

- [x] 5. Fix double bouton "Retour" et texte dupliqué

  **Description**: Sur la page de choix de studio (flow Studio→Date pour groupes), il y a deux boutons "Retour" et deux textes "Choisissez votre studio".

  **What to do**:
  - Identifier le composant responsable
  - Supprimer le doublon
  - Garder un seul bouton "Retour" cohérent

  **Must NOT do**:
  - Ne pas changer la logique de navigation
  - Ne pas supprimer le bouton nécessaire

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple suppression de doublon
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 2 (avec Tasks 4, 6, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/StudioPicker.tsx` - Sélection de studio
  - `src/components/booking/` - Autres composants de réservation

  **Acceptance Criteria**:
  - [x] Un seul bouton "Retour" sur la page de choix studio
  - [x] Un seul texte "Choisissez votre studio"

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Pas de double bouton Retour
    Tool: Chrome DevTools MCP
    Preconditions: Flow groupe, sélection "Studio → Date"
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Click: "Groupe 3+ pers."
      3. Click: "Je choisis mon studio"
      4. Wait for: studio selection page
      5. Find: all buttons with text "Retour"
      6. Assert: count equals 1
      7. Find: all text "Choisissez votre studio"
      8. Assert: count equals 1
    Expected Result: Un seul de chaque
    Evidence: Screenshot de la page
  ```

  **Commit**: YES
  - Message: `fix(booking): remove duplicate back button and text`
  - Files: `src/components/booking/StudioPicker.tsx`

---

- [x] 6. Fix message résiduel sans sélection

  **Description**: Le message "Le choix du studio se fera selon la disponibilité, priorité aux groupes." s'affiche même quand aucun type de groupe n'est sélectionné.

  **What to do**:
  - Conditionner l'affichage du message à la sélection d'un type
  - Le message ne doit apparaître qu'après avoir sélectionné Solo ou Duo

  **Must NOT do**:
  - Ne pas supprimer le message (utile pour Solo/Duo)
  - Ne pas changer le contenu du message

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple condition d'affichage
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 2 (avec Tasks 4, 5, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/FlowChoice.tsx` - Choix du flow
  - `src/components/booking/` - Autres composants

  **Acceptance Criteria**:
  - [x] Message non visible avant sélection de type
  - [x] Message visible après sélection Solo
  - [x] Message visible après sélection Duo
  - [x] Message non visible après sélection Groupe (car choix de studio dispo)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Message conditionnel à la sélection
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Assert: page does NOT contain "priorité aux groupes"
      3. Click: "Solo ou Prof particulier"
      4. Assert: page contains "priorité aux groupes"
      5. Click: "Annuler et recommencer" or navigate back
      6. Assert: page does NOT contain "priorité aux groupes"
      7. Click: "Groupe 3+ pers."
      8. Assert: page does NOT contain "priorité aux groupes" (car choix dispo)
    Expected Result: Message seulement quand pertinent
  ```

  **Commit**: YES
  - Message: `fix(booking): show studio message only after type selection`
  - Files: `src/components/booking/FlowChoice.tsx` or related

---

- [x] 7. Fix légende non représentée visuellement

  **Description**: La légende montre "6€/h", "×", "Réservé", "Durée insuffisante" mais ces états ne sont pas visibles sur les créneaux horaires.

  **What to do**:
  - Option A: Ajouter des couleurs/icônes sur les créneaux pour correspondre à la légende
  - Option B: Simplifier la légende pour ne montrer que ce qui est visible
  - Privilégier Option A pour une meilleure UX

  **Must NOT do**:
  - Ne pas redessiner complètement le sélecteur de créneaux
  - Ne pas ajouter de nouveaux états de créneau

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Amélioration visuelle/UI
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Design des indicateurs visuels

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 2 (avec Tasks 4, 5, 6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/TimeSlotPicker.tsx` - Sélection de créneaux
  - `src/lib/booking.ts` - États des créneaux

  **Acceptance Criteria**:
  - [x] Créneaux ont une indication visuelle de leur état
  - [x] La légende correspond visuellement aux créneaux
  - [x] Créneaux "Réservé" sont visuellement distincts (si applicable)
  - [x] Créneaux avec "Durée insuffisante" sont marqués (si applicable)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Légende correspond aux créneaux
    Tool: Chrome DevTools MCP
    Preconditions: Page de sélection de créneau (après choix date/durée)
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Complete: type selection (Solo), date selection, duration (2h)
      3. Wait for: slot selection page
      4. Find: legend text "6€/h"
      5. Find: at least one slot with visual indicator matching legend
      6. Assert: colors/icons on slots match legend description
    Expected Result: Légende informative et cohérente
    Evidence: Screenshot avec légende et créneaux visibles
  ```

  **Commit**: YES
  - Message: `fix(booking): add visual indicators to slot buttons matching legend`
  - Files: `src/components/booking/TimeSlotPicker.tsx`

---

### Phase 3: Polish (P2)

- [x] 8. Distinction visuelle tarifs normaux/pointe

  **Description**: Les créneaux "heures normales" et "heures de pointe" (après 18h, weekends) ne sont pas distingués visuellement.

  **What to do**:
  - Ajouter une couleur différente ou icône pour les créneaux de pointe
  - Option: Badge "22€/h" sur les créneaux de soirée/weekend
  - Respecter le design existant (couleur primary #ffde59)

  **Must NOT do**:
  - Ne pas changer les tarifs
  - Ne pas redessiner tout le composant

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Amélioration visuelle/UI
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Design des indicateurs de prix

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 3 (avec Tasks 9, 10)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/TimeSlotPicker.tsx` - Sélection de créneaux
  - `src/lib/booking.ts` - Fonction `isPeakTime` ou similaire
  - `src/styles/globals.css` - Couleurs primary

  **Acceptance Criteria**:
  - [x] Créneaux de pointe ont un indicateur visuel distinct
  - [x] L'utilisateur peut identifier les créneaux moins chers
  - [x] Le design reste cohérent avec le reste du site

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Distinction tarifs normaux/pointe
    Tool: Chrome DevTools MCP
    Preconditions: Flow groupe, date de semaine
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Click: "Groupe 3+ pers."
      3. Click: "Je choisis ma date"
      4. Click: "Jeu 12" (jeudi - jour de semaine)
      5. Click: "2h" duration
      6. Wait for: slot selection
      7. Find: slot "16:00" (heure normale)
      8. Find: slot "19:00" (heure de pointe après 18h)
      9. Assert: visual difference between the two slots (color, icon, badge)
    Expected Result: Distinction visuelle claire
    Evidence: Screenshot avec les deux types de créneaux

  Scenario: Weekend tous créneaux de pointe
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Click: "Groupe 3+ pers."
      3. Click: "Je choisis ma date"
      4. Click: "Sam 14" (samedi)
      5. Click: "2h" duration
      6. Assert: all slots show peak rate indicator
      7. Assert: legend shows "22€/h" for weekend
    Expected Result: Tarifs weekend uniformes
  ```

  **Commit**: YES
  - Message: `feat(booking): visually distinguish peak rate slots`
  - Files: `src/components/booking/TimeSlotPicker.tsx`

---

- [x] 9. Explication créneaux désactivés

  **Description**: Certains créneaux sont désactivés (ex: 20:00+ pour 2h) sans explication visible.

  **What to do**:
  - Ajouter un tooltip au survol des créneaux désactivés
  - Message: "Ce créneau dépasse l'heure de fermeture" ou similaire
  - Alternative: Note en bas du sélecteur

  **Must NOT do**:
  - Ne pas changer la logique de disponibilité
  - Ne pas activer les créneaux qui doivent rester désactivés

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Ajout de tooltip UX
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 3 (avec Tasks 8, 10)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/TimeSlotPicker.tsx` - Sélection de créneaux
  - `src/lib/booking.ts` - Logique de disponibilité

  **Acceptance Criteria**:
  - [x] Créneaux désactivés ont un tooltip au survol
  - [x] Le message explique pourquoi le créneau est indisponible
  - [x] Accessible au clavier (focus + tooltip)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Créneau désactivé a explication
    Tool: Chrome DevTools MCP
    Preconditions: Page de sélection de créneau avec durée 2h
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Complete: type selection, date selection
      3. Click: "2h" duration
      4. Find: disabled slot (e.g., "22:30")
      5. Hover: over disabled slot
      6. Wait for: tooltip visible (timeout: 2s)
      7. Assert: tooltip text is not empty
      8. Assert: tooltip explains why slot is unavailable
    Expected Result: Explication visible
    Evidence: Screenshot avec tooltip

  Scenario: Explication accessible clavier
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to slot selection page
      2. Press: Tab to focus disabled slot
      3. Assert: tooltip or aria-label provides explanation
    Expected Result: Accessible sans souris
  ```

  **Commit**: YES
  - Message: `feat(booking): add tooltip explanation for disabled slots`
  - Files: `src/components/booking/TimeSlotPicker.tsx`

---

- [x] 10. Fix warning console accessibilité

  **Description**: Warning console: "A form field element should have an id or name attribute".

  **What to do**:
  - Identifier le champ sans id/name (probablement code promo)
  - Ajouter l'attribut id ou name approprié
  - Vérifier qu'il n'y a pas d'autres champs sans id/name

  **Must NOT do**:
  - Ne pas casser la logique de formulaire
  - Ne pas ajouter de validation supplémentaire

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple ajout d'attribut
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: OUI
  - **Parallel Group**: Wave 3 (avec Tasks 8, 9)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/booking/PromoCodeInput.tsx` - Champ code promo
  - Tous les composants avec inputs

  **Acceptance Criteria**:
  - [x] 0 warnings console liés aux form fields
  - [x] Tous les inputs ont id ou name

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Pas de warnings console
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation
      2. Navigate through: all pages (Les Studios, Le Matériel, Tarifs, Réservation, À Propos)
      3. For each page: Check console messages
      4. Assert: No warnings containing "form field", "id", "name"
    Expected Result: Console propre

  Scenario: Tous les inputs ont id/name
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation/panier
      2. Find: all input elements
      3. For each input: Assert element has "id" OR "name" attribute
      4. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/reservation/coordonnees
      5. Find: all input elements
      6. For each input: Assert element has "id" OR "name" attribute
    Expected Result: Tous les inputs accessibles
  ```

  **Commit**: YES
  - Message: `fix(a11y): add id/name attributes to all form fields`
  - Files: Components with inputs

---

## Validation Finale

- [x] 11. Test complet du système de réservation

  **Description**: Validation finale de toutes les corrections via Chrome DevTools MCP.

  **What to do**:
  - Exécuter un test complet du flow réservation
  - Vérifier toutes les corrections
  - Prendre des captures d'écran comme preuve

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test de validation
  - **Skills**: [`playwright`]
    - `playwright`: Pour les tests browser automatisés

  **Parallelization**:
  - **Can Run In Parallel**: NON (doit être fait à la fin)
  - **Parallel Group**: Final
  - **Blocks**: None
  - **Blocked By**: All other tasks

  **Acceptance Criteria**:
  - [x] Navigation SPA fonctionne sur toutes les pages
  - [x] URLs sont cohérentes
  - [x] Code promo affiche erreur si invalide
  - [x] Pas de double bouton Retour
  - [x] Message résiduel corrigé
  - [x] Légende correspond aux créneaux
  - [x] Tarifs de pointe visuellement distincts
  - [x] Créneaux désactivés ont explication
  - [x] 0 warnings console
  - [x] `pnpm check` passe
  - [x] `pnpm build` passe
  - [x] Deploy staging réussi

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Test complet du flow réservation
    Tool: Chrome DevTools MCP
    Steps:
      1. Navigate to: https://h3-studios-staging.amis-harmonie-sucy.workers.dev/
      2. Click: "Réservation" in nav
      3. Assert: URL is /reservation (not double)
      4. Complete full booking flow: Solo, date, duration, slot
      5. Add to cart
      6. Test: invalid promo code → see error message
      7. Complete: coordonnées form
      8. Choose: payment on place
      9. Assert: confirmation page shows correct details
      10. Navigate: to other pages (Les Studios, Tarifs, etc.)
      11. Assert: all navigation works without reload
      12. Check: console for errors/warnings
    Expected Result: Flow complet sans erreurs
    Evidence: Screenshots à chaque étape clé
  ```

  **Commit**: NO (validation only)

---

## Stratégie de Commit

| Après Tâche | Message | Fichiers |
|-------------|---------|----------|
| 1 | `fix(routing): prevent double /reservation in URL` | worker.tsx |
| 2 | `fix(navigation): use consistent /reservation URL everywhere` | pages avec liens |
| 3 | `fix(navigation): ensure SPA navigation updates content` | navigation components |
| 4 | `fix(cart): show error message for invalid promo code` | PromoCodeInput.tsx |
| 5 | `fix(booking): remove duplicate back button and text` | StudioPicker.tsx |
| 6 | `fix(booking): show studio message only after type selection` | FlowChoice.tsx |
| 7 | `fix(booking): add visual indicators to slot buttons matching legend` | TimeSlotPicker.tsx |
| 8 | `feat(booking): visually distinguish peak rate slots` | TimeSlotPicker.tsx |
| 9 | `feat(booking): add tooltip explanation for disabled slots` | TimeSlotPicker.tsx |
| 10 | `fix(a11y): add id/name attributes to all form fields` | Components with inputs |

---

## Critères de Succès

### Commandes de Vérification
```bash
pnpm check    # Expected: 0 errors
pnpm build    # Expected: exit 0
```

### Checklist Finale
- [x] Toutes les "Must Have" présentes
- [x] Aucune "Must NOT Have" présente
- [x] Navigation SPA testée et fonctionnelle
- [x] URLs cohérentes sur tout le site
- [x] Feedback utilisateur clair (code promo, créneaux)
- [x] 0 warnings console
- [x] Distinction visuelle tarifs normaux/pointe
- [x] Accessibilité améliorée (id/name sur tous les inputs)
- [x] Deploy staging validé
