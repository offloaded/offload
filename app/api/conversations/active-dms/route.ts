import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { perfStart } from "@/lib/perf";
import { NextResponse } from "next/server";

/**
 * GET /api/conversations/active-dms
 * Returns agent_ids the user has active DM conversations with (at least one message),
 * sorted by most recent activity.
 */
export async function GET() {
  const perfEnd = perfStart("GET /api/conversations/active-dms");
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Get all non-archived, non-hidden DM conversations for this user, ordered by recency
  let query = service
    .from("conversations")
    .select("id, agent_id, updated_at")
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspaceId)
    .not("agent_id", "is", null)
    .is("team_id", null)
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  // Try with sidebar_hidden filter; fall back without it if column doesn't exist yet
  let { data: conversations, error } = await query.eq("sidebar_hidden", false);
  if (error && error.message?.includes("sidebar_hidden")) {
    ({ data: conversations, error } = await service
      .from("conversations")
      .select("id, agent_id, updated_at")
      .eq("user_id", ctx.user.id)
      .eq("workspace_id", ctx.workspaceId)
      .not("agent_id", "is", null)
      .is("team_id", null)
      .eq("archived", false)
      .order("updated_at", { ascending: false }));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json([]);
  }

  // Deduplicate by agent_id (keep most recent)
  const seen = new Set<string>();
  const unique: { id: string; agent_id: string; updated_at: string }[] = [];
  for (const c of conversations) {
    if (!c.agent_id || seen.has(c.agent_id)) continue;
    seen.add(c.agent_id);
    unique.push(c);
  }

  // Check which conversations have at least one message — use one query per conversation
  // but only check the first few (most are active) and batch with Promise.all
  const convIds = unique.map((c) => c.id);

  // Batch existence checks — one lightweight query per conversation
  const existenceChecks = await Promise.all(
    convIds.map((id) =>
      service
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", id)
        .limit(1)
        .then(({ count }) => ({ id, hasMessages: (count || 0) > 0 }))
    )
  );

  const convsWithMessages = new Set(
    existenceChecks.filter((c) => c.hasMessages).map((c) => c.id)
  );

  // Return only agents with actual messages, preserving recency order
  const result = unique
    .filter((c) => convsWithMessages.has(c.id))
    .map((c) => ({
      agent_id: c.agent_id,
      last_message_at: c.updated_at,
    }));

  perfEnd(result?.length);
  return NextResponse.json(result);
}
