import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("agents")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
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
  const { id, name, role, purpose, color, web_search_enabled, working_style, communication_style, voice_samples, voice_profile, soft_skills, team_expectations } = body;

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

  // Explicit cleanup before agent delete
  await service
    .from("conversations")
    .delete()
    .eq("agent_id", id);

  await service
    .from("activity_log")
    .delete()
    .eq("agent_id", id);

  const { error } = await service
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
