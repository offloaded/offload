import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/work-items — list work items for the current workspace
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const service = createServiceSupabase();
  let query = service
    .from("work_items")
    .select("*, agents(name, color)")
    .eq("workspace_id", ctx.workspaceId);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten agent info from the join
  const items = (data || []).map((item) => {
    const { agents, ...rest } = item as Record<string, unknown>;
    const agent = agents as { name: string; color: string } | null;
    return {
      ...rest,
      agent_name: agent?.name || null,
      agent_color: agent?.color || null,
    };
  });

  return NextResponse.json(items);
}

// POST /api/work-items — create a new work item
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, agent_id, instructions } = body as {
    title: string;
    agent_id?: string;
    instructions?: string;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // 1. Create a conversation for this work item
  const { data: conversation, error: convError } = await service
    .from("conversations")
    .insert({
      user_id: ctx.user.id,
      workspace_id: ctx.workspaceId,
      agent_id: agent_id || null,
      archived: false,
    })
    .select("id")
    .single();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }

  // 2. Create an empty report
  const { data: report, error: reportError } = await service
    .from("reports")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      title: title.trim(),
      content: "",
      agent_id: agent_id || null,
      conversation_id: conversation.id,
    })
    .select("id")
    .single();

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  // 3. Create the work_item row
  const { data: workItem, error: wiError } = await service
    .from("work_items")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      title: title.trim(),
      agent_id: agent_id || null,
      report_id: report.id,
      conversation_id: conversation.id,
    })
    .select()
    .single();

  if (wiError) {
    return NextResponse.json({ error: wiError.message }, { status: 500 });
  }

  // 4. If instructions are provided and agent_id is set, send the initial message
  if (instructions?.trim() && agent_id) {
    await service.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: instructions.trim(),
    });
  }

  return NextResponse.json(workItem, { status: 201 });
}
