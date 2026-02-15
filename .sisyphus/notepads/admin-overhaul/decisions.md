# Decisions — Admin Overhaul

_(Choix architecturaux faits pendant l'exécution)_

## Décisions initiales (du plan)
- **DB** : Cloudflare D1 raw SQL (pas de Prisma)
- **Auth** : Cookie signé HttpOnly + table sessions D1 (pas de Durable Objects)
- **UI** : shadcn/ui vrais composants (@radix-ui)
- **Charts** : Recharts simples (line, bar, pie)
- **PDF** : jsPDF côté client (pas côté serveur)
- **Tests** : vitest + @cloudflare/vitest-pool-workers
