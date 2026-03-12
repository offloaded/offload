import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function DELETE() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const service = createServiceSupabase();

  // Remove all agent Asana project links in this workspace
  const { data: agents } = await service
    .from("agents")
    .select("id")
    .eq("workspace_id", ctx.workspaceId);

  if (agents && agents.length > 0) {
    const agentIds = agents.map((a) => a.id);
    await service
      .from("agent_asana_projects")
      .delete()
      .in("agent_id", agentIds);

    // Disable Asana on all agents and clear project assignments
    await service
      .from("agents")
      .update({ asana_enabled: false, asana_projects: null, updated_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId);
  }

  // Delete the integration record
  const { error } = await service
    .from("integrations")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "asana");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }));
}
