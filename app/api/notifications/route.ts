import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/notifications — fetch notifications for the current user
export async function GET(request: Request): Promise<Response> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread_only") === "true";

  const service = createServiceSupabase();
  let query = service
    .from("work_notifications")
    .select("*")
    .eq("user_id", ctx.user.id)
    .eq("workspace_id", ctx.workspaceId);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = data || [];
  const unread_count = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ unread_count, notifications });
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: Request): Promise<Response> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mark_all_read?: boolean; notification_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mark_all_read, notification_ids } = body;

  const service = createServiceSupabase();

  if (mark_all_read) {
    const { error } = await service
      .from("work_notifications")
      .update({ read: true })
      .eq("user_id", ctx.user.id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (notification_ids && notification_ids.length > 0) {
    const { error } = await service
      .from("work_notifications")
      .update({ read: true })
      .in("id", notification_ids)
      .eq("user_id", ctx.user.id)
      .eq("workspace_id", ctx.workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json(
      { error: "Provide mark_all_read or notification_ids" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
