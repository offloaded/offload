import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json(
      { error: "agent_id is required" },
      { status: 400 }
    );
  }

  // Find the conversation — group chat uses agent_id IS NULL
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (agentId === "group") {
    query = query.is("agent_id", null);
  } else {
    query = query.eq("agent_id", agentId);
  }

  const { data: conversation } = await query.single();

  if (!conversation) {
    return NextResponse.json({ conversation_id: null, messages: [] });
  }

  // Load messages
  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversation_id: conversation.id,
    messages: messages || [],
  });
}
