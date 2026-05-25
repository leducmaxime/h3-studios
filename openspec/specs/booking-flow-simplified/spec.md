## ADDED Requirements

### Requirement: Le flow de réservation est unique et linéaire

Le système SHALL proposer un parcours de réservation unique en 3 étapes principales : choix du type de groupe, sélection de la date, puis sélection du créneau et du studio. Le choix de parcours (`time-first` / `studio-first`) est supprimé.

#### Scenario: Un utilisateur arrive sur la page réservation
- **WHEN** un utilisateur navigue vers `/reservation`
- **THEN** le système affiche uniquement le sélecteur de type de groupe (Solo, Duo, Groupe)
- **AND** aucun choix de parcours (« par date » ou « par studio ») n'est présenté

#### Scenario: Un utilisateur sélectionne son type de groupe
- **WHEN** l'utilisateur choisit « Solo », « Duo » ou « Groupe » dans le `GroupTypeToggle`
- **THEN** le système passe automatiquement à l'étape de sélection de date (`WeekCalendar`)

#### Scenario: Un utilisateur sélectionne une date
- **WHEN** l'utilisateur choisit une date dans le `WeekCalendar`
- **THEN** le système charge et affiche la grille des créneaux pour les deux studios (`TimeSlotPicker` double studio)

#### Scenario: Retour arrière dans le flow
- **WHEN** l'utilisateur clique sur « Retour » depuis l'étape créneaux
- **THEN** le système revient à l'étape de sélection de date
- **AND** la date précédemment sélectionnée est conservée
