import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const PAGE_SIZE = 30;

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
  const conversationId = searchParams.get("conversation_id");
  const before = searchParams.get("before");
  const limit = parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10);

  // Load a specific conversation by ID
  if (conversationId) {
    return loadConversation(supabase, user.id, conversationId, before, limit);
  }

  // Load the most recent conversation for an agent (existing behavior)
  if (!agentId) {
    return NextResponse.json(
      { error: "agent_id or conversation_id is required" },
      { status: 400 }
    );
  }

  // Find the most recent conversation
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (agentId === "group") {
    query = query.is("agent_id", null);
  } else {
    query = query.eq("agent_id", agentId);
  }

  const { data: conversation } = await query.single();

  if (!conversation) {
    return NextResponse.json({
      conversation_id: null,
      messages: [],
      has_more: false,
    });
  }

  return loadConversation(supabase, user.id, conversation.id, before, limit);
}

async function loadConversation(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  conversationId: string,
  before: string | null,
  limit: number
) {
  // Verify the conversation belongs to the user
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!conv) {
    return NextResponse.json({
      conversation_id: null,
      messages: [],
      has_more: false,
    });
  }

  // Build messages query with pagination
  let msgQuery = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (before) {
    msgQuery = msgQuery.lt("created_at", before);
  }

  const { data: messages, error } = await msgQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = messages || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Return in ascending order (oldest first) for display
  page.reverse();

  return NextResponse.json({
    conversation_id: conversationId,
    messages: page,
    has_more: hasMore,
  });
}
