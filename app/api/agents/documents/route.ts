import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  // Verify the agent belongs to this user
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach chunk counts per document for status diagnostics
  const docIds = (data || []).map((d: { id: string }) => d.id);
  let chunkCounts: Record<string, number> = {};
  if (docIds.length > 0) {
    const { data: counts } = await supabase
      .rpc("count_chunks_by_document", { doc_ids: docIds });
    if (counts) {
      for (const row of counts) {
        chunkCounts[row.document_id] = row.chunk_count;
      }
    }
  }

  const enriched = (data || []).map((d: { id: string }) => ({
    ...d,
    chunk_count: chunkCounts[d.id] || 0,
  }));

  return NextResponse.json(enriched);
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("id");

  if (!docId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Get doc with agent ownership check
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, agent_id")
    .eq("id", docId)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", doc.agent_id)
    .eq("user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete from storage
  await supabase.storage.from("documents").remove([doc.storage_path]);

  // Delete document record (cascades to chunks)
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
