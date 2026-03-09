import { createServiceSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, buildSystemPrompt, cleanResponse } from "@/lib/anthropic";
import { retrieveContext, type RetrievedChunk } from "@/lib/rag";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import { getNextRun } from "@/lib/cron";
import { logActivity } from "@/lib/activity";
import { runGroupOrchestration } from "@/lib/group-orchestration";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min for Vercel
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const now = new Date();

  // Find all enabled tasks whose next_run_at is in the past
  const { data: tasks, error } = await supabase
    .from("scheduled_tasks")
    .select("*, agents(*)")
    .eq("enabled", true)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[Cron] Failed to fetch tasks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  console.log(`[Cron] Running ${tasks.length} task(s)`);

  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      try {
        await runTask(supabase, task);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        const agentName = task.agents?.name || "Agent";
        const preview = task.instruction.slice(0, 80) + (task.instruction.length > 80 ? "..." : "");
        await logActivity(supabase, task.user_id, task.agent_id, "task_failed",
          `${agentName} failed scheduled task: ${preview}`,
          { task_id: task.id, error: errMsg }
        );
        throw err;
      }
    })
  );

  const ran = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[Cron] Done: ${ran} succeeded, ${failed} failed`);

  return NextResponse.json({ ran, failed });
}

async function runTask(
  supabase: ReturnType<typeof createServiceSupabase>,
  task: {
    id: string;
    user_id: string;
    agent_id: string;
    instruction: string;
    cron: string | null;
    timezone: string;
    recurring: boolean;
    destination: string | null;
    agents: {
      id: string;
      name: string;
      purpose: string;
      web_search_enabled: boolean;
    };
  }
) {
  const agent = task.agents;
  const preview = task.instruction.slice(0, 80) + (task.instruction.length > 80 ? "..." : "");
  console.log(`[Cron] Running task ${task.id} for agent "${agent.name}": ${preview}`);

  await logActivity(supabase, task.user_id, task.agent_id, "task_started",
    `${agent.name} started scheduled task: ${preview}`,
    { task_id: task.id }
  );

  // 1. Find existing conversation based on destination, or create one
  const isGroupDest = task.destination === "group";
  const isTeamDest = task.destination?.startsWith("team:") ?? false;
  const teamId = isTeamDest ? task.destination!.replace("team:", "") : null;
  let convId: string;

  let convQuery = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", task.user_id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (isGroupDest) {
    convQuery = convQuery.is("agent_id", null).is("team_id", null);
  } else if (isTeamDest) {
    convQuery = convQuery.is("agent_id", null).eq("team_id", teamId);
  } else {
    convQuery = convQuery.eq("agent_id", task.agent_id);
  }

  const { data: existingConv } = await convQuery.single();

  if (existingConv) {
    convId = existingConv.id;
  } else {
    const insertData: Record<string, unknown> = { user_id: task.user_id };
    if (isGroupDest) {
      // agent_id null, team_id null → #all
    } else if (isTeamDest) {
      insertData.team_id = teamId;
    } else {
      insertData.agent_id = task.agent_id;
    }
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert(insertData)
      .select("id")
      .single();
    if (convError || !newConv) {
      throw new Error(`Failed to create conversation: ${convError?.message}`);
    }
    convId = newConv.id;
  }

  // 2. RAG context
  let ragContext: RetrievedChunk[] = [];
  let documentNames: string[] = [];

  const { data: agentDocs } = await supabase
    .from("documents")
    .select("file_name")
    .eq("agent_id", task.agent_id)
    .eq("status", "ready");

  if (agentDocs && agentDocs.length > 0) {
    documentNames = agentDocs.map((d) => d.file_name);
    const topK = agentDocs.length > 20 ? 25 : agentDocs.length > 5 ? 15 : 5;
    try {
      ragContext = await retrieveContext(supabase, task.agent_id, task.instruction, topK);
    } catch (err) {
      console.error("[Cron] RAG retrieval failed:", err);
    }
  }

  // 4. Web search if enabled
  let searchContext = "";
  if (agent.web_search_enabled) {
    try {
      const results = await webSearch(task.instruction, 5);
      if (results.length > 0) {
        searchContext = `\n\nWeb search results for context:\n\n${formatSearchResults(results)}`;
        await logActivity(supabase, task.user_id, task.agent_id, "web_search",
          `${agent.name} searched the web for: ${preview}`,
          { task_id: task.id, result_count: results.length }
        );
      }
    } catch (err) {
      console.error("[Cron] Web search failed:", err);
    }
  }

  // 5. Build system prompt
  let systemPrompt = buildSystemPrompt(
    agent,
    ragContext.length > 0 ? ragContext : undefined,
    documentNames.length > 0 ? documentNames : undefined
  );

  if (searchContext) {
    systemPrompt += searchContext;
  }

  systemPrompt += `\n\nThis is a scheduled task running automatically. The current date and time is ${new Date().toISOString()}. Write your response as a direct message to the user — just write the content naturally as if chatting. Do NOT include any XML tags, tool calls, send_message blocks, channel references, or delivery instructions. Do NOT mention Slack, Teams, or any messaging platform. Simply write the message content.`;

  // 6. Call Claude
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: task.instruction }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const responseText = cleanResponse(rawText);

  // 7. Save response as assistant message
  // For group/team chat, prefix with [AgentName] so the UI renders with correct name/color
  const isChannelDest = isGroupDest || isTeamDest;
  const savedContent = isChannelDest
    ? `[${agent.name}] ${responseText}`
    : responseText;

  await supabase.from("messages").insert({
    conversation_id: convId,
    role: "assistant",
    content: savedContent,
  });

  // 8. Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  // 8b. For group/team chat, trigger other agents to react via full orchestration
  if (isChannelDest) {
    console.log(`[Cron] Agent message saved to ${isTeamDest ? `team channel (${teamId})` : "#all"}, triggering orchestration for conv=${convId}`);
    try {
      if (isTeamDest) {
        // Team channel: only trigger agents in that team
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("agent_id")
          .eq("team_id", teamId);
        const teamAgentIds = (teamMembers || [])
          .map((m: { agent_id: string }) => m.agent_id)
          .filter((id: string) => id !== task.agent_id);
        if (teamAgentIds.length > 0) {
          const { data: allAgents } = await supabase
            .from("agents")
            .select("id")
            .eq("user_id", task.user_id);
          const excludeIds = (allAgents || [])
            .map((a: { id: string }) => a.id)
            .filter((id: string) => !teamAgentIds.includes(id) || id === task.agent_id);
          await runGroupOrchestration(supabase, task.user_id, convId, savedContent, excludeIds);
        }
      } else {
        await runGroupOrchestration(supabase, task.user_id, convId, savedContent, task.agent_id);
      }
    } catch (err) {
      console.error("[Cron] Channel reactions failed:", err);
      // Non-fatal — the original message was already saved
    }
  }

  // 9. Update task: last_run_at + next_run_at (or disable if one-off)
  if (task.recurring === false) {
    // One-off task: disable after running once
    await supabase
      .from("scheduled_tasks")
      .update({
        last_run_at: new Date().toISOString(),
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
  } else {
    let nextRun: string;
    try {
      nextRun = getNextRun(task.cron!, new Date()).toISOString();
    } catch {
      nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    await supabase
      .from("scheduled_tasks")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
  }

  await logActivity(supabase, task.user_id, task.agent_id, "task_completed",
    `${agent.name} completed scheduled task: ${preview}`,
    { task_id: task.id, conversation_id: convId }
  );

  console.log(`[Cron] Task ${task.id} completed. Response: ${responseText.slice(0, 100)}...`);
}

