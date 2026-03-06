import { createServerSupabase } from "@/lib/supabase-server";
import { processDocument } from "@/lib/rag";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
  "text/markdown",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const agentId = formData.get("agent_id") as string | null;

  if (!file || !agentId) {
    return NextResponse.json(
      { error: "file and agent_id are required" },
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx|xlsx|xls|txt|md|csv)$/i)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload PDF, DOCX, XLSX, TXT, or CSV." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20MB." },
      { status: 400 }
    );
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Upload to Supabase Storage — sanitize filename to prevent path traversal
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
  const storagePath = `${user.id}/${agentId}/${Date.now()}_${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      agent_id: agentId,
      file_name: file.name,
      file_size: file.size,
      storage_path: storagePath,
      status: "processing",
    })
    .select()
    .single();

  if (docError || !doc) {
    return NextResponse.json(
      { error: `Failed to create document record: ${docError?.message}` },
      { status: 500 }
    );
  }

  // Process document inline (extract text, chunk, embed, store)
  try {
    await processDocument(supabase, doc.id, storagePath);
    // Refresh the doc to return updated status
    const { data: updatedDoc } = await supabase
      .from("documents")
      .select()
      .eq("id", doc.id)
      .single();
    return NextResponse.json(updatedDoc || doc, { status: 201 });
  } catch (err) {
    console.error("Document processing failed:", err);
    // Document record exists with status 'error' (set by processDocument)
    // Return it so UI shows the error state
    const { data: errorDoc } = await supabase
      .from("documents")
      .select()
      .eq("id", doc.id)
      .single();
    return NextResponse.json(errorDoc || doc, { status: 201 });
  }
}
