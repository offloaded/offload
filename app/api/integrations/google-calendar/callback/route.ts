import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext } from "@/lib/workspace";
import { encrypt } from "@/lib/encryption";
import { createHmac } from "crypto";

export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=auth_failed`);
  }

  // Validate CSRF state
  const [workspaceId, hmac] = state.split(":");
  const expectedHmac = createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET || "")
    .update(workspaceId)
    .digest("hex");

  if (hmac !== expectedHmac || workspaceId !== ctx.workspaceId) {
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=invalid_state`);
  }

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[Google Calendar OAuth] Token exchange failed:", tokenRes.status);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=token_failed`);
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  if (!tokenData.refresh_token) {
    console.error("[Google Calendar OAuth] No refresh_token received — user may need to revoke and reconnect");
  }

  // Fetch Google user info to get email
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = userRes.ok ? await userRes.json() : null;
  const googleEmail = userData?.email || null;
  const googleName = userData?.name || userData?.email || null;

  // Store encrypted tokens
  const service = createServiceSupabase();
  const { error: dbError } = await service
    .from("integrations")
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "google_calendar",
        access_token_encrypted: encrypt(tokenData.access_token),
        refresh_token_encrypted: encrypt(tokenData.refresh_token || "none"),
        token_expires_at: expiresAt.toISOString(),
        asana_user_gid: googleEmail,
        asana_user_name: googleName,
        connected_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" }
    );

  if (dbError) {
    console.error("[Google Calendar OAuth] DB error:", dbError.message);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=save_failed`);
  }

  return Response.redirect(`${appUrl}/settings?tab=integrations&connected=google_calendar`);
}
