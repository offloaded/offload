import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, cleanResponse } from "@/lib/anthropic";
import { retrieveContext } from "@/lib/rag";

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
  const { message, conversation_id, mentions } = body as {
    message: string;
    conversation_id?: string;
    mentions?: string[];
  };

  if (!message?.trim()) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400 }
    );
  }

  // Load all agents for this user
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (agentsError || !agents || agents.length === 0) {
    return new Response(
      JSON.stringify({ error: "No agents found. Create agents first." }),
      { status: 400 }
    );
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
      .insert({ user_id: user.id, agent_id: null })
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
  await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message.trim(),
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  // Load message history
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

  // RAG: retrieve document context for each agent that has ready documents
  const { data: allDocs } = await supabase
    .from("documents")
    .select("agent_id, file_name")
    .in("agent_id", agents.map((a) => a.id))
    .eq("status", "ready");

  // Group docs by agent
  const docsByAgent = new Map<string, string[]>();
  for (const doc of allDocs || []) {
    const list = docsByAgent.get(doc.agent_id) || [];
    list.push(doc.file_name);
    docsByAgent.set(doc.agent_id, list);
  }

  // Retrieve context for all agents with documents in parallel
  const agentContextMap = new Map<string, { content: string; fileName: string; metadata?: { document_date?: string | null; section_heading?: string | null } }[]>();
  const retrievalPromises = agents
    .filter((a) => docsByAgent.has(a.id))
    .map(async (a) => {
      const docCount = docsByAgent.get(a.id)?.length || 0;
      const topK = docCount > 20 ? 25 : docCount > 5 ? 15 : 5;
      try {
        const ctx = await retrieveContext(supabase, a.id, message.trim(), topK);
        if (ctx.length > 0) {
          agentContextMap.set(a.id, ctx);
        }
      } catch (err) {
        console.error(`[Group RAG] Retrieval failed for ${a.name}:`, err);
      }
    });

  await Promise.all(retrievalPromises);

  // Build system prompt with per-agent document context
  const agentDescriptions = agents.map((a) => {
    let desc = `- ${a.name} (id: ${a.id}, color: ${a.color}): ${a.purpose}`;
    const docNames = docsByAgent.get(a.id);
    if (docNames && docNames.length > 0) {
      desc += `\n  Documents: ${docNames.join(", ")}`;
    }
    const ctx = agentContextMap.get(a.id);
    if (ctx && ctx.length > 0) {
      desc += `\n  Relevant knowledge base excerpts for ${a.name}:`;
      ctx.forEach((c, i) => {
        let header = `From "${c.fileName}"`;
        if (c.metadata?.document_date) header += ` (${c.metadata.document_date})`;
        if (c.metadata?.section_heading) header += ` — ${c.metadata.section_heading}`;
        desc += `\n  [${i + 1}] ${header}: ${c.content}`;
      });
    }
    return desc;
  }).join("\n\n");

  // Build mention instruction if user @mentioned specific agents
  const mentionedAgents = (mentions || [])
    .map((name) => agents.find((a) => a.name.toLowerCase() === name.toLowerCase()))
    .filter(Boolean);

  let mentionInstruction = "";
  if (mentionedAgents.length > 0) {
    const names = mentionedAgents.map((a) => a!.name).join(", ");
    mentionInstruction = `\n\nThe user has specifically @mentioned: ${names}. These agents MUST respond first and directly address the user's question. Other agents may still chime in briefly if they have relevant input.`;
  }

  const systemPrompt = `You are the Operations Manager for a team of AI agents. Your job is to route the user's message to the most relevant agent(s) and respond as them.

Your team:
${agentDescriptions}

IMPORTANT RULES:
1. Decide which agent(s) should respond based on the user's message.
2. Respond as each relevant agent. You may have 1-3 agents respond.
3. Format EACH agent's response on its own line, prefixed with their exact name in brackets:
   [Agent Name] Their response text here.
4. Each agent should respond in character — concise, professional, as a colleague. CRITICAL: Never use markdown formatting. No **bold** or *italic* asterisks. No # headers. No - bullet lists. No \`code blocks\`. Write in plain conversational text like a human messaging in a chat app. Never output XML tags, tool calls, or search markup.
5. If the message is general (like "hello"), have 1-2 agents respond naturally.
6. If the message clearly relates to one agent's domain, only that agent responds.
7. Do NOT add any text outside of the [Agent Name] format. Every line of your response must start with [Agent Name].
8. Keep responses concise — each agent should respond in 1-3 sentences unless more detail is needed.
9. When an agent has knowledge base excerpts provided above, they MUST reference and use that information in their response. Cite the relevant documents.

TEAM COLLABORATION:
10. Agents are colleagues, not isolated responders. They should act like a real team discussing problems together.
11. If another agent's expertise is relevant to your answer, tag them and ask for their input. For example: "[Marketing Lead] Great question — this also has HR implications. @HR Advisor, what does our policy say about this?"
12. If you notice a gap in your own knowledge that another agent could fill, ask them directly.
13. Build on what other agents have said in the conversation. Reference their previous responses when relevant.
14. When multiple agents respond, they should feel like a natural team discussion, not a list of independent answers.${mentionInstruction}`;

  // Stream response from Claude
  const anthropic = getAnthropicClient();

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
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

        // Clean the response: strip any <search> blocks or tool markup
        const cleaned = cleanResponse(fullResponse);

        // Save the cleaned response
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: cleaned,
        });

        // If cleaning changed the text, send a replace event
        if (cleaned !== fullResponse) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "replace", text: cleaned })}\n\n`
            )
          );
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
