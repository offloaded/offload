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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const cursor = searchParams.get("cursor"); // updated_at cursor for pagination

  if (query) {
    return searchConversations(supabase, user.id, query, cursor);
  }
  return listConversations(supabase, user.id, cursor);
}

async function listConversations(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  cursor: string | null
) {
  // Get conversations with their most recent message
  let convQuery = supabase
    .from("conversations")
    .select("id, agent_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    convQuery = convQuery.lt("updated_at", cursor);
  }

  const { data: conversations, error } = await convQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = conversations || [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  if (page.length === 0) {
    return NextResponse.json({ conversations: [], has_more: false });
  }

  // Get the last message for each conversation
  const convIds = page.map((c) => c.id);
  const { data: lastMessages } = await supabase
    .from("messages")
    .select("conversation_id, content, role, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });

  // Deduplicate: keep only the first (most recent) message per conversation
  const lastMsgMap = new Map<
    string,
    { content: string; role: string; created_at: string }
  >();
  for (const msg of lastMessages || []) {
    if (!lastMsgMap.has(msg.conversation_id)) {
      lastMsgMap.set(msg.conversation_id, msg);
    }
  }

  // Load agents for the conversations
  const agentIds = [...new Set(page.filter((c) => c.agent_id).map((c) => c.agent_id!))];
  let agentMap = new Map<string, { name: string; color: string }>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, color")
      .in("id", agentIds);
    for (const a of agents || []) {
      agentMap.set(a.id, { name: a.name, color: a.color });
    }
  }

  const results = page
    .map((c) => {
      const lastMsg = lastMsgMap.get(c.id);
      const agent = c.agent_id ? agentMap.get(c.agent_id) : null;
      return {
        id: c.id,
        agent_id: c.agent_id,
        agent_name: agent?.name || null,
        agent_color: agent?.color || null,
        is_group: !c.agent_id,
        preview: lastMsg ? truncate(lastMsg.content, 100) : "",
        preview_role: lastMsg?.role || null,
        last_message_at: lastMsg?.created_at || c.updated_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    })
    .filter((c) => c.preview); // only show conversations that have messages

  return NextResponse.json({
    conversations: results,
    has_more: hasMore,
  });
}

async function searchConversations(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  query: string,
  cursor: string | null
) {
  // Convert query to tsquery format: "hello world" → "hello & world"
  const tsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join(" & ");

  if (!tsQuery) {
    return NextResponse.json({ conversations: [], has_more: false });
  }

  // Search messages that belong to the user's conversations
  let msgQuery = supabase
    .from("messages")
    .select(
      "id, conversation_id, content, role, created_at, conversations!inner(user_id, agent_id, updated_at)"
    )
    .eq("conversations.user_id", userId)
    .textSearch("content", tsQuery, { type: "websearch" })
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    msgQuery = msgQuery.lt("created_at", cursor);
  }

  const { data: messages, error } = await msgQuery;

  if (error) {
    // Fallback to ILIKE search if full-text search fails
    return fallbackSearch(supabase, userId, query, cursor);
  }

  const rows = messages || [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Deduplicate by conversation_id — keep first (most recent) match
  const seen = new Set<string>();
  const unique = page.filter((m) => {
    if (seen.has(m.conversation_id)) return false;
    seen.add(m.conversation_id);
    return true;
  });

  // Load agents
  const agentIds = [
    ...new Set(
      unique
        .map((m) => (m.conversations as unknown as { agent_id: string | null })?.agent_id)
        .filter(Boolean) as string[]
    ),
  ];
  let agentMap = new Map<string, { name: string; color: string }>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, color")
      .in("id", agentIds);
    for (const a of agents || []) {
      agentMap.set(a.id, { name: a.name, color: a.color });
    }
  }

  const results = unique.map((m) => {
    const conv = m.conversations as unknown as {
      agent_id: string | null;
      updated_at: string;
    };
    const agent = conv?.agent_id ? agentMap.get(conv.agent_id) : null;
    return {
      id: m.conversation_id,
      agent_id: conv?.agent_id || null,
      agent_name: agent?.name || null,
      agent_color: agent?.color || null,
      is_group: !conv?.agent_id,
      preview: truncate(m.content, 120),
      preview_role: m.role,
      snippet: extractSnippet(m.content, query),
      message_id: m.id,
      last_message_at: m.created_at,
      created_at: m.created_at,
      updated_at: conv?.updated_at || m.created_at,
    };
  });

  return NextResponse.json({
    conversations: results,
    has_more: hasMore,
  });
}

async function fallbackSearch(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  query: string,
  cursor: string | null
) {
  // ILIKE fallback for when tsquery parsing fails
  let msgQuery = supabase
    .from("messages")
    .select(
      "id, conversation_id, content, role, created_at, conversations!inner(user_id, agent_id, updated_at)"
    )
    .eq("conversations.user_id", userId)
    .ilike("content", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    msgQuery = msgQuery.lt("created_at", cursor);
  }

  const { data: messages } = await msgQuery;
  const rows = messages || [];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const seen = new Set<string>();
  const unique = page.filter((m) => {
    if (seen.has(m.conversation_id)) return false;
    seen.add(m.conversation_id);
    return true;
  });

  const agentIds = [
    ...new Set(
      unique
        .map((m) => (m.conversations as unknown as { agent_id: string | null })?.agent_id)
        .filter(Boolean) as string[]
    ),
  ];
  let agentMap = new Map<string, { name: string; color: string }>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, color")
      .in("id", agentIds);
    for (const a of agents || []) {
      agentMap.set(a.id, { name: a.name, color: a.color });
    }
  }

  const results = unique.map((m) => {
    const conv = m.conversations as unknown as {
      agent_id: string | null;
      updated_at: string;
    };
    const agent = conv?.agent_id ? agentMap.get(conv.agent_id) : null;
    return {
      id: m.conversation_id,
      agent_id: conv?.agent_id || null,
      agent_name: agent?.name || null,
      agent_color: agent?.color || null,
      is_group: !conv?.agent_id,
      preview: truncate(m.content, 120),
      preview_role: m.role,
      snippet: extractSnippet(m.content, query),
      message_id: m.id,
      last_message_at: m.created_at,
      created_at: m.created_at,
      updated_at: conv?.updated_at || m.created_at,
    };
  });

  return NextResponse.json({
    conversations: results,
    has_more: hasMore,
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

function extractSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const queryLower = query.toLowerCase();
  const idx = lower.indexOf(queryLower);
  if (idx === -1) {
    // Try individual words
    const words = query.split(/\s+/);
    for (const word of words) {
      const wIdx = lower.indexOf(word.toLowerCase());
      if (wIdx >= 0) {
        const start = Math.max(0, wIdx - 40);
        const end = Math.min(content.length, wIdx + word.length + 60);
        return (start > 0 ? "..." : "") + content.slice(start, end).trim() + (end < content.length ? "..." : "");
      }
    }
    return truncate(content, 120);
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 60);
  return (start > 0 ? "..." : "") + content.slice(start, end).trim() + (end < content.length ? "..." : "");
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");

  if (!conversationId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", ctx.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
