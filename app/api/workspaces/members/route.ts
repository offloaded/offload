import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Get members with email from auth.users
  const { data: members } = await service
    .from("workspace_members")
    .select("workspace_id, user_id, role, invited_by, joined_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("joined_at", { ascending: true });

  if (!members) {
    return NextResponse.json([]);
  }

  // Fetch user emails
  const userIds = members.map((m) => m.user_id);
  const enriched = [];

  for (const member of members) {
    const { data: userData } = await service.auth.admin.getUserById(member.user_id);
    enriched.push({
      ...member,
      email: userData?.user?.email || null,
      display_name: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
    });
  }

  return NextResponse.json(enriched);
}

export async function PUT(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { user_id, role } = await request.json();
  if (!user_id || !role) {
    return NextResponse.json({ error: "user_id and role are required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Can't change owner role
  const service = createServiceSupabase();
  const { data: target } = await service
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", user_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  // Only owner can promote to admin
  if (role === "admin" && ctx.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can promote to admin" }, { status: 403 });
  }

  const { error } = await service
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  // Can't remove the owner
  const service = createServiceSupabase();
  const { data: target } = await service
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", userId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 });
  }

  const { error } = await service
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
