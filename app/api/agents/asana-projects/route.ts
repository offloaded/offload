import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/workspace";

export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agent_id");
  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify agent belongs to workspace
  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: projects } = await service
    .from("agent_asana_projects")
    .select("id, asana_project_gid, asana_project_name, asana_workspace_name")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });

  return NextResponse.json(projects || []);
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const body = await request.json();
  const { agent_id, asana_project_gid, asana_project_name, asana_workspace_name } = body;

  if (!agent_id || !asana_project_gid || !asana_project_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify agent belongs to workspace
  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", agent_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("agent_asana_projects")
    .upsert(
      { agent_id, asana_project_gid, asana_project_name, asana_workspace_name: asana_workspace_name || null },
      { onConflict: "agent_id,asana_project_gid" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("agent_asana_projects")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
