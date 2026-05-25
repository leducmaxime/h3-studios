## ADDED Requirements

### Requirement: Les créneaux des deux studios sont affichés l'un sous l'autre

Après sélection de la date, le système SHALL afficher les créneaux horaires (30 minutes) de La Scène, puis en dessous ceux du Podium. Chaque studio a son propre bloc avec un en-tête identifiant le studio.

#### Scenario: Affichage empilé des créneaux
- **WHEN** l'utilisateur a sélectionné une date
- **THEN** le système affiche le bloc de créneaux « La Scène » avec son en-tête
- **AND** en dessous, le bloc de créneaux « Le Podium » avec son en-tête
- **AND** chaque bloc liste les créneaux de 30 minutes pour les horaires d'ouverture du studio ce jour-là

#### Scenario: Scroll automatique après sélection de la date
- **WHEN** l'utilisateur sélectionne une date dans le `WeekCalendar`
- **THEN** la page SHALL scroller automatiquement pour amener le bloc des créneaux dans le viewport
- **AND** le scroll est suffisant pour que l'utilisateur voie le début des créneaux de La Scène ET que Le Podium soit au moins partiellement visible

#### Scenario: Créneau libre dans un studio
- **WHEN** un créneau n'est occupé par aucune réservation et n'est pas bloqué
- **THEN** le créneau SHALL être affiché comme « libre » (sélectionnable)

#### Scenario: Créneau occupé par un autre groupe (vue groupe)
- **WHEN** un utilisateur de type « group » consulte les créneaux
- **AND** un créneau est occupé par une autre réservation de type « group »
- **THEN** le créneau SHALL être affiché comme « indisponible » (non sélectionnable)

#### Scenario: Créneau occupé par un solo/duo à +24h (vue groupe)
- **WHEN** un utilisateur de type « group » consulte les créneaux
- **AND** un créneau est occupé par une réservation solo ou duo
- **AND** la date de début de cette réservation est dans plus de 24 heures
- **THEN** le créneau SHALL être affiché comme « disponible » (identique visuellement à un créneau libre)
- **AND** aucune indication visuelle de déplacement n'est montrée au groupe

#### Scenario: Créneau occupé par un solo/duo à -24h (vue groupe)
- **WHEN** un utilisateur de type « group » consulte les créneaux
- **AND** un créneau est occupé par une réservation solo ou duo
- **AND** la date de début de cette réservation est dans moins de 24 heures
- **THEN** le créneau SHALL être affiché comme « indisponible » (non sélectionnable)

#### Scenario: Créneau occupé (vue solo/duo)
- **WHEN** un utilisateur de type « solo » ou « duo » consulte les créneaux
- **AND** un créneau est occupé par n'importe quelle réservation (solo, duo, ou group)
- **THEN** le créneau SHALL être affiché comme « indisponible » (non sélectionnable)

#### Scenario: Créneau bloqué (tous types)
- **WHEN** un créneau est bloqué via `blocked_slots` (quel que soit le type d'utilisateur)
- **THEN** le créneau SHALL être affiché comme « bloqué » (non sélectionnable)

### Requirement: Drag-to-select limite à un seul studio à la fois

Le système SHALL permettre à l'utilisateur de sélectionner une plage de créneaux consécutifs par glisser-déposer. La sélection ne peut concerner qu'un seul studio. Sélectionner un créneau sur un autre studio désélectionne automatiquement le premier.

#### Scenario: Sélection sur un studio
- **WHEN** l'utilisateur initie un glisser-déposer sur un créneau de « La Scène »
- **THEN** la sélection SHALL s'étendre uniquement dans le bloc « La Scène »
- **AND** le bloc « Le Podium » n'est pas affecté

#### Scenario: Changement de studio annule la sélection précédente
- **WHEN** l'utilisateur a sélectionné un créneau sur « La Scène »
- **AND** l'utilisateur commence à sélectionner un créneau sur « Le Podium »
- **THEN** la sélection sur « La Scène » est immédiatement désélectionnée
- **AND** la nouvelle sélection s'applique uniquement à « Le Podium »

#### Scenario: Plage invalide (chevauchement avec créneau indisponible)
- **WHEN** la sélection par glisser-déposer inclut un créneau indisponible
- **THEN** le système SHALL marquer la sélection comme invalide
- **AND** le bouton de confirmation est désactivé

### Requirement: L'API availability supporte le double studio et les règles de visibilité

L'API `GET /api/availability?date=YYYY-MM-DD&groupType=solo|duo|group` SHALL retourner les informations de disponibilité pour les deux studios, avec les règles de visibilité appropriées selon le `groupType`.

#### Scenario: Requête availability pour un groupe
- **WHEN** l'API reçoit `GET /api/availability?date=2026-05-25&groupType=group`
- **THEN** la réponse SHALL inclure pour chaque créneau l'état par studio
- **AND** les créneaux occupés par des solo/duo à +24h sont marqués comme `available: true` (l'information `displaceable` est interne à l'API, non exposée au frontend pour usage visuel)
- **AND** les créneaux occupés par des groupes sont marqués comme `available: false`

#### Scenario: Requête availability pour un solo
- **WHEN** l'API reçoit `GET /api/availability?date=2026-05-25&groupType=solo`
- **THEN** la réponse SHALL inclure pour chaque créneau l'état par studio
- **AND** tous les créneaux occupés (peu importe le type) sont marqués comme `available: false`
- **AND** aucun créneau n'est marqué comme `displaceable`
