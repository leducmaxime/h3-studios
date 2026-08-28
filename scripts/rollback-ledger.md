# Procédure de migration et de rollback du grand livre

> **AVERTISSEMENT — NE JAMAIS déplacer ce fichier dans `migrations/`.**
> Wrangler appliquerait alors son contenu comme une migration.

## Fenêtre et préparation

Effectuer l'opération entre **23h00 et 23h10**. Éviter **05:55–06:15** : le
cron quotidien `0 6 * * *`, déclaré dans `wrangler.jsonc`, écrit en base.

Construire hors fenêtre, puis ne déployer que le worker pendant la coupure :

```sh
pnpm build
```

Ne pas lancer `release:prod` pendant la coupure : cette commande fait
`clean+build+deploy`. `site.maintenance_mode` est cosmétique : il masque
seulement l'écran de réservation et ne bloque ni `POST /api/bookings`, ni le
webhook Stripe, ni l'administration. L'activer peut dissuader les réservations,
mais ce n'est pas une protection.

## Règle d'exécution des contrôles

Le chemin d'import de `wrangler d1 execute --file=…` **n'affiche pas les
résultats des `SELECT`** : il ne renvoie qu'un compteur de requêtes. Les
contrôles P1–P5 et C1–C6 doivent donc être copiés et exécutés **un par un avec
`--command`** pour lire les valeurs. Les fichiers `.sql` sont la référence et
la source à copier ; ne pas les utiliser avec `--file` pour lire les résultats.

Statut de chaque contrôle :

| Contrôle | Attendu | Nature |
|---|---|---|
| `P1` | valeur à noter | Invariant de référence (reste dû) |
| `P2` | valeur à noter | Second invariant (encaissé net) |
| `P3a` `P3b` | `0` | **Bloquant** — hypothèses de la migration |
| `P3c` | valeur à noter | **Informatif.** Paiements à 0 € des réservations 100 % remisées, volontairement non migrés. Mesuré à 5 sur staging. **Ne pas interrompre la fenêtre sur ce contrôle.** |
| `P4` `P5` | `0` | **Bloquant** — FK et `parent_id` |
| `C1` | `= P1` au centime | **Bloquant** |
| `C2` `C4` `C5` `C6` | 0 ligne | **Bloquant** |
| `C3` | 0 ligne attendue | Informatif — mouvements non entièrement affectés |

Dans les exemples ci-dessous, remplacer `<COMMANDE>` par un seul `SELECT` du
fichier de contrôle, en conservant ses quotes shell (ou utiliser un fichier
temporaire correctement échappé pour la commande). Utiliser le bloc staging ou
le bloc production, jamais les deux pour une même opération.

## Séquence de migration

La séquence est la même pour staging et production. Les bases sont :

| Environnement | `--env` | Base D1 |
|---|---|---|
| Staging | `staging` | `h3-studios-db-staging` |
| Production | `production` | `h3-studios-db` |

0. **Portes d'entrée — ne pas ouvrir la fenêtre sans ces deux feux verts.**

   a. Le test de migration doit passer :

   ```sh
   npx vitest run src/__tests__/ledger-migration.test.ts
   ```

   b. **Répétition à blanc sur une copie réelle.** Cette étape a déjà rattrapé
      un défaut fatal (`FOREIGN KEY constraint failed` au `COMMIT`, dû au
      `DELETE` implicite d'un `DROP TABLE` référencé, que
      `PRAGMA defer_foreign_keys` ne couvre pas). Elle est peu coûteuse et se
      joue sur un export frais, sans toucher à la base distante :

   ```sh
   wrangler d1 export h3-studios-db --remote --env production --output /tmp/prod-copy.sql
   # puis rejouer migrations/0020_cash_ledger.sql sur cette copie avec node:sqlite,
   # et vérifier que C1 retombe exactement sur P1, en appliquant la migration
   # DANS les deux modes : instruction par instruction, et dans un BEGIN…COMMIT.
   # Le comportement transactionnel de D1 sur un fichier de migration n'est pas
   # garanti : les deux modes doivent réussir.
   ```

1. Noter le bookmark Time Travel : c'est le vrai levier de rollback.

   ```sh
   # Staging
   wrangler d1 time-travel info h3-studios-db-staging --env staging

   # Production
   wrangler d1 time-travel info h3-studios-db --env production
   ```

2. Faire une archive de secours avec `wrangler d1 export`. Un `d1 import`
     n'écrase pas une base non vide : ce n'est donc pas un outil de restauration.

   ```sh
   # Staging
   wrangler d1 export h3-studios-db-staging --remote --env staging --output h3-ledger-backup-staging.sql

   # Production
   wrangler d1 export h3-studios-db --remote --env production --output h3-ledger-backup-production.sql
   ```

3. Exécuter les contrôles P1, P2, P3a, P3b, P3c et P4, chacun séparément avec
   `--command`, puis conserver leurs sorties.

   ```sh
   # Staging
   wrangler d1 execute h3-studios-db-staging --remote --env staging --command '<COMMANDE P1>'
   # Production
   wrangler d1 execute h3-studios-db --remote --env production --command '<COMMANDE P1>'
   # Répéter pour P2, P3a, P3b, P3c et P4.
   ```

4. Appliquer la migration :

   ```sh
   # Staging
   wrangler d1 migrations apply h3-studios-db-staging --remote --env staging

   # Production
   wrangler d1 migrations apply h3-studios-db --remote --env production
   ```

5. Exécuter C1 et C2 séparément avec `--command`. C1 doit être strictement
   égal à P1 et C2 doit renvoyer zéro ligne. Exécuter également C3, informatif.

   ```sh
   # Staging
   wrangler d1 execute h3-studios-db-staging --remote --env staging --command '<COMMANDE C1>'
   wrangler d1 execute h3-studios-db-staging --remote --env staging --command '<COMMANDE C2>'
   wrangler d1 execute h3-studios-db-staging --remote --env staging --command '<COMMANDE C3>'

   # Production
   wrangler d1 execute h3-studios-db --remote --env production --command '<COMMANDE C1>'
   wrangler d1 execute h3-studios-db --remote --env production --command '<COMMANDE C2>'
   wrangler d1 execute h3-studios-db --remote --env production --command '<COMMANDE C3>'
   ```

6. Déployer le worker déjà construit, sans rebuild :

   ```sh
   # Staging
   wrangler deploy --env staging

   # Production
   wrangler deploy --env production
   ```

7. **Recette à chaud, dans cet ordre (~4 min).** Aucune écriture de test en
   production : l'encaissement, le remboursement Stripe et le parcours de
   réservation de bout en bout se testent uniquement sur staging.

   1. `/admin/paiements` — les totaux d'entête sont identiques au pré-vol.
   2. `/admin/recouvrement` — le total à recouvrer est identique.
   3. `/admin` — sur un **mois clos**, le CA est identique à la valeur notée.
   4. Une réservation soldée affiche « Payé », reste 0. Une réservation
      partiellement payée affiche le reste exact. Une réservation annulée avec
      `keep_balance_due = 1` affiche « Paiement dû ». Une réservation
      intégralement remboursée affiche « Remboursé ».
   5. Une réservation 100 % remisée reste affichée comme payée, bien qu'elle
      n'ait plus aucun mouvement associé (voir `P3c`).

   Puis remettre `site.maintenance_mode` à `false`.

## Divergence de C1

- Écart entre une mesure historique et le pré-vol : il s'agit d'une activité
  légitime ; le pré-vol devient la référence.
- Écart entre le pré-vol et le post-migration : **blocage dur**. Ne pas
  investiguer en production ; effectuer immédiatement le rollback ci-dessous.

## Rollback impératif

Utiliser le bookmark noté à l'étape 1. L'ordre est obligatoire : restaurer
d'abord l'ancien worker, puis lui rendre son ancien schéma. Cela évite de
réactiver l'ancien code sur le nouveau schéma.

```sh
# Staging
wrangler rollback --env staging
wrangler d1 time-travel restore h3-studios-db-staging --remote --env staging --bookmark=<BOOKMARK>

# Production
wrangler rollback --env production
wrangler d1 time-travel restore h3-studios-db --remote --env production --bookmark=<BOOKMARK>
```

Répéter avec les paramètres staging ou production appropriés, sans jamais
inverser ces deux commandes.
