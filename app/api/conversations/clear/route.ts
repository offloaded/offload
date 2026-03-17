import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/conversations/clear
 * Deletes all messages in a conversation but keeps the conversation record intact.
 * Also clears compaction_summary and agent_context_cache so stale context doesn't persist.
 * Body: { conversation_id: string }
 */
export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversation_id } = await req.json();
  if (!conversation_id) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify the conversation belongs to this user and workspace
  const { data: conv, error: convError } = await service
    .from("conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Delete all messages in this conversation
  const { error: deleteError } = await service
    .from("messages")
    .delete()
    .eq("conversation_id", conversation_id);

  if (deleteError) {
    console.error("[Clear Chat] Failed to delete messages:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Clear compaction summary and agent context cache
  await service
    .from("conversations")
    .update({
      compaction_summary: null,
      agent_context_cache: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation_id);

  console.log(`[Clear Chat] Cleared all messages for conversation=${conversation_id}`);

  return NextResponse.json({ ok: true });
}
