import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/document-outputs/[id]/download — download generated .docx
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

  const { data: output } = await service
    .from("document_outputs")
    .select("file_name, storage_path, status")
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!output) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (output.status !== "ready") {
    return NextResponse.json({ error: "Document is not ready" }, { status: 400 });
  }

  const { data: fileData, error } = await service.storage
    .from("document-outputs")
    .download(output.storage_path);

  if (error || !fileData) {
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${output.file_name}"`,
    },
  });
}
