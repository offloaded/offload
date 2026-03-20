import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { randomBytes } from "crypto";

export async function POST() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return new Response(JSON.stringify({ error: "Only admins can configure email ingestion" }), { status: 403 });
  }

  const service = createServiceSupabase();

  // Check if already configured
  const { data: workspace } = await service
    .from("workspaces")
    .select("inbound_email, name")
    .eq("id", ctx.workspaceId)
    .single();

  if (workspace?.inbound_email) {
    return new Response(
      JSON.stringify({ inbound_email: workspace.inbound_email }),
      { status: 200 }
    );
  }

  // Generate a unique inbound email address
  const domain = process.env.INBOUND_EMAIL_DOMAIN || "inbound.offloaded.life";
  const slug = (workspace?.name || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const uniqueId = randomBytes(4).toString("hex");
  const inboundEmail = `${slug}-${uniqueId}@${domain}`;

  const { error } = await service
    .from("workspaces")
    .update({ inbound_email: inboundEmail })
    .eq("id", ctx.workspaceId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ inbound_email: inboundEmail }), { status: 201 });
}
