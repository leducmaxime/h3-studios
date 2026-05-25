## ADDED Requirements

### Requirement: Email automatique en cas d'annulation par déplacement

Lorsqu'une réservation solo ou duo est annulée parce qu'un groupe a réservé sur son créneau et que l'autre studio est indisponible, le système SHALL envoyer un email de notification au propriétaire de la réservation annulée.

#### Scenario: Envoi d'email après annulation
- **WHEN** une réservation solo/duo est annulée automatiquement (statut `cancelled`, `cancel_reason = 'Déplacé par une réservation groupe'`)
- **THEN** le système SHALL envoyer un email à l'adresse `user_email` de la réservation annulée
- **AND** l'email contient la date, l'heure, et le studio de la réservation annulée
- **AND** l'email contient un lien vers la page de réservation (`/reservation`)
- **AND** l'email explique que l'annulation est due à une réservation prioritaire de groupe

#### Scenario: Contenu de l'email d'annulation
- **WHEN** l'email d'annulation est généré
- **THEN** le sujet SHALL être « Votre réservation H3 Studios a été modifiée »
- **AND** le corps SHALL mentionner la date et le créneau annulé
- **AND** le corps SHALL inviter le destinataire à réserver un autre créneau

#### Scenario: Échec d'envoi d'email non bloquant
- **WHEN** l'envoi de l'email échoue (ex: API Resend indisponible)
- **THEN** la réservation groupe est tout de même créée
- **AND** la réservation solo/duo est tout de même annulée
- **AND** l'erreur est loggée mais ne bloque pas la transaction

### Requirement: Email en cas de déplacement (changement de studio)

Lorsqu'une réservation solo ou duo est déplacée vers l'autre studio (pas annulée), le système SHALL également envoyer un email de notification informant du changement de studio.

#### Scenario: Envoi d'email après déplacement
- **WHEN** une réservation solo/duo est déplacée vers l'autre studio
- **THEN** le système SHALL envoyer un email à l'adresse `user_email`
- **AND** l'email indique le nouveau studio attribué
- **AND** l'email confirme que la date et l'heure restent inchangées
- **AND** le sujet SHALL être « Votre réservation H3 Studios a été modifiée »

### Requirement: Intégration Resend

Le système SHALL utiliser le SDK Resend (déjà intégré pour le formulaire de contact) pour envoyer les emails de notification. Les templates d'email sont stockés côté serveur.

#### Scenario: Envoi via Resend
- **WHEN** une notification doit être envoyée
- **THEN** le système appelle l'API Resend avec l'adresse email du destinataire
- **AND** utilise l'expéditeur configuré (identique au formulaire de contact)
- **AND** le format est HTML avec fallback texte brut
