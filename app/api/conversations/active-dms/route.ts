import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

/**
 * GET /api/conversations/active-dms
 * Returns agent_ids the user has active DM conversations with (at least one message),
 * sorted by most recent activity.
 */
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Get all non-archived DM conversations for this user, ordered by recency
  const { data: conversations, error } = await service
    .from("conversations")
    .select("id, agent_id, updated_at")
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspaceId)
    .not("agent_id", "is", null)
    .is("team_id", null)
    .eq("archived", false)
    .eq("sidebar_hidden", false)
    .order("updated_at", { ascending: false });

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

  // Check which conversations have at least one message
  const convIds = unique.map((c) => c.id);
  const { data: messageCounts } = await service
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", convIds)
    .limit(1000);

  const convsWithMessages = new Set(
    (messageCounts || []).map((m) => m.conversation_id)
  );

  // Return only agents with actual messages, preserving recency order
  const result = unique
    .filter((c) => convsWithMessages.has(c.id))
    .map((c) => ({
      agent_id: c.agent_id,
      last_message_at: c.updated_at,
    }));

  return NextResponse.json(result);
}
