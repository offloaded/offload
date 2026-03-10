import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/marketplace — browse published listings
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "team"; // 'agent' or 'team'
  const category = searchParams.get("category") || "";
  const query = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "popular"; // 'popular', 'newest', 'alpha'
  const cursor = searchParams.get("cursor");
  const limit = 30;

  const service = createServiceSupabase();

  let q = service
    .from("marketplace_listings")
    .select("*")
    .eq("status", "published")
    .eq("type", type);

  if (category) {
    q = q.eq("category", category);
  }

  if (query) {
    q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  // Sort
  if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
    if (cursor) q = q.lt("created_at", cursor);
  } else if (sort === "alpha") {
    q = q.order("name", { ascending: true });
  } else {
    // popular (default)
    q = q.order("adoption_count", { ascending: false });
  }

  q = q.limit(limit + 1);

  const { data: listings, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = listings || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // For team listings, load agent info
  const teamIds = page.filter((l) => l.type === "team" && l.source_team_id).map((l) => l.source_team_id);
  const agentSourceIds = page.filter((l) => l.type === "agent" && l.source_agent_id).map((l) => l.source_agent_id);

  // Load team agents
  let teamAgentsMap: Record<string, { name: string; role: string | null }[]> = {};
  if (teamIds.length > 0) {
    const { data: teamMembers } = await service
      .from("team_members")
      .select("team_id, agent_id, agents(name, role)")
      .in("team_id", teamIds);

    for (const tm of teamMembers || []) {
      if (!teamAgentsMap[tm.team_id]) teamAgentsMap[tm.team_id] = [];
      const agent = tm.agents as unknown as { name: string; role: string | null };
      if (agent) teamAgentsMap[tm.team_id].push({ name: agent.name, role: agent.role });
    }
  }

  // Load document counts for agent listings
  let agentDocCounts: Record<string, number> = {};
  if (agentSourceIds.length > 0) {
    const { data: docs } = await service
      .from("documents")
      .select("agent_id")
      .in("agent_id", agentSourceIds)
      .eq("status", "ready");

    for (const d of docs || []) {
      agentDocCounts[d.agent_id] = (agentDocCounts[d.agent_id] || 0) + 1;
    }
  }

  // Load publisher names
  const publisherIds = [...new Set(page.map((l) => l.publisher_user_id))];
  const publisherNames: Record<string, string> = {};
  for (const pid of publisherIds) {
    const { data: userData } = await service.auth.admin.getUserById(pid);
    publisherNames[pid] = userData?.user?.user_metadata?.full_name
      || userData?.user?.user_metadata?.name
      || userData?.user?.email?.split("@")[0]
      || "Anonymous";
  }

  const results = page.map((l) => ({
    id: l.id,
    type: l.type,
    name: l.name,
    description: l.description,
    category: l.category,
    adoption_count: l.adoption_count,
    publisher_name: publisherNames[l.publisher_user_id] || "Anonymous",
    source_agent_id: l.source_agent_id,
    source_team_id: l.source_team_id,
    created_at: l.created_at,
    // Team-specific
    agents: l.source_team_id ? (teamAgentsMap[l.source_team_id] || []) : undefined,
    agent_count: l.source_team_id ? (teamAgentsMap[l.source_team_id] || []).length : undefined,
    // Agent-specific
    document_count: l.source_agent_id ? (agentDocCounts[l.source_agent_id] || 0) : undefined,
  }));

  return NextResponse.json({ listings: results, has_more: hasMore });
}
