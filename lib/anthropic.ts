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

export function buildSystemPrompt(
  agent: { name: string; purpose: string; web_search_enabled?: boolean },
  context?: ContextChunk[],
  documentNames?: string[],
  options?: {
    enableScheduleDetection?: boolean;
    webSearchResults?: string;
    disabledFeatures?: Array<{ feature: string; label: string; description: string }>;
  }
): string {
  let prompt = `You are ${agent.name}.

Your purpose: ${agent.purpose}`;

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
    prompt += `\n\nYou can help users set up scheduled tasks — both recurring and one-off.

RECURRING tasks: phrases like "every morning", "daily at 5pm", "every Monday", "weekly", "each hour". Set "recurring": true.

ONE-OFF tasks: phrases like "in 5 minutes", "at 3pm today", "tomorrow morning", "next Tuesday at noon", "in an hour". Set "recurring": false. For these, calculate the cron expression for that specific date/time. The current date and time is ${new Date().toISOString()}.

Include a JSON block at the END of your response in exactly this format:

\`\`\`schedule_request
{"instruction": "the task to perform", "cron": "0 9 * * *", "timezone": "Pacific/Auckland", "recurring": true}
\`\`\`

Use standard 5-field cron expressions (minute hour day-of-month month day-of-week). For one-off tasks, use the specific minute, hour, day-of-month, month, and day-of-week that matches the requested time (e.g. "30 14 7 3 *" for 2:30 PM on March 7). Infer timezone from context or default to the user's likely timezone. Only include this block when the user is explicitly requesting a scheduled or delayed task.`;
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

  prompt += `\n\nBe concise, professional, and helpful. You are a remote team member — communicate like a competent colleague, not an AI assistant.

CRITICAL FORMATTING RULE: Never use markdown formatting in your responses. No **bold** or *italic* asterisks. No # headers. No - bullet lists. No \`code blocks\`. No [links](url). Write in plain conversational text exactly like a human colleague messaging in a chat app. If you need to emphasize something, use words ("importantly", "note that") not formatting symbols. If you need to list things, use natural sentences or number them with "1." "2." etc.

Never output any XML tags, tool calls, or search markup in your response. Your response must be clean, readable text only.`;

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
  // Remove complete <tag>...</tag> blocks (search, tool_call, function_call, tool_use, invoke, antThinking)
  cleaned = cleaned.replace(/<(?:search|tool_call|function_call|tool_use|invoke|antThinking)[^>]*>[\s\S]*?<\/(?:search|tool_call|function_call|tool_use|invoke|antThinking)>/gi, "");
  // Remove ```schedule_request and ```feature_request blocks (we handle these separately via SSE events)
  cleaned = cleaned.replace(/```schedule_request\s*\n[\s\S]*?\n```/g, "");
  cleaned = cleaned.replace(/```feature_request\s*\n[\s\S]*?\n```/g, "");

  if (streaming) {
    // Remove incomplete opening tags whose closing tag hasn't arrived yet.
    // e.g. "<search><provider>brave</provider><query>test" mid-stream
    cleaned = cleaned.replace(/<(?:search|tool_call|function_call|tool_use|invoke|antThinking)[^>]*>[\s\S]*$/gi, "");
    // Remove incomplete ```schedule_request or ```feature_request that hasn't closed
    cleaned = cleaned.replace(/```schedule_request[\s\S]*$/g, "");
    cleaned = cleaned.replace(/```feature_request[\s\S]*$/g, "");
  }

  // Trim leftover whitespace from removals
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}
