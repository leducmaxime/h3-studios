/**
 * Patches the generated dist/worker/wrangler.json to use the staging D1 database.
 * Run after `npm run build`, before `wrangler deploy --env staging`.
 */
import { readFileSync, writeFileSync } from "fs";

const configPath = "dist/worker/wrangler.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));

config.d1_databases = [
  {
    binding: "DB",
    database_name: "h3-studios-db-staging",
    database_id: "278d9c61-3c04-4107-9470-cd1c71ed43ef",
  },
];

writeFileSync(configPath, JSON.stringify(config));
console.log("✓ Patched dist/worker/wrangler.json with staging D1 database");
