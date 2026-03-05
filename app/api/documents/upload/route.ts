import { createServerSupabase } from "@/lib/supabase-server";
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

  // Upload to Supabase Storage
  const storagePath = `${user.id}/${agentId}/${Date.now()}_${file.name}`;
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

  // Trigger processing (fire-and-forget via internal API call)
  const origin = request.headers.get("origin") || request.headers.get("host");
  const protocol = origin?.startsWith("localhost") ? "http" : "https";
  const baseUrl = origin?.startsWith("http") ? origin : `${protocol}://${origin}`;

  fetch(`${baseUrl}/api/documents/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") || "",
    },
    body: JSON.stringify({ document_id: doc.id }),
  }).catch((err) => {
    console.error("Failed to trigger processing:", err);
  });

  return NextResponse.json(doc, { status: 201 });
}
