import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { parseDocxTemplate, isValidDocx } from "@/lib/docx-template-parser";
import mammoth from "mammoth";
import { NextResponse } from "next/server";

// POST /api/document-templates/upload — upload a .docx template
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.endsWith(".docx")) {
    return NextResponse.json({ error: "Only .docx files are supported" }, { status: 400 });
  }

  // Read the file
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate it's a valid .docx
  if (!isValidDocx(buffer)) {
    return NextResponse.json({ error: "Invalid .docx file" }, { status: 400 });
  }

  // Parse placeholders
  let parsed;
  try {
    parsed = parseDocxTemplate(buffer);
  } catch (err) {
    console.error("[DocTemplates] Parse error:", err);
    return NextResponse.json({ error: "Failed to parse template placeholders" }, { status: 400 });
  }

  // Extract HTML content from the .docx for in-app editing and agent readability
  let htmlContent = "";
  try {
    const result = await mammoth.convertToHtml({ buffer });
    htmlContent = result.value || "";
  } catch (err) {
    console.warn("[DocTemplates] mammoth extraction failed (non-fatal):", err);
  }

  const service = createServiceSupabase();

  // Upload to storage
  const storagePath = `${ctx.workspaceId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await service.storage
    .from("document-templates")
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });

  if (uploadError) {
    console.error("[DocTemplates] Upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  // Create database record
  const templateName = name.trim() || file.name.replace(/\.docx$/i, "");
  const { data, error } = await service
    .from("document_templates")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      name: templateName,
      description: description.trim(),
      content: htmlContent,
      file_name: file.name,
      file_size: buffer.length,
      storage_path: storagePath,
      placeholders: parsed.placeholders,
      sections: parsed.sections,
    })
    .select("id, name, file_name, file_size, placeholders, sections, content, created_at")
    .single();

  if (error) {
    // Clean up uploaded file
    await service.storage.from("document-templates").remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
