import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

const VALID_STATUSES = ["draft", "in_progress", "review", "complete"];

// GET /api/work-items/[id] — fetch a single work item
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

  // Fetch work item with agent info
  const { data: workItem, error } = await service
    .from("work_items")
    .select("*, agents(name, color)")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (error || !workItem) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  // Flatten agent info
  const { agents, ...rest } = workItem as Record<string, unknown>;
  const agent = agents as { name: string; color: string } | null;

  // Fetch linked report content
  let reportData: { title: string; content: string } | null = null;
  if (rest.report_id) {
    const { data: report } = await service
      .from("reports")
      .select("title, content")
      .eq("id", rest.report_id as string)
      .single();
    reportData = report || null;
  }

  return NextResponse.json({
    ...rest,
    agent_name: agent?.name || null,
    agent_color: agent?.color || null,
    report_title: reportData?.title || null,
    report_content: reportData?.content || null,
  });
}

// PATCH /api/work-items/[id] — update a work item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, status, agent_id } = body as {
    title?: string;
    status?: string;
    agent_id?: string;
  };

  if (!title && !status && agent_id === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (title !== undefined) updates.title = title.trim();
  if (status !== undefined) updates.status = status;
  if (agent_id !== undefined) updates.agent_id = agent_id || null;

  const { data, error } = await service
    .from("work_items")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Work item not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/work-items/[id] — delete a work item
export async function DELETE(
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

  // Delete the work item row only (preserve linked report and conversation)
  const { error } = await service
    .from("work_items")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
