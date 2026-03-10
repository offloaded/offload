import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Fetch all teams in workspace with their agent members
  const { data: teams, error } = await service
    .from("teams")
    .select("*, team_members(agent_id)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter out private channels the user doesn't have access to
  const allTeams = teams || [];
  const privateTeamIds = allTeams
    .filter((t) => t.visibility === "private")
    .map((t) => t.id);

  let memberChannelIds = new Set<string>();
  if (privateTeamIds.length > 0) {
    const { data: memberships } = await service
      .from("channel_members")
      .select("channel_id")
      .eq("user_id", ctx.user.id)
      .in("channel_id", privateTeamIds);
    memberChannelIds = new Set((memberships || []).map((m) => m.channel_id));
  }

  const visible = allTeams.filter((t) => {
    if (t.visibility === "public") return true;
    return memberChannelIds.has(t.id);
  });

  const result = visible.map((t) => ({
    id: t.id,
    user_id: t.user_id,
    workspace_id: t.workspace_id,
    name: t.name,
    description: t.description,
    visibility: t.visibility || "public",
    is_system: t.is_system || false,
    created_by: t.created_by || null,
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
  const { name, description, agent_ids, visibility, member_ids } = body;

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
      visibility: visibility === "private" ? "private" : "public",
      created_by: ctx.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add agent members if provided
  if (agent_ids?.length > 0) {
    const members = agent_ids.map((agent_id: string) => ({
      team_id: team.id,
      agent_id,
    }));
    await service.from("team_members").insert(members);
  }

  // For private channels, add channel members (creator + selected users)
  if (visibility === "private") {
    const channelMembers = [
      { channel_id: team.id, user_id: ctx.user.id, added_by: ctx.user.id },
    ];
    if (member_ids?.length > 0) {
      for (const uid of member_ids as string[]) {
        if (uid !== ctx.user.id) {
          channelMembers.push({ channel_id: team.id, user_id: uid, added_by: ctx.user.id });
        }
      }
    }
    await service.from("channel_members").insert(channelMembers);
  }

  return NextResponse.json({
    ...team,
    agent_ids: agent_ids || [],
  }, { status: 201 });
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

  // Prevent editing system channels' core properties
  const { data: existing } = await service
    .from("teams")
    .select("is_system")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (existing?.is_system) {
    return NextResponse.json({ error: "Cannot modify system channels" }, { status: 403 });
  }

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

  // Update agent members if provided
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

  // Prevent deleting system channels
  const { data: existing } = await service
    .from("teams")
    .select("is_system")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (existing?.is_system) {
    return NextResponse.json({ error: "Cannot delete system channels" }, { status: 403 });
  }

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
