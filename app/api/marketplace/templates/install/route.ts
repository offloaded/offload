import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

// POST /api/marketplace/templates/install — install a template as a new agent
export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { template_id } = body as { template_id: string };

  if (!template_id) {
    return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Load template
  const { data: template, error: tplErr } = await service
    .from("marketplace_templates")
    .select("*")
    .eq("id", template_id)
    .eq("is_active", true)
    .single();

  if (tplErr || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Map template tools to agent features
  const hasWebSearch = Array.isArray(template.tools) && template.tools.includes("web_search");

  // Build voice_profile text from voice config
  const voice = template.voice as { tone?: string; style?: string; avoids?: string } | null;
  let voiceProfile = "";
  if (voice) {
    const parts: string[] = [];
    if (voice.tone) parts.push(voice.tone);
    if (voice.style) parts.push(voice.style);
    voiceProfile = parts.join(" ");
  }

  // Create agent
  const { data: newAgent, error: createErr } = await service
    .from("agents")
    .insert({
      user_id: ctx.user.id,
      workspace_id: ctx.workspaceId,
      name: template.name,
      purpose: template.description,
      color: "#2C5FF6",
      web_search_enabled: hasWebSearch,
      source_template_id: template.id,
      custom_system_prompt: template.system_prompt,
      voice_config: template.voice,
      voice_profile: voiceProfile || null,
    })
    .select("id")
    .single();

  if (createErr || !newAgent) {
    return NextResponse.json(
      { error: `Failed to create agent: ${createErr?.message}` },
      { status: 500 }
    );
  }

  // Create report templates for this agent's workspace
  const reportTemplates = template.report_templates as Array<{
    name: string;
    description: string;
    structure: string;
  }> | null;

  if (reportTemplates && reportTemplates.length > 0) {
    for (const rt of reportTemplates) {
      // Parse structure into sections array
      const sections: Array<{ heading: string; description: string }> = [];
      const lines = rt.structure.split("\n");
      for (const line of lines) {
        const match = line.match(/^#{1,3}\s+(.+)/);
        if (match) {
          sections.push({ heading: match[1], description: "" });
        }
      }

      await service.from("report_templates").insert({
        workspace_id: ctx.workspaceId,
        name: rt.name,
        description: rt.description,
        structure: sections.length > 0 ? sections : null,
      });
    }
  }

  return NextResponse.json({
    type: "agent",
    agent_id: newAgent.id,
    message: `${template.name} has been added to your workspace.`,
  });
}
