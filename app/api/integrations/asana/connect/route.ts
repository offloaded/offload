import { getWorkspaceContext } from "@/lib/workspace";
import { createHmac } from "crypto";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) {
    return new Response("Asana not configured", { status: 500 });
  }

  // Build CSRF-safe state: workspaceId + HMAC signature
  const statePayload = ctx.workspaceId;
  const hmac = createHmac("sha256", process.env.ASANA_CLIENT_SECRET || "")
    .update(statePayload)
    .digest("hex");
  const state = `${statePayload}:${hmac}`;

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/asana/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  return Response.redirect(`https://app.asana.com/-/oauth_authorize?${params}`);
}
