import { createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import templateData from "@/agent-marketplace-templates.json";

// POST /api/marketplace/templates/seed — upsert all templates from JSON (admin only)
export async function POST(request: Request) {
  // Require CRON_SECRET bearer token (same as cron endpoints)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
