import { getWorkspaceContext } from "@/lib/workspace";
import { createHmac } from "crypto";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=not_configured`);
  }

  // Build CSRF-safe state: workspaceId + HMAC signature
  const statePayload = ctx.workspaceId;
  const hmac = createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET || "")
    .update(statePayload)
    .digest("hex");
  const state = `${statePayload}:${hmac}`;

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
