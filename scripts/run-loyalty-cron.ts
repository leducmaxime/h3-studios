/**
 * Déclenchement manuel one-shot de l'étape "codes fidélité" du cron.
 *
 * Le compte Cloudflare n'autorise pas `wrangler dev --remote` (session de
 * prévisualisation refusée), et un Worker déployé n'expose aucun déclencheur
 * HTTP pour son handler `scheduled`. Ce script rejoue donc *exactement* la
 * fonction `sendDueLoyaltyCodeEmails` de src/worker.tsx en branchant les vraies
 * fonctions de src/lib sur la D1 distante via l'API REST.
 *
 *   npx tsx scripts/run-loyalty-cron.ts --dry-run   # liste les candidats
 *   npx tsx scripts/run-loyalty-cron.ts --apply     # génère les codes + emails
 */
import { readFileSync } from "node:fs";
import {
  getDueLoyaltyCodeCandidates,
  claimLoyaltyCycleStart,
  createLoyaltyPromoCode,
  markLoyaltyPromoCodeNotified,
  addAuditLog,
} from "../src/lib/db";
import { sendLoyaltyCodeEmail } from "../src/lib/email";
import { COMPANY } from "../src/lib/company";

const ACCOUNT_ID = "f581acc7214b448e763b5ab2a14d8409";
const DATABASE_ID = "f621ac89-d8ec-42ce-ad5e-1467e629d799"; // h3-studios-db-staging

function readDevVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const match = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match) vars[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

/** Adaptateur minimal D1Database -> API REST D1 (prepare/bind/first/all/run). */
function createRemoteD1(token: string): any {
  const query = async (sql: string, params: unknown[]) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params }),
      },
    );
    const json = await response.json() as {
      success: boolean;
      errors?: Array<{ message: string }>;
      result?: Array<{ results: unknown[]; meta: Record<string, unknown> }>;
    };
    if (!json.success) {
      throw new Error(json.errors?.map((e) => e.message).join("; ") || "D1 query failed");
    }
    return json.result?.[0] ?? { results: [], meta: {} };
  };

  return {
    prepare(sql: string) {
      const run = (params: unknown[]) => ({
        async all() {
          const r = await query(sql, params);
          return { results: r.results, success: true, meta: r.meta };
        },
        async first() {
          const r = await query(sql, params);
          return (r.results[0] as unknown) ?? null;
        },
        async run() {
          const r = await query(sql, params);
          return { success: true, meta: r.meta };
        },
      });
      return { bind: (...params: unknown[]) => run(params), ...run([]) };
    },
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const vars = readDevVars();
  const token = vars.CLOUDFLARE_API_TOKEN;
  const resendKey = vars.RESEND_API_KEY;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN absent de .dev.vars");
  if (apply && !resendKey) throw new Error("RESEND_API_KEY absent de .dev.vars");

  const db = createRemoteD1(token);
  const candidates = await getDueLoyaltyCodeCandidates(db, 200);

  console.log(`\n${candidates.length} client(s) au palier :\n`);
  for (const c of candidates) {
    console.log(
      `  - ${c.name} <${c.email}> — ${c.cycleBookings}/${c.loyalty_threshold} réservations, ` +
      `remise ${c.loyalty_discount_value}${c.loyalty_discount_type === "fixed" ? "€" : "%"}, ` +
      `cycle jusqu'au ${c.cycleEnd}`,
    );
  }

  if (!apply) {
    console.log("\n[dry-run] Aucune écriture, aucun email. Relancer avec --apply.\n");
    return;
  }

  console.log("\n--- Application ---\n");
  let sent = 0, failed = 0, skipped = 0;

  // Réplique fidèle de sendDueLoyaltyCodeEmails (src/worker.tsx).
  for (const candidate of candidates) {
    if ((candidate.loyalty_discount_type !== "percentage" && candidate.loyalty_discount_type !== "fixed")
      || candidate.loyalty_discount_value <= 0
      || candidate.loyalty_threshold < 1
      || candidate.loyalty_code_validity_days <= 0) {
      skipped++;
      console.log(`  [skip] ${candidate.email} — configuration de remise invalide`);
      continue;
    }

    const claimed = await claimLoyaltyCycleStart(db, candidate.id, candidate.cycleEnd);
    if (!claimed) {
      skipped++;
      console.log(`  [skip] ${candidate.email} — cycle déjà réclamé`);
      continue;
    }

    let promo: Awaited<ReturnType<typeof createLoyaltyPromoCode>> | null = null;
    let result: { success: boolean; error?: string };
    try {
      promo = await createLoyaltyPromoCode(db, {
        userId: candidate.id,
        type: candidate.loyalty_discount_type,
        value: candidate.loyalty_discount_value,
        threshold: candidate.loyalty_threshold,
        cycleEnd: candidate.cycleEnd,
        validityDays: candidate.loyalty_code_validity_days,
      });
      result = await sendLoyaltyCodeEmail(resendKey!, {
        clientName: candidate.first_name || candidate.name.split(" ")[0] || candidate.name,
        clientEmail: candidate.email,
        code: promo.code,
        discountType: candidate.loyalty_discount_type,
        discountValue: candidate.loyalty_discount_value,
        scope: promo.scope === "first_booking" ? "first_booking" : "cart",
        threshold: candidate.loyalty_threshold,
        expiresAt: promo.expires_at || "",
        bookingUrl: `${COMPANY.siteUrl}/reservation`,
      });
      if (result.success) await markLoyaltyPromoCodeNotified(db, promo.id);
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }

    await addAuditLog(db, "user", candidate.id, "generate-loyalty-code", {
      threshold: candidate.loyalty_threshold,
      discountType: candidate.loyalty_discount_type,
      discountValue: candidate.loyalty_discount_value,
      cycleBookings: candidate.cycleBookings,
      cycleEnd: candidate.cycleEnd,
      promoCodeId: promo?.id ?? null,
      promoCode: promo?.code ?? null,
      success: result.success,
      error: result.error ?? null,
    }, "cron");

    if (result.success) {
      sent++;
      console.log(`  [ok] ${candidate.email} — code ${promo?.code}, expire le ${promo?.expires_at}`);
    } else {
      failed++;
      console.log(`  [échec] ${candidate.email} — ${result.error || "erreur inconnue"} (code ${promo?.code ?? "non créé"})`);
    }
  }

  console.log(`\nRésultat : ${sent} envoyé(s), ${failed} échec(s), ${skipped} ignoré(s).\n`);
}

main().catch((error) => {
  console.error("Échec :", error);
  process.exit(1);
});
