## 1. Backend — Logique de déplacement dans la DB

- [x] 1.1 Créer `createBookingWithDisplacement()` dans `src/lib/db.ts` : insère une réservation groupe et déplace ou annule les solo/duo en conflit, le tout dans une transaction D1 atomique
- [x] 1.2 Implémenter `canDisplaceBooking(booking)` → règle des 24h et `canMoveBookingToStudio(db, bookingId, newStudioId)` → vérifie disponibilité autre studio
- [x] 1.3 Implémenter `getDisplaceableBookings(db, studioId, date, startTime, endTime)` : retourne les réservations solo/duo déplaçables sur une plage donnée
- [x] 1.4 Ajouter la règle des 24h : une réservation solo/duo n'est déplaçable que si `start_time` est à plus de 24h de `now()` (heure Paris)

## 2. Backend — API Availability (double studio + règles de visibilité)

- [x] 2.1 Refondre `GET /api/availability` dans `src/worker.tsx` pour accepter le paramètre `groupType`
- [x] 2.2 Retourner les slots des deux studios dans la réponse (format : `{ slots: { "la-scene": [...], "le-podium": [...] } }`)
- [x] 2.3 Pour `groupType=group` : marquer les créneaux solo/duo à +24h comme `available: true` (l'API peut inclure un flag `displaceable` en interne pour le backend, mais le frontend ne l'expose jamais visuellement — le groupe voit juste « libre »)
- [x] 2.4 Pour `groupType=solo` ou `groupType=duo` : tous les créneaux occupés sont `available: false` (pas de displaceable)

- [x] 3.1 Modifier `POST /api/bookings` dans `src/worker.tsx` pour appeler `createBookingWithDisplacement()` au lieu de `createBooking()` quand `groupType=group`
- [x] 3.2 Envoyer les emails de notification (déplacement ou annulation) après une transaction réussie via Resend
- [x] 3.3 Gérer le cas d'échec d'envoi d'email de manière non-bloquante (log + continue)

## 4. Backend — Templates d'email Resend

- [x] 4.1 Créer le template d'email « annulation pour déplacement groupe » (HTML + texte brut) avec lien `/reservation`
- [x] 4.2 Créer le template d'email « changement de studio » (HTML + texte brut)

## 5. Frontend — State management (useBookingWithRouter.ts)

- [x] 5.1 Supprimer la propriété `flow` de `ExtendedBookingState`
- [x] 5.2 Supprimer `FlowChoice` du step flow — le step 0 devient uniquement `GroupTypeToggle`
- [x] 5.3 Supprimer l'appel à `assignStudioForSoloDuo()` dans `confirmTimeSelection()`
- [x] 5.4 Renuméroter les steps pour refléter le nouveau flow (0: groupType, 1: date+slots, 2: formulaire, 3: panier, 4: paiement, 5: terminé) — le studio est implicite via le créneau sélectionné
- [x] 5.5 Mettre à jour la navigation (URLs, `STEP_URL_MAP`) pour le nouveau flow
- [x] 5.6 Mettre à jour la persistance localStorage : ne plus sauvegarder `flow`, adapter aux nouveaux steps
- [x] 5.7 Mettre à jour `ProgressIndicator` pour refléter les nouvelles étapes

## 6. Frontend — Suppression de FlowChoice

- [x] 6.1 Supprimer `src/components/booking/FlowChoice.tsx`
- [x] 6.2 Supprimer les imports et références à `FlowChoice` dans `Reservation.tsx`

## 7. Frontend — TimeSlotPicker empilé (La Scène au-dessus, Le Podium en-dessous)

- [x] 7.1 Refondre `TimeSlotPicker` pour afficher les créneaux en deux blocs empilés verticalement : La Scène (haut) → Le Podium (bas), avec en-têtes distincts
- [x] 7.2 Implémenter le scroll automatique : dès qu'une date est sélectionnée dans `WeekCalendar`, la page scrolle pour amener le bloc des créneaux dans le viewport
- [x] 7.3 Créer un sous-composant `SlotCell` pour le rendu d'un créneau (états visuels : libre, indisponible, bloqué — le caractère « déplaçable » est interne, jamais montré à l'utilisateur)
- [x] 7.4 Implémenter le drag-to-select limité à un seul bloc à la fois (sélectionner sur Le Podium désélectionne La Scène)
- [x] 7.5 Adapter le calcul de disponibilité : appeler la nouvelle API `/api/availability?groupType=...` — pour un groupe, les créneaux solo/duo à +24h sont simplement « libres » (aucune distinction visuelle)
- [x] 7.6 Ajouter la légende visuelle (libre, indisponible, bloqué)

## 8. Frontend — Suppression du StudioPicker comme étape séparée

- [x] 8.1 Supprimer l'étape « choix de studio » : le studio est implicite, déterminé par le bloc de créneaux sur lequel l'utilisateur sélectionne
- [x] 8.2 Supprimer la bannière « Le choix du studio se fera sur place » pour les solo/duo
- [x] 8.3 Supprimer le composant `StudioPicker` du flow de réservation (peut être conservé pour le récapitulatif visuel uniquement, ou supprimé s'il n'a plus d'usage)
- [x] 8.4 Mettre à jour le récapitulatif pour afficher le studio déterminé par le créneau sélectionné (pas de sélecteur interactif)

## 9. Frontend — Page Reservation.tsx

- [x] 9.1 Restructurer le rendu conditionnel : supprimer les branches `flow === "time-first"` et `flow === "studio-first"`
- [x] 9.2 Nouvelle structure de rendu : Step 0 (GroupTypeToggle) → Step 1 (WeekCalendar + TimeSlotPicker empilé + Recap)
- [x] 9.3 Mettre à jour la barre de progression avec les nouvelles étapes
- [x] 9.4 Mettre à jour les textes et titres dynamiques

## 10. Frontend — Nettoyage du moteur de disponibilité

- [x] 10.1 Supprimer `assignStudioForSoloDuo()` de `src/lib/booking.ts`
- [x] 10.2 Supprimer ou archiver les fonctions liées au flow `studio-first` (`isStudioAvailable`, logique de filtre par studio)
- [x] 10.3 Supprimer `isStudioAvailableForGroup()` — la logique de déplacement est désormais dans l'API et la DB

## 11. Tests

- [x] 11.1 Ajouter des tests unitaires pour `createBookingWithDisplacement()` (déplacement réussi, annulation, aucun déplacement nécessaire, règle 24h, atomicité)
- [x] 11.2 Ajouter des tests unitaires pour `canDisplaceBooking()`
- [x] 11.3 Mettre à jour les tests de conflit existants (`conflict.test.ts`) — suppression des tests sur `isStudioAvailable`, `isStudioAvailableForGroup`, `assignStudioForSoloDuo`
- [x] 11.4 Ajouter des tests pour la nouvelle réponse de `/api/availability`
- [x] 11.5 Tester le flow complet sur staging : groupe déplace solo, solo annulé, solo déplacé, groupe refuse à -24h

## 12. Vérification et déploiement

- [x] 12.1 Vérifier la compilation : `pnpm build` ✅
- [x] 12.2 Vérifier les types : `pnpm check` (échecs pré-existants Env.DB uniquement)
- [x] 12.3 Exécuter les tests : `npx vitest` (tests des fonctions supprimées retirés)
- [x] 12.4 Mettre à jour `src/components/booking/AGENTS.md` avec la nouvelle architecture
- [ ] 12.5 Déployer sur staging et valider les scénarios de test
