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
import { routeByKeywords } from "@/lib/routing-keywords";
import { createWorkItem } from "@/lib/work-item-service";
import { getAnthropicClient, buildSystemPrompt, cleanResponse, resolveModel } from "@/lib/anthropic";
import { retrieveContext, type RetrievedChunk } from "@/lib/rag";
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

  if (!from_address) {
    return NextResponse.json({ error: "Missing sender address" }, { status: 400 });
  }

  console.log(`[Inbound Email] Received from ${from_address} to ${to_address}: "${subject}"`);

  const service = createServiceSupabase();

  // 4. Resolve workspace by sender email — find which workspace the sender belongs to
  //    All inbound emails go to a shared address (e.g. messages@offloaded.life).
  //    We match the sender's email to a user via auth.admin, then find their workspace.
  let workspace: { id: string; owner_id: string } | null = null;

  const { data: { users: allUsers } } = await service.auth.admin.listUsers();
  const senderUser = allUsers?.find((u) => u.email?.toLowerCase() === from_address.toLowerCase());

  if (senderUser) {
    const { data: membership } = await service
      .from("workspace_members")
      .select("workspace_id, workspaces(id, owner_id)")
      .eq("user_id", senderUser.id)
      .limit(1)
      .single();

    if (membership?.workspaces) {
      const ws = membership.workspaces as unknown as { id: string; owner_id: string };
      workspace = { id: ws.id, owner_id: ws.owner_id };
    }
  }

  // Fallback: try matching by inbound_email column (for dedicated addresses)
  if (!workspace) {
    const { data: wsMatch } = await service
      .from("workspaces")
      .select("id, owner_id")
      .eq("inbound_email", to_address)
      .single();
    workspace = wsMatch;
  }

  if (!workspace) {
    console.error(`[Inbound Email] No workspace found for sender ${from_address} or recipient ${to_address}`);
    return NextResponse.json(
      { error: "No workspace found for this email" },
      { status: 404 }
    );
  }

  console.log(`[Inbound Email] Matched to workspace ${workspace.id}`);

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
    // 6. Route email — try keyword matching first, fall back to LLM routing
    const { data: allAgents } = await service
      .from("agents")
      .select("id, name, routing_keywords")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null);

    const searchText = `${subject || ""} ${(body_plain || "").slice(0, 500)}`;
    const keywordMatch = routeByKeywords(searchText, allAgents || []);

    let routingResult;
    if (keywordMatch) {
      console.log(`[Inbound Email] Keyword match → ${keywordMatch.agent_name} (score: ${keywordMatch.score.toFixed(3)}, matched: ${keywordMatch.matched_keywords.join(", ")})`);
      routingResult = {
        agent_id: keywordMatch.agent_id,
        agent_name: keywordMatch.agent_name,
        reason: `Keyword match (score: ${keywordMatch.score.toFixed(2)}, keywords: ${keywordMatch.matched_keywords.slice(0, 5).join(", ")})`,
        suggested_title: subject || "Email work item",
      };
    } else {
      // Fall back to LLM routing
      routingResult = await routeEmailToAgent(workspace.id, {
        from_address,
        from_name: from_name || null,
        subject: subject || null,
        body_plain: body_plain || null,
      });
    }

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
    const conversationId = workItem.conversation_id || null;

    // 7a. Detect .docx attachments that may be Word templates with {{placeholders}}
    const docxAttachments = attachments.filter((a) =>
      a.filename?.endsWith(".docx") && a.downloadUrl
    );
    let detectedTemplateId: string | null = null;

    if (docxAttachments.length > 0) {
      const { parseDocxTemplate, isValidDocx } = await import("@/lib/docx-template-parser");

      for (const att of docxAttachments) {
        try {
          const attRes = await fetch(att.downloadUrl);
          if (!attRes.ok) continue;
          const buffer = Buffer.from(await attRes.arrayBuffer());
          if (!isValidDocx(buffer)) continue;

          const parsed = parseDocxTemplate(buffer);
          if (parsed.placeholders.length === 0) continue;

          console.log(`[Inbound Email] Detected .docx template "${att.filename}" with ${parsed.placeholders.length} placeholders`);

          // Store the template file
          const storagePath = `${workspace.id}/${Date.now()}-${att.filename}`;
          await service.storage.from("document-templates").upload(storagePath, buffer, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

          // Create template record
          const { data: tmpl } = await service.from("document_templates").insert({
            workspace_id: workspace.id,
            user_id: workspace.owner_id,
            name: att.filename.replace(/\.docx$/i, ""),
            description: `Auto-detected from email: ${subject || "attachment"}`,
            file_name: att.filename,
            file_size: buffer.length,
            storage_path: storagePath,
            placeholders: parsed.placeholders,
            sections: parsed.sections,
          }).select("id").single();

          if (tmpl) {
            detectedTemplateId = tmpl.id;
            // Link template to the work item
            await service.from("work_items").update({
              document_template_id: tmpl.id,
            }).eq("id", workItemId);
            console.log(`[Inbound Email] Linked template ${tmpl.id} to work item ${workItemId}`);
            break; // Use the first template found
          }
        } catch (e) {
          console.error(`[Inbound Email] Failed to parse .docx attachment "${att.filename}":`, e);
        }
      }
    }

    // 7b. Trigger the agent to process the email — call Claude directly
    // (Same pattern as cron/run-tasks — no user session needed)
    if (routingResult.agent_id && conversationId) {
      try {
        // Load the agent record for system prompt
        const { data: agent } = await service
          .from("agents")
          .select("*")
          .eq("id", routingResult.agent_id)
          .single();

        if (agent) {
          // Build RAG context from agent's knowledge base
          let ragContext: RetrievedChunk[] = [];
          let documentNames: string[] = [];
          const { data: agentDocs } = await service
            .from("documents")
            .select("file_name")
            .eq("agent_id", agent.id)
            .eq("status", "ready");

          if (agentDocs && agentDocs.length > 0) {
            documentNames = agentDocs.map((d: { file_name: string }) => d.file_name);
            const emailContent = `${subject || ""} ${body_plain || ""}`;
            try {
              ragContext = await retrieveContext(service, agent.id, emailContent, 5);
            } catch { /* non-fatal */ }
          }

          // Build system prompt with agent context
          let systemPrompt = buildSystemPrompt(
            agent,
            ragContext.length > 0 ? ragContext : undefined,
            documentNames.length > 0 ? documentNames : undefined
          );
          systemPrompt += `\n\nThis is a work item created from an inbound email. Process the email content and provide a helpful response. The current date is ${new Date().toISOString().slice(0, 10)}.`;

          // If a .docx template was detected from the email attachments, inject it into the prompt
          if (detectedTemplateId) {
            const { data: tmplData } = await service.from("document_templates")
              .select("id, name, placeholders, sections")
              .eq("id", detectedTemplateId)
              .single();
            if (tmplData) {
              const phs = (tmplData.placeholders as Array<{ name: string; label: string; description: string }>) || [];
              const secs = (tmplData.sections as Record<string, { heading: string; description: string }>) || {};
              systemPrompt += `\n\nATTACHED DOCUMENT TEMPLATE: "${tmplData.name}"
The email included a Word document template that needs to be filled. Use the save_document block to fill it.

Placeholders to fill:`;
              for (const ph of phs) {
                systemPrompt += `\n- **${ph.name}** (${ph.label}): ${secs[ph.name]?.description || ph.description || "Content for this field"}`;
              }
              systemPrompt += `\n
To fill this template, include at the END of your response:
\`\`\`save_document
{"template_id": "${tmplData.id}", "data": {"placeholder": "value", ...}}
\`\`\`

Fill ALL placeholders based on the email content and your analysis.`;
            }
          }

          const chatMessage = subject
            ? `From: ${from_name || from_address}\nSubject: ${subject}\n\n${body_plain}`
            : body_plain || "Please review the forwarded email.";

          // Call Claude
          const anthropic = getAnthropicClient();
          const response = await anthropic.messages.create({
            model: resolveModel(agent),
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: chatMessage }],
          });

          const rawText = response.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
          const responseText = cleanResponse(rawText);

          // Save the agent's response
          if (responseText) {
            await service.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: responseText,
            });
            console.log(`[Inbound Email] Agent responded (${responseText.length} chars)`);
          }

          // Check for save_document block in response
          const saveDocMatch = rawText.match(/```save_document\s*\n?([\s\S]*?)\n?```/);
          if (saveDocMatch) {
            try {
              const docParsed = JSON.parse(saveDocMatch[1].trim());
              if (docParsed.template_id && docParsed.data) {
                const { assembleDocument } = await import("@/lib/docx-assembler");
                const { data: tmpl } = await service.from("document_templates")
                  .select("id, name, file_name, storage_path, placeholders")
                  .eq("id", docParsed.template_id).single();
                if (tmpl) {
                  const { data: fileData } = await service.storage.from("document-templates").download(tmpl.storage_path);
                  if (fileData) {
                    const templateBuffer = Buffer.from(await fileData.arrayBuffer());
                    const expectedPhs = (tmpl.placeholders as Array<{ name: string }>).map((p) => p.name);
                    const result = assembleDocument(templateBuffer, docParsed.data, expectedPhs);
                    const outputFileName = `${tmpl.name}-${new Date().toISOString().slice(0, 10)}.docx`.replace(/[^a-zA-Z0-9._-]/g, "-");
                    const storagePath = `${workspace.id}/${workItemId}/${Date.now()}-${outputFileName}`;
                    await service.storage.from("document-outputs").upload(storagePath, result.buffer, {
                      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    await service.from("document_outputs").insert({
                      workspace_id: workspace.id,
                      work_item_id: workItemId,
                      document_template_id: tmpl.id,
                      agent_id: routingResult.agent_id,
                      file_name: outputFileName,
                      storage_path: storagePath,
                      placeholder_data: docParsed.data,
                      status: "ready",
                    });
                    console.log(`[Inbound Email] Document generated: ${outputFileName}`);
                  }
                }
              }
            } catch (e) {
              console.error("[Inbound Email] save_document failed:", e);
            }
          }
        }
      } catch (chatErr) {
        console.error("[Inbound Email] Agent processing failed (non-fatal):", chatErr);
      }
    }

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
