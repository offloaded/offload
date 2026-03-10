import { createServiceSupabase } from "@/lib/supabase-server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { report_id, template_id, agent_id } = await request.json();

  if (!report_id || !template_id) {
    return NextResponse.json({ error: "report_id and template_id are required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Fetch report
  const { data: report } = await service
    .from("reports")
    .select("id, title, content, agent_id, original_content")
    .eq("id", report_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Fetch template
  const { data: template } = await service
    .from("report_templates")
    .select("id, name, structure")
    .eq("id", template_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const sections = template.structure as Array<{ heading: string; description: string }>;
  if (!sections || sections.length === 0) {
    return NextResponse.json({ error: "Template has no sections" }, { status: 400 });
  }

  // Fetch agent name for context
  let agentName = "Agent";
  if (agent_id) {
    const { data: agent } = await service
      .from("agents")
      .select("name")
      .eq("id", agent_id)
      .single();
    if (agent) agentName = agent.name;
  }

  // Build template structure for the prompt
  const templateOutline = sections
    .map((s, i) => `${i + 1}. ${s.heading}${s.description ? ` — ${s.description}` : ""}`)
    .join("\n");

  // Use Claude to reformat the report according to the template
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are ${agentName}, a professional report writer. Your task is to reorganize the content of a report to follow a specific template structure. Keep all the original information — do not invent new data. Rearrange, restructure, and rewrite the content to fit the template headings. Use markdown formatting with ## for section headings.`,
    messages: [
      {
        role: "user",
        content: `Please restructure this report to follow the template below.

TEMPLATE: "${template.name}"
SECTIONS:
${templateOutline}

ORIGINAL REPORT:
Title: ${report.title}

${report.content}

Restructure the report content to follow each template section. Output ONLY the restructured report content (no preamble, no "Here's the report" — just the formatted content starting with the first heading).`,
      },
    ],
  });

  const reformatted = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!reformatted) {
    return NextResponse.json({ error: "Failed to generate templated report" }, { status: 500 });
  }

  // Update the report with templated content, preserving original
  const updates: Record<string, unknown> = {
    content: reformatted,
    title: `${report.title} (${template.name})`,
    updated_at: new Date().toISOString(),
  };

  // Preserve original content on first template application
  if (!report.original_content) {
    updates.original_content = report.content;
  }

  const { error: updateError } = await service
    .from("reports")
    .update(updates)
    .eq("id", report_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report_id });
}
