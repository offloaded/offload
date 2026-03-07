import { getAnthropicClient, cleanResponse } from "./anthropic";
import { retrieveContext } from "./rag";

type MessageIntent = "casual" | "knowledge" | "action" | "search";

/**
 * Rule-based intent classifier — same logic used by the group chat route.
 * Exported so the group chat route can import it instead of duplicating it.
 */
export function classifyIntent(text: string): MessageIntent {
  const lower = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  const casualPatterns = [
    /^(hi|hello|hey|howdy|yo|morning|evening|afternoon)\b/,
    /^good (morning|afternoon|evening|day|night)\b/,
    /^(thanks|thank you|ty|cheers|thx|appreciate it)\b/,
    /^(bye|goodbye|see ya|cya|later|see you)\b/,
    /^(ok|okay|got it|noted|sure|sounds good|perfect|great|cool|nice|awesome|brilliant|yep|yup|nope|roger)\b/,
    /^(no worries|np|all good|no problem)\b/,
    /^how are (you|everyone|the team|things)\b/,
    /^how'?s? (everyone|it going|the team|things)\b/,
    /^what'?s? up\b/,
    /^(lol|haha|nice one)\b/,
  ];
  if (wordCount <= 12 && casualPatterns.some((p) => p.test(lower))) return "casual";

  if (/\b(latest|current (news|events?|status)|today'?s?|this (morning|week|month)|breaking|just (happened|announced|released)|news about|search (for|the)|look up|google|check online)\b/.test(lower)) {
    return "search";
  }

  if (/\b(schedule|remind\b|set (a |an )?(reminder|alarm|meeting|appointment)|draft|write (a |an |me )|send (a |an )?|book|set up|organi[sz]e|arrang[e]|cancel|reschedul|every (day|morning|evening|week|month|hour)|daily|weekly|monthly|at \d|tomorrow|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)|in \d+ (minute|hour|day|week)s?)\b/.test(lower)) {
    return "action";
  }

  return "knowledge";
}

/**
 * Score how relevant an agent is to a message using word overlap.
 * Exported so the group chat route can import it instead of duplicating it.
 */
export function scoreAgentRelevance(
  message: string,
  agent: { name: string; purpose: string }
): number {
  const msgWords = new Set(
    message.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 3)
  );
  if (msgWords.size === 0) return 0;

  let score = 0;
  const agentText = `${agent.name} ${agent.purpose}`.toLowerCase().replace(/[^\w\s]/g, " ");
  for (const w of agentText.split(/\s+/)) {
    if (w.length > 3 && msgWords.has(w)) score++;
  }
  if (message.toLowerCase().includes(agent.name.toLowerCase())) score += 5;
  return score;
}

/**
 * Run the full group chat orchestration after any message lands in a group
 * conversation — whether from a user, a scheduled task, or a cross-posted DM.
 *
 * Uses intent classification + RAG + the same system prompt structure as the
 * streaming group chat route, but writes results directly to the DB instead
 * of streaming them to a client.
 *
 * @param supabase        Supabase client (service or user-auth both work)
 * @param userId          Owner of the conversation
 * @param conversationId  The group chat conversation
 * @param triggerMessage  The message that was just posted (may have [AgentName] prefix)
 * @param excludeAgentId  ID of the agent who posted — skip them as a responder
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runGroupOrchestration(
  supabase: any,
  userId: string,
  conversationId: string,
  triggerMessage: string,
  excludeAgentId?: string
): Promise<void> {
  // 1. Load all agents, then exclude the one who just posted
  const { data: allAgents } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!allAgents || allAgents.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = excludeAgentId ? allAgents.filter((a: any) => a.id !== excludeAgentId) : allAgents;
  if (agents.length === 0) return;

  // 2. Load recent conversation history (newest-first limit, then reverse)
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (history) history.reverse();

  const messages: { role: "user" | "assistant"; content: string }[] = (history || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({ role: m.role as "user" | "assistant", content: m.content })
  );

  // 3. Classify intent on the plain text (strip [AgentName] prefix if present)
  const plainText = triggerMessage.replace(/^\[[^\]]+\]\s*/, "").trim();
  const intent = classifyIntent(plainText);

  // 4. RAG retrieval for relevant agents (knowledge/action intents only)
  const { data: allDocs } = await supabase
    .from("documents")
    .select("agent_id, file_name")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in("agent_id", agents.map((a: any) => a.id))
    .eq("status", "ready");

  const docsByAgent = new Map<string, string[]>();
  for (const doc of allDocs || []) {
    const list = docsByAgent.get(doc.agent_id) || [];
    list.push(doc.file_name);
    docsByAgent.set(doc.agent_id, list);
  }

  const agentContextMap = new Map<string, { content: string; fileName: string; metadata?: { document_date?: string | null; section_heading?: string | null } }[]>();

  if (intent === "knowledge" || intent === "action") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentsWithDocs = agents.filter((a: any) => docsByAgent.has(a.id));
    if (agentsWithDocs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scored = agentsWithDocs.map((a: any) => ({ agent: a, score: scoreAgentRelevance(plainText, a) })).sort((a: any, b: any) => b.score - a.score);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relevant = scored.filter((s: any) => s.score > 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentsToRetrieve: any[] = relevant.length > 0 ? relevant.map((s: any) => s.agent) : agentsWithDocs;

      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agentsToRetrieve.map(async (a: any) => {
          try {
            const ctx = await retrieveContext(supabase, a.id, plainText, 5);
            if (ctx.length > 0) agentContextMap.set(a.id, ctx);
          } catch {
            // RAG failure is non-fatal
          }
        })
      );
    }
  }

  // 5. Build system prompt
  let systemPrompt: string;

  if (intent === "casual") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentList = agents.map((a: any) => `- ${a.name} (id: ${a.id}, color: ${a.color}): ${a.purpose}`).join("\n");

    systemPrompt = `You are managing a team of ${agents.length} AI agents in a group chat. A message was just posted. Decide if any agents should respond.

Your team:
${agentList}

RULES:
1. Have 0-2 agents respond with 1 short sentence each.
2. If the message doesn't warrant a response, output exactly: [no reactions]
3. Format every response as: [Agent Name] their message
4. Every line must start with [Agent Name]. No markdown. Plain conversational text only.`;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentDescriptions = agents.map((a: any) => {
      const shortPurpose = a.purpose.length > 120 ? a.purpose.slice(0, 120).trimEnd() + "..." : a.purpose;
      let desc = `- ${a.name} (id: ${a.id}, color: ${a.color}): ${shortPurpose}`;
      const docNames = docsByAgent.get(a.id);
      if (docNames && docNames.length > 0) desc += `\n  Documents: ${docNames.join(", ")}`;
      const ctx = agentContextMap.get(a.id);
      if (ctx && ctx.length > 0) {
        desc += `\n  Relevant knowledge base excerpts for ${a.name}:`;
        ctx.forEach((c, i) => {
          let header = `From "${c.fileName}"`;
          if (c.metadata?.document_date) header += ` (${c.metadata.document_date})`;
          if (c.metadata?.section_heading) header += ` — ${c.metadata.section_heading}`;
          desc += `\n  [${i + 1}] ${header}: ${c.content}`;
        });
      }
      return desc;
    }).join("\n\n");

    systemPrompt = `You are the Operations Manager for a team of AI agents in a group chat. A message was just posted. Decide which agents should respond.

Your team:
${agentDescriptions}

IMPORTANT RULES:
1. Decide which agent(s) should respond. You may have 0-3 agents respond.
2. If the message isn't relevant to any agent's domain and doesn't invite discussion, respond with exactly: [no reactions]
3. Format EACH agent's response on its own line, prefixed with their exact name in brackets:
   [Agent Name] Their response text here.
4. Each agent should respond in character — concise, professional, as a colleague. Never use markdown formatting. No **bold** or *italic*. No # headers. No bullet lists. Plain conversational text only. Never output XML tags.
5. Do NOT add any text outside of the [Agent Name] format. Every line must start with [Agent Name].
6. Keep responses concise — 1-3 sentences each.
7. When an agent has knowledge base excerpts provided above, they should reference and use that information.

TEAM COLLABORATION:
8. Agents are colleagues, not isolated responders. They can tag each other for follow-up.
9. Build on the conversation context. Don't repeat what was already said.`;
  }

  // 6. Call Claude
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const rawText = response.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)
    .join("");

  const cleaned = cleanResponse(rawText).trim();

  if (!cleaned || /^\[no reactions\]$/i.test(cleaned) || cleaned.toLowerCase().includes("[no reactions]")) {
    return;
  }

  // 7. Save responses to the conversation
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: cleaned,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
