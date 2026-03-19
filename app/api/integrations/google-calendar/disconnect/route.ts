import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function DELETE() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const service = createServiceSupabase();

  // Disable Google Calendar on all agents and clear calendar assignments
  await service
    .from("agents")
    .update({ google_calendar_enabled: false, google_calendar_ids: null, updated_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId);

  // Delete the integration record
  const { error } = await service
    .from("integrations")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google_calendar");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }));
}
