## ADDED Requirements

### Requirement: Le studio est déterminé implicitement par le créneau sélectionné

Le système SHALL déterminer le studio de la réservation à partir du créneau horaire sélectionné par l'utilisateur. Il n'y a pas d'étape séparée de choix de studio : choisir un créneau sur La Scène signifie réserver La Scène, choisir un créneau sur Le Podium signifie réserver Le Podium. L'auto-assignation (`assignStudioForSoloDuo`) est supprimée.

#### Scenario: Un solo sélectionne un créneau sur La Scène
- **WHEN** un utilisateur « solo » sélectionne une plage horaire dans le bloc « La Scène »
- **THEN** le studio de la réservation est implicitement « la-scene »
- **AND** aucune étape supplémentaire de choix de studio n'est affichée

#### Scenario: Un duo sélectionne un créneau sur Le Podium
- **WHEN** un utilisateur « duo » sélectionne une plage horaire dans le bloc « Le Podium »
- **THEN** le studio de la réservation est implicitement « le-podium »

#### Scenario: Un groupe sélectionne un créneau (avec déplacement silencieux)
- **WHEN** un utilisateur « group » sélectionne une plage horaire dans le bloc « La Scène »
- **AND** certains créneaux de cette plage sont occupés par des solo/duo (déplaçables car à +24h)
- **THEN** le studio de la réservation est implicitement « la-scene »
- **AND** le récapitulatif n'affiche AUCUN avertissement concernant les réservations existantes
- **AND** le groupe n'est jamais informé qu'un déplacement ou une annulation aura lieu

#### Scenario: Changement de sélection d'un studio à l'autre
- **WHEN** l'utilisateur a sélectionné un créneau sur « La Scène »
- **AND** l'utilisateur sélectionne un créneau sur « Le Podium »
- **THEN** la sélection sur « La Scène » est automatiquement désélectionnée
- **AND** le studio de la réservation devient « le-podium »
- **AND** un seul créneau sur un seul studio est actif à la fois

### Requirement: Récapitulatif affiche le studio sélectionné

Le récapitulatif (avant ajout au panier) SHALL afficher clairement le studio correspondant au créneau sélectionné, sans demander à l'utilisateur de confirmer ou changer le studio.

#### Scenario: Récapitulatif après sélection de créneau
- **WHEN** l'utilisateur a validé une plage horaire sur un studio
- **THEN** le récapitulatif affiche le nom du studio, la date, et la plage horaire
- **AND** aucun sélecteur de studio n'est affiché (le studio est déjà déterminé)

### Requirement: Suppression de l'auto-assignation et de la bannière solo/duo

Le système SHALL supprimer la fonction `assignStudioForSoloDuo()` et la bannière « Le choix du studio se fera sur place ». Tous les utilisateurs voient les deux studios et choisissent via le créneau.

#### Scenario: Un solo ne voit plus de bannière de restriction
- **WHEN** un utilisateur « solo » est à l'étape de sélection des créneaux
- **THEN** aucune bannière « Le choix du studio se fera sur place » n'est affichée
- **AND** les deux blocs de créneaux (La Scène et Le Podium) sont visibles et utilisables

#### Scenario: Suppression de l'auto-assignation
- **WHEN** le code est compilé
- **THEN** la fonction `assignStudioForSoloDuo` n'existe plus dans `src/lib/booking.ts`
- **AND** aucun appel à cette fonction n'existe dans le codebase
