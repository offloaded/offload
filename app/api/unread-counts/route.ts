import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_unread_counts", {
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array of { chat_key, unread_count } to a map
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.chat_key] = row.unread_count;
  }

  return NextResponse.json(counts);
}
