import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/teams/members?team_id=xxx — list channel members
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  if (!teamId) {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify team belongs to workspace
  const { data: team } = await service
    .from("teams")
    .select("id, visibility, created_by")
    .eq("id", teamId)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.visibility !== "private") {
    return NextResponse.json([]);
  }

  // Fetch channel members with user info
  const { data: members, error } = await service
    .from("channel_members")
    .select("channel_id, user_id, added_by, added_at")
    .eq("channel_id", teamId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user emails/names from workspace_members
  const userIds = (members || []).map((m) => m.user_id);
  let userMap = new Map<string, { email: string | null }>();
  if (userIds.length > 0) {
    const { data: users } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ctx.workspaceId)
      .in("user_id", userIds);

    // Get emails from auth (service client can read auth metadata)
    for (const u of users || []) {
      userMap.set(u.user_id, { email: null });
    }
  }

  return NextResponse.json(members || []);
}

// POST /api/teams/members — add a member to a private channel
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { team_id, user_id } = body;

  if (!team_id || !user_id) {
    return NextResponse.json({ error: "team_id and user_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify team is private and belongs to workspace
  const { data: team } = await service
    .from("teams")
    .select("id, visibility, created_by, workspace_id")
    .eq("id", team_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.visibility !== "private") {
    return NextResponse.json({ error: "Channel is not private" }, { status: 400 });
  }

  // Check permission: workspace admin/owner or channel creator
  const canManageChannel =
    hasPermission(ctx.role, "admin") || team.created_by === ctx.user.id;
  if (!canManageChannel) {
    return NextResponse.json({ error: "Not authorized to manage this channel" }, { status: 403 });
  }

  // Verify user is a workspace member
  const { data: isMember } = await service
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", user_id)
    .single();

  if (!isMember) {
    return NextResponse.json({ error: "User is not a workspace member" }, { status: 400 });
  }

  const { error } = await service
    .from("channel_members")
    .upsert({
      channel_id: team_id,
      user_id,
      added_by: ctx.user.id,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/teams/members?team_id=xxx&user_id=yyy — remove a member
export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");
  const userId = searchParams.get("user_id");

  if (!teamId || !userId) {
    return NextResponse.json({ error: "team_id and user_id required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: team } = await service
    .from("teams")
    .select("id, visibility, created_by")
    .eq("id", teamId)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const canManageChannel =
    hasPermission(ctx.role, "admin") || team.created_by === ctx.user.id;
  if (!canManageChannel) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await service
    .from("channel_members")
    .delete()
    .eq("channel_id", teamId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
