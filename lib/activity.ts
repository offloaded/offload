import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType =
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "document_processed"
  | "document_failed"
  | "web_search"
  | "asana_create_task"
  | "asana_update_task";

export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  agentId: string | null,
  type: ActivityType,
  description: string,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.from("activity_log").insert({
      user_id: userId,
      agent_id: agentId,
      type,
      description,
      metadata: metadata || null,
    });
  } catch (err) {
    // Never let activity logging break the main flow
    console.error("[Activity] Failed to log:", err);
  }
}

/**
 * Detect whether a message is a standup-style question asking about work status.
 */
export function isStandupQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(working on|what are you (doing|up to|working)|give me (an |a )?(update|status|standup)|standup|stand-up|stand up|what'?s? (your )?(status|update|progress)|blockers?|blocked|any (updates?|progress)|how'?s? (it|work|things) going|what have you (been|done)|report|brief me|catch me up|where are (we|things) at|any news)\b/.test(lower);
}

/**
 * Build a plain-text summary of an agent's recent real activity.
 * Used to ground standup responses in actual work, not purpose statements.
 */
export async function getAgentActivitySummary(
  supabase: SupabaseClient,
  agentId: string,
  userId: string
): Promise<string> {
  const lines: string[] = [];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // 1. Scheduled tasks
  try {
    const { data: tasks } = await supabase
      .from("scheduled_tasks")
      .select("instruction, cron, last_run_at, enabled")
      .eq("agent_id", agentId)
      .eq("user_id", userId);

    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        const status = t.enabled ? "active" : "paused";
        const lastRan = t.last_run_at
          ? `last ran ${formatRelativeTime(t.last_run_at)}`
          : "hasn't run yet";
        lines.push(`- Scheduled task (${status}): "${t.instruction}" (${lastRan})`);
      }
    }
  } catch { /* non-fatal */ }

  // 2. Recent conversations — get the last 5 conversation topics
  try {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, updated_at")
      .eq("user_id", userId)
      .eq("agent_id", agentId)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (convs && convs.length > 0) {
      // Get the first user message from each conversation as the topic
      for (const conv of convs) {
        const { data: firstMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .eq("role", "user")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (firstMsg) {
          const topic = firstMsg.content.slice(0, 80) + (firstMsg.content.length > 80 ? "..." : "");
          const when = formatRelativeTime(conv.updated_at);
          lines.push(`- Conversation (${when}): User asked "${topic}"`);
        }
      }
    }
  } catch { /* non-fatal */ }

  // 3. Recent documents processed
  try {
    const { data: docs } = await supabase
      .from("documents")
      .select("file_name, created_at, status")
      .eq("agent_id", agentId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false });

    if (docs && docs.length > 0) {
      const readyCount = docs.filter(d => d.status === "ready").length;
      const processingCount = docs.filter(d => d.status === "processing").length;
      const names = docs.slice(0, 3).map(d => d.file_name).join(", ");
      let docLine = `- Documents this week: ${readyCount} processed`;
      if (processingCount > 0) docLine += `, ${processingCount} still processing`;
      docLine += ` (${names}${docs.length > 3 ? ` + ${docs.length - 3} more` : ""})`;
      lines.push(docLine);
    }
  } catch { /* non-fatal */ }

  // 4. Recent activity log entries (web searches, task runs)
  try {
    const { data: activities } = await supabase
      .from("activity_log")
      .select("type, description, created_at")
      .eq("agent_id", agentId)
      .eq("user_id", userId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (activities && activities.length > 0) {
      for (const a of activities) {
        const when = formatRelativeTime(a.created_at);
        lines.push(`- ${formatActivityType(a.type)} (${when}): ${a.description.slice(0, 100)}`);
      }
    }
  } catch { /* non-fatal */ }

  if (lines.length === 0) {
    return "YOUR RECENT ACTIVITY:\nYou have no recent activity — no scheduled tasks, no recent conversations, no documents processed this week. Be honest about this. Don't make up work based on your purpose statement.";
  }

  return `YOUR RECENT ACTIVITY (this is what you have ACTUALLY been doing — use this for standup/status responses, not your purpose statement):\n${lines.join("\n")}`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

function formatActivityType(type: string): string {
  const map: Record<string, string> = {
    task_started: "Task started",
    task_completed: "Task completed",
    task_failed: "Task failed",
    document_processed: "Document processed",
    document_failed: "Document failed",
    web_search: "Web search",
  };
  return map[type] || type;
}
