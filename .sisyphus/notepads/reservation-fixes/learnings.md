# Learnings - Reservation Fixes

Conventions, patterns et découvertes pendant les corrections.

---

## 2026-02-12: Fix URLs réservation

**Pattern:** Toujours vérifier la cohérence des URLs internes avec les routes définies.

**Découverte:** Il existait une redirection `/tarifs-et-reservation` → `/tarifs` mais les boutons "Réservation" pointaient vers cette ancienne URL au lieu de `/reservation`.

**Solution:** Remplacer les liens dans `Home.tsx` et `LesStudios.tsx` pour pointer directement vers `/reservation`. La redirection a été conservée pour la compatibilité SEO.

## 2026-02-12: Fix navigation SPA

### Problème
Les clics sur les liens de navigation du Header ne mettaient pas à jour le contenu de la page SPA.

### Cause racine
Le Header utilisait des balises `<a href="...">` natives sans empêcher le comportement par défaut du navigateur. Bien que `initClientNavigation()` de rwsdk soit configuré dans `client.tsx`, l'interception automatique des clics ne fonctionnait pas correctement.

### Solution
Utiliser explicitement la fonction `navigate()` de `rwsdk/client` avec `e.preventDefault()` dans les gestionnaires onClick :

```tsx
import { navigate } from "rwsdk/client";

// Dans le lien :
<a
  href={menuItem.path}
  onClick={(e) => {
    e.preventDefault();
    setNavbarOpen(false);
    navigate(menuItem.path);
  }}
>
```

### Points clés
- Toujours utiliser `navigate()` explicitement pour la navigation SPA avec rwsdk
- Garder le `href` pour l'accessibilité et le SEO
- Le `e.preventDefault()` est essentiel pour éviter le rechargement complet

## 2026-02-12: Visual legend matching for time slots

### Problème
La légende du sélecteur de créneaux montrait des états (tarifs, réservé, durée insuffisante) qui n'étaient pas visuellement représentés sur les créneaux eux-mêmes.

### Solution
Ajouter des indicateurs visuels sur les créneaux pour correspondre à la légende :

1. **Tarif affiché**: Les créneaux disponibles montrent maintenant le tarif horaire (ex: "18€/h → 12:00")
2. **Icône peak ⚡**: Les créneaux en heures de pointe (18h+, weekends) affichent l'icône ⚡
3. **Durée insuffisante**: Les créneaux avec durée insuffisante affichent "durée insuff."
4. **Réservé ×**: Les créneaux réservés affichent le × avant l'heure barrée

### Mise à jour de la légende
La légende utilise maintenant des mini-carrés représentatifs avec le même style que les créneaux :
- Carré blanc/gris avec "18" pour le tarif off-peak
- Carré jaune avec "⚡" pour le tarif peak
- Carré rouge avec "× 18" barré pour réservé
- Carré en pointillé avec "18 insuff." pour durée insuffisante

### Pattern de design
- La légende doit toujours refléter exactement l'apparence des éléments interactifs
- Utiliser le même code de style (classes Tailwind) pour la légende et les éléments réels
- Inclure des exemples concrets (ex: "18" au lieu de "XX") dans les mini-prévisualisations

## 2026-02-12: Fix duplicate Retour button and title in studio-first flow

**Problem**: When navigating to the studio selection page via studio-first flow (Groupe 3+ → Je choisis mon studio), there were two "Retour" buttons and two "Choisissez votre studio" texts displayed.

**Root Cause**: In `Reservation.tsx`, the studio-first flow (step 1) had:
1. An external header with "Retour" button + "Choisissez votre studio" text (lines 451-468)
2. The `StudioPicker` component which ALSO rendered its own internal header with the same elements

**Solution**: Added `hideHeader` prop to `StudioPicker` component and passed `hideHeader={true}` from `Reservation.tsx` when the external header is already present.

**Files Modified**:
- `src/components/booking/StudioPicker.tsx` - Added `hideHeader?: boolean` prop
- `src/app/pages/Reservation.tsx` - Pass `hideHeader` to StudioPicker for studio-first flow

**Pattern**: When a parent component provides navigation headers, child components should accept a `hideHeader` prop to avoid duplication. This pattern is already used in `TimeSlotPicker` with the same prop.

## 2026-02-12: Fix accessibility warning - form fields without id/name

### Problème
Warning console: "A form field element should have an id or name attribute"

### Solution
Ajouter des attributs `id` uniques à tous les éléments de formulaire (input, select, textarea) dans les pages admin.

### Fichiers corrigés
- `src/app/pages/admin/Settings.tsx` - 11 inputs (time, number, checkbox)
- `src/app/pages/admin/Users.tsx` - 1 input (recherche)
- `src/app/pages/admin/UserDetail.tsx` - 5 champs (4 inputs + 1 textarea)
- `src/app/pages/admin/BookingDetail.tsx` - 3 champs (1 input + 2 selects)
- `src/app/pages/admin/Bookings.tsx` - 4 champs (1 input + 3 selects + 1 checkbox)
- `src/app/pages/admin/Studios.tsx` - 5 champs (2 inputs + 3 selects)
- `src/app/pages/admin/Payments.tsx` - 2 selects (filtres)

### Convention de nommage des IDs
- Préfixe descriptif basé sur le contexte: `weekday-`, `weekend-`, `notify-`, `edit-`, `filter-`, `block-`, `reschedule-`, `payment-`
- Kebab-case: `min-advance-hours`, `edit-band-name`, `filter-status`
- Éviter les IDs génériques qui pourraient dupliquer

### Note
Les checkboxes de sélection de lignes dans les tableaux (ex: sélection d'un booking individuel) n'ont pas besoin d'ID unique car elles sont générées dynamiquement dans une boucle. Seule la checkbox "select all" a besoin d'un ID.
