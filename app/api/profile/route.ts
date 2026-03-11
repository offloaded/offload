import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: profile } = await service
    .from("user_profiles")
    .select("display_name, timezone")
    .eq("id", ctx.user.id)
    .single();

  return NextResponse.json({
    email: ctx.user.email || "",
    display_name: profile?.display_name || "",
    timezone: profile?.timezone || "UTC",
  });
}

export async function PUT(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { display_name, timezone } = body;

  const updates: Record<string, unknown> = { id: ctx.user.id };
  if (display_name !== undefined) updates.display_name = display_name.trim();
  if (timezone !== undefined) updates.timezone = timezone;

  const service = createServiceSupabase();
  const { error } = await service
    .from("user_profiles")
    .upsert(updates, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
