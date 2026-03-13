/**
 * One-time migration script: find all active conversations that exceed the
 * compaction token threshold and run compaction on them retroactively.
 *
 * Usage:
 *   npx tsx scripts/compact-long-conversations.ts
 *   npx tsx scripts/compact-long-conversations.ts --dry-run
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency)
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
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local — make sure you run from the project root.");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Config (mirrors lib/context-manager.ts + lib/compaction.ts) ────────
const MODEL_CONTEXT_LIMIT = 200_000;
const MAX_OUTPUT_TOKENS = 4096;
const SAFETY_BUFFER = 4_000;
const COMPACTION_TRIGGER_RATIO = 0.70;

// Rough estimate: conservative system prompt size for threshold check
const ESTIMATED_SYSTEM_PROMPT_TOKENS = 15_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`Compact long conversations — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Find all non-archived conversations that don't already have a compaction summary
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  if (convError) {
    console.error("Failed to fetch conversations:", convError);
    process.exit(1);
  }

  if (!conversations || conversations.length === 0) {
    console.log("No active conversations found.");
    return;
  }

  console.log(`Found ${conversations.length} active conversation(s). Checking token counts...\n`);

  const historyBudget =
    MODEL_CONTEXT_LIMIT - ESTIMATED_SYSTEM_PROMPT_TOKENS - MAX_OUTPUT_TOKENS - SAFETY_BUFFER;
  const threshold = historyBudget * COMPACTION_TRIGGER_RATIO;

  let compactedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const conv of conversations) {
    // Load all non-compacted messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conv.id)
      .is("compacted_at", null)
      .order("created_at", { ascending: true });

    if (msgError || !messages) {
      console.error(`  [ERROR] conv=${conv.id}: failed to load messages — ${msgError?.message}`);
      errorCount++;
      continue;
    }

    // Check token count
    const historyTokens = messages.reduce(
      (sum, m) => sum + estimateTokens(m.content) + 4,
      0
    );

    if (historyTokens <= threshold) {
      skippedCount++;
      continue; // Under threshold, skip
    }

    console.log(
      `  conv=${conv.id}: ${messages.length} msgs, ~${historyTokens} tokens (threshold: ${Math.round(threshold)}) — NEEDS COMPACTION`
    );

    if (dryRun) {
      compactedCount++;
      continue;
    }

    // Load existing compaction summary if any
    const { data: convRecord } = await supabase
      .from("conversations")
      .select("compaction_summary")
      .eq("id", conv.id)
      .single();

    const existingSummary = convRecord?.compaction_summary || null;

    // Take oldest 70% to compact
    if (messages.length < 6) {
      console.log(`    Skipping — too few messages (${messages.length})`);
      skippedCount++;
      continue;
    }

    const splitIdx = Math.ceil(messages.length * 0.7);
    const toCompact = messages.slice(0, splitIdx);

    // Build text for summarisation
    const parts: string[] = [];
    if (existingSummary) {
      parts.push(`[Previous compaction summary]\n${existingSummary}`);
    }
    for (const m of toCompact) {
      const label = m.role === "user" ? "User" : "Agent";
      parts.push(`${label}: ${m.content.slice(0, 2000)}`);
    }
    const textToSummarise = parts.join("\n\n");

    // Generate summary
    let summary: string;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "Summarise this conversation history concisely. Preserve: all key decisions made, " +
          "all facts and data discussed, all commitments and action items, the user's preferences " +
          "and instructions, and any report or tool outputs that were produced. Do not lose specific " +
          "details like names, dates, numbers, or task assignments. Drop verbose explanations, " +
          "redundant greetings, and raw tool invocation syntax — keep only results.",
        messages: [{ role: "user", content: textToSummarise.slice(0, 30_000) }],
      });
      summary = resp.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    } catch (err) {
      console.error(`    [ERROR] Summary generation failed:`, err);
      errorCount++;
      continue;
    }

    // Persist compaction summary on conversation
    const { error: updateErr } = await supabase
      .from("conversations")
      .update({
        compaction_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conv.id);

    if (updateErr) {
      console.error(`    [ERROR] Failed to update conversation:`, updateErr.message);
      errorCount++;
      continue;
    }

    // Mark compacted messages
    const compactedIds = toCompact.map((m) => m.id);
    const { error: markErr } = await supabase
      .from("messages")
      .update({ compacted_at: new Date().toISOString() })
      .in("id", compactedIds);

    if (markErr) {
      console.error(`    [ERROR] Failed to mark messages:`, markErr.message);
      errorCount++;
      continue;
    }

    console.log(
      `    Compacted ${toCompact.length}/${messages.length} msgs → summary ${summary.length} chars`
    );
    compactedCount++;

    // Small delay to avoid rate-limiting the Haiku API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n--- Done ---`);
  console.log(`  Compacted: ${compactedCount}`);
  console.log(`  Skipped (under threshold): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  if (dryRun) {
    console.log(`\n  This was a dry run. Run without --dry-run to apply changes.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
