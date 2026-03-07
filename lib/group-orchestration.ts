import { getAnthropicClient, cleanResponse } from "./anthropic";
import { retrieveContext } from "./rag";

type MessageIntent = "casual" | "knowledge" | "action" | "search";

// ─── Exported helpers (also used by the streaming group chat route) ────────

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

  if (/\b(latest (news|events?|updates?)|current (news|events?)|today'?s? (news|events?|updates?|headlines?|market|prices?|scores?)|this (morning|week|month)'?s? (news|updates?|headlines?)|breaking( news)?|just (happened|announced|released)|news about|search (for|the) (?!web)|look up|google|check online)\b/.test(lower)) {
    return "search";
  }

  if (/\b(schedule|remind\b|set (a |an )?(reminder|alarm|meeting|appointment)|draft|write (a |an |me )|send (a |an )?|book|set up|organi[sz]e|arrang[e]|cancel|reschedul|every (day|morning|evening|week|month|hour)|daily|weekly|monthly|at \d|tomorrow|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)|in \d+ (minute|hour|day|week)s?)\b/.test(lower)) {
    return "action";
  }

  return "knowledge";
}

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

// ─── Addressing detection ──────────────────────────────────────────────────

/**
 * Exported for use in the streaming group chat route.
 * Analyse a message to determine:
 *   - isTeamWide: whether the message is addressed to everyone (standup,
 *     "hey team", "what are you all working on", etc.)
 *   - mentionedAgentIds: agents explicitly named or @mentioned in the message
 */
export function detectMessageAddressing(
  text: string,
  agents: { id: string; name: string }[]
): { isTeamWide: boolean; mentionedAgentIds: string[] } {
  const lower = text.toLowerCase();

  const isTeamWide = [
    /\b(team|everyone|everybody|all|folks|group|y'all|you all|you guys)\b/,
    /\b(standup|stand[\s-]?up|status update|check[\s-]?in|daily|weekly sync|sprint)\b/,
    /what (are|have|is) (you|everyone|the team|we) (all )?(working on|doing|up to|blocked on|shipping|building)\b/,
    /any (updates?|blockers?|issues?|news|progress|impediments?)\b/,
    /how (is|are) (everyone|the team|things|you all|we all)\b/,
    /what'?s? (everyone|the team|going on|new|the status)\b/,
    /\b(go around|round the room|each of you|all of you)\b/,
  ].some((p) => p.test(lower));

  const mentionedAgentIds: string[] = [];
  for (const agent of agents) {
    const n = agent.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`@${n}\\b`),                                         // @Name
      new RegExp(`\\b${n},`),                                         // "Name," direct address
      new RegExp(`\\b${n}\\?`),                                       // "Name?"
      new RegExp(`how about you,?\\s+${n}\\b`),                      // "how about you, Name"
      new RegExp(`what (about|do) you (think|say),?\\s+${n}\\b`),    // "what do you think, Name"
      new RegExp(`${n}[,.]?\\s+(what|how|do|can|are|have|did)\\b`),  // "Name, what..."
      new RegExp(`(you|your),?\\s+${n}\\b`),                         // "you, Name" or "your Name"
    ];
    if (patterns.some((p) => p.test(lower))) {
      mentionedAgentIds.push(agent.id);
    }
  }

  return { isTeamWide, mentionedAgentIds };
}

/** Split a multi-agent response into individual [AgentName] content blocks. */
function parseAgentBlocks(text: string): { name: string; content: string }[] {
  const blocks: { name: string; content: string }[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]\s*(.*)/);
    if (m) {
      blocks.push({ name: m[1], content: m[2] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].content += " " + line.trim();
    }
  }
  return blocks.filter((b) => b.content.trim());
}

interface FollowUpTrigger {
  /** Agents who should be invited to respond in the next round. */
  targetAgentIds: string[];
  /** The agent(s) who asked — excluded from responding to their own questions. */
  askerAgentIds: string[];
  reason: string;
}

/**
 * Parse the batch of agent responses and determine if any follow-up is needed.
 *
 * Key differences from the old version:
 * - Does NOT filter by "already responded" — Bob can reply even if he spoke earlier
 * - Detects ambiguous "you" / "how about you" / "what do you think" patterns
 *   and targets every available agent when no name is specified
 * - Only the ASKING agent is excluded from the follow-up (not all responders)
 */
function detectFollowUpTriggers(
  responseText: string,
  allAgents: { id: string; name: string }[],
  alwaysExcludeIds: Set<string>,  // original poster(s) — never respond
): FollowUpTrigger | null {
  const blocks = parseAgentBlocks(responseText);
  if (blocks.length === 0) return null;

  const targetIds = new Set<string>();
  const askerIds = new Set<string>();
  const reasons: string[] = [];

  for (const block of blocks) {
    if (!block.content.includes("?")) continue;       // no question, skip
    const lower = block.content.toLowerCase();

    const asker = allAgents.find((a) => a.name === block.name);
    if (asker) askerIds.add(asker.id);

    // 1. Specific agent named in the question
    let foundSpecific = false;
    for (const agent of allAgents) {
      if (alwaysExcludeIds.has(agent.id)) continue;
      if (asker && agent.id === asker.id) continue;   // don't target yourself
      const n = agent.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const specific = [
        new RegExp(`@${n}\\b`),
        new RegExp(`\\b${n}[,?!]`),
        new RegExp(`\\b${n}[,.]?\\s+(what|how|do|can|are|have|did|is|any|got)\\b`),
        new RegExp(`(how about|what about|anything from),?\\s*${n}\\b`),
      ];
      if (specific.some((p) => p.test(lower))) {
        targetIds.add(agent.id);
        foundSpecific = true;
        reasons.push(`${block.name} → @${agent.name}`);
      }
    }

    // 2. Ambiguous "you" or team-wide — address every available agent when no name was found
    if (!foundSpecific) {
      const ambiguous = [
        /\bhow about you\b/,
        /\bwhat (do|about) you (think|say|reckon)\b/,
        /\banything (from your end|from you|on your end)\b/,
        /\byour (thoughts|take|view|perspective)\b/,
        /\bwhat'?s? your\b/,
        /\bhow (is|are|about) you\b/,
        /\bwhat about you\b/,
        /\bwith you\b/,
        /\byou[?!]\s*$/,             // ends "...with you?" or "...you!"
        /\byou (think|feel|know|see|reckon)\b/,
        /\bhow'?s? (it going|everything going|things going) (with|for) you\b/,
        // Team-wide follow-up patterns
        /\bhow (is|are|'?s) (everyone|the team|you all|you guys|we all)\b/,
        /\bwhat (do|does|did) everyone\b/,
        /\bwhat about (everyone|the team|you all|you guys)\b/,
        /\banyone (else|have|know|want|need)\b/,
        /\bany (thoughts|updates?|reactions?|questions?|feedback)\b/,
        /\blet me know if (anyone|anyone's)\b/,
      ];
      if (ambiguous.some((p) => p.test(lower))) {
        for (const agent of allAgents) {
          if (alwaysExcludeIds.has(agent.id)) continue;
          if (asker && agent.id === asker.id) continue;
          targetIds.add(agent.id);
        }
        reasons.push(`${block.name} → ambiguous "you" (all agents)`);
      }
    }
  }

  if (targetIds.size === 0) return null;
  return { targetAgentIds: [...targetIds], askerAgentIds: [...askerIds], reason: reasons.join("; ") };
}

// ─── Main orchestration function ──────────────────────────────────────────

/**
 * Run the full group chat orchestration after any message lands in a group
 * conversation — whether from a user, a scheduled task, or a cross-posted DM.
 *
 * @param supabase           Supabase client (service or user-auth both work)
 * @param userId             Owner of the conversation
 * @param conversationId     The group chat conversation
 * @param triggerMessage     The message that was just posted (may have [AgentName] prefix)
 * @param excludeAgentId     Agent(s) who posted — skip them as responders
 * @param _round             Internal recursion guard (do not pass from callers)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runGroupOrchestration(
  supabase: any,
  userId: string,
  conversationId: string,
  triggerMessage: string,
  excludeAgentId?: string | string[],
  _round = 0
): Promise<void> {
  const LOG = `[GroupOrchestration r${_round}]`;
  console.log(`${LOG} triggered — conv=${conversationId} exclude=${JSON.stringify(excludeAgentId ?? "none")} msg="${triggerMessage.slice(0, 80)}"`);

  // 1. Load all agents, then exclude the poster(s)
  const { data: allAgents } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!allAgents || allAgents.length === 0) {
    console.log(`${LOG} no agents found — aborting`);
    return;
  }

  const excludeIds = new Set<string>(
    Array.isArray(excludeAgentId) ? excludeAgentId : excludeAgentId ? [excludeAgentId] : []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = allAgents.filter((a: any) => !excludeIds.has(a.id));
  if (agents.length === 0) {
    console.log(`${LOG} no agents remain after exclusion — aborting`);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log(`${LOG} ${agents.length} potential responder(s): ${agents.map((a: any) => a.name).join(", ")}`);

  // 2. Extract the poster's name from the [AgentName] prefix, if present
  const posterMatch = triggerMessage.match(/^\[([^\]]+)\]/);
  const posterName = posterMatch ? posterMatch[1] : null;

  // 3. Classify intent and detect addressing on the plain text
  const plainText = triggerMessage.replace(/^\[[^\]]+\]\s*/, "").trim();
  const { isTeamWide, mentionedAgentIds } = detectMessageAddressing(plainText, allAgents);
  const intent = classifyIntent(plainText);

  // Team-wide questions override casual fast-path so ALL agents respond.
  // Search intent degrades to knowledge since orchestration has no web search.
  const effectiveIntent = intent === "casual" && isTeamWide ? "knowledge"
    : intent === "search" ? "knowledge"
    : intent;

  console.log(`${LOG} intent=${intent} effectiveIntent=${effectiveIntent} isTeamWide=${isTeamWide} mentioned=${mentionedAgentIds.length}`);

  // 4. Build messages array for Claude's API
  // Claude requires alternating roles starting with "user".
  //
  // For round 0: load DB history (all-assistant), prepend a "[group chat]" user stub,
  //   merge consecutive same-role messages. This gives Claude full context.
  //
  // For follow-up rounds (_round > 0): the DB history is "complete" — every agent
  //   already responded in the prior round. If we send it all as one giant assistant
  //   turn, Claude sees nothing to respond to and returns empty. Instead, present the
  //   triggerMessage (the prior round's responses, which contain the follow-up question)
  //   as the user turn so Claude has a clear question to answer.
  let messages: { role: "user" | "assistant"; content: string }[];

  if (_round > 0) {
    // Follow-up round: just the trigger as the question to respond to
    messages = [{ role: "user", content: triggerMessage }];
  } else {
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (history) history.reverse();

    const rawMessages = (history || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({ role: m.role as "user" | "assistant", content: m.content as string })
    );

    messages = [];
    for (const msg of rawMessages) {
      if (messages.length === 0) {
        if (msg.role === "assistant") messages.push({ role: "user", content: "[group chat]" });
        messages.push(msg);
      } else {
        const last = messages[messages.length - 1];
        if (last.role === msg.role) {
          last.content += "\n" + msg.content;
        } else {
          messages.push(msg);
        }
      }
    }
    if (messages.length === 0) {
      messages.push({ role: "user", content: "[group chat]" });
      messages.push({ role: "assistant", content: triggerMessage });
    }
  }

  console.log(`${LOG} messages=${messages.length} first_role=${messages[0]?.role}`);

  // 5. RAG retrieval for relevant agents (knowledge/action only)
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

  if (effectiveIntent === "knowledge" || effectiveIntent === "action") {
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
          } catch { /* non-fatal */ }
        })
      );
    }
  }

  // 6. Build system prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentDescriptions = agents.map((a: any) => {
    const shortPurpose = a.purpose.length > 120 ? a.purpose.slice(0, 120).trimEnd() + "..." : a.purpose;
    let desc = `- ${a.name} (id: ${a.id}, color: ${a.color}): ${shortPurpose}`;
    const docNames = docsByAgent.get(a.id);
    if (docNames?.length) desc += `\n  Documents: ${docNames.join(", ")}`;
    const ctx = agentContextMap.get(a.id);
    if (ctx?.length) {
      desc += `\n  Relevant excerpts for ${a.name}:`;
      ctx.forEach((c, i) => {
        let header = `From "${c.fileName}"`;
        if (c.metadata?.document_date) header += ` (${c.metadata.document_date})`;
        if (c.metadata?.section_heading) header += ` — ${c.metadata.section_heading}`;
        desc += `\n  [${i + 1}] ${header}: ${c.content}`;
      });
    }
    return desc;
  }).join("\n\n");

  // Build the response requirement instruction based on addressing type
  let responseRequirement: string;
  if (isTeamWide) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentNames = agents.map((a: any) => a.name).join(", ");
    responseRequirement = `MANDATORY: This message is addressed to the ENTIRE team. EVERY agent listed must respond — ${agentNames}. No agent may be skipped or omitted. Each gives their individual update or answer.`;
  } else if (mentionedAgentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mentionedNames = agents.filter((a: any) => mentionedAgentIds.includes(a.id)).map((a: any) => a.name);
    const otherNames = mentionedNames.join(", ");
    responseRequirement = `MANDATORY: The following agents were directly addressed by name and MUST respond: ${otherNames}. Other agents may also chime in briefly if they have relevant input, but the named agents must reply first.`;
  } else if (effectiveIntent === "casual") {
    responseRequirement = `1-2 agents respond with a brief, natural reply. If the message clearly doesn't need a response, output exactly: [no reactions]`;
  } else {
    responseRequirement = `1-3 agents respond based on relevance to their domain. If no agent has anything relevant to add, output exactly: [no reactions]`;
  }

  const posterContext = posterName
    ? `\nThis message was posted by ${posterName}. When the message says "you" or asks a question, it is directed at the listed agents.`
    : "";

  const systemPrompt = `You are the Operations Manager for a team of AI agents in a group chat. A message was just posted and you must generate responses from the appropriate agents.${posterContext}

Your team:
${agentDescriptions}

RESPONSE REQUIREMENT:
${responseRequirement}

FORMAT RULES (strictly enforced):
- Format EACH agent's response on its own line: [Agent Name] Their response here.
- Every line MUST start with [Agent Name]. No text outside that format.
- Plain conversational text only. No markdown, no **bold**, no # headers, no bullet lists. No XML tags.
- Each response: 1-4 sentences, concise and in-character.
- When an agent has knowledge excerpts, they should reference that information.
- Agents are colleagues — they can tag others for follow-up (e.g. "@Bob what do you think?") but keep it natural.`;

  // 7. Call Claude
  console.log(`${LOG} calling Claude — isTeamWide=${isTeamWide} mentionedIds=${mentionedAgentIds.length} system=${systemPrompt.length}chars`);
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
  console.log(`${LOG} Claude response (${cleaned.length}chars): "${cleaned.slice(0, 150)}"`);

  if (!cleaned || /^\[no reactions\]$/i.test(cleaned) || cleaned.toLowerCase().includes("[no reactions]")) {
    console.log(`${LOG} no reactions — skipping save`);
    return;
  }

  // 8. Save responses
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: cleaned,
  });
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  console.log(`${LOG} responses saved to conv=${conversationId}`);

  // 9. Multi-round follow-up — cap at 2 extra rounds total.
  if (_round < 2) {
    console.log(`${LOG} Checking for follow-up triggers in agent responses...`);
    const followUp = detectFollowUpTriggers(cleaned, allAgents, excludeIds);

    if (followUp) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetNames = allAgents.filter((a: any) => followUp.targetAgentIds.includes(a.id)).map((a: any) => a.name).join(", ");
      console.log(`${LOG} Follow-up triggered — targets: [${targetNames}] reason: ${followUp.reason}`);

      // Exclude everyone EXCEPT targeted agents (so only they can respond).
      // Also exclude the askers so they don't answer their own questions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextExclude = allAgents
        .filter((a: any) => !followUp.targetAgentIds.includes(a.id))
        .map((a: any) => a.id as string);

      await runGroupOrchestration(supabase, userId, conversationId, cleaned, nextExclude, _round + 1);
    } else {
      console.log(`${LOG} No follow-up triggers found — conversation complete`);
    }
  }
}
