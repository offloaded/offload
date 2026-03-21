import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/document-templates — list templates for workspace
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data, error } = await service
    .from("document_templates")
    .select("id, name, description, content, file_name, file_size, placeholders, sections, created_at, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// DELETE /api/document-templates?id=... — delete a template
export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Get the template to find its storage path
  const { data: template } = await service
    .from("document_templates")
    .select("storage_path")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Delete from storage
  if (template.storage_path) {
    await service.storage.from("document-templates").remove([template.storage_path]);
  }

  // Delete from database
  const { error } = await service
    .from("document_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
