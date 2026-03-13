/**
 * Audit: scan for consecutive same-role messages in all conversations.
 * Usage: npx tsx scripts/audit-consecutive-messages.ts
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

async function main() {
  // Get all conversations
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, agent_id, archived")
    .order("updated_at", { ascending: false });

  let totalConsecutive = 0;
  let affectedConvs = 0;
  const details: Array<{ convId: string; archived: boolean; pairs: number; examples: string[] }> = [];

  for (const conv of convs || []) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    if (!msgs || msgs.length < 2) continue;

    let pairs = 0;
    const examples: string[] = [];
    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i].role === msgs[i - 1].role) {
        pairs++;
        if (examples.length < 3) {
          examples.push(
            `  [${msgs[i - 1].role}] "${msgs[i - 1].content.slice(0, 60)}..." → [${msgs[i].role}] "${msgs[i].content.slice(0, 60)}..."`
          );
        }
      }
    }

    if (pairs > 0) {
      totalConsecutive += pairs;
      affectedConvs++;
      details.push({ convId: conv.id, archived: conv.archived, pairs, examples });
    }
  }

  console.log(`\n=== Consecutive Same-Role Message Audit ===\n`);
  console.log(`Total consecutive pairs: ${totalConsecutive}`);
  console.log(`Affected conversations: ${affectedConvs}`);
  console.log(`Total conversations scanned: ${convs?.length || 0}\n`);

  for (const d of details) {
    console.log(`conv=${d.convId} (${d.archived ? "archived" : "active"}): ${d.pairs} pair(s)`);
    for (const ex of d.examples) {
      console.log(ex);
    }
    console.log();
  }
}

main().catch(console.error);
