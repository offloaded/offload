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
  const expectedHmac = createHmac("sha256", process.env.ASANA_CLIENT_SECRET || "")
    .update(workspaceId)
    .digest("hex");

  if (hmac !== expectedHmac || workspaceId !== ctx.workspaceId) {
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=invalid_state`);
  }

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/integrations/asana/callback`;
  const tokenRes = await fetch("https://app.asana.com/-/oauth_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ASANA_CLIENT_ID!,
      client_secret: process.env.ASANA_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[Asana OAuth] Token exchange failed:", tokenRes.status);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=token_failed`);
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Fetch Asana user info
  const meRes = await fetch("https://app.asana.com/api/1.0/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const meData = meRes.ok ? await meRes.json() : null;
  const asanaUserGid = meData?.data?.gid || null;
  const asanaUserName = meData?.data?.name || null;

  // Store encrypted tokens
  const service = createServiceSupabase();
  const { error: dbError } = await service
    .from("integrations")
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "asana",
        access_token_encrypted: encrypt(tokenData.access_token),
        refresh_token_encrypted: encrypt(tokenData.refresh_token),
        token_expires_at: expiresAt.toISOString(),
        asana_user_gid: asanaUserGid,
        asana_user_name: asanaUserName,
        connected_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" }
    );

  if (dbError) {
    console.error("[Asana OAuth] DB error:", dbError.message);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=save_failed`);
  }

  return Response.redirect(`${appUrl}/settings?tab=integrations&connected=asana`);
}
