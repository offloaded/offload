/**
 * Inbound Email Webhook — powered by inbound.new
 *
 * Receives parsed inbound emails and routes them to the appropriate agent.
 *
 * Setup steps:
 *   1. Create an endpoint at https://inbound.new
 *   2. Set the webhook URL to: POST https://<your-domain>/api/webhooks/inbound-email
 *   3. Copy the Verification Token from your inbound.new endpoint settings
 *   4. Set INBOUND_EMAIL_WEBHOOK_SECRET in your environment to that token
 *   5. Configure your MX records to point to inbound.new's servers
 *   6. Generate an inbound email address in Offloaded Settings > Integrations
 *
 * Payload format (inbound.new):
 *   {
 *     event: "email.received",
 *     timestamp: "ISO 8601",
 *     email: {
 *       id, messageId, recipient, subject, receivedAt,
 *       from: { text, addresses: [{ name, address }] },
 *       to: { text, addresses: [{ name, address }] },
 *       parsedData: { textBody, htmlBody, attachments: [{ filename, contentType, size, downloadUrl }] }
 *     },
 *     endpoint: { id, name, type }
 *   }
 */

import { createServiceSupabase } from "@/lib/supabase-server";
import { routeEmailToAgent } from "@/lib/email-router";
import { createWorkItem } from "@/lib/work-item-service";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types for inbound.new payload
// ---------------------------------------------------------------------------

interface InboundEmailPayload {
  event: string;
  timestamp: string;
  email: {
    id: string;
    messageId: string;
    recipient: string;
    subject: string;
    receivedAt: string;
    from: {
      text: string;
      addresses: Array<{ name: string | null; address: string }>;
    };
    to: {
      text: string;
      addresses: Array<{ name: string | null; address: string }>;
    };
    parsedData: {
      messageId: string;
      date: string;
      subject: string;
      textBody: string;
      htmlBody: string;
      attachments: Array<{
        filename: string;
        contentType: string;
        size: number;
        contentId?: string;
        contentDisposition?: string;
        downloadUrl: string;
      }>;
    };
  };
  endpoint: {
    id: string;
    name: string;
    type: string;
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // Log all headers for debugging
  const hdrs: Record<string, string> = {};
  request.headers.forEach((v, k) => { hdrs[k] = v; });
  console.log("[Inbound Email] Headers:", JSON.stringify(hdrs));

  // 1. Verify webhook — check multiple possible header names
  const token =
    request.headers.get("X-Webhook-Verification-Token") ||
    request.headers.get("X-Webhook-Secret") ||
    request.headers.get("x-webhook-verification-token") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  console.log("[Inbound Email] Token found:", token ? `${token.slice(0, 10)}...` : "NONE");

  if (!token || token !== process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    console.log("[Inbound Email] Auth failed. Expected:", process.env.INBOUND_EMAIL_WEBHOOK_SECRET?.slice(0, 10) + "...");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let payload: InboundEmailPayload;
  try {
    payload = (await request.json()) as InboundEmailPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only process email.received events
  if (payload.event !== "email.received") {
    return NextResponse.json({ success: true, skipped: true });
  }

  // 3. Extract fields from inbound.new structure
  const email = payload.email;
  if (!email) {
    return NextResponse.json({ error: "Missing email data" }, { status: 400 });
  }

  const fromAddr = email.from?.addresses?.[0];
  const from_address = fromAddr?.address || email.from?.text || "";
  const from_name = fromAddr?.name || "";
  const to_address = email.recipient || email.to?.addresses?.[0]?.address || "";
  const subject = email.subject || email.parsedData?.subject || "";
  const body_plain = email.parsedData?.textBody || "";
  const body_html = email.parsedData?.htmlBody || "";
  const attachments = email.parsedData?.attachments || [];

  if (!to_address) {
    return NextResponse.json({ error: "Missing recipient address" }, { status: 400 });
  }

  console.log(`[Inbound Email] Received from ${from_address} to ${to_address}: "${subject}"`);

  const service = createServiceSupabase();

  // 4. Resolve workspace by inbound_email
  const { data: workspace, error: wsError } = await service
    .from("workspaces")
    .select("id, owner_id")
    .eq("inbound_email", to_address)
    .single();

  if (wsError || !workspace) {
    console.error(`[Inbound Email] No workspace found for ${to_address}`);
    return NextResponse.json(
      { error: "No workspace found for this inbound address" },
      { status: 404 }
    );
  }

  // 5. Store the raw email in inbound_emails (audit trail — before any processing)
  const { data: emailRecord, error: insertError } = await service
    .from("inbound_emails")
    .insert({
      workspace_id: workspace.id,
      from_address,
      from_name: from_name || null,
      to_address,
      subject: subject || null,
      body_plain: body_plain || null,
      body_html: body_html || null,
      attachments: attachments.length > 0 ? attachments : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !emailRecord) {
    console.error("[Inbound Email] Failed to save:", insertError?.message);
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save email" },
      { status: 500 }
    );
  }

  console.log(`[Inbound Email] Saved as ${emailRecord.id}, routing...`);

  // Steps 6-9 wrapped in try/catch — failures don't lose the stored email
  try {
    // 6. Route email to the best-fit agent
    const routingResult = await routeEmailToAgent(workspace.id, {
      from_address,
      from_name: from_name || null,
      subject: subject || null,
      body_plain: body_plain || null,
    });

    console.log(`[Inbound Email] Routed to ${routingResult.agent_name} (${routingResult.agent_id}): ${routingResult.reason}`);

    // 7. Create a work item with execution context
    const workItem = await createWorkItem({
      workspace_id: workspace.id,
      user_id: workspace.owner_id,
      title: routingResult.suggested_title || subject || "Email work item",
      agent_id: routingResult.agent_id,
      instructions: subject
        ? `From: ${from_name || from_address}\nSubject: ${subject}\n\n${body_plain}`
        : body_plain,
      source: "email",
      inbound_email_id: emailRecord.id,
    });

    const workItemId = workItem.work_item.id as string;

    // 8. Update inbound email with routing result
    await service
      .from("inbound_emails")
      .update({
        routed_agent_id: routingResult.agent_id,
        work_item_id: workItemId,
        routing_reason: routingResult.reason,
        status: "routed",
      })
      .eq("id", emailRecord.id);

    // 9. Notify all workspace members
    const { data: members } = await service
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.id);

    if (members && members.length > 0) {
      const notifications = members.map((m) => ({
        workspace_id: workspace.id,
        user_id: m.user_id,
        work_item_id: workItemId,
        inbound_email_id: emailRecord.id,
        type: "email_received",
        title: `New email from ${from_name || from_address}`,
        body: subject || "(no subject)",
        read: false,
      }));

      await service.from("work_notifications").insert(notifications);
    }

    console.log(`[Inbound Email] Work item ${workItemId} created successfully`);
  } catch (err) {
    // Mark as failed but return 200 so the provider doesn't retry
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Inbound Email] Processing failed:`, message);
    await service
      .from("inbound_emails")
      .update({ status: "failed", routing_reason: message })
      .eq("id", emailRecord.id);

    return NextResponse.json({ success: true, warning: "Routing failed", detail: message });
  }

  return NextResponse.json({ success: true });
}
