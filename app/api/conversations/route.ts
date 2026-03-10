import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

const PAGE_SIZE = 30;

export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = ctx.user;
  const supabase = await createServerSupabase();
  const service = createServiceSupabase();

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");
  const conversationId = searchParams.get("conversation_id");
  const teamId = searchParams.get("team_id");
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const limit = parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10);

  // Fetch messages newer than a timestamp (for polling)
  if (conversationId && after) {
    return loadNewMessages(service, conversationId, after);
  }

  // Load a specific conversation by ID — use service to allow shared channel access
  if (conversationId) {
    return loadConversation(service, null, conversationId, before, limit);
  }

  // Load team conversation — shared across workspace members
  if (teamId) {
    // Verify access for private channels
    const { data: teamData } = await service
      .from("teams")
      .select("id, visibility")
      .eq("id", teamId)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (!teamData) {
      return NextResponse.json({ conversation_id: null, messages: [], has_more: false });
    }

    if (teamData.visibility === "private") {
      const { data: membership } = await service
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", teamId)
        .eq("user_id", user.id)
        .single();
      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { data: teamConv } = await service
      .from("conversations")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .is("agent_id", null)
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!teamConv) {
      return NextResponse.json({
        conversation_id: null,
        messages: [],
        has_more: false,
      });
    }
    return loadConversation(service, null, teamConv.id, before, limit);
  }

  // Load the most recent conversation for an agent (existing behavior)
  if (!agentId) {
    return NextResponse.json(
      { error: "agent_id, conversation_id, or team_id is required" },
      { status: 400 }
    );
  }

  if (agentId === "group") {
    // Group chat is shared across workspace
    const { data: groupConv } = await service
      .from("conversations")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .is("agent_id", null)
      .is("team_id", null)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!groupConv) {
      return NextResponse.json({
        conversation_id: null,
        messages: [],
        has_more: false,
      });
    }
    return loadConversation(service, null, groupConv.id, before, limit);
  }

  // Agent DMs — private per user
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_id", agentId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string | null,
  conversationId: string,
  before: string | null,
  limit: number
) {
  // Verify the conversation exists (optionally scoped to user for DMs)
  let convQuery = supabase
    .from("conversations")
    .select("id, previous_conversation_id, archived")
    .eq("id", conversationId);

  if (userId) {
    convQuery = convQuery.eq("user_id", userId);
  }

  const { data: conv } = await convQuery.single();

  if (!conv) {
    return NextResponse.json({
      conversation_id: null,
      messages: [],
      has_more: false,
    });
  }

  // Check if there's a previous conversation summary
  let previousSummary: string | null = null;
  if (conv.previous_conversation_id) {
    const { data: prevConv } = await supabase
      .from("conversations")
      .select("summary")
      .eq("id", conv.previous_conversation_id)
      .single();
    if (prevConv?.summary) {
      previousSummary = prevConv.summary;
    }
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
    previous_summary: previousSummary,
    previous_conversation_id: conv.previous_conversation_id,
  });
}

async function loadNewMessages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  after: string
) {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages || [] });
}
