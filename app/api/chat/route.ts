import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, buildSystemPrompt, cleanResponse } from "@/lib/anthropic";
import { retrieveContext, type RetrievedChunk } from "@/lib/rag";
import { webSearch, formatSearchResults } from "@/lib/web-search";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const body = await request.json();
  const { agent_id, message, conversation_id } = body;

  if (!agent_id || !message?.trim()) {
    return new Response(
      JSON.stringify({ error: "agent_id and message are required" }),
      { status: 400 }
    );
  }

  // Load the agent and verify ownership
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agent_id)
    .eq("user_id", user.id)
    .single();

  if (agentError || !agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
    });
  }

  // Use existing conversation or create a new one
  let convId = conversation_id;
  if (convId) {
    // Verify the conversation belongs to this user
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .single();
    if (!existingConv) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404 }
      );
    }
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, agent_id })
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

  // Save the user message
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

  // Load message history for context
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messages = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

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
      ragContext = await retrieveContext(supabase, agent_id, message.trim(), topK);
      console.log(`[Chat RAG] Retrieved ${ragContext.length} context chunks (topK=${topK})`);
    } catch (err) {
      console.error("RAG retrieval failed:", err);
      // Continue without context — don't block the chat
    }
  }

  // Web search only if enabled — this is the server-side enforcement point
  let webSearchResults: string | undefined;
  if (agent.web_search_enabled) {
    try {
      const results = await webSearch(message.trim(), 5);
      if (results.length > 0) {
        webSearchResults = formatSearchResults(results);
      }
    } catch (err) {
      console.error("[Chat] Web search failed:", err);
    }
  }

  // Build list of disabled features for in-chat activation
  const disabledFeatures: Array<{ feature: string; label: string; description: string }> = [];
  if (!agent.web_search_enabled) {
    disabledFeatures.push({
      feature: "web_search",
      label: "Web Search",
      description: "Search the web for current information, news, and real-time data",
    });
  }

  // Stream response from Claude
  const anthropic = getAnthropicClient();
  const systemPrompt = buildSystemPrompt(
    agent,
    ragContext.length > 0 ? ragContext : undefined,
    documentNames.length > 0 ? documentNames : undefined,
    {
      enableScheduleDetection: true,
      webSearchResults,
      disabledFeatures: disabledFeatures.length > 0 ? disabledFeatures : undefined,
    }
  );
  console.log(`[Chat RAG] System prompt length: ${systemPrompt.length}`);

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  // Create a ReadableStream that sends SSE events
  const encoder = new TextEncoder();
  let fullResponse = "";

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

        // Detect schedule_request and feature_request before cleaning
        const scheduleMatch = fullResponse.match(
          /```schedule_request\s*\n([\s\S]*?)\n```/
        );
        const featureMatch = fullResponse.match(
          /```feature_request\s*\n([\s\S]*?)\n```/
        );

        // Clean the response: strip <search> blocks, schedule_request blocks, feature_request blocks, etc.
        const cleaned = cleanResponse(fullResponse);

        // Save the cleaned response
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: cleaned,
        });

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

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Stream error";
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
