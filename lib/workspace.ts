import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  invited_by: string;
  joined_at: string;
  // Joined from auth.users
  email?: string;
  display_name?: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  status: "pending" | "accepted";
  created_at: string;
}

/**
 * Get the active workspace ID from the request cookie or default to the user's first workspace.
 * Returns { workspaceId, role, user } or throws/returns null if unauthorized.
 */
export async function getWorkspaceContext() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Check for workspace_id cookie
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  let workspaceId = cookieStore.get("workspace_id")?.value || null;

  const service = createServiceSupabase();

  if (workspaceId) {
    // Verify membership
    const { data: member } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (member) {
      return { workspaceId, role: member.role as "owner" | "admin" | "member", user };
    }
    // Cookie is stale — fall through to default
  }

  // Get user's first workspace
  const { data: memberships } = await service
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (memberships && memberships.length > 0) {
    return {
      workspaceId: memberships[0].workspace_id,
      role: memberships[0].role as "owner" | "admin" | "member",
      user,
    };
  }

  // No workspace — create one
  const { data: ws } = await service
    .from("workspaces")
    .insert({ name: "My Workspace", owner_id: user.id })
    .select("id")
    .single();

  if (ws) {
    await service.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: "owner",
      invited_by: user.id,
    });
    return { workspaceId: ws.id, role: "owner" as const, user };
  }

  return null;
}

/**
 * Check if a user has at least the specified role in a workspace.
 */
export function hasPermission(
  userRole: "owner" | "admin" | "member",
  requiredRole: "owner" | "admin" | "member"
): boolean {
  const levels = { owner: 3, admin: 2, member: 1 };
  return levels[userRole] >= levels[requiredRole];
}

/**
 * Accept all pending invites for a user (called after signup/login).
 */
export async function acceptPendingInvites(userId: string, email: string) {
  const service = createServiceSupabase();

  const { data: invites } = await service
    .from("workspace_invites")
    .select("id, workspace_id, invited_by")
    .eq("email", email)
    .eq("status", "pending");

  if (!invites || invites.length === 0) return;

  for (const invite of invites) {
    // Add as member
    await service.from("workspace_members").insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: "member",
      invited_by: invite.invited_by,
    }).then(() => {});

    // Mark invite as accepted
    await service
      .from("workspace_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);
  }
}
