import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return client;
}

interface ContextChunk {
  content: string;
  fileName: string;
  similarity?: number;
  metadata?: {
    document_date?: string | null;
    section_heading?: string | null;
  };
}

// ─── Style tag → system prompt instructions ───────────────────────

const WORKING_STYLE_INSTRUCTIONS: Record<string, string> = {
  Proactive: "Take initiative. Flag potential issues before being asked. Suggest next steps. Ask clarifying questions when needed.",
  Analytical: "Be data-driven and evidence-based. Structure your thinking clearly. Reference specific facts and figures from your documents.",
  Collaborative: "Build on what others say. Reference your colleagues' input. Look for connections across different perspectives.",
};

const COMMUNICATION_STYLE_INSTRUCTIONS: Record<string, string> = {
  Concise: "Keep responses brief and to the point. Prioritise clarity over completeness.",
  Professional: "Maintain a formal, structured tone. Use proper terminology.",
  Supportive: "Be encouraging and warm. Acknowledge effort and progress. Use a friendly tone.",
};

export function buildStyleInstructions(agent: {
  working_style?: string[] | null;
  communication_style?: string[] | null;
}): string {
  const lines: string[] = [];

  if (agent.working_style && agent.working_style.length > 0) {
    for (const style of agent.working_style) {
      const instruction = WORKING_STYLE_INSTRUCTIONS[style];
      if (instruction) lines.push(instruction);
    }
  }

  if (agent.communication_style && agent.communication_style.length > 0) {
    for (const style of agent.communication_style) {
      const instruction = COMMUNICATION_STYLE_INSTRUCTIONS[style];
      if (instruction) lines.push(instruction);
    }
  }

  // Universal re-engagement rule for group chat
  lines.push(
    "CRITICAL: Never repeat a point you have already made in this conversation, regardless of your personality. " +
    "If you have already responded on a topic, only speak again if: (1) you are directly @mentioned, " +
    "(2) someone asked you a direct question, (3) you have genuinely NEW information to add — not a restatement. " +
    "If you have nothing new to say, stay silent."
  );

  return lines.join("\n");
}

export function buildSystemPrompt(
  agent: {
    name: string;
    purpose: string;
    web_search_enabled?: boolean;
    working_style?: string[] | null;
    communication_style?: string[] | null;
    voice_profile?: string | null;
    soft_skills?: { skill: string; confidence: string; note?: string }[] | null;
  },
  context?: ContextChunk[],
  documentNames?: string[],
  options?: {
    enableScheduleDetection?: boolean;
    webSearchResults?: string;
    disabledFeatures?: Array<{ feature: string; label: string; description: string }>;
    activitySummary?: string;
  }
): string {
  let prompt = `You are ${agent.name}.

Your purpose: ${agent.purpose}

CRITICAL — YOU ARE NOT A TOOL-USING SYSTEM: Never output XML tags, tool calls, or structured action syntax of any kind. This means no <send_message>, </send_message>, <action>, <channel>, or similar tags. Never write delivery instructions. The system handles all message routing — your job is only to write the content as plain conversational text.`;

  if (documentNames && documentNames.length > 0) {
    prompt += `\n\nYou have access to the following documents in your knowledge base:\n${documentNames.map((n) => `- ${n}`).join("\n")}`;
  }

  if (context && context.length > 0) {
    prompt += `\n\nRelevant excerpts from your knowledge base:\n\n`;
    prompt += context
      .map((c, i) => {
        let header = `[${i + 1}] From "${c.fileName}"`;
        if (c.metadata?.document_date) {
          header += ` (${c.metadata.document_date})`;
        }
        if (c.metadata?.section_heading) {
          header += ` — ${c.metadata.section_heading}`;
        }
        return `${header}:\n${c.content}`;
      })
      .join("\n\n");
    prompt += `\n\nWhen answering questions, reference the relevant documents from your knowledge base. Cite the document name and date when available (e.g. "In the July 2023 meeting, council resolved..."). If you don't have enough information in your documents to answer confidently, say so.`;
  }

  if (agent.web_search_enabled) {
    prompt += `\n\nYou have web search capability. The system automatically searches the web for every message you receive and provides the results below.`;
  }

  if (options?.webSearchResults) {
    prompt += `\n\nWeb search results:\n\n${options.webSearchResults}`;
    prompt += `\n\nYou may reference these web search results when they're relevant. Cite URLs when quoting specific information.`;
  }

  if (options?.enableScheduleDetection) {
    prompt += `\n\nYou can help users set up scheduled tasks and post immediate messages to the group chat. Use plain text for your visible response — the only structured output allowed is the specific JSON blocks described below.

SCHEDULED TASKS (future delivery):
Infer where to deliver:
- "remind me", "send me", "message me", "DM me", "let me know" → destination "dm"
- "ask the group", "tell the team", "post in the group chat", "message the team" → destination "group"
- Default to "dm" when unclear.

For RECURRING tasks ("every morning", "daily at 5pm", "every Monday"):
\`\`\`schedule_request
{"instruction": "the task to perform", "cron": "0 9 * * *", "timezone": "Pacific/Auckland", "recurring": true, "destination": "dm"}
\`\`\`

For ONE-OFF tasks ("in 5 minutes", "at 3pm today", "tomorrow at noon", "in an hour"):
\`\`\`schedule_request
{"instruction": "the task to perform", "run_at": "${new Date().toISOString()}", "timezone": "Pacific/Auckland", "recurring": false, "destination": "dm"}
\`\`\`

Current date/time: ${new Date().toISOString()}. Only include a schedule_request block when the user is explicitly requesting a future scheduled or delayed task.

IMMEDIATE GROUP MESSAGES (post to group chat right now, not scheduled):
When the user asks you to message/post something to the group or team immediately (not at a future time), write your visible reply naturally (e.g. "I'll post that to the group now."), then include at the END of your response:
\`\`\`group_message_request
{"message": "the exact message to post to the group chat"}
\`\`\`
The message content is just plain text — no XML, no tags. Only use this block when the user explicitly wants something posted to the group right now.`;
  }

  // Disabled feature activation instructions
  if (options?.disabledFeatures && options.disabledFeatures.length > 0) {
    prompt += `\n\nSome features are currently disabled for you. If a user asks you to do something that requires a disabled feature, DO NOT say you can't do it. Instead, briefly explain the feature isn't enabled yet and ask if they'd like to turn it on. Include a feature activation block at the END of your response in exactly this format:

\`\`\`feature_request
{"feature": "feature_id", "label": "Feature Name"}
\`\`\`

Disabled features:`;
    for (const f of options.disabledFeatures) {
      prompt += `\n- ${f.feature}: ${f.description}`;
    }
    prompt += `\n\nOnly include the feature_request block when the user's request clearly requires one of these disabled features.`;
  }

  const styleInstructions = buildStyleInstructions(agent);
  const behaviorLine = styleInstructions
    ? styleInstructions
    : "Be concise, professional, and helpful.";

  prompt += `\n\n${behaviorLine} You are a remote team member — communicate like a competent colleague, not an AI assistant.`;

  if (agent.voice_profile) {
    prompt += `\n\nTONE OF VOICE: Communicate in this style: ${agent.voice_profile} Match this tone and approach in every response.`;
  }

  if (agent.soft_skills && agent.soft_skills.length > 0) {
    const skillsList = agent.soft_skills
      .map((s) => `- ${s.skill} (${s.confidence})${s.note ? ` — ${s.note}` : ""}`)
      .join("\n");
    prompt += `\n\nYOUR SOFT SKILLS:\n${skillsList}\nLean into these strengths when responding. For skills with low confidence, actively work on improving.`;
  }

  prompt += `\n\nSKILLS SELF-ASSESSMENT: When asked about your skills, capabilities, or what you're good at, reflect on your purpose and experience. You can update your skills by including a JSON block at the END of your response:
\`\`\`skills_update
[{"skill": "skill name", "confidence": "low|medium|high", "note": "why you have this skill"}]
\`\`\`
Only include this block when explicitly discussing your skills or when asked to develop a new capability.`;

  if (options?.activitySummary) {
    prompt += `\n\n${options.activitySummary}\n\nIMPORTANT: When asked about what you're working on, your status, progress, blockers, or for a standup update, answer ONLY from the activity summary above. Your purpose statement describes what you CAN do — the activity summary describes what you ARE doing. If you have no recent activity, say so honestly ("Nothing active on my end right now. Let me know if there's something I can pick up."). Do NOT fabricate work or talk generically about your role.`;
  }

  prompt += `\n\nFORMATTING RULE: Never use markdown formatting. No **bold**, no *italic*, no # headers, no - bullet lists, no \`code blocks\`, no [links](url). Write in plain conversational text like a human in a chat app. To list things, use natural sentences or "1." "2." numbering.`;

  return prompt;
}

/**
 * Strip internal markup from LLM responses before showing to users.
 * Removes <search>...</search> XML blocks, ```schedule_request blocks,
 * and any other tool-call artifacts.
 *
 * When `streaming` is true, also removes partially-received tags
 * (e.g. an opening `<search>` whose closing tag hasn't arrived yet).
 */
export function cleanResponse(text: string, streaming = false): string {
  let cleaned = text;
  // Remove complete <tag>...</tag> blocks (search, tool_call, function_call, tool_use, invoke, antThinking, send_message, message, action)
  cleaned = cleaned.replace(/<(?:search|tool_call|function_call|tool_use|invoke|antThinking|send_message|message|action|delivery)[^>]*>[\s\S]*?<\/(?:search|tool_call|function_call|tool_use|invoke|antThinking|send_message|message|action|delivery)>/gi, "");
  // Remove ```schedule_request, ```feature_request, and ```group_message_request blocks (handled separately via SSE events)
  cleaned = cleaned.replace(/```schedule_request\s*\n[\s\S]*?\n```/g, "");
  cleaned = cleaned.replace(/```feature_request\s*\n[\s\S]*?\n```/g, "");
  cleaned = cleaned.replace(/```group_message_request\s*\n[\s\S]*?\n```/g, "");
  cleaned = cleaned.replace(/```skills_update\s*\n[\s\S]*?\n```/g, "");

  if (streaming) {
    // Remove incomplete opening tags whose closing tag hasn't arrived yet.
    // e.g. "<search><provider>brave</provider><query>test" mid-stream
    cleaned = cleaned.replace(/<(?:search|tool_call|function_call|tool_use|invoke|antThinking|send_message|message|action|delivery)[^>]*>[\s\S]*$/gi, "");
    // Remove incomplete ```schedule_request, ```feature_request, or ```group_message_request that hasn't closed
    cleaned = cleaned.replace(/```schedule_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```feature_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```group_message_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```skills_update[\s\S]*$/g, "");
  }

  // Strip leading [AgentName] or [You] bracket prefix that agents sometimes generate
  cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, "");

  // Trim leftover whitespace from removals
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}
