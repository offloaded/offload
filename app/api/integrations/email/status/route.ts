import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: workspace } = await service
    .from("workspaces")
    .select("inbound_email")
    .eq("id", ctx.workspaceId)
    .single();

  const inboundEmail = workspace?.inbound_email || null;

  // Count recent inbound emails
  let emailCount = 0;
  if (inboundEmail) {
    const { count } = await service
      .from("inbound_emails")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId);
    emailCount = count || 0;
  }

  return new Response(
    JSON.stringify({
      configured: !!inboundEmail,
      inbound_email: inboundEmail,
      email_count: emailCount,
    })
  );
}
