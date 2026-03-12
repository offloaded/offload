import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function DELETE() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const service = createServiceSupabase();

  // Disable GitHub on all agents and clear repo assignments
  await service
    .from("agents")
    .update({ github_enabled: false, github_repositories: null, updated_at: new Date().toISOString() })
    .eq("workspace_id", ctx.workspaceId);

  // Delete the integration record
  const { error } = await service
    .from("integrations")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "github");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }));
}
