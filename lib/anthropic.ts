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

// ─── Personality trait → system prompt instructions ───────────────────────

const PERSONALITY_INSTRUCTIONS: Record<string, Record<number, string>> = {
  verbosity: {
    1: "Short, direct answers only. Get to the point fast — one or two sentences max.",
    2: "Be concise. Get to the point without unnecessary elaboration.",
    4: "Provide thorough responses with full reasoning, relevant context, and examples where helpful.",
    5: "Give detailed, comprehensive responses with full reasoning, context, and worked examples. Be thorough.",
  },
  initiative: {
    1: "After giving your answer, stay quiet unless directly @mentioned. Do not ask follow-up questions, comment on others' replies, or volunteer additional thoughts.",
    2: "After giving your answer, only speak again if you have something genuinely new to add. Don't ask follow-up questions unless critical.",
    4: "Actively engage — ask others questions, offer to help explain things, and build on the conversation after your initial answer.",
    5: "Be highly proactive: ask others questions, offer to explain things, start new threads within the conversation, and volunteer relevant information even after you've already responded.",
  },
  reactivity: {
    1: "Give your own independent answer. Don't reference, build on, or react to what others have said — just give your perspective directly.",
    2: "Focus on your own perspective. Only briefly acknowledge others if directly relevant.",
    4: "Engage with what others said — play back key points to confirm understanding, note agreements or disagreements, and connect ideas between different agents' responses.",
    5: "Actively collaborate: play back what others said to confirm understanding, ask clarifying questions about their points, connect ideas between different agents' responses, and build on the group's thinking.",
  },
  repetition_tolerance: {
    1: "Make your point once, concisely. If the conversation continues on your topic, stay quiet — one contribution per topic. Do not restate or rephrase what you already said.",
    2: "Avoid repeating yourself. Say it once clearly and move on unless asked directly.",
    4: "Expand on your answer if the conversation develops — provide additional context, nuance, or examples. Ask follow-up questions to ensure your point was understood.",
    5: "Re-engage when the conversation develops on your topic. Add context, nuance, and follow-up questions. Ensure your perspective is fully captured even if it takes multiple messages.",
  },
  warmth: {
    1: "Strictly professional and factual. No small talk, humour, or emoji. Get straight to business.",
    2: "Keep a professional tone with minimal informality.",
    4: "Be warm and friendly — casual, approachable tone. Acknowledge others personally. Occasional humour is welcome.",
    5: "Be casual, warm, and personable. Use humour, emoji, and informal language freely. Acknowledge others by name and be encouraging.",
  },
};

export function buildPersonalityInstructions(agent: {
  verbosity?: number;
  initiative?: number;
  reactivity?: number;
  repetition_tolerance?: number;
  warmth?: number;
}): string {
  const traits: [string, number | undefined][] = [
    ["verbosity",            agent.verbosity],
    ["initiative",           agent.initiative],
    ["reactivity",           agent.reactivity],
    ["repetition_tolerance", agent.repetition_tolerance],
    ["warmth",               agent.warmth],
  ];
  const lines = traits
    .map(([key, val]) => {
      const v = val ?? 3;
      return PERSONALITY_INSTRUCTIONS[key]?.[v] ?? "";
    })
    .filter(Boolean);

  // Append the universal re-engagement rule
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
    verbosity?: number;
    initiative?: number;
    reactivity?: number;
    repetition_tolerance?: number;
    warmth?: number;
    voice_profile?: string | null;
  },
  context?: ContextChunk[],
  documentNames?: string[],
  options?: {
    enableScheduleDetection?: boolean;
    webSearchResults?: string;
    disabledFeatures?: Array<{ feature: string; label: string; description: string }>;
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

  const personalityInstructions = buildPersonalityInstructions(agent);
  const behaviorLine = personalityInstructions
    ? personalityInstructions
    : "Be concise, professional, and helpful.";

  prompt += `\n\n${behaviorLine} You are a remote team member — communicate like a competent colleague, not an AI assistant.`;

  if (agent.voice_profile) {
    prompt += `\n\nTONE OF VOICE: Communicate in this style: ${agent.voice_profile} Match this tone and approach in every response.`;
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

  if (streaming) {
    // Remove incomplete opening tags whose closing tag hasn't arrived yet.
    // e.g. "<search><provider>brave</provider><query>test" mid-stream
    cleaned = cleaned.replace(/<(?:search|tool_call|function_call|tool_use|invoke|antThinking|send_message|message|action|delivery)[^>]*>[\s\S]*$/gi, "");
    // Remove incomplete ```schedule_request, ```feature_request, or ```group_message_request that hasn't closed
    cleaned = cleaned.replace(/```schedule_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```feature_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```group_message_request[\s\S]*$/g, "");
  }

  // Strip leading [AgentName] or [You] bracket prefix that agents sometimes generate
  cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, "");

  // Trim leftover whitespace from removals
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}
