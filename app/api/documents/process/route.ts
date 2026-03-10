import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { processDocument } from "@/lib/rag";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabase();
  const service = createServiceSupabase();

  const { document_id } = await request.json();

  if (!document_id) {
    return NextResponse.json(
      { error: "document_id is required" },
      { status: 400 }
    );
  }

  // Verify document exists
  const { data: doc } = await service
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

  // Verify agent belongs to workspace
  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", doc.agent_id)
    .eq("workspace_id", ctx.workspaceId)
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
