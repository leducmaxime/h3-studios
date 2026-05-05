# Rapport d'analyse — Déploiement Cloudflare H3 Studios

**Date :** 5 mai 2026  
**Compte Cloudflare :** H3.studio.musique@gmail.com  
**Account ID :** `f581acc7214b448e763b5ab2a14d8409`

---

## 🔴 Problèmes critiques

### 1. Bases D1 inexistantes sur le compte

La configuration `wrangler.jsonc` référence deux bases D1 :

| Environnement | Nom | ID configuré | Existe sur le compte ? |
|---------------|-----|--------------|------------------------|
| Top-level (fallback) | `h3-studios-db` | `8a1d88d0-d741-4367-91c9-bbcf4b719b9b` | ❌ NON |
| Staging | `h3-studios-db-staging` | `278d9c61-3c04-4107-9470-cd1c71ed43ef` | ❌ NON |
| Production | *(hérite du top-level)* | `8a1d88d0-d741-4367-91c9-bbcf4b719b9b` | ❌ NON |

**Conséquence :** Le déploiement échouera ou le worker plantera au runtime dès qu'il essaiera d'accéder à `env.DB`.

### 2. R2 Buckets — Aucun bucket créé

`wrangler r2 bucket list` retourne une liste vide. Si l'application stocke des images ou fichiers, cette infrastructure est manquante.

### 3. KV Namespaces — Aucun namespace

`wrangler kv namespace list` retourne `[]`. Si l'application utilise KV pour du cache ou de la configuration, c'est absent.

### 4. Secrets — Configuration minimale

Un seul secret existe : `TMP_WORKER_CREATED`. Aucun secret métier (Stripe, auth, etc.) n'est configuré.

### 5. Script `patch-staging-config.mjs` — Contournement fragile

Ce script modifie le `wrangler.json` généré après le build pour injecter la DB staging. Cela indique que le processus de build ne gère pas correctement les environnements. C'est une dette technique qui risque de casser à chaque mise à jour de wrangler.

---

## 🟡 Anomalies de configuration

### `wrangler.jsonc`

```jsonc
{
  "name": "h3-studios",           // ← top-level
  "account_id": "f581acc7214b448e763b5ab2a14d8409",
  // ...
  "d1_databases": [
    { "binding": "DB", "database_name": "h3-studios-db", "database_id": "8a1d88d0-d741-4367-91c9-bbcf4b719b9b" }
  ],
  "env": {
    "staging": {
      "name": "h3-studios-staging",
      "d1_databases": [
        { "binding": "DB", "database_name": "h3-studios-db-staging", "database_id": "278d9c61-3c04-4107-9470-cd1c71ed43ef" }
      ]
    },
    "production": {
      "name": "h3-studios",
      // ← PAS de d1_databases ici ! Hérite du top-level
    }
  }
}
```

**Problèmes :**
- Le top-level définit une DB qui n'existe pas
- L'environnement `production` n'a pas sa propre DB explicite
- Le build génère un `wrangler.json` qui ignore les sections `env` (d'où le besoin du script patch)

### `package.json` — Scripts de déploiement

```json
"release:staging": "npm run clean && npm run build && node scripts/patch-staging-config.mjs && wrangler deploy --config dist/worker/wrangler.json --env staging",
"release:prod": "npm run clean && npm run build && wrangler deploy --config dist/worker/wrangler.json"
```

**Problème :** `release:prod` n'utilise pas `--env production`, ce qui signifie qu'il déploie avec la config top-level (qui a la mauvaise DB).

---

## 🟢 Éléments qui fonctionnent

- Authentification wrangler : OK (token API valide)
- Build : OK (le worker compile, ~2.2MB)
- Dry-run : OK (wrangler accepte la config et simule le déploiement)
- Assets : OK (le binding ASSETS est configuré)

---

## 📋 Plan d'action

### Phase 1 — Créer les ressources manquantes

```bash
# 1. Créer la base D1 de production
wrangler d1 create h3-studios-db
# → Noter le nouveau database_id

# 2. Créer la base D1 de staging
wrangler d1 create h3-studios-db-staging
# → Noter le nouveau database_id
```

### Phase 2 — Corriger la configuration

1. **Mettre à jour `wrangler.jsonc`** avec les nouveaux `database_id`
2. **Ajouter explicitement `d1_databases` dans l'environnement `production`**
3. **Supprimer le script `patch-staging-config.mjs`**
4. **Corriger `release:prod`** pour utiliser `--env production`

### Phase 3 — Migrer les données (si ancien compte accessible)

```bash
# Depuis l'ancien compte
wrangler d1 export h3-studios-db --remote --output=prod-backup.sql
wrangler d1 export h3-studios-db-staging --remote --output=staging-backup.sql

# Vers le nouveau compte
wrangler d1 execute h3-studios-db --remote --file=prod-backup.sql
wrangler d1 execute h3-studios-db-staging --remote --file=staging-backup.sql
```

### Phase 4 — Configurer les secrets

```bash
# À adapter selon les besoins réels
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put STRIPE_SECRET_KEY --env staging
wrangler secret put ADMIN_PASSWORD_HASH --env production
wrangler secret put ADMIN_PASSWORD_HASH --env staging
# etc.
```

### Phase 5 — Déployer et tester

```bash
pnpm check      # Vérifier les types
pnpm build      # Build
pnpm release:staging   # Déployer staging
pnpm release:prod      # Déployer production
```

---

## ❓ Questions ouvertes

1. **Ancien compte :** As-tu encore accès à l'ancien compte Cloudflare pour exporter les données D1 ?
2. **Secrets :** Quels secrets l'application utilise-t-elle ? (Stripe, auth admin, clés API, etc.)
3. **R2 / KV :** L'application utilise-t-elle R2 (images) ou KV (cache) ?
4. **Domaines :** Quels sont les domaines de production et de staging ?

---

*Rapport généré automatiquement. À valider avant mise en œuvre.*
