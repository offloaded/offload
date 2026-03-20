import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const wid = ctx.workspaceId;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const nowISO = new Date().toISOString();

  // Tomorrow boundary for "scheduled today"
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowISO = tomorrowStart.toISOString();

  // Run all queries in parallel
  const [
    activeCountRes,
    completedTodayRes,
    scheduledTodayRes,
    emailsTodayRes,
    workItemsRes,
    agentsRes,
    upcomingScheduledRes,
    activityFeedRes,
    overdueScheduledRes,
  ] = await Promise.all([
    // Active work items count
    service
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wid)
      .in("status", ["draft", "in_progress"]),

    // Completed today count
    service
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wid)
      .eq("status", "complete")
      .gte("updated_at", todayISO),

    // Scheduled today count
    service
      .from("scheduled_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wid)
      .eq("enabled", true)
      .gte("next_run_at", todayISO)
      .lt("next_run_at", tomorrowISO),

    // Emails ingested today count
    service
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wid)
      .gte("created_at", todayISO),

    // Recent 5 work items
    service
      .from("work_items")
      .select("id, title, status, source, agent_id, updated_at, agents(name)")
      .eq("workspace_id", wid)
      .order("updated_at", { ascending: false })
      .limit(5),

    // All agents in workspace
    service
      .from("agents")
      .select("id, name, color")
      .eq("workspace_id", wid)
      .is("deleted_at", null)
      .order("name"),

    // Next 3 upcoming scheduled tasks
    service
      .from("scheduled_tasks")
      .select("id, instruction, next_run_at, agent_id, agents(name)")
      .eq("workspace_id", wid)
      .eq("enabled", true)
      .gt("next_run_at", nowISO)
      .order("next_run_at", { ascending: true })
      .limit(3),

    // Recent 8 activity events
    service
      .from("activity_events")
      .select("id, event_type, description, agent_id, work_item_id, created_at, agents(name)")
      .eq("workspace_id", wid)
      .order("created_at", { ascending: false })
      .limit(8),

    // Overdue scheduled count (missed their run time)
    service
      .from("scheduled_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wid)
      .eq("enabled", true)
      .lt("next_run_at", nowISO),
  ]);

  // Get running work items per agent for status text
  const runningItemsRes = await service
    .from("work_items")
    .select("agent_id, title")
    .eq("workspace_id", wid)
    .eq("status", "in_progress");

  const runningByAgent: Record<string, string> = {};
  if (runningItemsRes.data) {
    for (const item of runningItemsRes.data) {
      if (item.agent_id) {
        runningByAgent[item.agent_id] = item.title;
      }
    }
  }

  // Build agents with status
  const agentsWithStatus = (agentsRes.data || []).map((agent: { id: string; name: string; color: string }) => {
    const runningTitle = runningByAgent[agent.id];
    return {
      id: agent.id,
      name: agent.name,
      color: agent.color,
      initials: agent.name
        .split(/\s+/)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      active: !!runningTitle,
      status: runningTitle ? `Working on ${runningTitle}` : "Idle",
    };
  });

  return NextResponse.json({
    metrics: {
      activeWorkItems: activeCountRes.count ?? 0,
      completedToday: completedTodayRes.count ?? 0,
      scheduledToday: (scheduledTodayRes.count ?? 0) + (overdueScheduledRes.count ?? 0),
      overdueScheduled: overdueScheduledRes.count ?? 0,
      emailsIngested: emailsTodayRes.count ?? 0,
    },
    workItems: (workItemsRes.data || []).map((w: Record<string, unknown>) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      source: w.source || "manual",
      agent_name: (w.agents as { name: string } | null)?.name || null,
      updated_at: w.updated_at,
    })),
    agents: agentsWithStatus,
    upcomingScheduled: (upcomingScheduledRes.data || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.instruction,
      next_run_at: s.next_run_at,
      agent_name: (s.agents as { name: string } | null)?.name || null,
    })),
    activityFeed: (activityFeedRes.data || []).map((e: Record<string, unknown>) => ({
      id: e.id,
      event_type: e.event_type,
      description: e.description,
      agent_name: (e.agents as { name: string } | null)?.name || null,
      created_at: e.created_at,
    })),
  });
}
