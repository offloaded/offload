import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversation_id } = await request.json();

  if (!conversation_id) {
    return NextResponse.json(
      { error: "conversation_id is required" },
      { status: 400 }
    );
  }

  // Use service role to bypass RLS for the update
  const service = createServiceSupabase();
  const { error } = await service
    .from("conversations")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", conversation_id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
