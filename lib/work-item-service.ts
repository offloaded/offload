import { createServiceSupabase } from "./supabase-server";

export interface CreateWorkItemParams {
  workspace_id: string;
  user_id: string;
  title: string;
  agent_id?: string;
  instructions?: string;
  source?: "manual" | "email" | "api";
  inbound_email_id?: string;
}

export interface CreateWorkItemResult {
  work_item: Record<string, unknown>;
  report_id: string;
  execution_context_id?: string;
  conversation_id?: string;
}

export async function createWorkItem(
  params: CreateWorkItemParams
): Promise<CreateWorkItemResult> {
  const service = createServiceSupabase();

  // 1. Create an empty report for this work item
  const { data: report, error: reportError } = await service
    .from("reports")
    .insert({
      workspace_id: params.workspace_id,
      user_id: params.user_id,
      title: params.title.trim(),
      content: "",
      agent_id: params.agent_id || null,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    throw new Error(`Failed to create report: ${reportError?.message}`);
  }

  // 2. Create the work_items row
  const { data: workItem, error: wiError } = await service
    .from("work_items")
    .insert({
      workspace_id: params.workspace_id,
      user_id: params.user_id,
      title: params.title.trim(),
      agent_id: params.agent_id || null,
      report_id: report.id,
      instructions: params.instructions?.trim() || null,
      source: params.source || "manual",
      inbound_email_id: params.inbound_email_id || null,
      conversation_id: null,
    })
    .select()
    .single();

  if (wiError || !workItem) {
    throw new Error(`Failed to create work item: ${wiError?.message}`);
  }

  const result: CreateWorkItemResult = {
    work_item: workItem,
    report_id: report.id,
  };

  // Log activity event for work item creation
  const sourceLabel = params.source === "email" ? "via email" : params.source === "api" ? "via API" : "";
  await service.from("activity_events").insert({
    workspace_id: params.workspace_id,
    agent_id: params.agent_id || null,
    work_item_id: workItem.id,
    event_type: params.source === "email" ? "email_received" : "work_started",
    description: `created work item — ${params.title}${sourceLabel ? ` ${sourceLabel}` : ""}`,
  }).then(() => {}, () => {}); // fire-and-forget

  // 3. If agent_id and instructions are provided, auto-create an execution context
  if (params.agent_id && params.instructions?.trim()) {
    // Create a conversation for this execution
    const { data: conversation, error: convError } = await service
      .from("conversations")
      .insert({
        user_id: params.user_id,
        workspace_id: params.workspace_id,
        agent_id: params.agent_id,
        archived: false,
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      // Return work item without execution context — caller can retry
      return result;
    }

    // Insert the instructions as the first user message
    await service.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: params.instructions.trim(),
    });

    // Create the execution context record
    const { data: execCtx, error: execError } = await service
      .from("work_execution_contexts")
      .insert({
        work_item_id: workItem.id,
        agent_id: params.agent_id,
        conversation_id: conversation.id,
        status: "running",
        context_summary: {
          work_item_title: params.title,
          has_instructions: true,
          agent_id: params.agent_id,
          source: params.source || "manual",
        },
      })
      .select("id")
      .single();

    if (!execError && execCtx) {
      result.execution_context_id = execCtx.id;
    }

    // Update work_items with conversation_id and set status to in_progress
    await service
      .from("work_items")
      .update({
        conversation_id: conversation.id,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", workItem.id);

    result.conversation_id = conversation.id;
    result.work_item = { ...workItem, conversation_id: conversation.id, status: "in_progress" };
  }

  return result;
}
