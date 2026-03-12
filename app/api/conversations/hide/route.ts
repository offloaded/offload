import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/conversations/hide
 * Hides or unhides a DM conversation from the sidebar without deleting it.
 * Body: { agent_id: string, hidden?: boolean }
 * hidden defaults to true (hide). Pass false to unhide.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agent_id, hidden } = await req.json();
  if (!agent_id) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { error } = await service
    .from("conversations")
    .update({ sidebar_hidden: hidden !== false })
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspaceId)
    .eq("agent_id", agent_id)
    .eq("archived", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
