import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { assembleDocument } from "@/lib/docx-assembler";
import { NextResponse } from "next/server";

/**
 * POST /api/document-outputs/assemble
 * Assemble a filled .docx from a template + placeholder data.
 * Called after agent generates content or directly by the user.
 */
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { template_id, data, work_item_id, agent_id } = body as {
    template_id: string;
    data: Record<string, string>;
    work_item_id?: string;
    agent_id?: string;
  };

  if (!template_id || !data) {
    return NextResponse.json({ error: "template_id and data are required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Fetch template
  const { data: template } = await service
    .from("document_templates")
    .select("id, name, file_name, storage_path, placeholders")
    .eq("id", template_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Download template file from storage
  const { data: fileData, error: dlError } = await service.storage
    .from("document-templates")
    .download(template.storage_path);

  if (dlError || !fileData) {
    return NextResponse.json({ error: "Failed to download template file" }, { status: 500 });
  }

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  // Create output record (status: generating)
  const timestamp = new Date().toISOString().slice(0, 10);
  const cleanTitle = work_item_id
    ? `${template.name}-${timestamp}`
    : `${template.name}-${timestamp}`;
  const outputFileName = `${cleanTitle}.docx`.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${ctx.workspaceId}/${work_item_id || "manual"}/${Date.now()}-${outputFileName}`;

  const { data: outputRow, error: insertError } = await service
    .from("document_outputs")
    .insert({
      workspace_id: ctx.workspaceId,
      work_item_id: work_item_id || null,
      document_template_id: template_id,
      agent_id: agent_id || null,
      file_name: outputFileName,
      storage_path: storagePath,
      placeholder_data: data,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !outputRow) {
    return NextResponse.json({ error: "Failed to create output record" }, { status: 500 });
  }

  // Assemble the document
  try {
    const expectedPlaceholders = (template.placeholders as Array<{ name: string }>).map((p) => p.name);
    const result = assembleDocument(templateBuffer, data, expectedPlaceholders);

    // Upload assembled document
    const { error: uploadError } = await service.storage
      .from("document-outputs")
      .upload(storagePath, result.buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Mark as ready
    await service.from("document_outputs").update({
      status: "ready",
    }).eq("id", outputRow.id);

    return NextResponse.json({
      id: outputRow.id,
      file_name: outputFileName,
      status: "ready",
      missing_placeholders: result.missingPlaceholders,
    }, { status: 201 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Assembly failed";
    await service.from("document_outputs").update({
      status: "error",
      error_message: errorMsg,
    }).eq("id", outputRow.id);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
