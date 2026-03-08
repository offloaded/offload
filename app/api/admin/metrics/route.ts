import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function GET() {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabase();

  // Total users via auth admin API
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const totalUsers = users.length;

  // Active today — users with messages in the last 24 hours
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("conversation_id")
    .gte("created_at", yesterday)
    .eq("role", "user");

  const convIds = [
    ...new Set(recentMessages?.map((m) => m.conversation_id) || []),
  ];
  const { data: convUsers } =
    convIds.length > 0
      ? await supabase
          .from("conversations")
          .select("user_id")
          .in("id", convIds)
      : { data: [] as { user_id: string }[] };
  const activeToday = new Set(convUsers?.map((c) => c.user_id) || []).size;

  // Counts
  const [agentsRes, msgsRes, docsRes, tasksRes] = await Promise.all([
    supabase.from("agents").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase
      .from("scheduled_tasks")
      .select("id", { count: "exact", head: true }),
  ]);

  // API costs
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: todayCosts } = await supabase
    .from("api_usage")
    .select("cost")
    .gte("created_at", todayStart.toISOString());

  const { data: monthCosts } = await supabase
    .from("api_usage")
    .select("cost, service")
    .gte("created_at", monthStart.toISOString());

  const apiCostToday =
    todayCosts?.reduce((s, r) => s + Number(r.cost), 0) || 0;
  const apiCostMonth =
    monthCosts?.reduce((s, r) => s + Number(r.cost), 0) || 0;

  // Cost breakdown by service
  const costByService: Record<string, number> = {};
  for (const row of monthCosts || []) {
    costByService[row.service] =
      (costByService[row.service] || 0) + Number(row.cost);
  }

  // Average response time this month
  const { data: avgRt } = await supabase
    .from("api_usage")
    .select("response_time_ms")
    .gte("created_at", monthStart.toISOString())
    .not("response_time_ms", "is", null);

  const avgResponseTime = avgRt?.length
    ? Math.round(
        avgRt.reduce((s, r) => s + r.response_time_ms, 0) / avgRt.length
      )
    : 0;

  // Top agents by message count
  const { data: agentConvs } = await supabase
    .from("conversations")
    .select("id, agent_id")
    .not("agent_id", "is", null);

  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, name, color");

  const agentMsgCount: Record<string, number> = {};
  const agentDocCount: Record<string, number> = {};

  if (agentConvs?.length) {
    const agentConvMap: Record<string, string[]> = {};
    for (const c of agentConvs) {
      if (!agentConvMap[c.agent_id]) agentConvMap[c.agent_id] = [];
      agentConvMap[c.agent_id].push(c.id);
    }

    for (const [agentId, agentConvIds] of Object.entries(agentConvMap)) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", agentConvIds);
      agentMsgCount[agentId] = count || 0;
    }
  }

  // Document counts per agent
  const { data: allDocs } = await supabase
    .from("documents")
    .select("agent_id");
  for (const doc of allDocs || []) {
    agentDocCount[doc.agent_id] =
      (agentDocCount[doc.agent_id] || 0) + 1;
  }

  const topAgents = (allAgents || [])
    .map((a) => ({
      name: a.name,
      color: a.color,
      messages: agentMsgCount[a.id] || 0,
      docs: agentDocCount[a.id] || 0,
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 6);

  return NextResponse.json({
    totalUsers,
    activeToday,
    totalAgents: agentsRes.count || 0,
    totalMessages: msgsRes.count || 0,
    totalDocuments: docsRes.count || 0,
    totalScheduledTasks: tasksRes.count || 0,
    apiCostToday: Math.round(apiCostToday * 100) / 100,
    apiCostMonth: Math.round(apiCostMonth * 100) / 100,
    costByService,
    avgResponseTime,
    topAgents,
  });
}
