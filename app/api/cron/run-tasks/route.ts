import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, buildSystemPrompt } from "@/lib/anthropic";
import { retrieveContext, type RetrievedChunk } from "@/lib/rag";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import { getNextRun } from "@/lib/cron";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min for Vercel

export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabase();
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
    tasks.map((task) => runTask(supabase, task))
  );

  const ran = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[Cron] Done: ${ran} succeeded, ${failed} failed`);

  return NextResponse.json({ ran, failed });
}

async function runTask(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  task: {
    id: string;
    user_id: string;
    agent_id: string;
    instruction: string;
    cron: string;
    timezone: string;
    agents: {
      id: string;
      name: string;
      purpose: string;
      web_search_enabled: boolean;
    };
  }
) {
  const agent = task.agents;
  console.log(`[Cron] Running task ${task.id} for agent "${agent.name}": ${task.instruction.slice(0, 80)}`);

  // 1. Create a conversation for this task run
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({ user_id: task.user_id, agent_id: task.agent_id })
    .select("id")
    .single();

  if (convError || !conv) {
    throw new Error(`Failed to create conversation: ${convError?.message}`);
  }

  // 2. Insert the instruction as a user message
  await supabase.from("messages").insert({
    conversation_id: conv.id,
    role: "user",
    content: `[Scheduled task] ${task.instruction}`,
  });

  // 3. RAG context
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

  systemPrompt += `\n\nThis message is from a scheduled task. The current date and time is ${new Date().toISOString()}. Complete the task thoroughly.`;

  // 6. Call Claude
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: task.instruction }],
  });

  const responseText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // 7. Save response as assistant message
  await supabase.from("messages").insert({
    conversation_id: conv.id,
    role: "assistant",
    content: responseText,
  });

  // 8. Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conv.id);

  // 9. Update task: last_run_at + next_run_at
  let nextRun: string;
  try {
    nextRun = getNextRun(task.cron, new Date()).toISOString();
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

  console.log(`[Cron] Task ${task.id} completed. Response: ${responseText.slice(0, 100)}...`);
}
