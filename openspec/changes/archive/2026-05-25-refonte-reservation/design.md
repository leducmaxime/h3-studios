## Context

Le système actuel propose deux parcours de réservation distincts (`time-first` et `studio-first`), avec une auto-assignation de studio pour les solo/duo. La logique de disponibilité côté frontend (`src/lib/booking.ts`) et backend (`GET /api/availability`) doit être refondue pour supporter un affichage simultané des deux studios avec des règles de visibilité différentes selon le type de groupe, ainsi qu'un mécanisme de déplacement/annulation automatique au moment de la confirmation d'une réservation groupe.

## Goals / Non-Goals

**Goals:**
- Simplifier le flow de réservation en supprimant le choix de parcours et l'auto-assignation
- Afficher les créneaux des deux studios l'un en dessous de l'autre, avec scroll automatique après sélection de la date
- Permettre à l'utilisateur de choisir implicitement son studio en sélectionnant un créneau sur le studio souhaité (un seul créneau, un seul studio à la fois)
- Implémenter la priorité des groupes : affichage différencié des créneaux solo/duo pour les groupes, déplacement ou annulation automatique au moment de la confirmation
- Envoyer un email de notification aux solo/duo annulés pour cause de déplacement groupe

**Non-Goals:**
- Modifier le schéma de base de données (les colonnes existantes suffisent)
- Modifier la logique de pricing ou les tarifs
- Modifier le panier multi-réservation (il reste fonctionnel)
- Modifier le flow de paiement Stripe
- Modifier l'interface d'administration ou le calendrier admin
- Gérer les déplacements en cascade (un groupe déplace un solo qui déplacerait un autre solo)

## Decisions

### D1 : Flow unique linéaire — studio choisi implicitement via le créneau

**Choix** : Remplacer les deux flux (`time-first`, `studio-first`) par un flux unique : `groupType → date → créneaux (2 studios empilés) → formulaire → panier → paiement`. Il n'y a **pas d'étape séparée de choix de studio** : le studio est implicitement déterminé par le créneau que l'utilisateur sélectionne. Si l'utilisateur sélectionne un créneau sur La Scène puis commence à en sélectionner un sur Le Podium, la sélection La Scène est désélectionnée. Un seul créneau sur un seul studio à la fois.

**Alternatives considérées** :
- Garder les deux flux avec le nouvel affichage → complexité inutile, l'utilisateur n'a pas besoin de choisir un parcours
- Flow : date → groupType → créneaux → studio → rejeté car le groupType détermine ce que l'utilisateur voit dans les créneaux
- Étape séparée « choix du studio » après sélection du créneau → complexité inutile : le choix du studio est redondant avec le choix du créneau puisque chaque créneau est déjà associé à un studio spécifique

**Rationale** : Le type de groupe détermine les règles d'affichage, il doit être choisi en premier. Le studio est une propriété intrinsèque du créneau sélectionné — pas besoin de le demander séparément.

### D2 : Créneaux des deux studios empilés verticalement avec scroll auto

**Choix** : Afficher les créneaux de La Scène et du Podium l'un en dessous de l'autre (pas côte à côte). Dès qu'une date est sélectionnée dans le `WeekCalendar`, la page scrolle automatiquement pour amener les créneaux dans le viewport, garantissant que l'utilisateur voit bien les deux sets de créneaux.

**Alternatives considérées** :
- Grille 3 colonnes (heure | La Scène | Le Podium) → comparaison côte à côte plus difficile à lire sur mobile, complexité de drag-to-select sur deux colonnes
- Deux colonnes côte à côte → même problème de lisibilité mobile
- Onglets pour switcher entre studios → masque l'autre studio, l'utilisateur risque de ne pas voir l'alternative

**Rationale** : L'empilement vertical est plus naturel sur mobile (scroll natif) et permet de présenter chaque studio avec son propre en-tête clairement identifié. Le scroll automatique garantit que l'utilisateur ne manque pas le deuxième studio.

### D3 : Règle des 24h pour le déplacement

**Choix** : Un groupe peut réserver sur un créneau solo/duo uniquement si la date de réservation est à plus de 24h. Si ≤ 24h, le créneau est considéré comme indisponible (comportement standard).

**Alternatives considérées** :
- 48h → trop restrictif pour les groupes
- Pas de limite → risque de déplacer un solo/duo 1h avant sa réservation

**Rationale** : 24h est un compromis acceptable entre flexibilité pour les groupes et respect des réservations existantes.

### D4 : Déplacement vs annulation — logique backend

**Choix** : Au moment du `POST /api/bookings` d'un groupe, si le créneau choisi est occupé par un solo/duo, le backend vérifie si l'autre studio est disponible sur l'intégralité de la plage horaire du solo/duo. Si oui → `UPDATE` le `studio_id` (déplacement). Si non → `UPDATE` le `status` à `cancelled` avec `cancel_reason = 'Déplacé par une réservation groupe'`. Dans les deux cas, l'opération est atomique (transaction D1).

**Alternatives considérées** :
- Déplacement asynchrone (job queue) → complexité inutile pour D1
- Refuser la réservation groupe si conflit → ne respecte pas la priorité groupe souhaitée
- Déplacement side-car dans l'API → pas atomique, risque d'état incohérent

**Rationale** : L'approche atomique garantit la cohérence des données. D1 supporte les transactions, le tout peut être fait dans une seule requête batch.

### D5 : Email de notification

**Choix** : Utiliser Resend (déjà intégré pour le formulaire de contact) pour envoyer un email transactionnel au solo/duo annulé. Template dédié avec lien vers la page de réservation.

**Alternatives considérées** :
- Email via worker queue → pas de queue disponible sur Workers
- Notification in-app uniquement → pas de système de notification en place
- SMS → non intégré actuellement

**Rationale** : Resend est déjà configuré et testé. L'email est le canal le plus fiable pour ce type de notification.

### D6 : Pas de modification du schéma DB

**Choix** : Utiliser les colonnes existantes (`studio_id`, `status`, `cancel_reason`, `cancelled_at`) sans nouvelle migration. Le `cancel_reason` distinguera les annulations utilisateur des annulations par déplacement groupe.

**Rationale** : Le schéma actuel couvre tous les besoins. Évite une migration inutile.

## Risks / Trade-offs

- **[Risque] Course condition si deux groupes réservent simultanément sur le même créneau solo/duo** → Mitigation : transaction D1 atomique avec `WHERE NOT EXISTS` (déjà en place dans `createBooking`). Le premier groupe gagne, le second reçoit une erreur de conflit.
- **[Risque] Le solo/duo déplacé voit son studio changer sans être prévenu** → Mitigation : envoyer un email de notification dans les deux cas (déplacement ET annulation). Pour le déplacement, l'email indique le nouveau studio.
- **[Risque] Complexité accrue du TimeSlotPicker** → Mitigation : extraire la logique de rendu des cellules dans des sous-composants (`SlotCell`, `StudioColumn`). Tests unitaires sur la logique de disponibilité.
- **[Trade-off] Les solo/duo ne voient plus « leur » studio automatiquement** → Accepté : c'est le comportement voulu. Ils gagnent en contrôle.
- **[Trade-off] Un groupe ne peut plus choisir « studio d'abord »** → Accepté : le flow unique compense par une meilleure visibilité des deux studios.

## Migration Plan

1. **Déploiement** : La refonte est déployée en une fois sur staging, puis production après validation.
2. **Rollback** : Conserver l'ancien code dans un tag git. Le schéma DB étant inchangé, un rollback du code suffit.
3. **Données** : Aucune migration de données nécessaire. Les réservations existantes continuent de fonctionner avec l'ancien `studio_id`.
4. **Tests** : Valider sur staging avec des scénarios réels (créer des résas solo/duo, réserver par-dessus avec un groupe, vérifier déplacement/annulation + email).

## Open Questions

1. **Faut-il notifier par email aussi en cas de déplacement (pas seulement annulation) ?** → Probablement oui, pour que le solo/duo sache dans quel studio il doit aller.
2. **Quel est le délai exact des 24h ?** 24h avant le début du créneau ? 24h avant minuit le jour J ? → À clarifier : proposer 24h avant le `start_time` de la réservation.
3. **Les réservations de groupe déjà existantes doivent-elles aussi déclencher le déplacement ?** → Non, le nouveau mécanisme ne s'applique qu'aux nouvelles réservations groupe. Les réservations existantes ne sont pas affectées.
4. **Template d'email pour annulation : faut-il un design spécifique ?** → Réutiliser le style des emails Resend existants (contact form), avec un template dédié pour l'annulation.
