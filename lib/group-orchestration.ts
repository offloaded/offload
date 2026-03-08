import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, cleanResponse, buildStyleInstructions } from "./anthropic";
import { retrieveContext } from "./rag";
import { isStandupQuestion, getAgentActivitySummary } from "./activity";

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
  // Standup questions look casual but need the full pipeline for activity context
  if (isStandupQuestion(lower)) return "knowledge";
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
    // "What are your top risks?" / "What's your take?" — plural "your" implying the whole group
    /what (are|is|were) your\b/,
    /what'?s? your\b/,
    // "Give me your X" / "Share your X" — soliciting from the group
    /\b(give|share|tell|show) me your\b/,
    // "I'd like to hear from everyone" / "thoughts?"
    /\b(hear from|input from|feedback from) (everyone|the team|each|all)\b/,
    /\bthoughts\?/,
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
  const LOG = "[FollowUp]";
  const blocks = parseAgentBlocks(responseText);
  console.log(`${LOG} Scanning ${blocks.length} block(s) for follow-up triggers. Already responded: [${[...alreadyRespondedIds].map((id) => allAgents.find((a) => a.id === id)?.name ?? id).join(", ")}]`);
  if (blocks.length === 0) {
    console.log(`${LOG} No [AgentName] blocks found in response text`);
    return null;
  }

  const targetIds = new Set<string>();
  const askerIds = new Set<string>();
  const reasons: string[] = [];

  for (const block of blocks) {
    const hasQuestion = block.content.includes("?");
    console.log(`${LOG} Block [${block.name}]: hasQuestion=${hasQuestion} content="${block.content.slice(0, 120)}"`);
    if (!hasQuestion) continue;
    const lower = block.content.toLowerCase();

    const asker = allAgents.find((a) => a.name === block.name);
    if (asker) askerIds.add(asker.id);

    // 1. Specific agent named — allow even if they already responded this round
    let foundSpecific = false;
    for (const agent of allAgents) {
      if (hardExcludeIds.has(agent.id)) continue;
      if (asker && agent.id === asker.id) continue;
      const n = agent.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Also match role-based references like "governance perspective", "from a X standpoint"
      const roleStem = agent.name.toLowerCase().replace(/\b(advisor|manager|lead|officer|specialist|analyst|director|consultant)\b/gi, "").trim();
      const specific = [
        new RegExp(`@${n}\\b`),
        new RegExp(`\\b${n}[,?!]`),
        new RegExp(`\\b${n}[,.]?\\s+(what|how|do|can|are|have|did|is|any|got)\\b`),
        new RegExp(`(how about|what about|anything from),?\\s*${n}\\b`),
        // Role-based matching: "from a governance perspective", "on your radar"
        ...(roleStem.length > 3 ? [new RegExp(`\\b${roleStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(perspective|standpoint|side|angle|view)\\b`)] : []),
      ];
      const matchedPattern = specific.find((p) => p.test(lower));
      if (matchedPattern) {
        targetIds.add(agent.id);
        foundSpecific = true;
        reasons.push(`${block.name} → @${agent.name}`);
        console.log(`${LOG}   Specific match: ${block.name} → ${agent.name} (pattern: ${matchedPattern.source})`);
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
        /\bon your radar\b/,
        /\bwhat (are|is) your\b/,
      ];
      const matchedAmbiguous = ambiguous.find((p) => p.test(lower));
      if (matchedAmbiguous) {
        let added = 0;
        for (const agent of allAgents) {
          if (hardExcludeIds.has(agent.id)) continue;
          if (alreadyRespondedIds.has(agent.id)) continue; // skip already-responded for ambiguous
          if (asker && agent.id === asker.id) continue;
          targetIds.add(agent.id);
          added++;
        }
        if (added > 0) {
          reasons.push(`${block.name} → ambiguous (${added} new agents)`);
          console.log(`${LOG}   Ambiguous match: ${block.name} → ${added} new agents (pattern: ${matchedAmbiguous.source})`);
        } else {
          console.log(`${LOG}   Ambiguous match found but all eligible agents already responded`);
        }
      } else {
        console.log(`${LOG}   Question detected but no specific or ambiguous pattern matched`);
      }
    }
  }

  console.log(`${LOG} Result: ${targetIds.size} target(s) [${[...targetIds].map((id) => allAgents.find((a) => a.id === id)?.name ?? id).join(", ")}]`);
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
    working_style?: string[] | null;
    communication_style?: string[] | null;
    voice_profile?: string | null;
    soft_skills?: { skill: string; confidence: string; note?: string }[] | null;
    team_expectations?: { expectation: string; category?: string }[] | null;
  },
  context: ContextChunk[],
  teamMemberNames: string[],
  docNames?: string[],
  scheduleInstructions?: string,
  priorResponses?: string,
  weight?: "full" | "brief",
  activitySummary?: string,
  teamExpectationsContext?: string,
  channelContext?: { channelName: string; channelDescription?: string }
): string {
  const otherMembers = teamMemberNames.filter((n) => n !== agent.name);
  const teamList = otherMembers.length > 0 ? otherMembers.join(", ") : "no other members";

  const styleInstructions = buildStyleInstructions(agent);

  const channelLabel = channelContext
    ? `the #${channelContext.channelName} channel`
    : "the #All channel (the main group chat with all agents)";
  const channelNote = channelContext?.channelDescription
    ? ` This channel is for: ${channelContext.channelDescription}.`
    : "";
  const membersNote = channelContext
    ? ` Only members of the ${channelContext.channelName} team are in this channel.`
    : " Every agent on the team is in this channel.";

  let prompt = `You are ${agent.name}, responding in ${channelLabel}.${channelNote}${membersNote}

Your role: ${agent.purpose}

Team members in this channel: ${teamList}. Address the user as @You.
When referencing someone, use @Name (e.g. @${otherMembers[0] ?? "Alice"}, @You). Never use markdown like **replies to Name** or "replies to".

${styleInstructions ? `${styleInstructions}\n\n` : "Write a concise, natural response (1-3 sentences) from your perspective.\n"}Do NOT prefix your response with your name or "[${agent.name}]".
NEVER wrap any name in square brackets like [SomeName]. NEVER speak as the user or prefix with [You].
Just write your natural response — the system adds attribution automatically.
Plain conversational text only — no markdown, no bold, no headers, no bullet lists.

CRITICAL: If you are asked a question, answer it directly from your own perspective and expertise. Do NOT redirect the question back to the group or ask others the same question. Do NOT say things like "Can everyone give me an update?" — instead, give YOUR OWN update or answer.

Never @mention yourself or address yourself. You ARE yourself — just give your update directly.

Don't tag every agent asking them to respond. Give your own update and let others respond naturally. The system will prompt other agents to contribute — that's not your job.

CONTEXT: Only respond to the MOST RECENT message in the conversation. Ignore older topics that have already been discussed and resolved. If the latest message asks about risks, respond about risks — do not reference or answer questions from earlier in the conversation.`;

  if (agent.voice_profile) {
    prompt += `\n\nTONE OF VOICE: Communicate in this style: ${agent.voice_profile} Match this tone and approach in every response.`;
  }

  if (agent.soft_skills && agent.soft_skills.length > 0) {
    const skillsList = agent.soft_skills
      .map((s) => `- ${s.skill} (${s.confidence})${s.note ? ` — ${s.note}` : ""}`)
      .join("\n");
    prompt += `\n\nYOUR SOFT SKILLS:\n${skillsList}\nLean into these strengths when responding.`;
  }

  if (agent.team_expectations && agent.team_expectations.length > 0) {
    const expList = agent.team_expectations
      .map((e) => `- ${e.expectation}`)
      .join("\n");
    prompt += `\n\nYOUR WORKING STANDARDS:\n${expList}\nFollow these expectations in every response.`;
  }

  if (teamExpectationsContext) {
    prompt += `\n\n${teamExpectationsContext}`;
  }

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

  if (activitySummary) {
    prompt += `\n\n${activitySummary}\n\nIMPORTANT: When asked about what you're working on, your status, progress, blockers, or for a standup update, answer ONLY from the activity summary above. Your purpose statement describes what you CAN do — the activity summary describes what you ARE doing. If you have no recent activity, say so honestly ("Nothing active on my end right now. Let me know if there's something I can pick up."). Do NOT fabricate work or talk generically about your role.`;
  }

  if (priorResponses) {
    prompt += `\n\nYour colleagues have already said:\n${priorResponses}\nDo NOT repeat what's been covered — not even in different words. If they answered well and you have nothing new to add, a single brief acknowledgement is fine. Focus ONLY on what you can uniquely add from your role. If your prior response is shown above, do NOT restate it.`;
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
  agents: { id: string; name: string; purpose: string; working_style?: string[] | null }[],
  recentMessages: string[],
  newMessage: string
): Promise<EvalResult[]> {
  const contextText = recentMessages.length > 0
    ? `Recent conversation:\n${recentMessages.join("\n")}\n\n`
    : "";

  return Promise.all(
    agents.map(async (agent): Promise<EvalResult> => {
      const isProactive = agent.working_style?.includes("Proactive") ?? false;

      // Check if this agent already spoke in the recent context
      const alreadySpoke = recentMessages.some((m) =>
        m.includes(`[${agent.name}]`) || m.startsWith(`Team: [${agent.name}]`)
      );

      let reEngagementNote = "";
      if (alreadySpoke) {
        reEngagementNote = isProactive
          ? "\nYou have ALREADY responded. As a proactive agent, you may respond again if you have genuinely NEW information, a new angle, or a useful follow-up question. Do NOT restate what you already said."
          : "\nYou have ALREADY responded. Only respond again if you are directly @mentioned, asked a direct question, or have something genuinely new to add.";
      }

      const evalPrompt = `You are ${agent.name}. Your role: ${agent.purpose.slice(0, 200)}.${reEngagementNote}

${contextText}New message: "${newMessage}"

Should you respond? Consider: Is this relevant to your role? Would your expertise add value?${alreadySpoke ? " Remember you already responded — only say yes if you have something NEW." : " When in doubt, respond — it's better to contribute than stay silent."}`;

      console.log(`[Evaluate] ${agent.name}: alreadySpoke=${alreadySpoke} proactive=${isProactive}`);

      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 120,
          system: `You are a relevance classifier for a group chat. Reply with JSON only, no extra text:
{"respond": true/false, "urgency": "high|medium|low", "weight": "full|brief", "reason": "brief reason"}
respond: true if the message is relevant to the agent's role and they can contribute meaningfully
urgency: high=directly about their expertise, medium=relevant contribution, low=tangential but useful
weight: full=substantive response needed, brief=1 sentence acknowledgment
Default to respond=true if the topic touches their area of expertise.`,
          messages: [{
            role: "user",
            content: evalPrompt,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
        console.log(`[Evaluate] ${agent.name} raw response: ${text}`);
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const urgency = (["high", "medium", "low"].includes(parsed.urgency) ? parsed.urgency : "medium") as "high" | "medium" | "low";
          const weight = (parsed.weight === "brief" ? "brief" : "full") as "full" | "brief";
          const result = {
            agentId: agent.id,
            respond: Boolean(parsed.respond),
            urgency,
            weight,
            reason: String(parsed.reason || ""),
          };
          console.log(`[Evaluate] ${agent.name}: respond=${result.respond} urgency=${result.urgency} weight=${result.weight} reason="${result.reason}"`);
          return result;
        }
        console.log(`[Evaluate] ${agent.name}: NO JSON found in response, defaulting to respond=false`);
      } catch (err) {
        console.error(`[Evaluate] ${agent.name}: ERROR`, err);
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
  agent: { id: string; name: string; purpose: string; working_style?: string[] | null; communication_style?: string[] | null; voice_profile?: string | null; soft_skills?: { skill: string; confidence: string; note?: string }[] | null; team_expectations?: { expectation: string; category?: string }[] | null },
  messages: { role: "user" | "assistant"; content: string }[],
  plainMessage: string,
  docsByAgent: Map<string, string[]>,
  teamMemberNames: string[],
  scheduleInstructions?: string,
  priorResponses?: string,
  weight?: "full" | "brief",
  userId?: string,
  teamExpectationsContext?: string,
  channelContext?: { channelName: string; channelDescription?: string }
): Promise<string> {
  let context: ContextChunk[] = [];
  if (docsByAgent.has(agent.id)) {
    try {
      context = await retrieveContext(supabase, agent.id, plainMessage, 5);
    } catch { /* non-fatal */ }
  }

  // Fetch activity summary for standup-style questions
  let activitySummary: string | undefined;
  if (isStandupQuestion(plainMessage) && userId) {
    try {
      activitySummary = await getAgentActivitySummary(supabase, agent.id, userId);
    } catch { /* non-fatal */ }
  }

  const systemPrompt = buildGroupAgentSystemPrompt(
    agent,
    context,
    teamMemberNames,
    docsByAgent.get(agent.id),
    scheduleInstructions,
    priorResponses,
    weight,
    activitySummary,
    teamExpectationsContext,
    channelContext
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

// ─── Topic boundary detection ─────────────────────────────────────────────

type SimpleMessage = { role: "user" | "assistant"; content: string };

/**
 * Detect whether the latest user message starts a new topic or continues
 * the current discussion. Uses a fast Haiku call with minimal context.
 *
 * Returns the index into `allMessages` where the current topic begins.
 * - If NEW topic: returns the index of the latest user message
 * - If CONTINUE: returns 0 (keep everything)
 */
async function detectTopicBoundary(
  anthropic: Anthropic,
  allMessages: SimpleMessage[],
): Promise<number> {
  // Find the last user message
  let lastUserIdx = -1;
  for (let i = allMessages.length - 1; i >= 0; i--) {
    if (allMessages[i].role === "user") { lastUserIdx = i; break; }
  }
  if (lastUserIdx <= 0) return 0; // first message or not found — keep all

  // If 5 or fewer messages, no point checking — keep all
  if (allMessages.length <= 5) return 0;

  // Grab the 3 messages before the latest user message for context
  const contextStart = Math.max(0, lastUserIdx - 3);
  const priorContext = allMessages.slice(contextStart, lastUserIdx);
  const latestUserMsg = allMessages[lastUserIdx].content;

  if (priorContext.length === 0) return 0;

  const contextSummary = priorContext
    .map((m) => `${m.role === "user" ? "User" : "Team"}: ${m.content.slice(0, 150)}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      system: "You detect topic shifts in group chat. Reply with exactly one word: CONTINUE or NEW.\nCONTINUE = the new message builds on, references, or is about the same subject as the recent messages.\nNEW = the new message starts a clearly different subject (e.g. from weekend plans to work risks, or from scheduling to a technical question).",
      messages: [{
        role: "user",
        content: `Recent conversation:\n${contextSummary}\n\nNew message from user: "${latestUserMsg.slice(0, 200)}"`,
      }],
    });
    const answer = response.content[0].type === "text" ? response.content[0].text.trim().toUpperCase() : "";
    console.log(`[TopicBoundary] verdict=${answer} for: "${latestUserMsg.slice(0, 80)}"`);

    if (answer.startsWith("NEW")) {
      // New topic — only keep messages from this user message onward
      // But always include at least the last user message
      console.log(`[TopicBoundary] Trimming history: keeping ${allMessages.length - lastUserIdx} of ${allMessages.length} messages`);
      return lastUserIdx;
    }
  } catch (err) {
    console.error("[TopicBoundary] Error (keeping full history):", err);
  }

  return 0; // CONTINUE or error — keep all
}

/**
 * Build smart context-aware message history.
 *
 * 1. Fetch a generous window of recent messages (30)
 * 2. Run topic boundary detection
 * 3. If new topic: trim to messages from the new topic onward
 * 4. Always keep at least the last 5 messages
 */
export async function buildSmartHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  anthropic: Anthropic,
  conversationId: string,
): Promise<SimpleMessage[]> {
  // Fetch a generous window — we'll trim intelligently
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!history || history.length === 0) return [];
  history.reverse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawMessages: SimpleMessage[] = history.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  // Merge consecutive same-role messages (Claude API requires alternation)
  const merged: SimpleMessage[] = [];
  for (const msg of rawMessages) {
    if (merged.length === 0) {
      if (msg.role === "assistant") merged.push({ role: "user", content: "[group chat]" });
      merged.push(msg);
    } else {
      const last = merged[merged.length - 1];
      if (last.role === msg.role) {
        last.content += "\n" + msg.content;
      } else {
        merged.push(msg);
      }
    }
  }

  // If 5 or fewer messages, keep all — no topic detection needed
  if (merged.length <= 5) {
    console.log(`[SmartHistory] ${merged.length} messages — keeping all (too few to trim)`);
    return merged;
  }

  // Detect topic boundary
  const boundaryIdx = await detectTopicBoundary(anthropic, merged);

  // Always keep at least the last 5 messages
  const minKeep = Math.max(0, merged.length - 5);
  const trimIdx = Math.min(boundaryIdx, minKeep);
  const result = merged.slice(trimIdx);

  console.log(`[SmartHistory] ${merged.length} total → keeping ${result.length} (boundary=${boundaryIdx}, minKeep=${minKeep})`);
  return result;
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

  // DB-level dedup: check who already responded to the latest user message in this conversation.
  // This prevents duplicate responses when orchestration runs concurrently or in follow-up rounds.
  if (_round === 0) {
    // Find the most recent user message timestamp
    const { data: latestUserMsg } = await supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestUserMsg) {
      // Find assistant messages after the latest user message
      const { data: recentResponses } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .gt("created_at", latestUserMsg.created_at);

      if (recentResponses && recentResponses.length > 0) {
        // Parse agent names from [AgentName] prefixes
        const alreadyPosted = new Set<string>();
        for (const msg of recentResponses) {
          const blocks = parseAgentBlocks(msg.content);
          for (const b of blocks) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = allAgents.find((a: any) => a.name === b.name);
            if (found) alreadyPosted.add(found.id);
          }
        }
        if (alreadyPosted.size > 0) {
          // Merge into _respondedIds so they're skipped
          for (const id of alreadyPosted) _respondedIds.add(id);
          console.log(`${LOG} DB dedup: ${alreadyPosted.size} agent(s) already responded to this message`);
        }
      }
    }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMemberNames = allAgents.map((a: any) => a.name as string);
  const anthropic = getAnthropicClient();

  // 5. Build message history with smart topic-aware trimming
  let messages: { role: "user" | "assistant"; content: string }[];
  if (_round > 0) {
    messages = [{ role: "user", content: triggerMessage }];
  } else {
    messages = await buildSmartHistory(supabase, anthropic, conversationId);
    if (messages.length === 0) {
      messages.push({ role: "user", content: "[group chat]" });
      messages.push({ role: "assistant", content: triggerMessage });
    }
  }

  // 6. CASUAL SHORTCUT — no evaluate, no RAG, Haiku model
  if (effectiveIntent === "casual" && mentionedAgentIds.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligibleAgents = agents.filter((a: any) => !_respondedIds.has(a.id));
    const scored = eligibleAgents
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
    // Remove agents who already responded (DB dedup)
    for (const id of _respondedIds) respondingIds.delete(id);
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
        teamMemberNames,
        undefined, // scheduleInstructions
        undefined, // priorResponses
        undefined, // weight
        userId
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
