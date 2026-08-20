# Audit des 5 issues GitHub ouvertes restantes

**Dépôt** : `leducmaxime/h3-studios`
**Date** : 20 août 2026
**Périmètre** : les 5 issues ouvertes à cette date (#77, #74, #73, #48, #39)
**Résultat** : 5 issues ouvertes → **5** (aucune fermeture, aucune consolidation, aucune scission)
**Révision du code** : `6a1fe49`

Cet audit fait suite à celui du 19/08/2026 (`docs/audit-issues-2026-08.md`), qui avait ramené 26 issues à 12.
Sept d'entre elles ont été livrées depuis ; les cinq restantes font l'objet du présent document.

Chaque verdict est étayé par **deux preuves indépendantes** : une référence code (`fichier:ligne`, commit)
et un constat observé sur `https://staging.h3-studios.fr` (session admin authentifiée pour les issues
ADMIN, parcours public pour #39). Les écarts sont consignés au § Limites de vérification.

## Contrôle préalable du build déployé

Une réouverture antérieure ayant été causée par un déploiement périmé, la fraîcheur du build a été
vérifiée **par le contenu et non par l'horodatage** avant tout constat d'absence :

- `src/components/common/ReservationBannerIcon.tsx` est créé par le commit de tête `6a1fe49` et par
  aucun autre (`git log --follow`).
- Le bundle servi par staging expose `/assets/ReservationBannerIcon-DTZGIAxw.js`, contenant les
  26 clés d'icônes introduites par ce commit.
- Déploiement staging le plus récent : `7a1e0619`, 20/08 21:20 UTC, postérieur au commit (18:20 UTC).
  Arbre de travail propre et synchronisé avec `origin/main`.

**Conclusion : le build déployé contient bien la tête de branche.** Aucun constat de ce document ne
repose sur un déploiement périmé.

---

## Tableau récapitulatif

| # | Verdict | Preuve code | Preuve staging (20/08/2026) | Action appliquée |
|---|---|---|---|---|
| **77** | non implémenté | `booking.ts:306-312` — `ALL_TIME_SLOTS` est un **littéral** de 31 entrées `09:00`→`00:00` ; `booking.ts:420-425` + `:437-439` durée par `indexOf` → `-1` ; `worker.tsx:2089-2091` refus « Créneau invalide » | `GET /api/admin/bookings/quote` `03:00→05:00` → `{"success":false,"error":"Créneau invalide…"}` ; `23:00→03:00` idem ; `22:00→00:00` → 36 € OK. Grille de la modale : `9h · 9h30 … 23h30 · 0h`, aucun créneau nocturne | **Réécrite en place** (+ renommée) |
| **74** | non implémenté | `TimeSlotPicker.tsx:572-576` — `gridCols` **non borné** `Math.max(1, …ceil(len/3))` ; modales plafonnées à `lg:max-w-4xl` (`Calendar.tsx:1696`, `BookingDetail.tsx:1217`) | Fenêtre **1467 × 855** (résolution de la capture) : modale **896 px**, grille `repeat(11, …)`, 31 cellules de **31,4 px**, **16/31 cellules débordent** (`9h` réclame 82 px dans 29 px ; `10h30` 33 px dans 29 px). Badges `DÉBUT` 42,5 px / `FIN` 26,7 px en `absolute` + `nowrap` | **Réécrite en place** (+ renommée) |
| **73** | non implémenté | `worker.tsx:2379-2382` — choix explicite en commentaire : « Un simple déplacement conserve le prix historique » ; `:2383-2388` recalcul conditionnel ; `Calendar.tsx:388-393` et `BookingDetail.tsx:345-350` n'envoient que le créneau ; `:2315-2316` aucune validation temporelle | Journal d'audit : déplacement réel du **20/08 16:25:45**, deux minutes avant le dépôt (16:27:52), portant `H3-20260820-B6JW` à `10:00→00:00` (14 h). La réservation stocke encore `base_price = total_price = 64 €` en `paid`, alors que le devis serveur tarife ce créneau **236 €** (64 € = exactement 4 h). **Écart : 172 €.** Entrée `dc527863-…` : `18:30 → 17:00` persisté en `confirmed` | **Réécrite en place** (+ renommée, absorbe le défaut de validation) |
| **48** | non implémenté | `db-types.ts:112-151` — `DbUser` sans champ de fidélité ; aucune des 17 migrations n'ajoute de colonne ; `Reservation.tsx:186` panier = `max(0, cartTotal − promoDiscount)` | Fiche client : sections **Informations · Statistiques · Répartition studios · Actions** uniquement. Aucune occurrence de « ristourne », « fidélité » ou « seuil » | **Réécrite en place** (références réactualisées, arbitrages tranchés) |
| **39** | **partiel** | Présence livrée par `31e7fc5` (19/08 18:24), **postérieur** au dépôt (16/08) → vaut satisfaction. Hiérarchie : `tax.ts:37-40` concatène `" TTC"` dans la chaîne ; option `bare` (`:33`) **sans aucun point d'appel en production** | `/tarifs` : 10 échantillons sur 10 ont « TTC » **dans le même nœud de texte** que le montant, sans élément dédié, en `14px / opacity 1 / #fff / weight 400`. Tunnel `/reservation/groupe` : `12px / opacity 1 / weight 500`, même structure | **Réécrite en place** (+ renommée, pas de scission) |

### Synthèse

| Verdict | Nombre | Issues |
|---|---|---|
| implémenté | 0 | — |
| partiel | 1 | 39 |
| non implémenté | 4 | 77, 74, 73, 48 |

| Action | Nombre |
|---|---|
| Réécrites en place | 5 |
| Consolidées | 0 |
| Scindées | 0 |
| Fermées | 0 |
| **Total ouvertes après restructuration** | **5** |

---

## Restructuration : pourquoi aucune fusion ni scission

La règle de l'audit précédent a été appliquée telle quelle : **fusionner si et seulement si le thème
compte au moins deux membres et qu'ils partagent une cause racine ou une surface de correction.**
Aucun couple parmi les cinq ne satisfait cette condition. L'absence de consolidation est un
**résultat**, pas une omission.

**#74 et #77 sont couplées mais pas fusionnables.** Elles descendent du même commit `c0a9ceb`
(19/08 18:44, « module de choix de créneau identique au public »), et corriger #77 rouvre
mécaniquement #74. Mais la longueur de `ALL_TIME_SLOTS` n'est pas la *cause* de #74 : c'est une
*variable aggravante*. La cause de #74 est une formule de colonnes non bornée
(`TimeSlotPicker.tsx:572-576`) dans un conteneur à largeur plafonnée — le défaut est le produit
`colonnes × largeur du conteneur`. Preuve : la même grille, avec les mêmes 31 créneaux, est
parfaitement lisible en création (`BookingNew`, ~1195 px, cellules ~55 px). Fusionner affirmerait
une cause commune qui n'existe pas. La dépendance est donc **déclarée dans les deux issues**, sur le
modèle `#42 → #60` de l'audit précédent, et #74 porte un critère explicitement indépendant de
`ALL_TIME_SLOTS.length`.

**#73 n'est fusionnable avec aucune des deux.** L'intersection avec #77 se réduit à une fonction
(`computeBookingQuote`) que #77 étend dans son *domaine* et que #73 doit *appeler* : deux
changements orthogonaux. Surtout, #73 est l'issue la mieux étayée et sa correction est entièrement
outillée, tandis que #77 dépendait d'un arbitrage d'architecture. Les fusionner aurait enchaîné une
correction livrable à une décision en attente.

**#73 absorbe en revanche le défaut de plage inversée**, non pas au titre d'une cause commune — le
non-recalcul est un choix délibéré documenté, l'absence de validation est un oubli — mais au titre
de la **surface de correction** : les deux se corrigent dans le même gestionnaire
(`worker.tsx` PUT `/api/admin/bookings/:id`) et par la même opération, re-dériver le créneau côté
serveur au lieu de le traiter en passe-plat. La validation est de surcroît un **prérequis** du
recalcul : la fonction de tarification doit pouvoir se prononcer sur `18:30 → 17:00` avant de
tarifer quoi que ce soit.

**#39 n'est pas scindée.** Elle porte bien deux volets, mais le second résorbe le premier par
construction : une fois les points de rendu passés par un chemin de formatage commun, les oublis de
mention disparaissent d'eux-mêmes. Indice décisif que les deux volets relèvent d'un même refactor
inachevé : `tax.ts:33` documente une option `bare` prévue exactement pour les libellés portant déjà
la mention, et **jamais câblée en production**. Scinder aurait par ailleurs créé une issue quasi
vide, la présence étant complète sur les surfaces publiques — le seul périmètre que porte le
label PUBLIC de l'issue.

## Critère d'antériorité

Le critère de l'audit précédent — *une fonctionnalité présente avant le dépôt de l'issue est la base
dont l'auteur se plaint, pas une satisfaction partielle* — a été déterminant sur trois des cinq :

- **#77** : le mécanisme « avertir + forcer » est complet et opérationnel (constaté sur staging :
  bandeau ambre + bouton **Confirmer** actif), mais livré par `c0a9ceb` **la veille** du dépôt.
  Verdict **non implémenté** et non « partiel ».
- **#74** : le remède demandé par le titre d'origine (« élargir la modale ») **a déjà été appliqué**
  par `c0a9ceb` (`lg:max-w-md` → `lg:max-w-4xl`), la veille du dépôt, et ne suffit pas. Ce point
  est écrit en toutes lettres dans l'issue : sans lui, un implémenteur « corrigerait » en
  élargissant à nouveau.
- **#73** : les primitives nécessaires existent toutes (devis serveur, remboursement partiel, solde
  dû) mais sont **toutes antérieures** à l'issue et **aucune n'est câblée** au déplacement.
  L'antériorité s'applique aux primitives comme aux fonctionnalités : verdict **non implémenté**.

À l'inverse, **#39** est la seule à recevoir *partiel* : la présence des mentions a été livrée
`31e7fc5` **après** le dépôt, ce qui vaut satisfaction de la demande initiale.

---

## Décisions produit arbitrées

Aucune issue ne comporte plus de point « à trancher ». Une décision a été prise sur précédent
maison ; les six autres, qui relèvent d'un arbitrage commercial que le code ne peut pas trancher,
ont été **remontées à l'utilisateur et tranchées par lui** avant réécriture.

| Issue | Point | Décision | Fondement |
|---|---|---|---|
| **48** | Réservations **annulées** dans le décompte | **Ne comptent pas** | **Précédent maison**, unanime : `db.ts:363-386` compte `status != 'cancelled'` et tous les agrégats du tableau de bord (`db.ts:1877-1965`) excluent `cancelled` sans exception |
| **48** | Réservations **`no-show`** dans le décompte | **Ne comptent pas** | **Arbitrage utilisateur.** Le précédent les inclut, mais il a été écrit pour une statistique de consommation, pas pour une récompense : une séance non honorée n'ouvre pas de droit |
| **48** | Articulation avec code promo et remise manuelle | **Non cumulable — priorité stricte : remise manuelle > code promo > ristourne** | **Arbitrage utilisateur.** Le précédent (`worker.tsx:2389-2401`) établissait la non-cumulativité, pas l'ordre. Le geste manuel de l'opérateur reste souverain ; l'automatique n'écrase ni une décision humaine ni une campagne en cours |
| **48** | Comportement du compteur | **Récurrent : toutes les X réservations, compteur remis à zéro** | **Arbitrage utilisateur.** « au bout de X réservations » était ambigu et sans précédent ; modèle de la carte de fidélité retenu |
| **77** | Modèle horaire | **Les deux** : grille 24 h ancrée sur `00:00` (48 créneaux) **et** franchissement de minuit, en deux phases | **Arbitrage utilisateur.** La grille seule suffirait à poser un `03:00→05:00`, mais pas une session de nuit continue commencée la veille |
| **77** | Tarif des heures de nuit | **Tarif heure pleine** | **Arbitrage utilisateur.** Aucune migration ni écran supplémentaire ; une heure de nuit n'est pas une heure creuse |
| **73** | Reprise des lignes déjà corrompues | **Hors périmètre de l'issue** | **Arbitrage utilisateur** : les deux lignes constatées sont des données de recette sans valeur métier |

### Conséquence croisée traitée explicitement

Le choix « les deux » sur #77 introduira une convention de franchissement de minuit, sous laquelle
`18:30 → 17:00` **deviendra une durée légitime de 22 h 30**. Le critère de validation absorbé par #73
a donc été rédigé de façon **neutre vis-à-vis de la convention** — « le triplet persisté doit être
re-dérivable en une durée strictement positive et bornée par la fonction même qui le tarife » —
afin qu'il reste valable après la mise en œuvre de #77 au lieu de la contredire.

## Dépendances techniques

- **#77 aggrave #74.** Porter `ALL_TIME_SLOTS` de 31 à 48 créneaux fait passer la grille de 11 à
  16 colonnes par studio dans une modale de 896 px. La relation joue dans les deux sens : corriger
  #74 en calibrant sur 31 colonnes casserait #77. Les deux issues portent la dépendance.
- **Le verrou de #77 n'est pas le nombre de fichiers concernés, c'est une invariante.** `"00:00"`
  est une sentinelle de fin de journée (`db.ts:36-38` `normEnd`, `:41-43` `endCmp`,
  `booking.ts:422`, `worker.tsx:2357`) qui ne normalise que la **fin**. Un début après minuit n'a
  donc **aucune normalisation définie**, et le prédicat de recouvrement
  `start_time < ? AND end_time > ?` est indéfini dans ce régime. Ce point est écrit dans l'issue :
  sans lui, la correction consisterait à ajouter des chaînes au tableau, et casserait silencieusement
  la détection de conflit.

## Éléments devenus obsolètes depuis l'audit du 19/08

Deux obstacles cités par #48 sont levés, ce qui est consigné dans l'issue :

- **La correction de #42 est livrée** : `db.ts:50-65` `dateDirectionCondition` compare désormais la
  date **et** l'heure de fin. Le prédicat « réservation réellement passée » nécessaire au décompte
  existe donc. *Réserve* : le filtre client de la fiche client (`UserDetail.tsx:317-318`) compare
  encore la date seule et ne doit pas servir de source.
- **La ventilation des remises du tableau de bord existe** (`Dashboard.tsx:1702-1720`,
  `db.ts:1951-1953`), constatée sur staging : « Remises accordées 337,10 € TTC · dont 285,10 € code
  promo · 52 € remise manuelle ». La ristourne de fidélité s'y ajoutera comme troisième catégorie.

Par ailleurs, la liste de surfaces publiée dans le commentaire de réouverture de #39 comportait de
nombreuses références devenues fausses ; toutes les références des corps réécrits ont été
revérifiées sur `6a1fe49`.

---

## Limites de vérification

Aucune de ces limites ne soutient un verdict « implémenté » : aucune fermeture n'en dépend.

1. **#73 — aucun déplacement n'a été exécuté.** La consigne interdisant toute action mutante sur les
   données de recette, la preuve n'a **pas** été obtenue en déplaçant une réservation. Elle repose
   sur un **déplacement réel préexistant**, tracé au journal d'audit (20/08 16:25:45), dont l'effet
   est mesurable à froid : prix stocké 64 € contre 236 € au devis serveur pour le même créneau. La
   chaîne est complète et vérifiable, mais elle est **constatée a posteriori et non reproduite**.
2. **#73 — le comportement de remboursement du delta négatif n'est pas observable.** Il n'existe
   aujourd'hui aucun code de remboursement sur le chemin du déplacement ; l'absence est établie par
   lecture du code, pas par un essai.
3. **#77 — la persistance d'un créneau nocturne n'a pas été tentée.** Le refus est établi au niveau
   du devis serveur (`03:00→05:00` et `23:00→03:00` refusés) et de la grille (aucun créneau
   nocturne proposé). Aucune tentative d'écriture n'a été faite.
4. **#74 — mesures prises à une seule résolution.** Les relevés (896 px, 31,4 px par cellule,
   16 cellules sur 31 en débordement) l'ont été à **1467 × 855**, résolution de la capture d'origine,
   par émulation de fenêtre. Les critères d'acceptation à 1280 × 800 et 1920 × 1080 sont des
   objectifs, non des mesures constatées.
5. **#39 — échantillonnage.** Le constat porte sur 10 montants de `/tarifs` et 3 du tunnel
   `/reservation/groupe`, non sur les 43 points d'appel publics un par un. Le caractère systématique
   est en revanche établi par le code : la concaténation a lieu dans `formatPrice` lui-même.
   Corollaire : **la non-régression des emails, PDF, CSV et du libellé Stripe n'a pas été vérifiée**
   — elle est portée en critère d'acceptation, faute d'accès à une boîte de réception de recette et
   sans avoir généré d'export.
6. **#48 — une seule fiche client observée.** L'absence de section de fidélité a été constatée sur
   un profil ; elle est corroborée par l'absence totale de colonne et de champ dans le code.

## Incident : écriture accidentelle en production

À signaler sans détour. La commande `wrangler d1 execute <NOM> --env staging` résout la base par le
**nom positionnel**, et non par `--env`. Le nom `h3-studios-db` désigne la base de **production**
(`b2230e0f`) ; la recette est `h3-studios-db-staging` (`f621ac89`).

- **Fait** : le 20/08 à 21:51:03 UTC, une ligne a été insérée dans `admin_users` **en production** —
  un compte super-admin `opencode@h3-studios.fr` au mot de passe connu. L'intention était de créer
  un compte d'audit sur la recette, où le compte existait déjà (id `adm-5fb6026b`) sans que ce soit
  su à cet instant.
- **Correction** : ligne supprimée quelques minutes plus tard.
- **Vérification après correction** : `admin_users` de production ramenée à ses **2 lignes
  d'origine** (`marcel@…`, `leducmaxime@…`) ; `sessions` pour cet identifiant = **0** (le compte n'a
  jamais servi à se connecter) ; `audit_logs` depuis 21:00 = **0**. Aucune donnée de réservation, de
  paiement ni de configuration n'a été lue ni modifiée en production.
- **Conséquence sur l'audit** : les premières lectures, mal ciblées, avaient conclu à tort que la
  recette était vide de réservations et de déplacements. Ces conclusions ont été annulées ; la
  recette compte en réalité **131 réservations** et **174 entrées de journal d'audit**, et c'est de
  là que provient la preuve de #73.
- **Mesure appliquée ensuite** : ciblage explicite de `h3-studios-db-staging` et contrôle de
  cohérence (131 réservations / 4 comptes admin) avant toute opération.

## Conservation du contenu d'origine

Aucune information n'a été supprimée.

- Les **5 issues réécrites** ont chacune reçu un **commentaire d'archive publié avant** le
  remplacement du corps, contenant le texte d'origine **à l'octet** dans un bloc de code, ainsi que
  le titre d'origine et le nouveau titre. Contrôle indépendant effectué après publication en
  comparant chaque texte archivé à la capture du corps réalisée avant édition : **5 sur 5
  identiques à l'octet**.
- Une seule issue du périmètre portait une capture d'écran : **#74**, dont le corps d'origine était
  *uniquement* cette capture. Elle est **doublement préservée** : ré-affichée dans le commentaire
  d'archive, et **ré-intégrée en tête du corps réécrit**. Vérifié depuis GitHub après application.
- Les textes d'archive ont été générés par script à partir du corps récupéré avant édition, plutôt
  que retapés, afin de garantir la reproduction à l'octet.
- Les commentaires antérieurs (constats de vérification du 20/08 et archive du 19/08 sur #48) n'ont
  été ni modifiés ni supprimés.

## Contraintes respectées

Aucune modification du code applicatif · aucun build · aucun déploiement · aucune migration D1 ·
aucune suppression d'issue · aucune fermeture d'issue · aucune action mutante sur les données de
recette (aucune réservation créée, annulée, déplacée ni payée).

**Exception, déclarée au § Incident** : une écriture accidentelle en production sur `admin_users`,
détectée, annulée et vérifiée comme sans effet résiduel.

Périmètre d'écriture : les issues GitHub du dépôt et la présente note. `src/`, `migrations/` et le
reste de l'arborescence n'ont été lus qu'à titre de référence.
