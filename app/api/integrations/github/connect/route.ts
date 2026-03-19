import { getWorkspaceContext } from "@/lib/workspace";
import { createHmac } from "crypto";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=not_configured`);
  }

  // Build CSRF-safe state: workspaceId + HMAC signature
  const statePayload = ctx.workspaceId;
  const hmac = createHmac("sha256", process.env.GITHUB_CLIENT_SECRET || "")
    .update(statePayload)
    .digest("hex");
  const state = `${statePayload}:${hmac}`;

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state,
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
