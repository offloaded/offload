import { getAnthropicClient } from "./anthropic";
import { createServiceSupabase } from "./supabase-server";

export interface EmailRoutingResult {
  agent_id: string;
  agent_name: string;
  reason: string;
  suggested_title: string;
}

const ROUTING_SYSTEM_PROMPT = `You are an email routing system for a workspace. Given a list of AI agents and an inbound email, determine which agent is best suited to handle this email as a work item.

Consider:
1. Each agent's name, role, and purpose — match the email's subject matter to the most relevant agent
2. Each agent's capabilities — agents with project management tools (Asana, GitHub) can look up tasks and project status; agents without these tools cannot
3. Each agent's knowledge base — agents with uploaded documents can reference that knowledge

An agent WITHOUT project management tools cannot produce project status reports, task lists, or progress updates — even if their role sounds relevant. Prefer agents that have the tools needed to fulfill the request.

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

  // 1. Query all non-deleted agents with their capabilities
  const { data: agents, error } = await service
    .from("agents")
    .select("id, name, role, purpose, web_search_enabled, asana_enabled, github_enabled, google_calendar_enabled")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  if (!agents || agents.length === 0) {
    throw new Error("No agents found in workspace");
  }

  // Also check which agents have knowledge base documents
  const agentIds = agents.map((a) => a.id);
  const { data: docCounts } = await service
    .from("documents")
    .select("agent_id")
    .in("agent_id", agentIds)
    .eq("status", "ready");

  const agentsWithDocs = new Set((docCounts || []).map((d: { agent_id: string }) => d.agent_id));

  // 2. Build the routing prompt with capabilities
  const agentList = agents
    .map((a) => {
      const capabilities: string[] = [];
      if (a.asana_enabled) capabilities.push("Asana (project/task management)");
      if (a.github_enabled) capabilities.push("GitHub (code/issues)");
      if (a.google_calendar_enabled) capabilities.push("Google Calendar");
      if (a.web_search_enabled) capabilities.push("Web search");
      if (agentsWithDocs.has(a.id)) capabilities.push("Knowledge base documents");

      const capsStr = capabilities.length > 0 ? capabilities.join(", ") : "No integrations";
      return `- ID: ${a.id} | Name: ${a.name} | Role: ${a.role || "N/A"} | Purpose: ${a.purpose || "N/A"} | Capabilities: ${capsStr}`;
    })
    .join("\n");

  const userPrompt = `Available agents:\n${agentList}\n\nInbound email:\nFrom: ${email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}\nSubject: ${email.subject || "(no subject)"}\nBody:\n${(email.body_plain || "(empty)").slice(0, 2000)}`;

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
