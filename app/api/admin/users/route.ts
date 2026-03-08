import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") || "created_at";
  const order = url.searchParams.get("order") || "desc";

  // Get all users via auth admin API
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const userIds = users.map((u) => u.id);

  // Profiles
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("*")
    .in("id", userIds);
  const profileMap = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p])
  );

  // Agent counts per user
  const { data: agents } = await supabase.from("agents").select("user_id");
  const agentCounts: Record<string, number> = {};
  for (const a of agents || []) {
    agentCounts[a.user_id] = (agentCounts[a.user_id] || 0) + 1;
  }

  // Message counts and last active per user (via conversations)
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, user_id");
  const convMap: Record<string, string> = {};
  for (const c of convs || []) {
    convMap[c.id] = c.user_id;
  }

  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, created_at")
    .eq("role", "user");
  const msgCounts: Record<string, number> = {};
  const lastActive: Record<string, string> = {};
  for (const m of msgs || []) {
    const uid = convMap[m.conversation_id];
    if (!uid) continue;
    msgCounts[uid] = (msgCounts[uid] || 0) + 1;
    if (!lastActive[uid] || m.created_at > lastActive[uid]) {
      lastActive[uid] = m.created_at;
    }
  }

  // Token usage per user — current month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: usage } = await supabase
    .from("api_usage")
    .select("user_id, tokens_in, tokens_out, cost")
    .gte("created_at", monthStart.toISOString());

  const tokenUsage: Record<string, { tokens: number; cost: number }> = {};
  for (const u of usage || []) {
    if (!tokenUsage[u.user_id])
      tokenUsage[u.user_id] = { tokens: 0, cost: 0 };
    tokenUsage[u.user_id].tokens += (u.tokens_in || 0) + (u.tokens_out || 0);
    tokenUsage[u.user_id].cost += Number(u.cost) || 0;
  }

  // All-time token usage
  const { data: allUsage } = await supabase
    .from("api_usage")
    .select("user_id, tokens_in, tokens_out, cost");

  const totalTokenUsage: Record<string, { tokens: number; cost: number }> = {};
  for (const u of allUsage || []) {
    if (!totalTokenUsage[u.user_id])
      totalTokenUsage[u.user_id] = { tokens: 0, cost: 0 };
    totalTokenUsage[u.user_id].tokens +=
      (u.tokens_in || 0) + (u.tokens_out || 0);
    totalTokenUsage[u.user_id].cost += Number(u.cost) || 0;
  }

  // Build result
  let result = users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_active: lastActive[u.id] || null,
    agent_count: agentCounts[u.id] || 0,
    message_count: msgCounts[u.id] || 0,
    total_tokens: totalTokenUsage[u.id]?.tokens || 0,
    total_cost: totalTokenUsage[u.id]?.cost || 0,
    month_tokens: tokenUsage[u.id]?.tokens || 0,
    month_cost: tokenUsage[u.id]?.cost || 0,
    monthly_token_limit: profileMap[u.id]?.monthly_token_limit || null,
    suspended: profileMap[u.id]?.suspended || false,
  }));

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((u) => u.email?.toLowerCase().includes(q));
  }

  // Sort
  const sortKey = sort as keyof (typeof result)[0];
  result.sort((a, b) => {
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });

  return NextResponse.json(result);
}
