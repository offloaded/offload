import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Get all workspaces the user is a member of
  const { data: memberships } = await service
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json([]);
  }

  const wsIds = memberships.map((m) => m.workspace_id);
  const { data: workspaces } = await service
    .from("workspaces")
    .select("*")
    .in("id", wsIds)
    .order("created_at", { ascending: true });

  // Combine workspace data with user's role
  const result = (workspaces || []).map((ws) => ({
    ...ws,
    role: memberships.find((m) => m.workspace_id === ws.id)?.role || "member",
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: ws, error } = await service
    .from("workspaces")
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add creator as owner
  await service.from("workspace_members").insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: "owner",
    invited_by: user.id,
  });

  return NextResponse.json({ ...ws, role: "owner" }, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Workspace ID required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify user is owner or admin
  const { data: member } = await service
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();

  const { data, error } = await service
    .from("workspaces")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
