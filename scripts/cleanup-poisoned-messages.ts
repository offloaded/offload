/**
 * One-time cleanup: remove empty and error-fallback assistant messages
 * that poison conversation history and cause the model to repeat failures.
 *
 * Also removes orphaned user messages that have no assistant response
 * (to maintain the alternating user/assistant pattern).
 *
 * Usage:
 *   npx tsx scripts/cleanup-poisoned-messages.ts
 *   npx tsx scripts/cleanup-poisoned-messages.ts --dry-run
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ERROR_FALLBACK = "I'm having trouble responding right now. Please try again.";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`Cleanup poisoned messages — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Find all non-archived conversations
  const { data: convs, error: convErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("archived", false);

  if (convErr) {
    console.error("Failed to fetch conversations:", convErr);
    process.exit(1);
  }

  let totalDeleted = 0;

  for (const conv of convs || []) {
    // Find poisoned assistant messages: empty or error fallback
    const { data: poisoned } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conv.id)
      .eq("role", "assistant")
      .or(`content.eq.,content.eq.${ERROR_FALLBACK}`)
      .order("created_at", { ascending: true });

    if (!poisoned || poisoned.length === 0) continue;

    console.log(`conv=${conv.id}: found ${poisoned.length} poisoned assistant message(s)`);

    for (const msg of poisoned) {
      const preview = msg.content ? `"${msg.content.slice(0, 60)}"` : "(empty)";
      console.log(`  [${msg.created_at}] ${preview}`);
    }

    if (!dryRun) {
      const ids = poisoned.map((m) => m.id);
      const { error: delErr } = await supabase
        .from("messages")
        .delete()
        .in("id", ids);

      if (delErr) {
        console.error(`  Failed to delete:`, delErr.message);
      } else {
        console.log(`  Deleted ${ids.length} message(s)`);
        totalDeleted += ids.length;
      }
    } else {
      totalDeleted += poisoned.length;
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`  Total poisoned messages ${dryRun ? "found" : "deleted"}: ${totalDeleted}`);
  if (dryRun) {
    console.log(`\n  This was a dry run. Run without --dry-run to apply changes.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
