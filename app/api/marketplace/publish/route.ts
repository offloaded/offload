import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

// POST /api/marketplace/publish — publish agent or team to marketplace
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Only workspace owners and admins can publish" }, { status: 403 });
  }

  const body = await request.json();
  const { type, agent_id, team_id, description, category } = body as {
    type: "agent" | "team";
    agent_id?: string;
    team_id?: string;
    description: string;
    category: string;
  };

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
  }
  if (!category?.trim()) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  if (type === "agent") {
    if (!agent_id) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    // Verify agent belongs to workspace
    const { data: agent } = await service
      .from("agents")
      .select("id, name")
      .eq("id", agent_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check if already published
    const { data: existing } = await service
      .from("marketplace_listings")
      .select("id, status")
      .eq("source_agent_id", agent_id)
      .eq("status", "published")
      .single();

    if (existing) {
      return NextResponse.json({ error: "This agent is already published" }, { status: 409 });
    }

    const { data: listing, error } = await service
      .from("marketplace_listings")
      .insert({
        type: "agent",
        source_agent_id: agent_id,
        publisher_user_id: ctx.user.id,
        publisher_workspace_id: ctx.workspaceId,
        name: agent.name,
        description: description.trim(),
        category,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(listing, { status: 201 });
  }

  if (type === "team") {
    if (!team_id) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    // Verify team belongs to workspace
    const { data: team } = await service
      .from("teams")
      .select("id, name, is_system")
      .eq("id", team_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.is_system) {
      return NextResponse.json({ error: "Cannot publish system channels" }, { status: 400 });
    }

    // Check if already published
    const { data: existing } = await service
      .from("marketplace_listings")
      .select("id, status")
      .eq("source_team_id", team_id)
      .eq("status", "published")
      .single();

    if (existing) {
      return NextResponse.json({ error: "This team is already published" }, { status: 409 });
    }

    const { data: listing, error } = await service
      .from("marketplace_listings")
      .insert({
        type: "team",
        source_team_id: team_id,
        publisher_user_id: ctx.user.id,
        publisher_workspace_id: ctx.workspaceId,
        name: team.name,
        description: description.trim(),
        category,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(listing, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// DELETE /api/marketplace/publish — unpublish
export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("id");

  if (!listingId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  const { data: listing } = await service
    .from("marketplace_listings")
    .select("id, publisher_user_id")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Only publisher or workspace admin can unpublish
  if (listing.publisher_user_id !== ctx.user.id && !hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await service
    .from("marketplace_listings")
    .update({ status: "unpublished", updated_at: new Date().toISOString() })
    .eq("id", listingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
