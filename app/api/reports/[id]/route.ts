import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/reports/[id] — get a single report
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

  const { data: report, error } = await service
    .from("reports")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Enrich with agent name
  let agentName: string | null = null;
  if (report.agent_id) {
    const { data: agent } = await service
      .from("agents")
      .select("name")
      .eq("id", report.agent_id)
      .single();
    agentName = agent?.name || null;
  }

  return NextResponse.json({ ...report, agent_name: agentName });
}

// PATCH /api/reports/[id] — update a report's title and/or content
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
  const { title, content, display_name } = body as { title?: string; content?: string; display_name?: string };

  if (!title && !content && display_name === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Fetch the current report to preserve original_content on first edit
  const { data: existing, error: fetchError } = await service
    .from("reports")
    .select("content, original_content, user_id, workspace_id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (title) updates.title = title;
  if (display_name !== undefined) updates.display_name = display_name || null;
  if (content) {
    // On first edit, snapshot the original agent content
    if (!existing.original_content) {
      updates.original_content = existing.content;
    }
    updates.content = content;
  }

  // Save current version to history before overwriting (only for content changes)
  if (content) {
    try {
      await service.from("report_versions").insert({
        report_id: id,
        title: title || "Untitled",
        content: existing.content,
        author_type: "human",
        author_id: ctx.user.id,
        change_type: "human_edit",
      });
    } catch { /* non-fatal — versioning is best-effort */ }
  }

  const { error } = await service
    .from("reports")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
