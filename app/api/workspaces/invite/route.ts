import { createServiceSupabase } from "@/lib/supabase-server";
import { getWorkspaceContext, hasPermission } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const { data: invites } = await service
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false });

  return NextResponse.json(invites || []);
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const service = createServiceSupabase();

  // Check if already a member
  const { data: existingUsers } = await service.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );

  if (existingUser) {
    const { data: existingMember } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("user_id", existingUser.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: "This person is already a member" }, { status: 400 });
    }
  }

  // Check for existing pending invite
  const { data: existingInvite } = await service
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .single();

  if (existingInvite) {
    return NextResponse.json({ error: "An invite has already been sent to this email" }, { status: 400 });
  }

  // Get workspace name for the email
  const { data: workspace } = await service
    .from("workspaces")
    .select("name")
    .eq("id", ctx.workspaceId)
    .single();

  const workspaceName = workspace?.name || "a workspace";

  // Get inviter name
  const { data: inviterData } = await service.auth.admin.getUserById(ctx.user.id);
  const inviterName = inviterData?.user?.user_metadata?.full_name ||
    inviterData?.user?.user_metadata?.name ||
    ctx.user.email || "A teammate";

  // Create invite record
  const { data: invite, error: inviteError } = await service
    .from("workspace_invites")
    .insert({
      workspace_id: ctx.workspaceId,
      email: normalizedEmail,
      invited_by: ctx.user.id,
    })
    .select()
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Send invite email
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://offloaded.ai";

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Offloaded <noreply@offloaded.ai>",
      to: normalizedEmail,
      subject: `${inviterName} invited you to join ${workspaceName} on Offloaded`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">You've been invited to join ${workspaceName}</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            ${inviterName} has invited you to collaborate on <strong>${workspaceName}</strong> on Offloaded.
            You'll have access to the team's AI agents, channels, and shared knowledge bases.
          </p>
          <a href="${appUrl}/auth?invite=${invite.id}" style="display: inline-block; background: #2C5FF6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">
            Accept Invite
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">
            If you didn't expect this invitation, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Invite] Failed to send email:", err);
    // Don't fail the invite — record is created, email can be resent
  }

  // If the user already exists, add them directly
  if (existingUser) {
    await service.from("workspace_members").insert({
      workspace_id: ctx.workspaceId,
      user_id: existingUser.id,
      role: "member",
      invited_by: ctx.user.id,
    });

    await service
      .from("workspace_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    return NextResponse.json({ ...invite, status: "accepted", immediate: true }, { status: 201 });
  }

  return NextResponse.json(invite, { status: 201 });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(ctx.role, "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get("id");

  if (!inviteId) {
    return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
