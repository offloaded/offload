import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("include_deleted") === "true";

  const service = createServiceSupabase();
  let query = service
    .from("agents")
    .select("*")
    .eq("workspace_id", ctx.workspaceId);

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    // Graceful fallback if deleted_at column doesn't exist yet
    if (error.message?.includes("deleted_at")) {
      const { data: fallback, error: fbError } = await service
        .from("agents")
        .select("*")
        .eq("workspace_id", ctx.workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (fbError) return NextResponse.json({ error: fbError.message }, { status: 500 });
      return NextResponse.json(fallback);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only admins can create agents" }, { status: 403 });
  }

  const body = await request.json();
  const { name, role, purpose, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("agents")
    .insert({
      user_id: ctx.user.id,
      workspace_id: ctx.workspaceId,
      name: name.trim(),
      role: role?.trim() || null,
      purpose: purpose?.trim() || "",
      color: color || "#2C5FF6",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only admins can edit agents" }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, role, purpose, color, web_search_enabled, asana_enabled, asana_projects, working_style, communication_style, voice_samples, voice_profile, soft_skills, team_expectations } = body;

  if (!id) {
    return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updates.name = name.trim();
  if (role !== undefined) updates.role = role?.trim() || null;
  if (purpose !== undefined) updates.purpose = purpose.trim();
  if (color !== undefined) updates.color = color;
  if (web_search_enabled !== undefined) updates.web_search_enabled = web_search_enabled;
  if (asana_enabled !== undefined) updates.asana_enabled = asana_enabled;
  if (asana_projects !== undefined) updates.asana_projects = asana_projects;
  if (working_style !== undefined) updates.working_style = working_style;
  if (communication_style !== undefined) updates.communication_style = communication_style;
  if (voice_samples !== undefined) updates.voice_samples = voice_samples;
  if (voice_profile !== undefined) updates.voice_profile = voice_profile;
  if (soft_skills !== undefined) updates.soft_skills = soft_skills;
  if (team_expectations !== undefined) updates.team_expectations = team_expectations;

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("agents")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
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
    return NextResponse.json({ error: "Only admins can delete agents" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Verify agent belongs to this workspace
  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Soft delete: set deleted_at instead of removing the row.
  // This preserves message history, report authorship, etc.
  const { error } = await service
    .from("agents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    // Fallback: if deleted_at column doesn't exist yet, hard delete
    if (error.message?.includes("deleted_at")) {
      await service.from("conversations").delete().eq("agent_id", id);
      await service.from("activity_log").delete().eq("agent_id", id);
      const { error: delErr } = await service
        .from("agents")
        .delete()
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove from team memberships so the deleted agent doesn't participate in team chats
  await service
    .from("team_members")
    .delete()
    .eq("agent_id", id);

  // Hide DM conversations with this agent from sidebar
  const hidPayload: Record<string, unknown> = { sidebar_hidden: true };
  try {
    await service
      .from("conversations")
      .update(hidPayload)
      .eq("agent_id", id)
      .eq("archived", false);
  } catch {
    // sidebar_hidden column may not exist yet
  }

  // Disable scheduled tasks for this agent
  await service
    .from("scheduled_tasks")
    .update({ enabled: false })
    .eq("agent_id", id);

  return NextResponse.json({ success: true });
}
