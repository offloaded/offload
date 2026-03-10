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
