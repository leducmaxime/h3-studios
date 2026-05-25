## Why

Le flow de réservation actuel est contre-intuitif : il demande à l'utilisateur de choisir entre deux parcours (« par date » ou « par studio ») avant même de savoir quel créneau est disponible, et impose un studio aux solo/duo sans leur laisser le choix. Cette refonte supprime cette friction en simplifiant le parcours et en donnant plus de contrôle à tous les utilisateurs, tout en préservant la priorité légitime des groupes (plus rémunérateurs) avec un mécanisme clair de déplacement/annulation.

## What Changes

- **BREAKING** : Suppression du choix de parcours (`FlowChoice`) — le flow est désormais unique et linéaire
- **BREAKING** : Suppression de l'auto-assignation de studio pour les solo/duo — tous les utilisateurs choisissent leur studio
- Affichage simultané des créneaux des **deux studios** (La Scène + Le Podium) côte à côte après sélection de la date
- Les groupes voient les créneaux solo/duo à +24h comme disponibles et peuvent réserver dessus
- Déplacement automatique des solo/duo vers l'autre studio lors d'une réservation groupe, si l'autre studio est libre sur toute la période
- Annulation automatique des solo/duo avec **email de notification** si l'autre studio est indisponible
- Les solo/duo voient tous les créneaux réservés comme indisponibles (pas de priorité sur d'autres réservations)
- Refonte de l'API `/api/availability` pour supporter la nouvelle logique de disponibilité par groupe

## Capabilities

### New Capabilities

- `booking-flow-simplified` : Nouveau flux de réservation en 3 étapes (type de groupe → date → créneaux + studio), remplaçant l'ancien système à deux parcours
- `dual-studio-availability` : Affichage simultané des créneaux des deux studios sur une grille unique, avec distinction visuelle par studio et par type d'occupation
- `open-studio-selection` : Tous les utilisateurs (solo, duo, groupe) choisissent librement leur studio parmi ceux disponibles
- `group-priority-displacement` : Mécanisme backend de déplacement ou annulation automatique des réservations solo/duo lorsqu'un groupe réserve sur leur créneau
- `booking-cancellation-notifications` : Envoi d'email automatique (via Resend) en cas d'annulation d'une réservation solo/duo causée par un déplacement de groupe

### Modified Capabilities

*Aucune — il n'existe pas de spécifications existantes dans `openspec/specs/`.*

## Impact

- **`src/components/booking/FlowChoice.tsx`** : supprimé
- **`src/components/booking/useBookingWithRouter.ts`** : refonte majeure (suppression `flow`, suppression `assignStudioForSoloDuo`, nouveau step flow)
- **`src/components/booking/TimeSlotPicker.tsx`** : refonte pour afficher les deux studios simultanément
- **`src/components/booking/StudioPicker.tsx`** : intégré dans l'étape créneaux (choix après sélection du range)
- **`src/components/booking/GroupTypeToggle.tsx`** : reste en première étape, ajustements mineurs
- **`src/components/booking/WeekCalendar.tsx`** : devient la deuxième étape, ajustements mineurs
- **`src/app/pages/Reservation.tsx`** : restructuration du rendu conditionnel (plus de `flow` à vérifier)
- **`src/lib/booking.ts`** : refonte du moteur de disponibilité (`getSlotDetails`, `getAvailableStudiosForSlot`, `isRangeBookable`, suppression de `assignStudioForSoloDuo`)
- **`src/lib/db.ts`** : nouvelle fonction `createBookingWithDisplacement()` gérant l'insertion groupe avec déplacement/annulation atomique
- **`src/lib/email.ts`** (ou nouveau) : template et envoi d'email d'annulation pour déplacement
- **`src/worker.tsx`** : refonte de la route `POST /api/bookings` pour intégrer la logique de déplacement, mise à jour de `GET /api/availability`
- **Migrations** : aucune modification du schéma DB nécessaire
