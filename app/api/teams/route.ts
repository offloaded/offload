import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Fetch teams with their member agent IDs — scoped to workspace
  const { data: teams, error } = await service
    .from("teams")
    .select("*, team_members(agent_id)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten team_members into agent_ids array
  const result = (teams || []).map((t) => ({
    id: t.id,
    user_id: t.user_id,
    workspace_id: t.workspace_id,
    name: t.name,
    description: t.description,
    created_at: t.created_at,
    updated_at: t.updated_at,
    agent_ids: (t.team_members || []).map((m: { agent_id: string }) => m.agent_id),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only admins can create teams" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, agent_ids } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: team, error } = await service
    .from("teams")
    .insert({
      user_id: ctx.user.id,
      workspace_id: ctx.workspaceId,
      name: name.trim(),
      description: description?.trim() || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add members if provided
  if (agent_ids?.length > 0) {
    const members = agent_ids.map((agent_id: string) => ({
      team_id: team.id,
      agent_id,
    }));
    await service.from("team_members").insert(members);
  }

  return NextResponse.json({ ...team, agent_ids: agent_ids || [] }, { status: 201 });
}

export async function PUT(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only admins can edit teams" }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, description, agent_ids } = body;

  if (!id) {
    return NextResponse.json({ error: "Team ID required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();

  const { data: team, error } = await service
    .from("teams")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update members if provided — replace all
  if (agent_ids !== undefined) {
    await service.from("team_members").delete().eq("team_id", id);
    if (agent_ids.length > 0) {
      const members = agent_ids.map((agent_id: string) => ({
        team_id: id,
        agent_id,
      }));
      await service.from("team_members").insert(members);
    }
  }

  return NextResponse.json({ ...team, agent_ids: agent_ids || [] });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only admins can delete teams" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Team ID required" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
