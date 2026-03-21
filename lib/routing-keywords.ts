import { getAnthropicClient } from "./anthropic";
import { createServiceSupabase } from "./supabase-server";

// ─── Generate routing keywords for an agent ────────────────────────

export async function generateRoutingKeywords(agent: {
  id: string;
  name: string;
  role?: string | null;
  purpose?: string | null;
  custom_system_prompt?: string | null;
}): Promise<string[]> {
  const client = getAnthropicClient();

  // Gather knowledge base doc titles
  const service = createServiceSupabase();
  const { data: docs } = await service
    .from("documents")
    .select("file_name")
    .eq("agent_id", agent.id)
    .eq("status", "ready");

  const docTitles = (docs || []).map((d: { file_name: string }) => d.file_name);

  const prompt = `Given this agent's configuration, generate 20-30 routing keywords and short phrases that describe the types of work this agent should handle. Return as a JSON array of strings. Be specific — include domain terms, document types, and common phrases someone would use when sending work to this agent.

Agent name: ${agent.name}
Role: ${agent.role || "N/A"}
System prompt: ${(agent.custom_system_prompt || agent.purpose || "").slice(0, 1000)}
Knowledge base topics: ${docTitles.length > 0 ? docTitles.join(", ") : "None"}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Extract JSON array from response (may be wrapped in markdown)
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const keywords = JSON.parse(match[0]) as string[];
      return keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    }
  } catch {
    console.error("[RoutingKeywords] Failed to parse keyword response:", text.slice(0, 200));
  }

  return [];
}

// ─── Save generated keywords to the agent ────────────────────────

export async function updateAgentKeywords(agentId: string, keywords: string[]): Promise<void> {
  const service = createServiceSupabase();
  await service
    .from("agents")
    .update({
      routing_keywords: keywords,
      keywords_updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);
}

// ─── Generate and save keywords (fire-and-forget helper) ────────

export async function generateAndSaveKeywords(agent: {
  id: string;
  name: string;
  role?: string | null;
  purpose?: string | null;
  custom_system_prompt?: string | null;
}): Promise<void> {
  try {
    const keywords = await generateRoutingKeywords(agent);
    if (keywords.length > 0) {
      await updateAgentKeywords(agent.id, keywords);
      console.log(`[RoutingKeywords] Generated ${keywords.length} keywords for agent "${agent.name}"`);
    }
  } catch (err) {
    console.error(`[RoutingKeywords] Failed to generate keywords for agent "${agent.name}":`, err);
  }
}

// ─── Match a work item against agents using keywords ─────────────

export interface KeywordMatchResult {
  agent_id: string;
  agent_name: string;
  score: number;
  matched_keywords: string[];
}

export function matchWorkItemToAgents(
  searchText: string,
  agents: Array<{
    id: string;
    name: string;
    routing_keywords: string[] | null;
  }>
): KeywordMatchResult[] {
  const lowerSearch = searchText.toLowerCase();

  const results: KeywordMatchResult[] = agents.map((agent) => {
    const keywords = agent.routing_keywords || [];
    if (keywords.length === 0) {
      return { agent_id: agent.id, agent_name: agent.name, score: 0, matched_keywords: [] };
    }

    const matched = keywords.filter((kw) => lowerSearch.includes(kw));
    const score = matched.length / keywords.length;

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      score,
      matched_keywords: matched,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Route a work item to an agent using keyword matching.
 * Returns the best agent if confidence threshold is met, null otherwise.
 */
export function routeByKeywords(
  searchText: string,
  agents: Array<{
    id: string;
    name: string;
    routing_keywords: string[] | null;
  }>
): KeywordMatchResult | null {
  const results = matchWorkItemToAgents(searchText, agents);

  if (results.length === 0) return null;

  const top = results[0];
  const second = results.length > 1 ? results[1] : null;

  // Must score above 0.15 (15% keyword match)
  if (top.score < 0.15) return null;

  // Must score at least 2x the second highest agent
  if (second && second.score > 0 && top.score < second.score * 2) return null;

  return top;
}

// ─── Nightly keyword refinement ──────────────────────────────────

export async function refineAgentKeywords(agentId: string): Promise<{
  before: string[];
  after: string[];
} | null> {
  const service = createServiceSupabase();

  // Get the agent's current keywords
  const { data: agent } = await service
    .from("agents")
    .select("id, name, routing_keywords")
    .eq("id", agentId)
    .single();

  if (!agent) return null;

  const currentKeywords: string[] = agent.routing_keywords || [];

  // Get the first user message from each conversation in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations } = await service
    .from("conversations")
    .select("id")
    .eq("agent_id", agentId)
    .gte("updated_at", thirtyDaysAgo);

  if (!conversations || conversations.length === 0) return null;

  const convIds = conversations.map((c) => c.id);

  // Get first user message from each conversation
  const firstMessages: string[] = [];
  for (const convId of convIds.slice(0, 50)) {
    const { data: msg } = await service
      .from("messages")
      .select("content")
      .eq("conversation_id", convId)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (msg?.content) {
      firstMessages.push(msg.content.slice(0, 300));
    }
  }

  // Also include manual assignment data (positive signal: assigned TO this agent)
  const { data: manualAssignments } = await service
    .from("manual_assignments")
    .select("work_item_title, work_item_instructions")
    .eq("agent_id", agentId)
    .gte("assigned_at", thirtyDaysAgo);

  const assignmentTopics = (manualAssignments || []).map((a) =>
    `${a.work_item_title || ""} ${(a.work_item_instructions || "").slice(0, 200)}`
  ).filter(Boolean);

  // Negative signal: work items reassigned AWAY from this agent
  const { data: reassignedAway } = await service
    .from("manual_assignments")
    .select("work_item_title, work_item_instructions")
    .eq("previous_agent_id", agentId)
    .gte("assigned_at", thirtyDaysAgo);

  const reassignedAwayTopics = (reassignedAway || []).map((a) =>
    `${a.work_item_title || ""} ${(a.work_item_instructions || "").slice(0, 200)}`
  ).filter(Boolean);

  if (firstMessages.length === 0 && assignmentTopics.length === 0 && reassignedAwayTopics.length === 0) return null;

  // Extract topics via Haiku
  const client = getAnthropicClient();

  const allTopics = [...firstMessages, ...assignmentTopics];

  const topicResponse = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Extract the main topics and request types from these user messages/work items. Return as a JSON array of short topic strings.\n\nMessages:\n${allTopics.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
    }],
  });

  const topicText = topicResponse.content[0].type === "text" ? topicResponse.content[0].text : "";
  let extractedTopics: string[] = [];
  try {
    const match = topicText.match(/\[[\s\S]*\]/);
    if (match) extractedTopics = JSON.parse(match[0]);
  } catch {
    // non-fatal
  }

  if (extractedTopics.length === 0) return null;

  // Refine keywords
  const refineResponse = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Here are the topics and requests from recent conversations with this agent. Update the routing keywords to better reflect what users actually bring to this agent. Keep the original domain keywords but add new ones based on real usage patterns. Remove keywords that never appear in real conversations. Return as a JSON array of 20-40 strings.

Current keywords: ${JSON.stringify(currentKeywords)}
Recent conversation topics: ${JSON.stringify(extractedTopics)}
Manual assignments (work items users specifically directed to this agent — positive signal, add keywords for these): ${assignmentTopics.length > 0 ? assignmentTopics.join("; ") : "None"}
Reassigned away (work items initially routed to this agent but the user moved them elsewhere — negative signal, remove or deprioritise keywords that only match these): ${reassignedAwayTopics.length > 0 ? reassignedAwayTopics.join("; ") : "None"}`,
    }],
  });

  const refineText = refineResponse.content[0].type === "text" ? refineResponse.content[0].text : "";

  try {
    const match = refineText.match(/\[[\s\S]*\]/);
    if (match) {
      const newKeywords = (JSON.parse(match[0]) as string[])
        .map((k) => k.toLowerCase().trim())
        .filter(Boolean);

      if (newKeywords.length > 0) {
        await updateAgentKeywords(agent.id, newKeywords);
        return { before: currentKeywords, after: newKeywords };
      }
    }
  } catch {
    console.error("[RoutingKeywords] Failed to parse refinement response");
  }

  return null;
}
