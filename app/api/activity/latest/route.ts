import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// Returns the timestamp of the most recent activity entry — used for the sidebar "new activity" dot
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("activity_log")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ latest: data?.created_at || null });
}
