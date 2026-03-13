/**
 * Chat compaction — summarise older messages when a conversation approaches
 * the context window limit.  The full history stays in the database for UI
 * display; compaction only affects the API payload sent to Claude.
 *
 * Flow:
 *  1. Before each API call, check if system prompt + history exceeds 70% of
 *     the model's context window.
 *  2. If so, take the oldest 70% of messages and summarise them via Claude.
 *  3. Store the summary on the conversation and mark those messages as compacted.
 *  4. When building the next API payload, prepend the compaction summary as a
 *     system-level context block and only include non-compacted messages.
 */

import { estimateTokens } from "./context-manager";
import { getAnthropicClient } from "./anthropic";

// Trigger compaction when history tokens exceed this fraction of the context window
const COMPACTION_TRIGGER_RATIO = 0.70;
const MODEL_CONTEXT_LIMIT = 200_000;
const MAX_OUTPUT_TOKENS = 4096;
const SAFETY_BUFFER = 4_000;

// ── Types ──────────────────────────────────────────────────────────────

export interface CompactableMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// ── Public helpers ─────────────────────────────────────────────────────

/**
 * Decide whether compaction should run for this conversation.
 */
export function shouldCompact(
  systemPromptTokens: number,
  messages: { content: string }[]
): boolean {
  const historyBudget =
    MODEL_CONTEXT_LIMIT - systemPromptTokens - MAX_OUTPUT_TOKENS - SAFETY_BUFFER;
  const threshold = historyBudget * COMPACTION_TRIGGER_RATIO;
  const historyTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4,
    0
  );
  return historyTokens > threshold;
}

/**
 * Run compaction: summarise the oldest 70% of messages and persist the result.
 *
 * Returns the compaction summary text (also written to the DB), or null if
 * compaction was skipped (e.g. too few messages).
 */
export async function compactConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  messages: CompactableMessage[],
  existingSummary: string | null
): Promise<string | null> {
  if (messages.length < 6) return null; // not enough to compact

  // Take the oldest 70 % of messages to summarise
  const splitIdx = Math.ceil(messages.length * 0.7);
  const toCompact = messages.slice(0, splitIdx);

  // Build the text that Claude will summarise
  const parts: string[] = [];

  // If there's already a compaction summary, include it so the new summary
  // incorporates prior context (keeps it to a single summary block).
  if (existingSummary) {
    parts.push(`[Previous compaction summary]\n${existingSummary}`);
  }

  for (const m of toCompact) {
    const label = m.role === "user" ? "User" : "Agent";
    // Keep generous content — the summariser handles length
    parts.push(`${label}: ${m.content.slice(0, 2000)}`);
  }

  const textToSummarise = parts.join("\n\n");

  // Generate summary via a fast, cheap model
  const anthropic = getAnthropicClient();
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
    console.error("[Compaction] Summary generation failed:", err);
    return null; // non-fatal — fall back to normal trimming
  }

  console.log(
    `[Compaction] conv=${conversationId} compacted ${toCompact.length}/${messages.length} msgs, ` +
      `summary ${summary.length} chars`
  );

  // Persist: update conversation with the new summary
  await supabase
    .from("conversations")
    .update({
      compaction_summary: summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // Mark the compacted messages
  const compactedIds = toCompact.map((m) => m.id);
  await supabase
    .from("messages")
    .update({ compacted_at: new Date().toISOString() })
    .in("id", compactedIds);

  return summary;
}

/**
 * Inject the compaction summary into the system prompt so that Claude has
 * context from earlier in the conversation.
 */
export function injectCompactionContext(
  systemPrompt: string,
  compactionSummary: string
): string {
  return (
    systemPrompt +
    "\n\n--- Earlier conversation context (compacted summary) ---\n" +
    compactionSummary +
    "\n--- End of compacted summary ---"
  );
}
