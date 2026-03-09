/**
 * Context window management for Claude API calls.
 *
 * Estimates token counts and trims conversation history / RAG chunks
 * to stay within the model's context budget.
 */

// Rough heuristic: 1 token ≈ 4 characters for English text.
// This is conservative (actual ratio is closer to 3.5), which is fine — better to over-trim than overflow.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Claude Sonnet 4.5: 200k context, 8k max output
const MODEL_CONTEXT_LIMIT = 200_000;
const MAX_OUTPUT_TOKENS = 4096;

// Budget: system prompt + RAG ≤ 60%, conversation history gets the rest minus output buffer
const SYSTEM_BUDGET_RATIO = 0.6;

interface ContextBudget {
  systemTokens: number;
  historyTokens: number;
  remainingForOutput: number;
  totalTokens: number;
  overBudget: boolean;
}

export function calculateBudget(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): ContextBudget {
  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0); // +4 per message overhead
  const totalTokens = systemTokens + historyTokens + MAX_OUTPUT_TOKENS;
  const remainingForOutput = MODEL_CONTEXT_LIMIT - systemTokens - historyTokens;

  return {
    systemTokens,
    historyTokens,
    remainingForOutput,
    totalTokens,
    overBudget: remainingForOutput < MAX_OUTPUT_TOKENS,
  };
}

/**
 * Trim conversation history to fit within the context window.
 * Keeps the most recent messages, dropping oldest first.
 * Always keeps at least the last message (the user's current input).
 */
export function trimHistory<T extends { role: string; content: string }>(
  systemPrompt: string,
  messages: T[],
  maxMessages = 50
): T[] {
  if (messages.length === 0) return messages;

  const systemTokens = estimateTokens(systemPrompt);
  const historyBudget = MODEL_CONTEXT_LIMIT - systemTokens - MAX_OUTPUT_TOKENS - 1000; // 1k safety buffer

  // Start with all messages (up to maxMessages)
  let trimmed = messages.slice(-maxMessages);

  // If within budget, return as-is
  let historyTokens = trimmed.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
  if (historyTokens <= historyBudget) return trimmed;

  // Drop oldest messages until we fit
  while (trimmed.length > 1 && historyTokens > historyBudget) {
    const removed = trimmed.shift()!;
    historyTokens -= estimateTokens(removed.content) + 4;
  }

  // If still over budget with just 1 message, truncate the message content
  if (historyTokens > historyBudget && trimmed.length === 1) {
    const maxChars = historyBudget * 4; // convert back to chars
    trimmed[0] = { ...trimmed[0], content: trimmed[0].content.slice(-maxChars) };
  }

  return trimmed;
}

/**
 * Cap RAG chunks to a maximum token budget.
 * Keeps the first N chunks that fit (they're already sorted by relevance).
 */
export function trimRagChunks<T extends { content: string }>(
  chunks: T[],
  maxTokens = 30_000,
  maxChunks = 10
): T[] {
  const result: T[] = [];
  let tokens = 0;

  for (const chunk of chunks.slice(0, maxChunks)) {
    const chunkTokens = estimateTokens(chunk.content);
    if (tokens + chunkTokens > maxTokens) break;
    result.push(chunk);
    tokens += chunkTokens;
  }

  return result;
}

// Token threshold for triggering auto-archival (70% of the history budget)
const ARCHIVE_THRESHOLD_RATIO = 0.7;

/**
 * Check if a conversation should be auto-archived based on message history size.
 */
export function shouldArchive(
  systemPromptTokens: number,
  messages: { role: string; content: string }[]
): boolean {
  const historyBudget = MODEL_CONTEXT_LIMIT - systemPromptTokens - MAX_OUTPUT_TOKENS - 1000;
  const archiveThreshold = historyBudget * ARCHIVE_THRESHOLD_RATIO;
  const historyTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
  return historyTokens > archiveThreshold;
}
