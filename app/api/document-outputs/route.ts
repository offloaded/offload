import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/document-outputs?work_item_id=... — list outputs for a work item
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workItemId = searchParams.get("work_item_id");

  const service = createServiceSupabase();
  let query = service
    .from("document_outputs")
    .select("id, work_item_id, document_template_id, agent_id, file_name, status, error_message, created_at, document_templates(name)")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  if (workItemId) {
    query = query.eq("work_item_id", workItemId);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten template name
  const outputs = (data || []).map((d) => {
    const { document_templates, ...rest } = d as Record<string, unknown>;
    const tmpl = document_templates as { name: string } | null;
    return { ...rest, template_name: tmpl?.name || "Unknown Template" };
  });

  return NextResponse.json(outputs);
}
