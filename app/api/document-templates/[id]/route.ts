import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/document-templates/[id] — fetch a single template with full content
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

  const { data, error } = await service
    .from("document_templates")
    .select("id, name, description, content, file_name, file_size, placeholders, sections, created_at, updated_at")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/document-templates/[id] — update template name, description, or content
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
  const { name, description, content } = body as {
    name?: string;
    description?: string;
    content?: string;
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (content !== undefined) updates.content = content;

  const service = createServiceSupabase();

  const { data, error } = await service
    .from("document_templates")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id, name, description, content, placeholders, sections, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
