import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { parseDocxTemplate, parseTextTemplate } from "@/lib/template-parser";
import { NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = /\.(docx|txt|md)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!ALLOWED_EXTENSIONS.test(file.name)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload .docx, .txt, or .md files." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parse structure from file
  let structure;
  if (file.name.endsWith(".docx")) {
    structure = await parseDocxTemplate(buffer);
  } else {
    const text = buffer.toString("utf-8");
    structure = parseTextTemplate(text);
  }

  if (structure.length === 0) {
    return NextResponse.json(
      { error: "No headings found in file. Use headings (H1-H3) or markdown # headings to define report sections." },
      { status: 400 }
    );
  }

  // Store file in Supabase Storage
  const service = createServiceSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ctx.user.id}/${Date.now()}_${safeName}`;

  // Use service client for storage (no RLS on storage)
  const { error: uploadError } = await service.storage
    .from("report-templates")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("[Template Upload] Storage error:", uploadError.message);
    // Continue without storage — the parsed structure is what matters
  }

  // Derive template name from filename
  const name = file.name.replace(/\.(docx|txt|md)$/i, "").replace(/[_-]/g, " ");

  const { data, error } = await service
    .from("report_templates")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      name,
      description: `Uploaded from ${file.name}`,
      structure,
      file_name: file.name,
      file_size: file.size,
      storage_path: uploadError ? null : storagePath,
    })
    .select("id, name, description, structure, file_name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
