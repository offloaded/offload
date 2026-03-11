import { createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import templateData from "@/agent-marketplace-templates.json";

// POST /api/marketplace/templates/seed — upsert all templates from JSON
export async function POST() {
  const service = createServiceSupabase();

  const templates = templateData.marketplace_agents;
  let upserted = 0;

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const { error } = await service.from("marketplace_templates").upsert(
      {
        id: t.id,
        name: t.name,
        icon: t.icon,
        category: t.category,
        tagline: t.tagline,
        description: t.description,
        target_persona: t.target_persona,
        system_prompt: t.system_prompt,
        voice: t.voice,
        tools: t.tools,
        report_templates: t.report_templates,
        is_active: true,
        sort_order: i,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error(`[Seed] Failed to upsert template ${t.id}:`, error.message);
    } else {
      upserted++;
    }
  }

  return NextResponse.json({
    message: `Seeded ${upserted}/${templates.length} templates.`,
  });
}
