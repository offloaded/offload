import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await req.json();
  const { monthly_token_limit } = body as {
    monthly_token_limit: number | null;
  };

  if (
    monthly_token_limit !== null &&
    (typeof monthly_token_limit !== "number" || monthly_token_limit < 0)
  ) {
    return NextResponse.json(
      { error: "monthly_token_limit must be a positive number or null" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabase();

  const { error } = await supabase.from("user_profiles").upsert(
    { id: userId, monthly_token_limit },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: userId, monthly_token_limit });
}
