/**
 * Per-agent context windowing for team chats.
 *
 * Instead of sending every agent the full conversation history (which causes
 * role bleed, copying, and context overflow), build a tailored context window
 * for each agent containing:
 *
 *   1. The original user request that started the thread
 *   2. Summaries of other agents' contributions (1-2 sentences each)
 *   3. This agent's own previous messages (full text)
 *   4. The most recent user message (full text)
 *
 * Summaries are cached on the conversation record to avoid re-summarising.
 */

import Anthropic from "@anthropic-ai/sdk";
import { estimateTokens } from "./context-manager";

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
  agent_id?: string | null;
  agent_name?: string | null;
};

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
};

interface AgentSummaryCache {
  [agentId: string]: {
    summary: string;
    last_message_id: string;
  };
}

// ── Summary generation ──────────────────────────────────────────────

async function summariseContributions(
  anthropic: Anthropic,
  agentName: string,
  contents: string[]
): Promise<string> {
  const combined = contents.map((c, i) => `Message ${i + 1}: ${c}`).join("\n\n");
  // Cap input to avoid blowing the Haiku context
  const truncated = combined.slice(0, 15_000);

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system:
        "Summarise this agent's contributions in 2-3 sentences. " +
        "Preserve specific recommendations, data points, decisions, and action items. " +
        "Drop greetings, filler, and conversational noise. Be factual and concise.",
      messages: [
        {
          role: "user",
          content: `Agent "${agentName}" said:\n\n${truncated}`,
        },
      ],
    });
    return resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    console.error(`[AgentContext] Failed to summarise ${agentName}:`, err);
    // Fallback: take first 200 chars of latest message
    const latest = contents[contents.length - 1] || "";
    return latest.slice(0, 200) + (latest.length > 200 ? "..." : "");
  }
}

// ── Parse agent blocks from combined messages ───────────────────────

interface ParsedAgentBlock {
  agentName: string;
  content: string;
}

/**
 * Parse "[AgentName] content" blocks from combined assistant messages.
 * Team chat stores all agent responses in a single message as:
 *   "[Agent1] response text\n[Agent2] response text"
 */
function parseAgentBlocks(text: string): ParsedAgentBlock[] {
  const blocks: ParsedAgentBlock[] = [];
  const regex = /\[([^\]]+)\]\s*/g;
  let match: RegExpExecArray | null;
  const positions: { name: string; start: number; contentStart: number }[] = [];

  while ((match = regex.exec(text)) !== null) {
    positions.push({
      name: match[1],
      start: match.index,
      contentStart: match.index + match[0].length,
    });
  }

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].start : text.length;
    const content = text.slice(pos.contentStart, end).trim();
    if (content) {
      blocks.push({ agentName: pos.name, content });
    }
  }

  return blocks;
}

// ── Main context builder ────────────────────────────────────────────

/**
 * Build a per-agent context window for a team chat response.
 *
 * @param anthropic    - Anthropic client for summary generation
 * @param supabase     - DB client
 * @param targetAgent  - The agent we're building context for
 * @param allAgents    - All agents in the team (for name→id mapping)
 * @param conversationId - The conversation ID
 * @param rawMessages  - Full message history (with agent_id if available)
 * @param originalRequest - The user's original request that started the thread
 * @param latestUserMessage - The most recent user message
 * @param existingCache - Cached summaries from the conversation record
 * @returns The tailored message array and updated cache
 */
export async function buildAgentContext(
  anthropic: Anthropic,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  targetAgent: { id: string; name: string },
  allAgents: { id: string; name: string }[],
  conversationId: string,
  rawMessages: AgentMessage[],
  originalRequest: string,
  latestUserMessage: string,
  existingCache: AgentSummaryCache
): Promise<{ messages: ContextMessage[]; updatedCache: AgentSummaryCache }> {
  const LOG = "[AgentContext]";
  const agentNameToId = new Map<string, string>();
  for (const a of allAgents) {
    agentNameToId.set(a.name.toLowerCase(), a.id);
  }

  // ── Separate messages by agent ────────────────────────────────────
  // Agent messages may have agent_id set (new messages) or be combined
  // "[AgentName] text" blocks in a single assistant message (legacy)

  const ownContents: string[] = [];
  const otherByAgent = new Map<string, { name: string; contents: string[] }>();

  for (const msg of rawMessages) {
    if (msg.role === "user") continue;

    // New-style: agent_id is set on the message
    if (msg.agent_id) {
      if (msg.agent_id === targetAgent.id) {
        ownContents.push(msg.content);
      } else {
        const agentName = msg.agent_name || "Unknown";
        const existing = otherByAgent.get(msg.agent_id) || { name: agentName, contents: [] };
        existing.contents.push(msg.content);
        otherByAgent.set(msg.agent_id, existing);
      }
      continue;
    }

    // Legacy: parse "[AgentName] content" blocks from combined messages
    const blocks = parseAgentBlocks(msg.content);
    if (blocks.length === 0) {
      // Can't attribute — treat as context for everyone
      ownContents.push(msg.content);
      continue;
    }

    for (const block of blocks) {
      const blockAgentId = agentNameToId.get(block.agentName.toLowerCase());
      if (blockAgentId === targetAgent.id) {
        ownContents.push(block.content);
      } else if (blockAgentId) {
        const existing = otherByAgent.get(blockAgentId) || { name: block.agentName, contents: [] };
        existing.contents.push(block.content);
        otherByAgent.set(blockAgentId, existing);
      }
    }
  }

  // ── Build summaries for other agents (with caching) ───────────────
  const updatedCache: AgentSummaryCache = { ...existingCache };
  const summaryLines: string[] = [];

  const summaryPromises = Array.from(otherByAgent.entries()).map(
    async ([agentId, { name, contents }]) => {
      // Check cache — if we already summarised and no new messages, reuse
      const lastContent = contents[contents.length - 1];
      const contentHash = lastContent.slice(0, 50); // simple fingerprint
      const cached = existingCache[agentId];

      if (cached && cached.last_message_id === contentHash) {
        return { name, summary: cached.summary };
      }

      // Generate new summary
      const summary = await summariseContributions(anthropic, name, contents);
      updatedCache[agentId] = { summary, last_message_id: contentHash };
      return { name, summary };
    }
  );

  const summaryResults = await Promise.all(summaryPromises);
  for (const { name, summary } of summaryResults) {
    summaryLines.push(`[${name}: ${summary}]`);
  }

  console.log(
    `${LOG} Agent "${targetAgent.name}": own=${ownContents.length} msgs, ` +
      `others=${otherByAgent.size} agents summarised, ` +
      `cached=${Object.keys(existingCache).length}→${Object.keys(updatedCache).length}`
  );

  // ── Assemble the context window ───────────────────────────────────
  const contextMessages: ContextMessage[] = [];

  // 1. Original request
  contextMessages.push({
    role: "user",
    content: `The user asked: ${originalRequest}`,
  });

  // 2. Other agents' summaries (if any)
  if (summaryLines.length > 0) {
    contextMessages.push({
      role: "assistant",
      content: "Here's what the team has contributed so far:",
    });
    contextMessages.push({
      role: "user",
      content: `Team members' input:\n${summaryLines.join("\n")}`,
    });
  }

  // 3. This agent's own previous messages (full text, with alternating roles)
  if (ownContents.length > 0) {
    // Keep the most recent own messages that fit in budget
    const TOKEN_BUDGET_OWN = 20_000;
    let tokenCount = 0;
    const kept: string[] = [];
    for (let i = ownContents.length - 1; i >= 0; i--) {
      const tokens = estimateTokens(ownContents[i]);
      if (tokenCount + tokens > TOKEN_BUDGET_OWN) break;
      kept.unshift(ownContents[i]);
      tokenCount += tokens;
    }

    for (const content of kept) {
      // Ensure alternating roles — inject a user prompt before each assistant message
      const last = contextMessages[contextMessages.length - 1];
      if (last && last.role === "assistant") {
        contextMessages.push({ role: "user", content: "[continuation]" });
      }
      contextMessages.push({ role: "assistant", content });
    }
  }

  // 4. Latest user message
  const last = contextMessages[contextMessages.length - 1];
  if (last && last.role === "user" && last.content === latestUserMessage) {
    // Already included — skip
  } else {
    if (last && last.role === "user") {
      // Need an assistant message between two user messages
      contextMessages.push({ role: "assistant", content: "(acknowledged)" });
    }
    contextMessages.push({ role: "user", content: latestUserMessage });
  }

  // Ensure starts with user message
  while (contextMessages.length > 0 && contextMessages[0].role !== "user") {
    contextMessages.shift();
  }

  // Persist updated cache
  try {
    await supabase
      .from("conversations")
      .update({ agent_context_cache: updatedCache })
      .eq("id", conversationId);
  } catch (err) {
    console.error(`${LOG} Failed to persist cache:`, err);
  }

  return { messages: contextMessages, updatedCache };
}
