import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/reports — list reports or get count
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const countOnly = url.searchParams.get("count_only");

  const service = createServiceSupabase();

  if (countOnly) {
    const { count } = await service
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId);
    return NextResponse.json({ count: count || 0 });
  }

  // Try with display_name first (added in migration 030)
  let { data: reports, error } = await service
    .from("reports")
    .select("id, title, display_name, source, agent_id, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[GET /api/reports] Query error:", error.message, error.details, error.hint, error.code);

    // Fallback: display_name column may not exist yet (migration 030 not applied)
    const fallback = await service
      .from("reports")
      .select("id, title, source, agent_id, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fallback.error) {
      console.error("[GET /api/reports] Fallback also failed:", fallback.error.message);
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }

    // Add null display_name so the frontend shape is consistent
    reports = (fallback.data || []).map((r) => ({ ...r, display_name: null }));
  }

  return NextResponse.json(reports || []);
}

// POST /api/reports — create a report
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, agent_id, conversation_id, message_id, source } = body as {
    title: string;
    content: string;
    agent_id?: string;
    conversation_id?: string;
    message_id?: string;
    source?: string;
  };

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data, error } = await service
    .from("reports")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      title,
      content,
      agent_id: agent_id || null,
      conversation_id: conversation_id || null,
      message_id: message_id || null,
      source: source || "manual",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

// DELETE /api/reports — delete a report
export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { error } = await service
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
