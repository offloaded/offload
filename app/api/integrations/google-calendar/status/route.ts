import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const service = createServiceSupabase();
  const { data } = await service
    .from("integrations")
    .select("asana_user_name, asana_user_gid, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google_calendar")
    .single();

  const configured = !!process.env.GOOGLE_CLIENT_ID;

  if (!data) {
    return new Response(JSON.stringify({ connected: false, configured }));
  }

  return new Response(
    JSON.stringify({
      connected: true,
      configured,
      google_email: data.asana_user_gid,
      google_name: data.asana_user_name,
      connected_at: data.created_at,
    })
  );
}
