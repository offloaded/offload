import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, cleanResponse, buildPersonalityInstructions } from "./anthropic";
import { retrieveContext } from "./rag";

type MessageIntent = "casual" | "knowledge" | "action" | "search";

// ─── Exported helpers ──────────────────────────────────────────────────────

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
      new RegExp(`@${n}\\b`),
      new RegExp(`\\b${n},`),
      new RegExp(`\\b${n}\\?`),
      new RegExp(`how about you,?\\s+${n}\\b`),
      new RegExp(`what (about|do) you (think|say),?\\s+${n}\\b`),
      new RegExp(`${n}[,.]?\\s+(what|how|do|can|are|have|did)\\b`),
      new RegExp(`(you|your),?\\s+${n}\\b`),
    ];
    if (patterns.some((p) => p.test(lower))) {
      mentionedAgentIds.push(agent.id);
    }
  }

  return { isTeamWide, mentionedAgentIds };
}

// ─── Internal: parse [AgentName] blocks ───────────────────────────────────

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

// ─── Internal: follow-up detection ────────────────────────────────────────

export interface FollowUpTrigger {
  targetAgentIds: string[];
  askerAgentIds: string[];
  reason: string;
}

/**
 * Scan all agent response blocks for questions that need follow-up.
 *
 * @param hardExcludeIds     Agents who can never respond (original poster, etc.)
 * @param alreadyRespondedIds Agents who already responded this chain — excluded from
 *                            ambiguous targets ("you", "everyone") but CAN be targeted
 *                            if specifically @mentioned by name.
 */
export function detectFollowUpTriggers(
  responseText: string,
  allAgents: { id: string; name: string }[],
  hardExcludeIds: Set<string>,
  alreadyRespondedIds: Set<string>,
): FollowUpTrigger | null {
  const blocks = parseAgentBlocks(responseText);
  if (blocks.length === 0) return null;

  const targetIds = new Set<string>();
  const askerIds = new Set<string>();
  const reasons: string[] = [];

  for (const block of blocks) {
    if (!block.content.includes("?")) continue;
    const lower = block.content.toLowerCase();

    const asker = allAgents.find((a) => a.name === block.name);
    if (asker) askerIds.add(asker.id);

    // 1. Specific agent named — allow even if they already responded this round
    let foundSpecific = false;
    for (const agent of allAgents) {
      if (hardExcludeIds.has(agent.id)) continue;
      if (asker && agent.id === asker.id) continue;
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

    // 2. Ambiguous ("you", "everyone") — only target agents who haven't responded yet
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
        /\byou[?!]\s*$/,
        /\byou (think|feel|know|see|reckon)\b/,
        /\bhow'?s? (it going|everything going|things going) (with|for) you\b/,
        /\bhow (is|are|'?s) (everyone|the team|you all|you guys|we all)\b/,
        /\bwhat (do|does|did) everyone\b/,
        /\bwhat about (everyone|the team|you all|you guys)\b/,
        /\banyone (else|have|know|want|need)\b/,
        /\bany (thoughts|updates?|reactions?|questions?|feedback)\b/,
        /\blet me know if (anyone|anyone's)\b/,
      ];
      if (ambiguous.some((p) => p.test(lower))) {
        let added = 0;
        for (const agent of allAgents) {
          if (hardExcludeIds.has(agent.id)) continue;
          if (alreadyRespondedIds.has(agent.id)) continue; // skip already-responded for ambiguous
          if (asker && agent.id === asker.id) continue;
          targetIds.add(agent.id);
          added++;
        }
        if (added > 0) reasons.push(`${block.name} → ambiguous (${added} new agents)`);
      }
    }
  }

  if (targetIds.size === 0) return null;
  return { targetAgentIds: [...targetIds], askerAgentIds: [...askerIds], reason: reasons.join("; ") };
}

// ─── Internal: build per-agent group chat system prompt ───────────────────

type ContextChunk = {
  content: string;
  fileName: string;
  metadata?: { document_date?: string | null; section_heading?: string | null };
};

function buildGroupAgentSystemPrompt(
  agent: {
    name: string;
    purpose: string;
    verbosity?: number;
    initiative?: number;
    reactivity?: number;
    repetition_tolerance?: number;
    warmth?: number;
  },
  context: ContextChunk[],
  teamMemberNames: string[],
  docNames?: string[],
  scheduleInstructions?: string,
  priorResponses?: string,
  weight?: "full" | "brief"
): string {
  const otherMembers = teamMemberNames.filter((n) => n !== agent.name);
  const teamList = otherMembers.length > 0 ? otherMembers.join(", ") : "no other members";

  const personalityInstructions = buildPersonalityInstructions(agent);

  let prompt = `You are ${agent.name}, a member of a team group chat.

Your role: ${agent.purpose}

Team members you can address: ${teamList}. Address the user as @You.
When referencing someone, use @Name (e.g. @${otherMembers[0] ?? "Alice"}, @You). Never use markdown like **replies to Name** or "replies to".

${personalityInstructions ? `${personalityInstructions}\n\n` : "Write a concise, natural response (1-3 sentences) from your perspective.\n"}Do NOT prefix your response with your name or "[${agent.name}]".
NEVER wrap any name in square brackets like [SomeName]. NEVER speak as the user or prefix with [You].
Just write your natural response — the system adds attribution automatically.
Plain conversational text only — no markdown, no bold, no headers, no bullet lists.

CRITICAL: If you are asked a question, answer it directly from your own perspective and expertise. Do NOT redirect the question back to the group or ask others the same question. Do NOT say things like "Can everyone give me an update?" — instead, give YOUR OWN update or answer.`;

  if (docNames?.length) {
    prompt += `\n\nYour knowledge base: ${docNames.join(", ")}`;
  }

  if (context.length > 0) {
    prompt += `\n\nRelevant excerpts from your knowledge base:\n`;
    context.forEach((c, i) => {
      let header = `[${i + 1}] From "${c.fileName}"`;
      if (c.metadata?.document_date) header += ` (${c.metadata.document_date})`;
      if (c.metadata?.section_heading) header += ` — ${c.metadata.section_heading}`;
      prompt += `\n${header}:\n${c.content}`;
    });
    prompt += `\n\nReference relevant information from your knowledge base when applicable.`;
  }

  if (priorResponses) {
    prompt += `\n\nYour colleagues have already said:\n${priorResponses}\nDon't repeat what's been covered. If they answered well, a brief acknowledgement is fine. Focus on what only you can uniquely add from your role.`;
  }

  if (weight === "brief") {
    prompt += `\n\nKeep your response to 1 short sentence only — brief acknowledgement or small addition.`;
  }

  if (scheduleInstructions) {
    prompt += `\n\n${scheduleInstructions}`;
  }

  return prompt;
}

// ─── Internal: evaluate phase (cheap parallel calls) ──────────────────────

export type EvalResult = {
  agentId: string;
  respond: boolean;
  urgency: "high" | "medium" | "low";
  weight: "full" | "brief";
  reason: string;
};

export async function evaluateAgents(
  anthropic: Anthropic,
  agents: { id: string; name: string; purpose: string; initiative?: number }[],
  recentMessages: string[],
  newMessage: string
): Promise<EvalResult[]> {
  const contextText = recentMessages.length > 0
    ? `Recent conversation:\n${recentMessages.join("\n")}\n\n`
    : "";

  return Promise.all(
    agents.map(async (agent): Promise<EvalResult> => {
      const initiative = agent.initiative ?? 3;
      const initiativeNote =
        initiative <= 2
          ? "\nYour initiative is LOW — only set respond=true if the message is squarely in your core expertise and clearly needs your input. Default to not responding."
          : initiative >= 4
          ? "\nYour initiative is HIGH — you actively contribute. Set respond=true if you can add any value, even tangentially."
          : "";

      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 120,
          system: `You are a relevance classifier for a group chat. Reply with JSON only, no extra text:
{"respond": true/false, "urgency": "high|medium|low", "weight": "full|brief", "reason": "brief reason"}
urgency: high=core to their expertise/critical to answer, medium=useful contribution, low=tangential
weight: full=substantive response needed, brief=1 sentence acknowledgment only`,
          messages: [{
            role: "user",
            content: `You are ${agent.name}. Your role: ${agent.purpose.slice(0, 200)}.${initiativeNote}

${contextText}New message: "${newMessage}"

Should you respond? How urgently, and how much?`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const urgency = (["high", "medium", "low"].includes(parsed.urgency) ? parsed.urgency : "medium") as "high" | "medium" | "low";
          const weight = (parsed.weight === "brief" ? "brief" : "full") as "full" | "brief";
          return {
            agentId: agent.id,
            respond: Boolean(parsed.respond),
            urgency,
            weight,
            reason: String(parsed.reason || ""),
          };
        }
      } catch (err) {
        console.error(`[Evaluate] ${agent.name}:`, err);
      }
      return { agentId: agent.id, respond: false, urgency: "low", weight: "full", reason: "evaluation error" };
    })
  );
}

// ─── Internal: respond phase (full individual pipeline) ───────────────────

export async function generateAgentResponse(
  anthropic: Anthropic,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  agent: { id: string; name: string; purpose: string; verbosity?: number; initiative?: number; reactivity?: number; repetition_tolerance?: number; warmth?: number },
  messages: { role: "user" | "assistant"; content: string }[],
  plainMessage: string,
  docsByAgent: Map<string, string[]>,
  teamMemberNames: string[],
  scheduleInstructions?: string,
  priorResponses?: string,
  weight?: "full" | "brief"
): Promise<string> {
  let context: ContextChunk[] = [];
  if (docsByAgent.has(agent.id)) {
    try {
      context = await retrieveContext(supabase, agent.id, plainMessage, 5);
    } catch { /* non-fatal */ }
  }

  const systemPrompt = buildGroupAgentSystemPrompt(
    agent,
    context,
    teamMemberNames,
    docsByAgent.get(agent.id),
    scheduleInstructions,
    priorResponses,
    weight
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text as string)
    .join("")
    .trim();

  return cleanResponse(text);
}

// ─── History builder (shared) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildHistory(supabase: any, conversationId: string, limit = 20): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (history) history.reverse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawMessages = (history || []).map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  const messages: { role: "user" | "assistant"; content: string }[] = [];
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

  return messages;
}

// ─── Main orchestration function ──────────────────────────────────────────

/**
 * Self-selection group chat orchestration:
 * 1. Casual shortcut: cheap fast responses with no RAG for casual messages
 * 2. Evaluate phase: parallel Haiku calls to each agent for relevance check
 * 3. Respond phase: parallel Sonnet calls for selected agents with full RAG
 * 4. Follow-up detection: up to 2 rounds for agent-to-agent questions
 *
 * @param _respondedIds  Accumulates agent IDs that have responded across rounds.
 *                       Passed recursively to prevent duplicate responses in
 *                       ambiguous follow-up targeting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runGroupOrchestration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  conversationId: string,
  triggerMessage: string,
  excludeAgentId?: string | string[],
  _round = 0,
  _respondedIds = new Set<string>()
): Promise<void> {
  const LOG = `[GroupOrch r${_round}]`;
  console.log(`${LOG} triggered — conv=${conversationId} msg="${triggerMessage.slice(0, 80)}"`);

  // 1. Load agents
  const { data: allAgents } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (!allAgents?.length) {
    console.log(`${LOG} no agents found — aborting`);
    return;
  }

  const excludeIds = new Set<string>(
    Array.isArray(excludeAgentId) ? excludeAgentId : excludeAgentId ? [excludeAgentId] : []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = allAgents.filter((a: any) => !excludeIds.has(a.id));
  if (agents.length === 0) {
    console.log(`${LOG} no agents after exclusion — aborting`);
    return;
  }

  // 2. Parse message
  const plainText = triggerMessage.replace(/^\[[^\]]+\]\s*/, "").trim();

  // 3. Classify
  const { isTeamWide, mentionedAgentIds } = detectMessageAddressing(plainText, allAgents);
  const intent = classifyIntent(plainText);
  const effectiveIntent = isTeamWide && intent === "casual" ? "knowledge"
    : intent === "search" ? "knowledge"
    : intent;

  console.log(`${LOG} intent=${intent} effective=${effectiveIntent} isTeamWide=${isTeamWide} mentioned=${mentionedAgentIds.length}`);

  // 4. Load docs
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

  // 5. Build message history
  let messages: { role: "user" | "assistant"; content: string }[];
  if (_round > 0) {
    messages = [{ role: "user", content: triggerMessage }];
  } else {
    messages = await buildHistory(supabase, conversationId, 20);
    if (messages.length === 0) {
      messages.push({ role: "user", content: "[group chat]" });
      messages.push({ role: "assistant", content: triggerMessage });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMemberNames = allAgents.map((a: any) => a.name as string);
  const anthropic = getAnthropicClient();

  // 6. CASUAL SHORTCUT — no evaluate, no RAG, Haiku model
  if (effectiveIntent === "casual" && mentionedAgentIds.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored = agents
      .map((a: any) => ({ agent: a, score: scoreAgentRelevance(plainText, a) }))
      .sort((a: any, b: any) => b.score - a.score);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const casualAgents = scored.slice(0, Math.min(2, scored.length)).map((s: any) => s.agent);

    const responses = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      casualAgents.map(async (agent: any) => {
        const systemPrompt = buildGroupAgentSystemPrompt(agent, [], teamMemberNames, []);
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: systemPrompt,
          messages,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = response.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text as string)
          .join("")
          .trim();
        return `[${agent.name}] ${cleanResponse(text)}`;
      })
    );

    const combined = responses.filter((r) => r.trim()).join("\n");
    if (!combined) return;

    await supabase.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: combined });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    console.log(`${LOG} Casual: ${casualAgents.length} agent(s) responded`);
    return;
  }

  // 7. SELECT RESPONDING AGENTS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mentionedAgents = agents.filter((a: any) => mentionedAgentIds.includes(a.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonMentionedAgents = agents.filter((a: any) => !mentionedAgentIds.includes(a.id));

  let respondingAgents: typeof agents;

  if (_round > 0) {
    // Follow-up rounds: skip re-evaluation — these agents were explicitly targeted by
    // detectFollowUpTriggers. Having them evaluate would likely result in "no" since
    // they can see they've already contributed to the conversation.
    respondingAgents = agents;
    console.log(`${LOG} Follow-up round: ${agents.length} targeted agent(s) respond without re-evaluation`);
  } else {
    // EVALUATE PHASE — parallel cheap calls
    const recentForEval = messages.slice(-4).map(
      (m) => `${m.role === "user" ? "User" : "Team"}: ${m.content.slice(0, 150)}`
    );

    let evalResults: EvalResult[] = [];
    if (nonMentionedAgents.length > 0) {
      if (isTeamWide) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evalResults = nonMentionedAgents.map((a: any) => ({ agentId: a.id, respond: true, urgency: "medium" as const, weight: "full" as const, reason: "team-wide message" }));
        console.log(`${LOG} Team-wide: all ${agents.length} agents respond`);
      } else {
        evalResults = await evaluateAgents(anthropic, nonMentionedAgents, recentForEval, plainText);
        for (const r of evalResults) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const name = agents.find((a: any) => a.id === r.agentId)?.name ?? r.agentId;
          console.log(`${LOG} Eval: ${name} → ${r.respond ? "YES" : "NO"} (${r.reason})`);
        }
      }
    }

    const respondingIds = new Set<string>([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...mentionedAgents.map((a: any) => a.id as string),
      ...evalResults.filter((r) => r.respond).map((r) => r.agentId),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    respondingAgents = agents.filter((a: any) => respondingIds.has(a.id));
  }

  console.log(`${LOG} Responding: [${respondingAgents.map((a: any) => a.name).join(", ") || "none"}]`);

  if (respondingAgents.length === 0) {
    console.log(`${LOG} No agents selected — done`);
    return;
  }

  // 8. RESPOND PHASE — parallel full pipeline
  const agentResponses = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    respondingAgents.map(async (agent: any) => {
      const text = await generateAgentResponse(
        anthropic,
        supabase,
        agent,
        messages,
        plainText,
        docsByAgent,
        teamMemberNames
      );
      return `[${agent.name}] ${text}`;
    })
  );

  const combined = agentResponses.filter((r) => r.trim()).join("\n");
  if (!combined) {
    console.log(`${LOG} All responses empty — done`);
    return;
  }

  // 9. Save
  await supabase.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: combined });
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  console.log(`${LOG} Saved ${respondingAgents.length} agent response(s)`);

  // 10. FOLLOW-UP DETECTION — cap at 2 extra rounds
  if (_round < 2) {
    // Track who has responded across this entire chain (cumulative)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nowResponded = new Set<string>([..._respondedIds, ...respondingAgents.map((a: any) => a.id as string)]);

    const followUp = detectFollowUpTriggers(combined, allAgents, excludeIds, nowResponded);
    if (followUp) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetNames = allAgents.filter((a: any) => followUp.targetAgentIds.includes(a.id)).map((a: any) => a.name).join(", ");
      console.log(`${LOG} Follow-up → [${targetNames}] reason: ${followUp.reason}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextExclude = allAgents.filter((a: any) => !followUp.targetAgentIds.includes(a.id)).map((a: any) => a.id as string);
      await runGroupOrchestration(supabase, userId, conversationId, combined, nextExclude, _round + 1, nowResponded);
    } else {
      console.log(`${LOG} No follow-up triggers — conversation complete`);
    }
  }
}
