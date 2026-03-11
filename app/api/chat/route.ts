import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, buildSystemPrompt, cleanResponse } from "@/lib/anthropic";
import { retrieveContext, type RetrievedChunk } from "@/lib/rag";
import { extractText } from "@/lib/rag";
import { webSearch, formatSearchResults } from "@/lib/web-search";
import { logActivity, isStandupQuestion, getAgentActivitySummary } from "@/lib/activity";
import { runGroupOrchestration } from "@/lib/group-orchestration";
import { logApiUsage, estimateCost } from "@/lib/api-usage";
import { estimateTokens, trimHistory, trimRagChunks, shouldArchive, calculateBudget } from "@/lib/context-manager";
import { getWorkspaceContext } from "@/lib/workspace";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const user = ctx.user;
  const supabase = await createServerSupabase();

  // Check suspension and usage limits
  const serviceDb = createServiceSupabase();
  const { data: profile } = await serviceDb
    .from("user_profiles")
    .select("suspended, monthly_token_limit")
    .eq("id", user.id)
    .single();

  if (profile?.suspended) {
    return new Response(JSON.stringify({ error: "Your account has been suspended." }), { status: 403 });
  }

  if (profile?.monthly_token_limit) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: usage } = await serviceDb
      .from("api_usage")
      .select("tokens_in, tokens_out")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    const totalTokens = (usage || []).reduce((s, r) => s + (r.tokens_in || 0) + (r.tokens_out || 0), 0);
    if (totalTokens >= profile.monthly_token_limit) {
      return new Response(
        JSON.stringify({ error: "You've reached your monthly usage limit. Contact support to upgrade." }),
        { status: 429 }
      );
    }
  }

  // Support both JSON and FormData (for file attachments)
  let agent_id: string;
  let message: string;
  let conversation_id: string | null = null;
  let fileContext: string | null = null;
  let fileName: string | null = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    agent_id = formData.get("agent_id") as string;
    message = formData.get("message") as string;
    conversation_id = formData.get("conversation_id") as string | null;
    const file = formData.get("file") as File | null;
    if (file) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        fileContext = await extractText(buffer, file.name);
        fileName = file.name;
        // Truncate very large files to ~50k chars to stay within context limits
        if (fileContext.length > 50000) {
          fileContext = fileContext.slice(0, 50000) + "\n\n[... file truncated ...]";
        }
      } catch (err) {
        console.error("[Chat] File extraction failed:", err);
        return new Response(
          JSON.stringify({ error: `Could not read file: ${err instanceof Error ? err.message : "unsupported format"}` }),
          { status: 400 }
        );
      }
    }
  } else {
    const body = await request.json();
    agent_id = body.agent_id;
    message = body.message;
    conversation_id = body.conversation_id || null;
  }

  if (!agent_id || !message?.trim()) {
    return new Response(
      JSON.stringify({ error: "agent_id and message are required" }),
      { status: 400 }
    );
  }

  // Load the agent — verify it belongs to the user's active workspace
  const { data: agent, error: agentError } = await serviceDb
    .from("agents")
    .select("*")
    .eq("id", agent_id)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (agentError || !agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
    });
  }

  // Load agent's team memberships for channel-aware messaging
  const { data: agentTeamRows } = await supabase
    .from("team_members")
    .select("team_id, teams(id, name)")
    .eq("agent_id", agent_id);

  const agentTeams: Array<{ id: string; name: string }> = (agentTeamRows || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.teams)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({ id: r.teams.id, name: r.teams.name }));

  // Use existing conversation or create a new one.
  // Prefer non-archived conversations. If the given conversation is archived,
  // look for or create a continuation.
  let convId = conversation_id;
  if (convId) {
    // Verify the conversation belongs to this user
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id, archived")
      .eq("id", convId)
      .eq("user_id", user.id)
      .single();
    if (!existingConv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404 }
      );
    }
    // If the client sent an archived conversation ID, find or create the continuation
    if (existingConv.archived) {
      const { data: continuation } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_id", agent_id)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (continuation) {
        convId = continuation.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, agent_id, previous_conversation_id: convId, workspace_id: ctx.workspaceId })
          .select("id")
          .single();
        if (newConv) convId = newConv.id;
      }
    }
  } else {
    // Try to find the most recent non-archived conversation for this agent
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("agent_id", agent_id)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, agent_id, workspace_id: ctx.workspaceId })
        .select("id")
        .single();

      if (convError || !newConv) {
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500 }
        );
      }
      convId = newConv.id;
    }
  }

  // ─── Explicit channel routing: extract #channel-name before LLM ───
  // This replaces the unreliable LLM-based group_message_request detection.
  // When a user types "#Scrum do standup", we extract the channel, resolve it,
  // and will cross-post the agent's response there after generation.
  let explicitChannelId: string | null = null;
  let explicitChannelName: string | null = null;
  let messageForLLM = message.trim();

  // Inject file content into the LLM message if a file was attached
  if (fileContext && fileName) {
    messageForLLM = `${messageForLLM}\n\n--- Attached file: ${fileName} ---\n${fileContext}`;
  }

  // Load all workspace teams for channel resolution
  const { data: allUserTeams } = await serviceDb
    .from("teams")
    .select("id, name")
    .eq("workspace_id", ctx.workspaceId);
  const userTeams: Array<{ id: string; name: string }> = allUserTeams || [];

  // Match #ChannelName at word boundaries (channel names from autocomplete)
  const channelPattern = /#([A-Za-z0-9][A-Za-z0-9 _-]*?)(?=\s|$|[.,!?;:])/;
  const channelMatch = messageForLLM.match(channelPattern);
  if (channelMatch) {
    const channelRef = channelMatch[1].trim();
    const channelLower = channelRef.toLowerCase();
    console.log(`[ChannelRoute] Detected #${channelRef} in user message`);

    if (channelLower === "all") {
      // #All means post to the group chat
      explicitChannelId = "all";
      explicitChannelName = "All";
      console.log(`[ChannelRoute] Resolved to #All (group chat)`);
    } else {
      // Look up team by name
      const matchedTeam = userTeams.find(
        (t) => t.name.toLowerCase() === channelLower
      );
      if (matchedTeam) {
        explicitChannelId = matchedTeam.id;
        explicitChannelName = matchedTeam.name;
        console.log(`[ChannelRoute] Resolved to team "${matchedTeam.name}" (${matchedTeam.id})`);
      } else {
        console.log(`[ChannelRoute] No team found for #${channelRef}, treating as plain text`);
      }
    }

    // Strip the #channel reference from the message sent to the LLM
    if (explicitChannelId) {
      messageForLLM = messageForLLM.replace(channelMatch[0], "").trim();
      if (!messageForLLM) {
        messageForLLM = message.trim(); // Don't send empty — keep original
      }
      console.log(`[ChannelRoute] Message for LLM: "${messageForLLM.slice(0, 80)}"`);
    }
  }

  // Save the user message (original, with #channel for display)
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message.trim(),
  });

  if (userMsgError) {
    return new Response(
      JSON.stringify({ error: "Failed to save message" }),
      { status: 500 }
    );
  }

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  // Load message history for context — fetch more than we'll use, then trim by tokens
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(60);

  let messages = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // If explicit channel routing is active, replace the last user message
  // with the cleaned version (without #channel reference) so the LLM doesn't
  // try to handle routing itself
  if (explicitChannelId && messages.length > 0) {
    const lastIdx = messages.length - 1;
    if (messages[lastIdx].role === "user") {
      messages[lastIdx] = { ...messages[lastIdx], content: messageForLLM };
    }
  }

  // Load previous conversation summary if this is a continuation
  const { data: convRecord } = await supabase
    .from("conversations")
    .select("previous_conversation_id, summary")
    .eq("id", convId)
    .single();

  let previousSummary: string | null = null;
  if (convRecord?.previous_conversation_id) {
    const { data: prevConv } = await supabase
      .from("conversations")
      .select("summary")
      .eq("id", convRecord.previous_conversation_id)
      .single();
    if (prevConv?.summary) {
      previousSummary = prevConv.summary;
    }
  }

  // RAG: retrieve relevant document context
  let ragContext: RetrievedChunk[] = [];
  let documentNames: string[] = [];

  // Check if agent has any documents
  const { data: agentDocs } = await supabase
    .from("documents")
    .select("file_name")
    .eq("agent_id", agent_id)
    .eq("status", "ready");

  const docCount = agentDocs?.length || 0;
  console.log(`[Chat RAG] Agent ${agent_id}: found ${docCount} ready docs`);

  if (agentDocs && docCount > 0) {
    documentNames = agentDocs.map((d) => d.file_name);
    // Scale retrieval with document set size: 5 for small sets, up to 25 for large
    const topK = docCount > 20 ? 25 : docCount > 5 ? 15 : 5;
    try {
      ragContext = await retrieveContext(supabase, agent_id, messageForLLM, topK);
      console.log(`[Chat RAG] Retrieved ${ragContext.length} context chunks (topK=${topK})`);
    } catch (err) {
      console.error("RAG retrieval failed:", err);
      // Continue without context — don't block the chat
    }
  }

  // Web search only if enabled — this is the server-side enforcement point
  // Coerce null to false (agents created before the column existed may have null)
  const webSearchEnabled = agent.web_search_enabled === true;
  // Skip web search for meta-commands (save report, schedule, etc.) that don't need external info
  const isMetaCommand = /^(save|create|write|generate|export|download|delete|schedule|remind|cancel)\b.{0,30}(report|summary|it|this|that|task|reminder)/i.test(messageForLLM.trim());
  let webSearchResults: string | undefined;
  if (webSearchEnabled && !isMetaCommand) {
    try {
      const results = await webSearch(messageForLLM, 10, agent.purpose);
      if (results.length > 0) {
        webSearchResults = formatSearchResults(results);
        const queryPreview = messageForLLM.slice(0, 80) + (messageForLLM.length > 80 ? "..." : "");
        logActivity(supabase, user.id, agent_id, "web_search",
          `${agent.name} searched the web for: ${queryPreview}`,
          { conversation_id: convId, result_count: results.length }
        );
      }
    } catch (err) {
      console.error("[Chat] Web search failed:", err);
    }
  }

  // Build list of disabled features for in-chat activation
  const disabledFeatures: Array<{ feature: string; label: string; description: string }> = [];
  if (!webSearchEnabled) {
    disabledFeatures.push({
      feature: "web_search",
      label: "Web Search",
      description: "Search the web for current information, news, and real-time data",
    });
  }

  // Fetch activity summary for standup-style questions
  let activitySummary: string | undefined;
  if (isStandupQuestion(messageForLLM)) {
    try {
      activitySummary = await getAgentActivitySummary(supabase, agent_id, user.id);
    } catch { /* non-fatal */ }
  }

  // Trim RAG chunks if too many — keep top 10, max 30k tokens
  ragContext = trimRagChunks(ragContext, 30_000, 10);

  // Fetch recent user-edited reports for this agent so it can learn from corrections
  let reportEdits: Array<{ title: string; original: string; edited: string }> = [];
  try {
    const { data: editedReports } = await serviceDb
      .from("reports")
      .select("title, original_content, content")
      .eq("agent_id", agent_id)
      .eq("workspace_id", ctx.workspaceId)
      .not("original_content", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (editedReports && editedReports.length > 0) {
      reportEdits = editedReports.map((r: { title: string; original_content: string; content: string }) => ({
        title: r.title,
        original: r.original_content,
        edited: r.content,
      }));
    }
  } catch { /* non-fatal */ }

  // Fetch available report templates for this workspace
  let reportTemplates: Array<{ id: string; name: string; description: string }> = [];
  try {
    const { data: templates } = await serviceDb
      .from("report_templates")
      .select("id, name, description")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (templates) reportTemplates = templates;
  } catch { /* non-fatal */ }

  // Fetch recent reports — split into "mine" (authored by this agent) and "others" (by other agents)
  let recentReports: Array<{ id: string; title: string; generated_title?: string; content: string; agent_name?: string; updated_at: string; is_mine?: boolean }> = [];
  try {
    const { data: reports } = await serviceDb
      .from("reports")
      .select("id, title, display_name, content, agent_id, updated_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (reports && reports.length > 0) {
      // Enrich with agent names
      const agentIds = [...new Set(reports.filter((r: { agent_id: string | null }) => r.agent_id).map((r: { agent_id: string }) => r.agent_id))];
      let agentNameMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: agentRows } = await serviceDb
          .from("agents")
          .select("id, name")
          .in("id", agentIds);
        if (agentRows) {
          agentNameMap = Object.fromEntries(agentRows.map((a: { id: string; name: string }) => [a.id, a.name]));
        }
      }
      // Put this agent's reports first, then others
      const mine = reports.filter((r: { agent_id: string | null }) => r.agent_id === agent.id);
      const others = reports.filter((r: { agent_id: string | null }) => r.agent_id !== agent.id);
      const ordered = [...mine, ...others].slice(0, 8);
      recentReports = ordered.map((r: { id: string; title: string; display_name: string | null; content: string; agent_id: string | null; updated_at: string }) => ({
        id: r.id,
        title: r.display_name || r.title,
        generated_title: r.display_name ? r.title : undefined,
        content: r.content,
        agent_name: r.agent_id ? agentNameMap[r.agent_id] : undefined,
        updated_at: r.updated_at,
        is_mine: r.agent_id === agent.id,
      }));
    }
  } catch { /* non-fatal */ }

  // Stream response from Claude
  const anthropic = getAnthropicClient();
  let systemPrompt = buildSystemPrompt(
    agent,
    ragContext.length > 0 ? ragContext : undefined,
    documentNames.length > 0 ? documentNames : undefined,
    {
      enableScheduleDetection: true,
      webSearchResults,
      disabledFeatures: disabledFeatures.length > 0 ? disabledFeatures : undefined,
      activitySummary,
      teamMemberships: agentTeams.length > 0 ? agentTeams : undefined,
      reportEdits: reportEdits.length > 0 ? reportEdits : undefined,
      reportTemplates: reportTemplates.length > 0 ? reportTemplates : undefined,
      recentReports: recentReports.length > 0 ? recentReports : undefined,
    }
  );

  // If explicit channel routing is active, tell the agent where its response will go
  if (explicitChannelId && explicitChannelName) {
    systemPrompt += `\n\nThe user's message will be cross-posted to #${explicitChannelName}. Write your response as if addressing that channel. Do NOT include any group_message_request blocks — the system handles routing automatically.`;
  }

  // Inject previous conversation summary if available
  if (previousSummary) {
    systemPrompt += `\n\nSummary of your previous conversation with this user: ${previousSummary}\n\nUse this context when relevant, but focus on the current conversation.`;
  }

  // Trim history to fit within context window
  messages = trimHistory(systemPrompt, messages);

  // Log context budget
  const budget = calculateBudget(systemPrompt, messages);
  console.log(`[Chat] Context budget: system=${budget.systemTokens} history=${budget.historyTokens} total=${budget.totalTokens} msgs=${messages.length} remaining=${budget.remainingForOutput} overBudget=${budget.overBudget}`);

  if (budget.overBudget) {
    console.warn(`[Chat] WARNING: Context may be over budget even after trimming. Remaining for output: ${budget.remainingForOutput}`);
  }

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  // Create a ReadableStream that sends SSE events
  const encoder = new TextEncoder();
  let fullResponse = "";
  const chatStartTime = Date.now();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send conversation_id as first event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "conversation_id", conversation_id: convId })}\n\n`
          )
        );

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", text })}\n\n`
              )
            );
          }
        }

        // Log full response for debugging cross-post detection
        console.log(`[Chat] Full response length: ${fullResponse.length}, contains "group_message_request": ${fullResponse.includes("group_message_request")}, contains "channel": ${fullResponse.includes('"channel"')}`);

        // Detect schedule_request, feature_request, and group_message_request before cleaning
        const scheduleMatch = fullResponse.match(
          /```schedule_request\s*\n?([\s\S]*?)\n?```/
        );
        const featureMatch = fullResponse.match(
          /```feature_request\s*\n?([\s\S]*?)\n?```/
        );
        const groupMsgMatch = fullResponse.match(
          /```group_message_request\s*\n?([\s\S]*?)\n?```/
        );
        const skillsMatch = fullResponse.match(
          /```skills_update\s*\n?([\s\S]*?)\n?```/
        );
        const expectationsMatch = fullResponse.match(
          /```expectations_update\s*\n?([\s\S]*?)\n?```/
        );
        const saveReportMatch = fullResponse.match(
          /```save_report\s*\n?([\s\S]*?)\n?```/
        );
        const readReportMatch = fullResponse.match(
          /```read_report\s*\n?([\s\S]*?)\n?```/
        );
        const updateReportMatch = fullResponse.match(
          /```update_report\s*\n?([\s\S]*?)\n?```/
        );

        // Clean the response: strip <search> blocks, schedule_request blocks, feature_request blocks, etc.
        const cleaned = cleanResponse(fullResponse);

        // Never save empty responses — show error instead
        if (!cleaned) {
          console.warn(`[Chat] Empty response from API. Raw length: ${fullResponse.length}`);
          const fallbackMsg = "I'm having trouble responding right now. Please try again.";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "replace", text: fallbackMsg })}\n\n`
            )
          );
          await supabase.from("messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: fallbackMsg,
          });
        } else {
          // Save the cleaned response
          await supabase.from("messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: cleaned,
          });
        }

        // Handle explicit save_report request from agent
        if (saveReportMatch) {
          try {
            const raw = saveReportMatch[1].trim();
            let reportTitle = "";
            let reportContent = "";

            // Try new title/--- format first
            const titleSepMatch = raw.match(/^title:\s*(.+)\n---\n([\s\S]+)$/i);
            if (titleSepMatch) {
              reportTitle = titleSepMatch[1].trim();
              reportContent = titleSepMatch[2].trim();
            } else {
              // Fall back to JSON (fix literal newlines in strings before parsing)
              const fixedJson = raw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
              const parsed = JSON.parse(fixedJson);
              reportTitle = parsed.title;
              reportContent = parsed.content?.replace(/\\n/g, "\n") || "";
            }

            if (reportTitle && reportContent) {
              const { data: reportData, error: reportError } = await serviceDb.from("reports").insert({
                workspace_id: ctx.workspaceId,
                user_id: user.id,
                agent_id: agent.id,
                title: reportTitle,
                content: reportContent,
                source: "agent",
                conversation_id: convId,
              }).select("id").single();
              if (reportError) {
                console.error("[Chat] Failed to save report:", reportError.message);
              } else {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "report_saved",
                      title: reportTitle,
                      report_id: reportData?.id || null,
                      content: reportContent,
                      agent_name: agent.name,
                      agent_id: agent.id,
                      templates: reportTemplates.length > 0 ? reportTemplates : undefined,
                    })}\n\n`
                  )
                );
              }
            }
          } catch (e) {
            console.error("[Chat] Failed to parse save_report block:", e);
          }
        }

        // Handle read_report — fetch the requested report and do a follow-up call
        if (readReportMatch) {
          try {
            const readReq = JSON.parse(readReportMatch[1].trim());
            let reportData = null;
            if (readReq.id) {
              const { data } = await serviceDb
                .from("reports")
                .select("id, title, display_name, content, agent_id, updated_at")
                .eq("id", readReq.id)
                .eq("workspace_id", ctx.workspaceId)
                .single();
              reportData = data;
            } else if (readReq.title) {
              // Search both display_name and original title
              const { data } = await serviceDb
                .from("reports")
                .select("id, title, display_name, content, agent_id, updated_at")
                .eq("workspace_id", ctx.workspaceId)
                .or(`display_name.ilike.%${readReq.title}%,title.ilike.%${readReq.title}%`)
                .order("updated_at", { ascending: false })
                .limit(1)
                .single();
              reportData = data;
            }

            if (reportData) {
              // Inject report content as a system message and re-call Claude for a follow-up
              const displayName = reportData.display_name || reportData.title;
              const reportContext = `[System: Here is the requested report]\nTitle: ${displayName}${reportData.display_name && reportData.display_name !== reportData.title ? `\nOriginal title: ${reportData.title}` : ""}\nID: ${reportData.id}\nLast updated: ${reportData.updated_at}\n\n${reportData.content}`;
              const followUpMessages = [
                ...messages,
                { role: "assistant" as const, content: cleaned || "" },
                { role: "user" as const, content: reportContext },
              ];

              // Stream the follow-up response
              const followUpStream = anthropic.messages.stream({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 4096,
                system: systemPrompt,
                messages: followUpMessages,
              });

              let followUpText = "";
              for await (const event of followUpStream) {
                if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                  followUpText += event.delta.text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`)
                  );
                }
              }

              const followUpCleaned = cleanResponse(followUpText);
              if (followUpCleaned) {
                await supabase.from("messages").insert({
                  conversation_id: convId,
                  role: "assistant",
                  content: followUpCleaned,
                });
                // Replace the streamed text with the full cleaned version
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "replace", text: (cleaned ? cleaned + "\n\n" : "") + followUpCleaned })}\n\n`)
                );
              }
            } else {
              console.log("[Chat] read_report: report not found for query", readReq);
            }
          } catch (e) {
            console.error("[Chat] Failed to handle read_report:", e);
          }
        }

        // Handle update_report — update report in DB and emit SSE event
        if (updateReportMatch) {
          try {
            const updateReq = JSON.parse(updateReportMatch[1].trim());
            if (updateReq.id && updateReq.content) {
              // Fetch current version before overwriting
              const { data: currentReport } = await serviceDb
                .from("reports")
                .select("id, title, content, user_id")
                .eq("id", updateReq.id)
                .eq("workspace_id", ctx.workspaceId)
                .single();

              if (currentReport) {
                // Save current version to version history
                await serviceDb.from("report_versions").insert({
                  report_id: currentReport.id,
                  title: currentReport.title,
                  content: currentReport.content,
                  author_type: "human",
                  author_id: currentReport.user_id,
                  change_type: "human_edit",
                });

                // Update the report
                const updates: Record<string, string> = {
                  content: updateReq.content,
                  updated_at: new Date().toISOString(),
                };
                if (updateReq.title) updates.title = updateReq.title;

                await serviceDb
                  .from("reports")
                  .update(updates)
                  .eq("id", updateReq.id)
                  .eq("workspace_id", ctx.workspaceId);

                // Save agent's new version to version history
                await serviceDb.from("report_versions").insert({
                  report_id: currentReport.id,
                  title: updateReq.title || currentReport.title,
                  content: updateReq.content,
                  author_type: "agent",
                  author_id: agent_id,
                  change_type: "agent_update",
                });

                // Emit SSE event so client can update the side panel
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "report_updated",
                      report_id: updateReq.id,
                      title: updateReq.title || currentReport.title,
                      content: updateReq.content,
                    })}\n\n`
                  )
                );

                console.log(`[Chat] Report updated: ${updateReq.id}`);
              } else {
                console.log(`[Chat] update_report: report not found: ${updateReq.id}`);
              }
            }
          } catch (e) {
            console.error("[Chat] Failed to handle update_report:", e);
          }
        }

        // If cleaning changed the text, send a replace event so the client shows clean text
        if (cleaned !== fullResponse) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "replace", text: cleaned })}\n\n`
            )
          );
        }

        if (scheduleMatch) {
          try {
            const schedule = JSON.parse(scheduleMatch[1]);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "schedule_request", ...schedule })}\n\n`
              )
            );
          } catch {
            // Invalid JSON in schedule block — ignore
          }
        }

        if (featureMatch) {
          try {
            const feature = JSON.parse(featureMatch[1]);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "feature_request", ...feature })}\n\n`
              )
            );
          } catch {
            // Invalid JSON in feature block — ignore
          }
        }

        // ─── Explicit channel routing (from #channel in user message) ───
        // This takes priority over LLM-generated group_message_request blocks
        if (explicitChannelId && cleaned) {
          console.log(`[ChannelRoute] Cross-posting response to #${explicitChannelName}`);
          try {
            const targetTeamId = explicitChannelId === "all" ? null : explicitChannelId;
            const postConvId = await crossPostToChannel(
              supabase, user.id, agent, cleaned, targetTeamId, ctx.workspaceId
            );
            console.log(`[ChannelRoute] Cross-post complete — conversation=${postConvId}`);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "group_message_request",
                  conversation_id: postConvId,
                  team_id: targetTeamId,
                })}\n\n`
              )
            );
          } catch (err) {
            console.error("[ChannelRoute] Cross-post failed:", err);
          }
        } else if (groupMsgMatch) {
          console.log(`[CrossPost] group_message_request block detected, raw JSON: ${groupMsgMatch[1].slice(0, 200)}`);
          try {
            const { message: groupMsg, channel: targetChannel } = JSON.parse(groupMsgMatch[1]);
            console.log(`[CrossPost] Parsed — message: "${(groupMsg || "").slice(0, 80)}", channel: "${targetChannel}"`);
            if (groupMsg) {
              // Resolve target channel: match channel name to a team
              let targetTeamId: string | null = null;
              if (targetChannel) {
                const channelLower = targetChannel.toLowerCase().replace(/^#/, "");
                console.log(`[CrossPost] Looking up channel ID for: "${channelLower}"`);
                const matchedTeam = agentTeams.find(
                  (t) => t.name.toLowerCase() === channelLower
                );
                if (!matchedTeam) {
                  // Try a broader lookup — the agent might reference a team they're not in
                  const { data: teamLookup } = await serviceDb
                    .from("teams")
                    .select("id, name")
                    .eq("workspace_id", ctx.workspaceId)
                    .ilike("name", channelLower)
                    .limit(1)
                    .single();
                  if (teamLookup) {
                    targetTeamId = teamLookup.id;
                    console.log(`[CrossPost] Found channel via DB: "${teamLookup.name}" (${teamLookup.id})`);
                  } else {
                    console.log(`[CrossPost] Channel "${targetChannel}" not found in agentTeams or DB, falling back to #all`);
                  }
                } else {
                  targetTeamId = matchedTeam.id;
                  console.log(`[CrossPost] Found channel in agent's teams: "${matchedTeam.name}" (${matchedTeam.id})`);
                }
              } else if (agentTeams.length === 1) {
                // Agent is in exactly one team and didn't specify a channel — default to their team
                targetTeamId = agentTeams[0].id;
                console.log(`[CrossPost] No channel specified, agent in 1 team — defaulting to #${agentTeams[0].name} (${targetTeamId})`);
              } else {
                console.log(`[CrossPost] No channel specified, agent in ${agentTeams.length} teams — posting to #all`);
              }

              console.log(`[CrossPost] Calling crossPostToChannel — teamId=${targetTeamId}`);
              const postConvId = await crossPostToChannel(
                supabase, user.id, agent, groupMsg, targetTeamId, ctx.workspaceId
              );
              console.log(`[CrossPost] Cross-post complete — conversation=${postConvId}`);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "group_message_request",
                    conversation_id: postConvId,
                    team_id: targetTeamId,
                  })}\n\n`
                )
              );
            } else {
              console.log(`[CrossPost] No message content in group_message_request block`);
            }
          } catch (err) {
            console.error("[CrossPost] Failed to cross-post:", err);
          }
        } else {
          // Check if the agent tried to output a group_message_request but the regex didn't match
          if (fullResponse.includes("group_message_request")) {
            console.log(`[CrossPost] WARNING: "group_message_request" found in response but regex didn't match. Raw response snippet around it:`);
            const idx = fullResponse.indexOf("group_message_request");
            console.log(`[CrossPost] ...${fullResponse.slice(Math.max(0, idx - 30), idx + 100)}...`);
          }
        }

        if (skillsMatch) {
          try {
            const newSkills = JSON.parse(skillsMatch[1]);
            if (Array.isArray(newSkills) && newSkills.length > 0) {
              // Merge with existing skills: update matching skills, add new ones
              const existing: Array<{ skill: string; confidence: string; note?: string }> = agent.soft_skills || [];
              const merged = [...existing];
              for (const ns of newSkills) {
                if (!ns.skill) continue;
                const idx = merged.findIndex((s) => s.skill.toLowerCase() === ns.skill.toLowerCase());
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...ns };
                } else {
                  merged.push(ns);
                }
              }
              await serviceDb
                .from("agents")
                .update({ soft_skills: merged, updated_at: new Date().toISOString() })
                .eq("id", agent_id)
                .eq("workspace_id", ctx.workspaceId);
              console.log(`[Chat] Updated soft_skills for ${agent.name}: ${merged.length} skill(s)`);
            }
          } catch {
            // Invalid JSON — ignore
          }
        }

        if (expectationsMatch) {
          try {
            const newExpectations = JSON.parse(expectationsMatch[1]);
            if (Array.isArray(newExpectations) && newExpectations.length > 0) {
              const existing: Array<{ expectation: string; category?: string }> = agent.team_expectations || [];
              const merged = [...existing];
              for (const ne of newExpectations) {
                if (!ne.expectation) continue;
                if (!merged.some((e) => e.expectation.toLowerCase() === ne.expectation.toLowerCase())) {
                  merged.push(ne);
                }
              }
              await serviceDb
                .from("agents")
                .update({ team_expectations: merged, updated_at: new Date().toISOString() })
                .eq("id", agent_id)
                .eq("workspace_id", ctx.workspaceId);
              console.log(`[Chat] Updated team_expectations for ${agent.name}: ${merged.length} expectation(s)`);
            }
          } catch {
            // Invalid JSON — ignore
          }
        }

        // Log API usage and actual token counts
        const responseTimeMs = Date.now() - chatStartTime;
        let actualTokensIn = 0;
        let actualTokensOut = 0;
        try {
          const finalMessage = await stream.finalMessage();
          actualTokensIn = finalMessage.usage?.input_tokens || 0;
          actualTokensOut = finalMessage.usage?.output_tokens || 0;
          const cost = estimateCost("claude-sonnet-4-5-20250929", actualTokensIn, actualTokensOut);
          console.log(`[Chat] API response: tokensIn=${actualTokensIn} tokensOut=${actualTokensOut} responseLen=${fullResponse.length} cleanedLen=${cleaned?.length ?? 0} time=${responseTimeMs}ms`);
          logApiUsage({
            user_id: user.id,
            service: "chat",
            model: "claude-sonnet-4-5-20250929",
            tokens_in: actualTokensIn,
            tokens_out: actualTokensOut,
            cost,
            response_time_ms: responseTimeMs,
          });
        } catch (usageErr) {
          console.error("[Chat] Usage logging failed:", usageErr);
        }

        // Auto-archival: if conversation is getting long, archive and start fresh
        try {
          if (shouldArchive(estimateTokens(systemPrompt), messages)) {
            console.log(`[Chat] Conversation ${convId} reached archive threshold, archiving...`);
            const newConvId = await archiveConversation(supabase, anthropic, convId!, agent_id, user.id, ctx.workspaceId);
            // Send archive event so client can show divider and switch to new conversation
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "archived", conversation_id: convId, new_conversation_id: newConvId })}\n\n`
              )
            );
          }
        } catch (archiveErr) {
          console.error("[Chat] Auto-archive failed (non-fatal):", archiveErr);
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Stream error";
        console.error(`[Chat] Stream error:`, err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Archive a conversation: generate a summary, mark as archived,
 * and create a new continuation conversation.
 */
async function archiveConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  anthropic: ReturnType<typeof getAnthropicClient>,
  conversationId: string,
  agentId: string,
  userId: string,
  workspaceId?: string
): Promise<string> {
  // Load recent messages for summarization
  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messageCount = msgs?.length || 0;
  if (messageCount < 5) return conversationId; // too few to archive

  // Build conversation text for summarization
  const convText = (msgs || [])
    .map((m: { role: string; content: string }) =>
      `${m.role === "user" ? "User" : "Agent"}: ${m.content.slice(0, 300)}`
    )
    .join("\n");

  // Generate summary using fast model
  let summary: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: "Summarize this conversation in 3-4 sentences covering the key topics discussed, decisions made, and any outstanding items. Be concise and factual.",
      messages: [{ role: "user", content: convText.slice(0, 8000) }],
    });
    summary = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    console.error("[Archive] Summary generation failed:", err);
    summary = `Conversation with ${messageCount} messages (summary unavailable).`;
  }

  console.log(`[Archive] Generated summary for conv=${conversationId}: "${summary.slice(0, 100)}..."`);

  // Mark conversation as archived with summary
  await supabase
    .from("conversations")
    .update({ archived: true, summary, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Save to conversation_summaries table
  await supabase.from("conversation_summaries").insert({
    conversation_id: conversationId,
    summary,
    message_count: messageCount,
  });

  // Create a new continuation conversation
  const insertData: Record<string, unknown> = {
    user_id: userId,
    agent_id: agentId,
    previous_conversation_id: conversationId,
  };
  if (workspaceId) insertData.workspace_id = workspaceId;
  const { data: newConv } = await supabase
    .from("conversations")
    .insert(insertData)
    .select("id")
    .single();

  const newConvId = newConv?.id || conversationId;
  console.log(`[Archive] Archived conv=${conversationId}, new conv=${newConvId}`);
  return newConvId;
}

/**
 * Cross-post a message to a channel (team or #all), then trigger
 * the appropriate agents to respond.
 *
 * @param teamId — if provided, targets the team channel; null → #all
 * Returns the conversation ID.
 */
async function crossPostToChannel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  agent: { id: string; name: string; purpose: string },
  messageContent: string,
  teamId: string | null,
  workspaceId?: string
): Promise<string> {
  const LOG = `[CrossPost:${teamId ? "team" : "#all"}]`;
  console.log(`${LOG} Cross-post triggered — agent="${agent.name}", teamId=${teamId}, message="${messageContent.slice(0, 80)}"`);

  // Build the conversation lookup query — use workspace_id for shared channels
  let convQuery = supabase
    .from("conversations")
    .select("id")
    .is("agent_id", null);

  if (workspaceId) {
    convQuery = convQuery.eq("workspace_id", workspaceId);
  } else {
    convQuery = convQuery.eq("user_id", userId);
  }

  if (teamId) {
    convQuery = convQuery.eq("team_id", teamId);
  } else {
    convQuery = convQuery.is("team_id", null);
  }

  const { data: existingConv, error: convLookupError } = await convQuery
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (convLookupError && convLookupError.code !== "PGRST116") {
    console.error(`${LOG} Conversation lookup error:`, convLookupError);
  }

  let convId: string;
  if (existingConv) {
    convId = existingConv.id;
    console.log(`${LOG} Found existing conversation: ${convId}`);
  } else {
    console.log(`${LOG} No existing conversation found, creating new one`);
    const insertData: Record<string, unknown> = { user_id: userId, agent_id: null };
    if (teamId) insertData.team_id = teamId;
    if (workspaceId) insertData.workspace_id = workspaceId;
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert(insertData)
      .select("id")
      .single();
    if (convError || !newConv) {
      console.error(`${LOG} Failed to create conversation:`, convError);
      throw new Error(`Failed to create conversation: ${convError?.message}`);
    }
    convId = newConv.id;
    console.log(`${LOG} Created new conversation: ${convId}`);
  }

  // Save the message tagged with the agent's name
  const taggedContent = `[${agent.name}] ${messageContent}`;
  console.log(`${LOG} Saving message to conversation ${convId}`);
  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: convId,
    role: "assistant",
    content: taggedContent,
  });
  if (msgError) {
    console.error(`${LOG} Failed to save message:`, msgError);
    throw new Error(`Failed to save message: ${msgError.message}`);
  }
  console.log(`${LOG} Message saved successfully`);

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  if (teamId) {
    // Team channel: only trigger agents in that team
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("agent_id")
      .eq("team_id", teamId);

    const teamAgentIds = (teamMembers || [])
      .map((m: { agent_id: string }) => m.agent_id)
      .filter((id: string) => id !== agent.id);

    console.log(`[Chat] Agent message saved to team channel (${teamId}), triggering ${teamAgentIds.length} team agent(s)`);

    if (teamAgentIds.length > 0) {
      // Exclude agents NOT in the team + the posting agent
      let agentsQuery = supabase.from("agents").select("id");
      if (workspaceId) {
        agentsQuery = agentsQuery.eq("workspace_id", workspaceId);
      } else {
        agentsQuery = agentsQuery.eq("user_id", userId);
      }
      const { data: allAgents } = await agentsQuery;

      const excludeIds = (allAgents || [])
        .map((a: { id: string }) => a.id)
        .filter((id: string) => !teamAgentIds.includes(id) || id === agent.id);

      await runGroupOrchestration(supabase, userId, convId, taggedContent, excludeIds, 0, new Set(), workspaceId);
    }
  } else {
    // #all channel
    console.log(`[Chat] Agent message saved to #all, triggering orchestration for conv=${convId}`);
    await runGroupOrchestration(supabase, userId, convId, taggedContent, agent.id, 0, new Set(), workspaceId);
  }

  return convId;
}

