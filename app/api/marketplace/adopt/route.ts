import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// POST /api/marketplace/adopt — adopt an agent or team from marketplace
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { listing_id } = body as { listing_id: string };

  if (!listing_id) {
    return NextResponse.json({ error: "listing_id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Load listing
  const { data: listing } = await service
    .from("marketplace_listings")
    .select("*")
    .eq("id", listing_id)
    .eq("status", "published")
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  try {
    if (listing.type === "agent" && listing.source_agent_id) {
      const newAgentId = await adoptAgent(service, listing.source_agent_id, ctx.user.id, ctx.workspaceId);

      // Increment adoption count
      await service
        .from("marketplace_listings")
        .update({ adoption_count: listing.adoption_count + 1, updated_at: new Date().toISOString() })
        .eq("id", listing.id);

      return NextResponse.json({
        type: "agent",
        agent_id: newAgentId,
        message: "Agent added to your workspace with all knowledge base documents.",
      });
    }

    if (listing.type === "team" && listing.source_team_id) {
      const result = await adoptTeam(service, listing.source_team_id, ctx.user.id, ctx.workspaceId);

      // Increment adoption count
      await service
        .from("marketplace_listings")
        .update({ adoption_count: listing.adoption_count + 1, updated_at: new Date().toISOString() })
        .eq("id", listing.id);

      return NextResponse.json({
        type: "team",
        team_id: result.teamId,
        agent_ids: result.agentIds,
        message: "Team added to your workspace with all knowledge base documents. You can customise agents in Settings.",
      });
    }

    return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
  } catch (err) {
    console.error("[Marketplace] Adoption failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Adoption failed" },
      { status: 500 }
    );
  }
}

async function adoptAgent(
  service: ReturnType<typeof createServiceSupabase>,
  sourceAgentId: string,
  userId: string,
  workspaceId: string
): Promise<string> {
  // Load source agent
  const { data: source, error: agentErr } = await service
    .from("agents")
    .select("*")
    .eq("id", sourceAgentId)
    .single();

  if (agentErr || !source) {
    throw new Error("Source agent not found");
  }

  // Create new agent in adopter's workspace
  const { data: newAgent, error: createErr } = await service
    .from("agents")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      name: source.name,
      role: source.role,
      purpose: source.purpose,
      color: source.color,
      web_search_enabled: source.web_search_enabled,
      working_style: source.working_style,
      communication_style: source.communication_style,
      voice_samples: source.voice_samples,
      voice_profile: source.voice_profile,
      soft_skills: source.soft_skills,
      team_expectations: source.team_expectations,
    })
    .select("id")
    .single();

  if (createErr || !newAgent) {
    throw new Error(`Failed to create agent: ${createErr?.message}`);
  }

  // Copy knowledge base
  await copyKnowledgeBase(service, sourceAgentId, newAgent.id, userId, workspaceId);

  return newAgent.id;
}

async function adoptTeam(
  service: ReturnType<typeof createServiceSupabase>,
  sourceTeamId: string,
  userId: string,
  workspaceId: string
): Promise<{ teamId: string; agentIds: string[] }> {
  // Load source team
  const { data: sourceTeam } = await service
    .from("teams")
    .select("name, description")
    .eq("id", sourceTeamId)
    .single();

  if (!sourceTeam) {
    throw new Error("Source team not found");
  }

  // Load team agent IDs
  const { data: teamMembers } = await service
    .from("team_members")
    .select("agent_id")
    .eq("team_id", sourceTeamId);

  const sourceAgentIds = (teamMembers || []).map((m) => m.agent_id);

  // Copy each agent
  const newAgentIds: string[] = [];
  for (const sourceAgentId of sourceAgentIds) {
    const newId = await adoptAgent(service, sourceAgentId, userId, workspaceId);
    newAgentIds.push(newId);
  }

  // Create team in adopter's workspace
  const { data: newTeam, error: teamErr } = await service
    .from("teams")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      name: sourceTeam.name,
      description: sourceTeam.description,
      created_by: userId,
    })
    .select("id")
    .single();

  if (teamErr || !newTeam) {
    throw new Error(`Failed to create team: ${teamErr?.message}`);
  }

  // Add agent members to team
  if (newAgentIds.length > 0) {
    const members = newAgentIds.map((agentId) => ({
      team_id: newTeam.id,
      agent_id: agentId,
    }));
    await service.from("team_members").insert(members);
  }

  return { teamId: newTeam.id, agentIds: newAgentIds };
}

async function copyKnowledgeBase(
  service: ReturnType<typeof createServiceSupabase>,
  sourceAgentId: string,
  targetAgentId: string,
  userId: string,
  workspaceId: string
) {
  // Load source documents
  const { data: docs } = await service
    .from("documents")
    .select("id, file_name, file_size, storage_path, status")
    .eq("agent_id", sourceAgentId)
    .eq("status", "ready");

  if (!docs || docs.length === 0) return;

  for (const doc of docs) {
    // Copy the storage file
    const newStoragePath = `${userId}/${targetAgentId}/${Date.now()}-${doc.file_name}`;

    // Download source file and re-upload
    const { data: fileData } = await service.storage
      .from("documents")
      .download(doc.storage_path);

    if (fileData) {
      await service.storage
        .from("documents")
        .upload(newStoragePath, fileData, { upsert: true });
    }

    // Create new document record
    const { data: newDoc, error: docErr } = await service
      .from("documents")
      .insert({
        agent_id: targetAgentId,
        file_name: doc.file_name,
        file_size: doc.file_size,
        storage_path: newStoragePath,
        status: "ready",
        workspace_id: workspaceId,
      })
      .select("id")
      .single();

    if (docErr || !newDoc) {
      console.error(`[Marketplace] Failed to copy document ${doc.file_name}:`, docErr?.message);
      continue;
    }

    // Copy all document chunks (with embeddings)
    const { data: chunks } = await service
      .from("document_chunks")
      .select("content, embedding, chunk_index, metadata")
      .eq("document_id", doc.id)
      .order("chunk_index", { ascending: true });

    if (chunks && chunks.length > 0) {
      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize).map((c) => ({
          document_id: newDoc.id,
          content: c.content,
          embedding: c.embedding,
          chunk_index: c.chunk_index,
          metadata: c.metadata,
        }));
        await service.from("document_chunks").insert(batch);
      }
    }
  }
}
