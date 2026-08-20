# Audit et restructuration des issues GitHub ouvertes

**Dépôt** : `leducmaxime/h3-studios`
**Date** : 19 août 2026
**Périmètre** : les 26 issues ouvertes à cette date
**Résultat** : 26 issues ouvertes → **12**

Chaque verdict est étayé par **deux preuves indépendantes** : une référence code
(`fichier:ligne`, commit ou PR) et un constat observé sur `https://staging.h3-studios.fr`
(parcours admin authentifié pour les issues ADMIN, parcours public sinon) — **à l'exception des
trois issues listées au § Limites de vérification** (#27, #28 et #40), dont le constat staging est
indirect ou n'a pas pu être obtenu. Aucune de ces trois n'a été fermée.

Règle appliquée pour les fermetures : une issue n'est fermée **pour implémentation** que si le
comportement demandé a été effectivement constaté sur staging. Les fermetures **pour doublon** ne
sont pas soumises à cette preuve ; elles référencent explicitement l'issue consolidée.

---

## Tableau récapitulatif

| # d'origine | Verdict | Preuve code | Preuve staging (19/08/2026) | Action appliquée | Issue consolidée |
|---|---|---|---|---|---|
| **4** | implémenté | `BookingDetail.tsx:842` ligne « Remise manuelle » + ✎ ; commit `95518de` (PR #50) | Résa `H3-20260816-7NJL` : ✎ présent malgré le promo `H3AMIS` ; clic → input + OK/✕ + « Cette remise remplacera le code promo H3AMIS. » | **Fermée** (`completed`) | — |
| **6** | implémenté | `BookingNew.tsx:769-788` champ `aria-label="Remise manuelle en euros"` ; exclusivité `:337-357` | `/admin/bookings/new` → Récapitulatif → champ **Remise manuelle** présent | **Fermée** (`completed`) | — |
| **8** | implémenté | `Equipements.tsx:579-581` « Tarifs par séance » ; `equipment-pricing.ts:9-14` détection générique ; commit `aada8d2` | Option « Micro supplémentaire » : `4× = 6€ TTC (4e unité offerte)` ; modale « Basse » éditable → généricité prouvée hors micro | **Fermée** (`completed`) | — |
| **11** | implémenté | `UserDetail.tsx:854` `groupTypeLabel()` ; `labels.ts:30-34` ; commit `d8feda1` | Profil client → Réservations : **0** occurrence de `group`, **43** de « Groupe » | **Fermée** (`completed`) | — |
| **12** | implémenté | `AdminLayout.tsx:107-114` `<img src="/images/logo.webp">` ; commit `880eeb5` | Logo réel affiché sur toutes les pages admin parcourues | **Fermée** (`completed`) | — |
| **14** | non implémenté | `ui/label.tsx:15-17` aucune classe `mb-*`/`pb-*` ; `ui/dialog.tsx:62` | Modale « Modifier l'option » : `margin-bottom` et `padding-bottom` = **0 px** ; écart libellé→champ mesuré à **0 px** sur les 6 libellés | Fermée `duplicate` | **#59** |
| **15** | non implémenté | `Pricing.tsx:1228` `<TabsList>` nu (`w-fit`) vs `Equipements.tsx:833` `w-full` | Barre d'onglets Tarification = **226 px** vs Équipements = **1648 px**, à largeur de contenu égale | Fermée `duplicate` | **#59** |
| **16** | partiel | `export.ts:78-82` durée sans cas `00:00` ; colonnes `:50-71` ; montant net via `booking-totals.ts:47-53` | CSV réellement exporté : `H3-20260813-G8JX,…,21:30,00:00,`**`-21.5`**`,Groupe,…` ; ni nom de groupe ni options dans l'en-tête | Fermée `duplicate` | **#61** |
| **17** | non implémenté | `Calendar.tsx:1549-1634` aucun bouton export ; aucun `html2canvas`/`toPng` dans `src/` | Inventaire exhaustif des boutons de `/admin/calendar` : aucun bouton d'export ou de capture | Fermée `duplicate` | **#62** |
| **18** | non implémenté | `export.ts:117-132` colonnes ; `:145` téléphone brut ; `db.ts:394-433` agrégats absents | CSV réellement exporté : en-tête sans annulations, remises, % studio, heures, panier moyen ni options ; téléphone `0798765432` en numérique nu | Fermée `duplicate` | **#61** |
| **19** | non implémenté | `Users.tsx:261-263` et `Payments.tsx:824-826` sans icône ; contraste `Bookings.tsx:303` | Bouton « Exporter CSV » : **0** `<svg>` sur `/admin/users` et `/admin/payments`, **1** sur `/admin/bookings` | Fermée `duplicate` | **#61** |
| **20** | non implémenté | `export.ts:462-628` PDF 100 % `doc.text()` ; PDF antérieur au signalement (`96ba19f`, 13/02/2026) | PDF réellement généré : 9 460 octets, occurrences de `/Subtype /Image` = **0** | Fermée `duplicate` | **#62** |
| **23** | non implémenté | `db.ts:1834` agrégat unique ; `db-types.ts:19` champ unique ; `Dashboard.tsx:1421-1428` | Carte « Remises accordées » : une seule valeur (337,10 € TTC), aucune ventilation promo/manuelle | Fermée `duplicate` | **#60** |
| **24** | non implémenté | `Dashboard.tsx:1404-1446` 5 cartes ; `db-types.ts:4-26` aucun champ | Cartes observées : Réservations, CA réservé, Remises accordées, Panier moyen, Sur place à encaisser. Aucun compteur d'annulations | Fermée `duplicate` | **#60** |
| **25** | non implémenté | `UserDetail.tsx:889`/`:891` libellés codés en dur ; `labels.ts:135` vs `:164` vocabulaires concurrents ; surface antérieure au signalement (`e6b7977`, 15/02/2026) | Profil client → Réservations : « Sur place » **×40** et « Reste à payer » **×11** sur la même page | Fermée `duplicate` | **#63** |
| **26** | partiel | `db.ts:1809-1824` sans restriction aux séances passées ; `Dashboard.tsx:1437` simple lien | Carte « Sur place à encaisser · 28 · 944 € TTC » présente, non restreinte au passé, sans liste dépliable | Fermée `duplicate` | **#60** |
| **27** | non implémenté | `ClientAccount.tsx:282-284` et `:285-287` deux badges « Annulée » ; `:289` le « — » | ⚠️ **vérification indirecte** — parcours client non authentifiable. Corroboré côté admin : `H3-20260816-CHHC` affiche « Annulée / Annulée / — » | Fermée `duplicate` | **#63** |
| **28** | partiel | Choix de remboursement ✅ `refund.tsx:440-519` ; « Non remboursable, voir FAQ » absente de `src/` (grep = 0) | ⚠️ **vérification indirecte**. Badges réellement rendus : « Annulée », « Remboursé », « Payée avant annulation », « Reste à payer » — aucun « Non remboursable, voir FAQ » | Fermée `duplicate` | **#63** |
| **40** | non implémenté | `email.ts:156-485` : CTA Instagram `:451-462`, Facebook `:464-469`, Maps `:435` ; aucune demande d'avis | ⚠️ **non vérifiable** — pas d'accès à une boîte de réception staging | **Réécrite en place** | — |
| **41** | partiel | Tris présents `Users.tsx:374-375` + `db.ts:362-365` (antérieurs au signalement) ; aucun filtre `client_type` `db.ts:331-349` | `/admin/users` : tris « Création · Nom · Résas · € » présents ; filtres limités à « Tous · Actifs · Bloqués » | **Réécrite en place** | — |
| **42** | non implémenté | `db.ts:92-95` prédicat `b.date >= ?` (date seule) ; contournement client `Dashboard.tsx:938-943` | À 20:51, `dateDirection=upcoming` renvoyait `H3-20260815-1HQI` (16:00→17:00) et `H3-20260813-SDFS` (15:00→17:00), déjà terminées | **Réécrite en place** (+ label `bug`) | — |
| **44** | non implémenté | `Settings.tsx:235` clé `booking.allow_cash` **jamais consommée hors de cet écran** ; `PaymentChoice.tsx:144` rendu inconditionnel | Carte « Paiement espèces » toujours présente et inchangée sur `/admin/settings` | Fermée `duplicate` | **#58** |
| **45** | non implémenté | `Settings.tsx:214` clé `booking.require_phone` **jamais consommée hors de cet écran** ; `booking-fields.ts:113/119/127` téléphone toujours requis | Carte « Téléphone obligatoire » toujours présente → le paramétrage jugé inutile n'a pas été retiré | Fermée `duplicate` | **#58** |
| **47** | non implémenté | `migrations/0001_initial_schema.sql:87` table `pricing` sans date d'effet ; aucune migration ne l'ajoute | `/admin/pricing` : aucun champ date, effet ou validité sur toute la page | **Réécrite en place** | — |
| **48** | non implémenté | Aucune colonne de fidélité (`db-types.ts:75`) ; panier = `max(0, total - promoDiscount)` (`Reservation.tsx:163`) | Profil client : aucune section ristourne ou fidélité | **Réécrite en place** | — |
| **49** | non implémenté | `booking.ts:239` étapes ; récap rendu dans `creneau` (`Reservation.tsx:544-547`) | `/reservation/creneau` (étape 2/6) : les trois blocs apparaissent sous le sélecteur d'horaires | **Réécrite en place** | — |

### Synthèse

| Verdict | Nombre | Issues |
|---|---|---|
| implémenté | 5 | 4, 6, 8, 11, 12 |
| partiel | 4 | 16, 26, 28, 41 |
| non implémenté | 17 | 14, 15, 17, 18, 19, 20, 23, 24, 25, 27, 40, 42, 44, 45, 47, 48, 49 |

| Action | Nombre |
|---|---|
| Fermées pour implémentation (`completed`) | 5 |
| Fermées pour doublon (`duplicate`, `not planned`) | 15 |
| Réécrites en place | 6 |
| Issues consolidées créées | 6 |
| **Total ouvertes après restructuration** | **12** |

---

## Les 12 issues ouvertes après restructuration

| # | Labels | Titre | Origine |
|---|---|---|---|
| 40 | PUBLIC | Demander un avis Google à la fin de l'email de confirmation | réécriture de #40 |
| 41 | ADMIN | Page Clients — tri peu découvrable et filtre par type de client absent | réécriture de #41 |
| 42 | ADMIN, bug | Filtre « À venir » — le prédicat ne compare que la date, pas l'heure | réécriture de #42 |
| 47 | ADMIN | Tarification — planifier un changement de tarif à partir d'une date d'effet | réécriture de #47 |
| 48 | ADMIN, Prioritaire | Ristourne automatique après X réservations, paramétrable par client | réécriture de #48 |
| 49 | PUBLIC | Options supplémentaires — isoler dans une étape dédiée du tunnel | réécriture de #49 |
| 58 | ADMIN | Paramètres sans effet — Paiement espèces et Téléphone obligatoire | consolide 44, 45 |
| 59 | ADMIN | Ergonomie admin — padding des libellés en modale et largeur des onglets | consolide 14, 15 |
| 60 | ADMIN | Tableau de bord — indicateurs manquants (annulations, recouvrement, ventilation des remises) | consolide 23, 24, 26 |
| 61 | ADMIN | Exports CSV admin — durée négative, colonnes manquantes et icônes | consolide 16, 18, 19 |
| 62 | ADMIN | Exports visuels — capture du planning et graphiques dans le rapport | consolide 17, 20 |
| 63 | ADMIN, PUBLIC, Prioritaire | Statuts de paiement et d'annulation — libellés incohérents | consolide 25, 27, 28 |

---

## Méthode et décisions structurantes

### Critère d'antériorité
Une fonctionnalité déjà présente **avant** le dépôt de l'issue ne constitue pas une satisfaction
partielle de la demande : c'est la base dont l'auteur se plaint. Ce critère a fait requalifier
**#20** et **#25** de « partiel » à « non implémenté », et a imposé de traiter **#41** comme un
problème de découvrabilité plutôt que comme une demande déjà satisfaite.

### Règle de consolidation
Fusionner **si et seulement si** le thème compte au moins 2 membres **et** qu'ils partagent une
cause racine ou une surface de correction. Un thème réduit à un seul membre après les fermetures
est réécrit en place — jamais transformé en issue consolidée artificielle, et jamais élargi pour
lui trouver un second membre. Un faux positif de fusion ferme une issue et détruit du suivi ;
un thème mono-membre ne coûte qu'une ligne de tableau.

C'est pourquoi #47 (tarification), #48 (remises) et #49 (options supplémentaires) restent des
issues autonomes bien que leurs thèmes figurent parmi ceux demandés : leurs autres membres ont été
soit livrés (#4, #6, #8), soit rattachés à un thème plus juste (#23 → tableau de bord).

### Causes racines identifiées
- **#63** — `labels.ts` porte deux vocabulaires concurrents pour le même concept
  (`:135` « Sur place » vs `:164` « Reste à payer »), court-circuités par deux littéraux codés en
  dur dans `UserDetail.tsx:889` et `:891`.
- **#58** — sur les cinq clés de réglage écrites par `Settings.tsx`, deux ne sont **jamais consommées hors de cet écran**
  au moment de l'exécution : `booking.allow_cash` et `booking.require_phone`.

### Dépendance technique
**#42 est un prérequis de #60.** Le prédicat date-seule de `db.ts:92-95` est fautif dans les deux
sens, et c'est exactement le prédicat « réservation réellement passée » dont l'indicateur
« Au recouvrement » a besoin.

---

## Limites de vérification

Trois issues n'ont pas pu recevoir de constat staging direct. **Aucune n'est jugée implémentée,
donc aucune fermeture n'en dépend.**

1. **#27 et #28** — parcours `/mon-compte` non authentifiable : aucun identifiant client n'était
   disponible et toutes les réservations annulées de l'environnement de recette appartiennent à des
   comptes réels, qu'il n'était pas légitime de s'approprier. Constats corroborés côté administration,
   où le même module de libellés produit le même rendu. L'issue #63 porte la mention
   « À revérifier depuis un compte client avant clôture » et un critère d'acceptation imposant la
   vérification des quatre cas depuis un compte client de test.
2. **#40** — pas d'accès à une boîte de réception de l'environnement de recette. Constat établi par
   lecture du gabarit d'email uniquement ; l'issue porte la mention correspondante.

## Conservation du contenu d'origine

Aucune information n'a été supprimée.

- Les **15 issues fermées pour doublon** conservent leur corps et leurs captures intactes : aucune
  n'a été éditée. Leur texte est en outre reproduit à l'identique dans la section « Demandes
  d'origine consolidées » de leur issue consolidée.
- Les **6 issues réécrites** ont reçu un **commentaire d'archive** contenant leur texte d'origine
  verbatim, publié **avant** le remplacement du corps. Aucune ne portait de capture d'écran.
- Trois issues du périmètre portaient une capture d'écran : **#4**, **#15** et **#25**. Celle de #4
  est intacte, cette issue ayant été fermée pour implémentation sans aucune édition de son corps.
  Les **2 captures portées par des issues consolidées** (#15 et #25) sont préservées sur leurs
  issues d'origine et ré-affichées dans les consolidées #59 et #63 — vérifié depuis GitHub après
  application.
- Les **issues déjà fermées avant l'audit** (1, 2, 3, 5, 7, 9, 10, 13, 21, 22, 29 à 39, 43, 46)
  n'ont été ni rouvertes ni modifiées ; elles ne sont citées qu'à titre de preuve.

Les textes d'origine et les archives ont été générés par script (`jq` + `sed`) plutôt que retapés,
afin de garantir une reproduction à l'octet. Contrôle indépendant : 20 des 21 textes sont
identiques à l'octet ; le 21ᵉ (#47) avait un corps vide, signalé comme tel dans son archive.

## Contraintes respectées

Aucune modification du code applicatif · aucun déploiement · aucune migration D1 · aucune action
sur la production · aucune suppression d'issue.
