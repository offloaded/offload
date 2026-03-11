import { createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// GET /api/marketplace/templates — list active templates (public catalog)
export async function GET() {
  const service = createServiceSupabase();
  const { data: templates, error } = await service
    .from("marketplace_templates")
    .select("id, name, icon, category, tagline, description, target_persona, tools, report_templates")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates || [] });
}
