import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/work-items/[id]/executions — list execution contexts for a work item
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const service = createServiceSupabase();

  // Verify the work item belongs to this workspace
  const { data: workItem } = await service
    .from("work_items")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("work_execution_contexts")
    .select("*")
    .eq("work_item_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/work-items/[id]/executions — create a new execution context (new run)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const service = createServiceSupabase();

  // Load the work item
  const { data: workItem } = await service
    .from("work_items")
    .select("id, agent_id, title, instructions, workspace_id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  // Create a fresh conversation for this execution (isolated from other runs)
  const { data: conversation, error: convError } = await service
    .from("conversations")
    .insert({
      user_id: ctx.user.id,
      workspace_id: ctx.workspaceId,
      agent_id: workItem.agent_id || null,
      archived: false,
    })
    .select("id")
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Failed to create execution conversation" }, { status: 500 });
  }

  // Build context summary — what's included in this execution
  const contextSummary: Record<string, unknown> = {
    work_item_title: workItem.title,
    has_instructions: !!workItem.instructions,
    agent_id: workItem.agent_id,
  };

  // Create the execution context record
  const { data: execCtx, error: execError } = await service
    .from("work_execution_contexts")
    .insert({
      work_item_id: id,
      agent_id: workItem.agent_id || null,
      conversation_id: conversation.id,
      status: "running",
      context_summary: contextSummary,
    })
    .select()
    .single();

  if (execError) {
    return NextResponse.json({ error: execError.message }, { status: 500 });
  }

  // If the work item has instructions, seed them as the first message
  if (workItem.instructions?.trim()) {
    await service.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: workItem.instructions.trim(),
    });
  }

  // Update the work item to point to this execution's conversation and mark as in_progress
  await service
    .from("work_items")
    .update({
      conversation_id: conversation.id,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Log activity event
  await service.from("activity_events").insert({
    workspace_id: ctx.workspaceId,
    agent_id: workItem.agent_id || null,
    work_item_id: id,
    event_type: "work_started",
    description: `started work on ${workItem.title}`,
  }).then(() => {}, () => {}); // fire-and-forget

  return NextResponse.json(execCtx, { status: 201 });
}
