import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// GET /api/marketplace/[id] — listing detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const service = createServiceSupabase();

  const { data: listing, error } = await service
    .from("marketplace_listings")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Publisher name
  const { data: userData } = await service.auth.admin.getUserById(listing.publisher_user_id);
  const publisherName = userData?.user?.user_metadata?.full_name
    || userData?.user?.user_metadata?.name
    || userData?.user?.email?.split("@")[0]
    || "Anonymous";

  let agents: { name: string; role: string | null; purpose: string; document_count: number }[] = [];
  let documents: { file_name: string; file_size: number }[] = [];
  let teamExpectations: Record<string, unknown[]> = {};

  if (listing.type === "team" && listing.source_team_id) {
    // Load team agents with full details
    const { data: teamMembers } = await service
      .from("team_members")
      .select("agent_id, agents(id, name, role, purpose, team_expectations)")
      .eq("team_id", listing.source_team_id);

    const agentIds: string[] = [];
    for (const tm of teamMembers || []) {
      const agent = tm.agents as unknown as {
        id: string; name: string; role: string | null; purpose: string;
        team_expectations: unknown[] | null;
      };
      if (agent) {
        agentIds.push(agent.id);
        if (agent.team_expectations && agent.team_expectations.length > 0) {
          teamExpectations[agent.name] = agent.team_expectations;
        }
      }
    }

    // Document counts per agent
    if (agentIds.length > 0) {
      const { data: docs } = await service
        .from("documents")
        .select("agent_id, file_name, file_size")
        .in("agent_id", agentIds)
        .eq("status", "ready");

      const docCountByAgent: Record<string, number> = {};
      for (const d of docs || []) {
        docCountByAgent[d.agent_id] = (docCountByAgent[d.agent_id] || 0) + 1;
        documents.push({ file_name: d.file_name, file_size: d.file_size });
      }

      for (const tm of teamMembers || []) {
        const agent = tm.agents as unknown as { id: string; name: string; role: string | null; purpose: string };
        if (agent) {
          agents.push({
            name: agent.name,
            role: agent.role,
            purpose: agent.purpose,
            document_count: docCountByAgent[agent.id] || 0,
          });
        }
      }
    }
  } else if (listing.type === "agent" && listing.source_agent_id) {
    // Load single agent details
    const { data: agent } = await service
      .from("agents")
      .select("name, role, purpose, team_expectations")
      .eq("id", listing.source_agent_id)
      .single();

    if (agent) {
      // Load documents
      const { data: docs } = await service
        .from("documents")
        .select("file_name, file_size")
        .eq("agent_id", listing.source_agent_id)
        .eq("status", "ready");

      documents = (docs || []).map((d) => ({ file_name: d.file_name, file_size: d.file_size }));

      agents.push({
        name: agent.name,
        role: agent.role,
        purpose: agent.purpose,
        document_count: documents.length,
      });

      if (agent.team_expectations && agent.team_expectations.length > 0) {
        teamExpectations[agent.name] = agent.team_expectations;
      }
    }
  }

  return NextResponse.json({
    id: listing.id,
    type: listing.type,
    name: listing.name,
    description: listing.description,
    category: listing.category,
    adoption_count: listing.adoption_count,
    publisher_name: publisherName,
    created_at: listing.created_at,
    agents,
    documents,
    team_expectations: teamExpectations,
  });
}
