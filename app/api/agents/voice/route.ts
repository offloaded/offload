import { createServiceSupabase } from "@/lib/supabase-server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getWorkspaceContext } from "@/lib/workspace";
import { hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";

/**
 * POST /api/agents/voice
 * Accepts voice samples, extracts a voice profile via LLM, saves both to the agent.
 */
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const service = createServiceSupabase();

  const body = await request.json();
  const { agent_id, samples } = body as {
    agent_id: string;
    samples: string[];
  };

  if (!agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Filter out empty samples
  const validSamples = (samples || []).map((s: string) => s.trim()).filter(Boolean);

  if (validSamples.length === 0) {
    // Clear voice data
    await service
      .from("agents")
      .update({ voice_samples: null, voice_profile: null, updated_at: new Date().toISOString() })
      .eq("id", agent_id)
      .eq("workspace_id", ctx.workspaceId);
    return NextResponse.json({ voice_profile: null });
  }

  // Verify agent belongs to workspace
  const { data: agent } = await service
    .from("agents")
    .select("id")
    .eq("id", agent_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Extract voice profile via LLM
  const anthropic = getAnthropicClient();
  const samplesText = validSamples
    .map((s: string, i: number) => `Sample ${i + 1}:\n${s}`)
    .join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are a communication style analyst. Analyse the writing samples and extract a concise voice profile — a description of how this person communicates. Focus on:
- Sentence structure (short/long, simple/complex)
- Tone (formal/casual, warm/direct, humorous/serious)
- Distinctive patterns (rhetorical questions, metaphors, lists, specific phrases)
- Vocabulary level (jargon-heavy, plain language, technical)
- How they open and close messages
- Energy and pacing

Write the profile as a concise paragraph (2-4 sentences) that could be used as an instruction for matching their style. Do not use bullet points. Write in second person ("You are direct and warm...").`,
    messages: [{
      role: "user",
      content: `Analyse these writing samples and extract a voice profile:\n\n${samplesText}`,
    }],
  });

  const profileText = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  // Save both samples and profile
  await service
    .from("agents")
    .update({
      voice_samples: validSamples,
      voice_profile: profileText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent_id)
    .eq("workspace_id", ctx.workspaceId);

  return NextResponse.json({ voice_profile: profileText });
}
