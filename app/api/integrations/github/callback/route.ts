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
  const expectedHmac = createHmac("sha256", process.env.GITHUB_CLIENT_SECRET || "")
    .update(workspaceId)
    .digest("hex");

  if (hmac !== expectedHmac || workspaceId !== ctx.workspaceId) {
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=invalid_state`);
  }

  // Exchange code for access token
  const redirectUri = `${appUrl}/api/integrations/github/callback`;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[GitHub OAuth] Token exchange failed:", tokenRes.status);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=token_failed`);
  }

  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    console.error("[GitHub OAuth] Token error:", tokenData.error_description || tokenData.error);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=token_failed`);
  }

  // Fetch GitHub user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });
  const userData = userRes.ok ? await userRes.json() : null;
  const githubLogin = userData?.login || null;
  const githubName = userData?.name || userData?.login || null;

  // Store encrypted token — GitHub tokens don't expire, so no refresh token or expiry
  const service = createServiceSupabase();
  const { error: dbError } = await service
    .from("integrations")
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        provider: "github",
        access_token_encrypted: encrypt(tokenData.access_token),
        refresh_token_encrypted: encrypt("none"),
        token_expires_at: new Date("2099-01-01").toISOString(),
        asana_user_gid: githubLogin,
        asana_user_name: githubName,
        connected_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" }
    );

  if (dbError) {
    console.error("[GitHub OAuth] DB error:", dbError.message);
    return Response.redirect(`${appUrl}/settings?tab=integrations&error=save_failed`);
  }

  return Response.redirect(`${appUrl}/settings?tab=integrations&connected=github`);
}
