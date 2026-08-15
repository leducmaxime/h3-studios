-- Type de client et identité légale : l'attribut de profil est backfillé en particulier,
-- tandis que le snapshot juridique d'une réservation préexistante reste inconnu (nullable).
-- users.client_type est NOT NULL DEFAULT car chaque ancienne ligne est légitimement particulier.
-- bookings.client_type est nullable sans défaut : affirmer particulier fabriquerait un fait réimprimé sur facture.
-- Les lectures aval font booking.client_type ?? user.client_type ?? 'particulier'. Aucun CHECK : ADD COLUMN
-- ne le vérifie pas rétroactivement sans rebuild SQLite ; la valeur est déjà whitelistée en TS et au resolve.
ALTER TABLE users ADD COLUMN client_type TEXT NOT NULL DEFAULT 'particulier';
ALTER TABLE users ADD COLUMN legal_name TEXT;
ALTER TABLE users ADD COLUMN siret TEXT;
ALTER TABLE users ADD COLUMN rna TEXT;
ALTER TABLE users ADD COLUMN instagram_accounts TEXT;

ALTER TABLE bookings ADD COLUMN client_type TEXT;
ALTER TABLE bookings ADD COLUMN legal_name TEXT;
ALTER TABLE bookings ADD COLUMN siret TEXT;
ALTER TABLE bookings ADD COLUMN rna TEXT;
ALTER TABLE bookings ADD COLUMN instagram_accounts TEXT;
