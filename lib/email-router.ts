import { getAnthropicClient } from "./anthropic";
import { createServiceSupabase } from "./supabase-server";

export interface EmailRoutingResult {
  agent_id: string;
  agent_name: string;
  reason: string;
  suggested_title: string;
}

const ROUTING_SYSTEM_PROMPT = `You are an email routing system for a workspace. Given a list of AI agents and an inbound email, determine which agent is best suited to handle this email as a work item.

Consider each agent's name, role, and purpose carefully. Match the email's subject matter to the agent whose expertise and responsibilities are most relevant.

Respond with ONLY a valid JSON object, no other text:
{"agent_id": "the-uuid", "agent_name": "Agent Name", "reason": "Brief explanation of why this agent is the best fit", "suggested_title": "A clear, concise work item title (not just the email subject)"}`;

export async function routeEmailToAgent(
  workspaceId: string,
  email: {
    from_address: string;
    from_name: string | null;
    subject: string | null;
    body_plain: string | null;
  }
): Promise<EmailRoutingResult> {
  const service = createServiceSupabase();

  // 1. Query all non-deleted agents in the workspace
  const { data: agents, error } = await service
    .from("agents")
    .select("id, name, role, purpose")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  if (!agents || agents.length === 0) {
    throw new Error("No agents found in workspace");
  }

  // 2. Build the routing prompt
  const agentList = agents
    .map((a) => `- ID: ${a.id} | Name: ${a.name} | Role: ${a.role || "N/A"} | Purpose: ${a.purpose || "N/A"}`)
    .join("\n");

  const userPrompt = `Available agents:\n${agentList}\n\nInbound email:\nFrom: ${email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}\nSubject: ${email.subject || "(no subject)"}\nBody:\n${email.body_plain || "(empty)"}`;

  // 3. Call Claude for routing decision
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: ROUTING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // 4. Parse the JSON response
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as EmailRoutingResult;

    // Verify the agent_id actually exists in our list
    const matched = agents.find((a) => a.id === parsed.agent_id);
    if (!matched) {
      // Fall back to first agent
      return {
        agent_id: agents[0].id,
        agent_name: agents[0].name,
        reason: "Default routing — model returned unknown agent",
        suggested_title: parsed.suggested_title || email.subject || "Email work item",
      };
    }

    return parsed;
  } catch {
    // 5. Fallback to the first agent if parsing fails
    return {
      agent_id: agents[0].id,
      agent_name: agents[0].name,
      reason: "Default routing — failed to parse model response",
      suggested_title: email.subject || "Email work item",
    };
  }
}
