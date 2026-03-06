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
  options?: { enableScheduleDetection?: boolean; webSearchResults?: string }
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
    prompt += `\n\nYou can help users set up scheduled tasks. If a user asks you to do something on a recurring schedule (e.g. "every morning at 9am", "every Monday", "daily at 5pm"), include a JSON block at the END of your response in exactly this format:

\`\`\`schedule_request
{"instruction": "the task to perform", "cron": "0 9 * * 1-5", "timezone": "Pacific/Auckland"}
\`\`\`

Use standard 5-field cron expressions (minute hour day-of-month month day-of-week). Infer timezone from context or default to the user's likely timezone. Only include this block when the user is explicitly requesting a recurring scheduled task.`;
  }

  prompt += `\n\nBe concise, professional, and helpful. You are a remote team member — communicate like a competent colleague, not an AI assistant. Never use markdown formatting in your responses. Write in plain text as a human colleague would in a chat message. No asterisks, no bullet points with dashes, no headers with hashes. Just natural conversational text.`;

  return prompt;
}
