/**
 * Inbound Email Webhook
 *
 * Receives inbound emails from a provider (Postmark, SendGrid, etc.) and routes
 * them to the appropriate agent in the matching workspace.
 *
 * Setup steps:
 *   1. Set INBOUND_EMAIL_WEBHOOK_SECRET in your environment variables.
 *   2. Configure your email provider to forward inbound emails to:
 *        POST https://<your-domain>/api/webhooks/inbound-email
 *      with the header X-Webhook-Secret set to the same secret.
 *   3. In Postmark: Settings → Inbound → set the webhook URL and add the header.
 *      In SendGrid: Settings → Inbound Parse → add host/URL, then use a
 *      middleware or proxy to attach the X-Webhook-Secret header.
 *   4. Ensure the workspace's `inbound_email` column in the `workspaces` table
 *      matches the "to" address the provider will deliver to.
 */

import { createServiceSupabase } from "@/lib/supabase-server";
import { routeEmailToAgent } from "@/lib/email-router";
import { createWorkItem } from "@/lib/work-item-service";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "Display Name <email@example.com>" into name + address */
function parseFromField(raw: string): { name: string; address: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), address: match[2].trim() };
  }
  return { name: "", address: raw.trim() };
}

/** Attempt to read the body as JSON, falling back to FormData. */
async function parsePayload(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  // FormData (multipart/form-data or application/x-www-form-urlencoded)
  const formData = await request.formData();
  const obj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // 1. Verify webhook secret
  const secret = request.headers.get("X-Webhook-Secret");
  if (!secret || secret !== process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = await parsePayload(request);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 3. Extract fields
  const fromRaw = (payload.from ?? payload.From ?? payload.from_address ?? "") as string;
  const { name: from_name, address: from_address } = parseFromField(fromRaw);

  const to_address = (
    (payload.to ?? payload.To ?? payload.to_address ?? "") as string
  ).trim();

  const subject = (
    (payload.subject ?? payload.Subject ?? "") as string
  ).trim();

  const body_plain = (
    (payload.text ?? payload.TextBody ?? payload.body_plain ?? "") as string
  ).trim();

  const body_html = (
    (payload.html ?? payload.HtmlBody ?? payload.body_html ?? "") as string
  ).trim();

  const attachments = (payload.attachments ?? payload.Attachments ?? []) as unknown[];

  if (!to_address) {
    return NextResponse.json({ error: "Missing to address" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // 4. Resolve workspace by inbound_email
  const { data: workspace, error: wsError } = await service
    .from("workspaces")
    .select("id, owner_id")
    .eq("inbound_email", to_address)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json(
      { error: "No workspace found for this inbound address" },
      { status: 404 }
    );
  }

  // 5. Insert inbound_emails row with status 'pending'
  const { data: emailRecord, error: insertError } = await service
    .from("inbound_emails")
    .insert({
      workspace_id: workspace.id,
      from_address,
      from_name,
      to_address,
      subject,
      body_plain,
      body_html,
      attachments: attachments.length > 0 ? attachments : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !emailRecord) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save email" },
      { status: 500 }
    );
  }

  // Steps 6-9 wrapped in try/catch
  try {
    // 6. Route email to an agent
    const routingResult = await routeEmailToAgent(workspace.id, {
      from_address,
      from_name,
      subject,
      body_plain,
    });

    // 7. Create a work item from the routed email
    const workItem = await createWorkItem({
      workspace_id: workspace.id,
      user_id: workspace.owner_id,
      title: routingResult.suggested_title,
      agent_id: routingResult.agent_id,
      instructions: `${subject}\n\n${body_plain}`,
      source: "email",
      inbound_email_id: emailRecord.id,
    });

    const workItemId = workItem.work_item.id as string;

    // 8. Update inbound_emails row with routing outcome
    await service
      .from("inbound_emails")
      .update({
        routed_agent_id: routingResult.agent_id,
        work_item_id: workItemId,
        routing_reason: routingResult.reason,
        status: "routed",
      })
      .eq("id", emailRecord.id);

    // 9. Create notifications for all workspace members
    const { data: members } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.id);

    if (members && members.length > 0) {
      const notifications = members.map((m) => ({
        workspace_id: workspace.id,
        user_id: m.user_id,
        work_item_id: workItemId,
        type: "email_received",
        title: `New email from ${from_name || from_address}: ${subject}`,
        read: false,
      }));

      await service.from("work_notifications").insert(notifications);
    }
  } catch (err) {
    // On failure, mark the email as failed but still return 200 to the provider
    // so it doesn't retry indefinitely.
    const message = err instanceof Error ? err.message : "Unknown error";
    await service
      .from("inbound_emails")
      .update({ status: "failed", routing_reason: message })
      .eq("id", emailRecord.id);

    return NextResponse.json({ success: true, warning: "Routing failed", detail: message });
  }

  // 10. Success
  return NextResponse.json({ success: true });
}
