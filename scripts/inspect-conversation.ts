/**
 * Inspect a specific agent's conversations for debugging.
 * Usage: npx tsx scripts/inspect-conversation.ts "HR Advisor"
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

const agentName = process.argv[2] || "HR";

async function main() {
  // Find matching agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, github_enabled, asana_enabled")
    .ilike("name", `%${agentName}%`);

  if (!agents || agents.length === 0) {
    console.log(`No agents matching "${agentName}"`);
    return;
  }

  for (const agent of agents) {
    console.log(`\n=== Agent: ${agent.name} (${agent.id}) ===`);
    console.log(`  github_enabled: ${agent.github_enabled}, asana_enabled: ${agent.asana_enabled}`);

    // Find active conversations
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, archived, compaction_summary, updated_at")
      .eq("agent_id", agent.id)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(5);

    console.log(`  Active conversations: ${convs?.length || 0}`);

    for (const conv of convs || []) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, role, content, created_at, compacted_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      const total = msgs?.length || 0;
      const nonCompacted = (msgs || []).filter((m) => !m.compacted_at).length;
      const totalTokens = (msgs || []).reduce(
        (s, m) => s + Math.ceil(m.content.length / 3.2) + 4,
        0
      );
      const nonCompactedTokens = (msgs || [])
        .filter((m) => !m.compacted_at)
        .reduce((s, m) => s + Math.ceil(m.content.length / 3.2) + 4, 0);

      console.log(`\n  conv=${conv.id}`);
      console.log(`    total msgs: ${total}, non-compacted: ${nonCompacted}`);
      console.log(`    total tokens: ~${totalTokens}, non-compacted tokens: ~${nonCompactedTokens}`);
      console.log(`    has compaction_summary: ${!!conv.compaction_summary}`);
      console.log(`    updated_at: ${conv.updated_at}`);

      // Check if over threshold
      const MODEL_CONTEXT_LIMIT = 200_000;
      const historyBudget = MODEL_CONTEXT_LIMIT - 15_000 - 4096 - 4_000;
      const threshold = historyBudget * 0.7;
      if (nonCompactedTokens > threshold) {
        console.log(`    ⚠ OVER COMPACTION THRESHOLD (${Math.round(threshold)})`);
      }

      // Show all messages with role and preview
      console.log(`    --- Messages ---`);
      for (const m of msgs || []) {
        const compactedTag = m.compacted_at ? " [COMPACTED]" : "";
        const preview = m.content.slice(0, 150).replace(/\n/g, " ");
        console.log(
          `    [${m.role}]${compactedTag} ${preview}${m.content.length > 150 ? "..." : ""}`
        );
      }
    }
  }
}

main().catch(console.error);
