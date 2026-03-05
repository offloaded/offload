import { createServerSupabase } from "@/lib/supabase-server";
import { processDocument } from "@/lib/rag";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { document_id } = await request.json();

  if (!document_id) {
    return NextResponse.json(
      { error: "document_id is required" },
      { status: 400 }
    );
  }

  // Verify document belongs to user's agent
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, agent_id, status")
    .eq("id", document_id)
    .single();

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", doc.agent_id)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (doc.status === "ready") {
    return NextResponse.json({ message: "Already processed" });
  }

  try {
    await processDocument(supabase, document_id, doc.storage_path);
    return NextResponse.json({ message: "Processing complete" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
