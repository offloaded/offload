import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType =
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "document_processed"
  | "document_failed"
  | "web_search";

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
