## ADDED Requirements

### Requirement: Déplacement automatique des solo/duo par un groupe

Lorsqu'un groupe confirme une réservation sur un créneau occupé par un solo ou un duo, le système SHALL tenter de déplacer la réservation solo/duo vers l'autre studio. Si l'autre studio est disponible sur toute la période, le déplacement est effectué. Sinon, la réservation solo/duo est annulée.

#### Scenario: Déplacement réussi vers l'autre studio
- **WHEN** un groupe confirme une réservation sur le studio A, à une date et plage horaire occupées par une réservation solo sur le studio A
- **AND** le studio B est disponible (aucune réservation, pas de blocked_slot) sur l'intégralité de la plage horaire du solo
- **AND** le studio B est dans ses horaires d'ouverture sur toute la plage
- **THEN** la réservation du groupe est créée sur le studio A
- **AND** la réservation solo est déplacée vers le studio B (`studio_id` mis à jour)
- **AND** les deux opérations sont atomiques (réussissent ou échouent ensemble)

#### Scenario: Annulation car l'autre studio est indisponible
- **WHEN** un groupe confirme une réservation sur le studio A, à une date et plage horaires occupées par une réservation duo sur le studio A
- **AND** le studio B n'est pas disponible sur l'intégralité de la plage horaire du duo (occupé ou bloqué sur au moins un créneau)
- **THEN** la réservation du groupe est créée sur le studio A
- **AND** la réservation duo est annulée (`status = 'cancelled'`, `cancelled_at = now`, `cancel_reason = 'Déplacé par une réservation groupe'`)

#### Scenario: Groupe sur un créneau libre (pas de déplacement)
- **WHEN** un groupe confirme une réservation sur un créneau libre (aucune réservation existante)
- **THEN** la réservation du groupe est créée normalement
- **AND** aucune autre réservation n'est modifiée

#### Scenario: Le solo/duo est à moins de 24h (pas de déplacement possible)
- **WHEN** un groupe tente de réserver sur un créneau occupé par un solo/duo
- **AND** la date de début de la réservation solo/duo est dans moins de 24 heures
- **THEN** le système SHALL rejeter la réservation groupe avec une erreur de conflit
- **AND** le frontend ne doit jamais permettre cette sélection (le créneau est affiché comme indisponible)

### Requirement: Atomicité des opérations de déplacement

Le déplacement ou l'annulation et la création de la réservation groupe SHALL être exécutés dans une transaction atomique. Si l'une des opérations échoue, toutes les modifications sont annulées.

#### Scenario: Échec de la création groupe après annulation solo
- **WHEN** le système annule une réservation solo
- **AND** la création de la réservation groupe échoue (ex: problème de contrainte)
- **THEN** l'annulation du solo est annulée (rollback)
- **AND** l'état de la base de données reste inchangé

### Requirement: Pas de déplacement en cascade

Le système SHALL ne pas déplacer une réservation qui déplacerait elle-même une autre réservation. Si un groupe déplace un solo, et que ce solo occupait le seul créneau disponible sur l'autre studio, le solo est simplement annulé (pas de recherche d'un troisième studio ou autre).

#### Scenario: Pas de cascade
- **WHEN** un groupe réserve sur le studio A, occupé par un solo
- **AND** le studio B est occupé par un duo sur la même plage
- **THEN** le solo est annulé (car pas de place sur le studio B)
- **AND** le duo sur le studio B n'est pas affecté
