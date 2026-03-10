import { getWorkspaceContext } from "@/lib/workspace";
import { createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: workspace } = await service
    .from("workspaces")
    .select("*")
    .eq("id", ctx.workspaceId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Get member count
  const { count } = await service
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId);

  return NextResponse.json({
    ...workspace,
    role: ctx.role,
    member_count: count || 1,
  });
}
