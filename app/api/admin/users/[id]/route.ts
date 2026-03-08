import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const supabase = createServiceSupabase();

  // Basic user info from auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.admin.getUserById(userId);

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // User's agents with message counts
  const { data: userAgents } = await supabase
    .from("agents")
    .select("id, name, color, created_at")
    .eq("user_id", userId);

  // Conversations for this user
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, agent_id")
    .eq("user_id", userId);

  const convIds = (convs || []).map((c) => c.id);
  const conversationCount = convIds.length;

  // Message counts per agent
  const agentMsgCounts: Record<string, number> = {};
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds);

    const convToAgent: Record<string, string> = {};
    for (const c of convs || []) {
      if (c.agent_id) convToAgent[c.id] = c.agent_id;
    }

    for (const m of msgs || []) {
      const agentId = convToAgent[m.conversation_id];
      if (agentId) {
        agentMsgCounts[agentId] = (agentMsgCounts[agentId] || 0) + 1;
      }
    }
  }

  const agentsWithStats = (userAgents || []).map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    created_at: a.created_at,
    message_count: agentMsgCounts[a.id] || 0,
  }));

  // Documents
  const { count: documentCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .in(
      "agent_id",
      (userAgents || []).map((a) => a.id)
    );

  // Scheduled tasks
  const { data: tasks } = await supabase
    .from("scheduled_tasks")
    .select("id, enabled")
    .eq("user_id", userId);

  const activeTasks = (tasks || []).filter((t) => t.enabled).length;
  const pausedTasks = (tasks || []).filter((t) => !t.enabled).length;

  // Daily token usage and cost for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: usageData } = await supabase
    .from("api_usage")
    .select("tokens_in, tokens_out, cost, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo);

  const dailyUsage: Record<string, { tokens: number; cost: number }> = {};
  for (const u of usageData || []) {
    const day = new Date(u.created_at).toISOString().split("T")[0];
    if (!dailyUsage[day]) dailyUsage[day] = { tokens: 0, cost: 0 };
    dailyUsage[day].tokens += (u.tokens_in || 0) + (u.tokens_out || 0);
    dailyUsage[day].cost += Number(u.cost) || 0;
  }

  // Build ordered daily data for last 30 days
  const dailyData: { date: string; tokens: number; cost: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000)
      .toISOString()
      .split("T")[0];
    const entry = dailyUsage[date];
    dailyData.push({
      date,
      tokens: entry?.tokens || 0,
      cost: Math.round((entry?.cost || 0) * 10000) / 10000,
    });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    suspended: profile?.suspended || false,
    monthly_token_limit: profile?.monthly_token_limit || null,
    conversationCount,
    agents: agentsWithStats,
    documentCount: documentCount || 0,
    scheduledTasks: {
      total: (tasks || []).length,
      active: activeTasks,
      paused: pausedTasks,
    },
    dailyUsage: dailyData,
  });
}
