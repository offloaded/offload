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
  const { suspended } = body as { suspended: boolean };

  if (typeof suspended !== "boolean") {
    return NextResponse.json(
      { error: "suspended must be a boolean" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabase();

  const { error } = await supabase.from("user_profiles").upsert(
    { id: userId, suspended },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: userId, suspended });
}
