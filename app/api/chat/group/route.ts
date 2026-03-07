import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, cleanResponse } from "@/lib/anthropic";
import { retrieveContext } from "@/lib/rag";
import { classifyIntent, scoreAgentRelevance } from "@/lib/group-orchestration";

export async function POST(request: Request) {
  const LOG = "[Group Chat]";
  console.log(`${LOG} ─── Request received ───`);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log(`${LOG} ✗ Unauthorized — no user session`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  console.log(`${LOG} ✓ User authenticated: ${user.id}`);

  const body = await request.json();
  const { message, conversation_id, mentions } = body as {
    message: string;
    conversation_id?: string;
    mentions?: string[];
  };

  console.log(`${LOG} Message: "${message?.slice(0, 100)}${message?.length > 100 ? "..." : ""}"`);
  console.log(`${LOG} conversation_id: ${conversation_id ?? "(none — new conversation)"}`);
  console.log(`${LOG} mentions: ${mentions?.length ? mentions.join(", ") : "(none)"}`);

  if (!message?.trim()) {
    console.log(`${LOG} ✗ Empty message rejected`);
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

  if (agentsError) {
    console.log(`${LOG} ✗ DB error loading agents:`, agentsError);
    return new Response(
      JSON.stringify({ error: "No agents found. Create agents first." }),
      { status: 400 }
    );
  }
  if (!agents || agents.length === 0) {
    console.log(`${LOG} ✗ No agents found for user ${user.id}`);
    return new Response(
      JSON.stringify({ error: "No agents found. Create agents first." }),
      { status: 400 }
    );
  }
  console.log(`${LOG} ✓ Loaded ${agents.length} agent(s): ${agents.map((a) => `"${a.name}" (${a.id})`).join(", ")}`);

  // Classify intent to determine pipeline depth
  const intent = classifyIntent(message.trim());
  console.log(`${LOG} ✓ Intent: ${intent}`);

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
      console.log(`${LOG} ✗ Conversation ${convId} not found or doesn't belong to user`);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404 }
      );
    }
    console.log(`${LOG} ✓ Using existing conversation: ${convId}`);
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, agent_id: null })
      .select("id")
      .single();

    if (convError || !newConv) {
      console.log(`${LOG} ✗ Failed to create conversation:`, convError);
      return new Response(
        JSON.stringify({ error: "Failed to create conversation" }),
        { status: 500 }
      );
    }
    convId = newConv.id;
    console.log(`${LOG} ✓ Created new conversation: ${convId}`);
  }

  // Save the user message
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message.trim(),
  });
  if (userMsgError) {
    console.log(`${LOG} ✗ Failed to save user message:`, userMsgError);
  } else {
    console.log(`${LOG} ✓ User message saved`);
  }

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  // Load message history — casual messages only need a short window
  const historyLimit = intent === "casual" ? 6 : 20;
  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(historyLimit);

  if (historyError) {
    console.log(`${LOG} ✗ Failed to load history:`, historyError);
  }

  // Re-sort ascending for the LLM (we fetched newest-first for the limit)
  if (history) history.reverse();

  const messages = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  console.log(`${LOG} ✓ History: ${messages.length} message(s) — roles: [${messages.map((m) => m.role).join(", ")}]`);
  // Check for invalid consecutive same-role messages (would cause Claude API 400)
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) {
      console.log(`${LOG} ⚠ CONSECUTIVE ${messages[i].role.toUpperCase()} MESSAGES at index ${i - 1} and ${i} — Claude API will reject this!`);
    }
  }
  if (messages.length > 0) {
    console.log(`${LOG}   First message role: ${messages[0].role}, Last message role: ${messages[messages.length - 1].role}`);
  }

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
  console.log(`${LOG} ✓ RAG docs: ${allDocs?.length ?? 0} ready doc(s) across ${docsByAgent.size} agent(s)`);

  // Determine which agents need RAG based on intent + relevance
  // casual/search → skip RAG entirely
  // knowledge/action → only retrieve for agents whose purpose overlaps the message
  const agentContextMap = new Map<string, { content: string; fileName: string; metadata?: { document_date?: string | null; section_heading?: string | null } }[]>();

  if (intent === "knowledge" || intent === "action") {
    const agentsWithDocs = agents.filter((a) => docsByAgent.has(a.id));

    // Score relevance and select agents to retrieve for
    let agentsToRetrieve = agentsWithDocs;
    if (agentsWithDocs.length > 0) {
      const scored = agentsWithDocs
        .map((a) => ({ agent: a, score: scoreAgentRelevance(message.trim(), a) }))
        .sort((a, b) => b.score - a.score);
      const relevant = scored.filter((s) => s.score > 0);
      // If relevance scoring finds matches, use those. Otherwise fall back to all agents with docs
      // (avoids missing context when message uses synonyms not in the purpose text)
      agentsToRetrieve = relevant.length > 0 ? relevant.map((s) => s.agent) : agentsWithDocs;
      console.log(
        `${LOG}   RAG selection: ${agentsToRetrieve.map((a) => {
          const s = scored.find((x) => x.agent.id === a.id);
          return `"${a.name}"(${s?.score ?? 0})`;
        }).join(", ")}`
      );
    }

    const retrievalPromises = agentsToRetrieve.map(async (a) => {
      const topK = 5;
      try {
        const ctx = await retrieveContext(supabase, a.id, message.trim(), topK);
        if (ctx.length > 0) {
          agentContextMap.set(a.id, ctx);
          console.log(`${LOG}   RAG: ${ctx.length} chunk(s) retrieved for "${a.name}"`);
        }
      } catch (err) {
        console.error(`${LOG} ✗ RAG retrieval failed for "${a.name}":`, err);
      }
    });

    await Promise.all(retrievalPromises);
  } else {
    console.log(`${LOG}   Skipping RAG for intent="${intent}"`);
  }

  // Build mention instruction if user @mentioned specific agents
  const mentionedAgents = (mentions || [])
    .map((name) => agents.find((a) => a.name.toLowerCase() === name.toLowerCase()))
    .filter(Boolean);

  let mentionInstruction = "";
  if (mentionedAgents.length > 0) {
    const names = mentionedAgents.map((a) => a!.name).join(", ");
    mentionInstruction = `\n\nThe user has specifically @mentioned: ${names}. These agents MUST respond first and directly address the user's question. Other agents may still chime in briefly if they have relevant input.`;
  }

  // ── System prompt ──────────────────────────────────────────────────────────
  // Casual messages get a lean prompt — no doc context, no heavy instructions.
  // All other intents get the full prompt with RAG chunks and scheduling rules.
  const agentList = agents
    .map((a) => `- ${a.name} (id: ${a.id}, color: ${a.color}): ${a.purpose}`)
    .join("\n");

  let systemPrompt: string;

  if (intent === "casual") {
    systemPrompt = `You are managing a friendly team of ${agents.length} AI agents in a group chat. This is casual conversation — respond warmly and briefly.

Your team:
${agentList}

RULES:
1. For team-wide greetings ("hello team", "good morning", "how's everyone", "hi all") — ALL ${agents.length} agents MUST respond, each with exactly 1 short sentence. Do not skip any agent.
2. For personal acknowledgements ("thanks", "ok", "sounds good") — 1-2 agents respond.
3. Format every response as: [Agent Name] their message
4. Every line must start with [Agent Name].
5. No markdown. Plain conversational text only.${mentionInstruction}`;
  } else {
    // Full prompt with RAG context and scheduling support
    const agentDescriptions = agents.map((a) => {
      const shortPurpose = a.purpose.length > 120 ? a.purpose.slice(0, 120).trimEnd() + "..." : a.purpose;
      let desc = `- ${a.name} (id: ${a.id}, color: ${a.color}): ${shortPurpose}`;
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

    systemPrompt = `You are the Operations Manager for a team of AI agents. Your job is to route the user's message to the most relevant agent(s) and respond as them.

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
14. When multiple agents respond, they should feel like a natural team discussion, not a list of independent answers.${mentionInstruction}

SCHEDULED TASKS:
If the user asks to schedule, remind, or delay something, the most relevant agent should acknowledge the request AND include a JSON block at the very END of your response.

For RECURRING tasks ("every morning", "daily at 5pm", "every Monday"):
\`\`\`schedule_request
{"agent_id": "the-agent-id", "instruction": "the task to perform", "cron": "0 9 * * *", "timezone": "Pacific/Auckland", "recurring": true, "destination": "group"}
\`\`\`

For ONE-OFF tasks ("in 5 minutes", "at 3pm today", "tomorrow at noon", "in an hour"):
\`\`\`schedule_request
{"agent_id": "the-agent-id", "instruction": "the task to perform", "run_at": "2025-03-07T15:00:00.000Z", "timezone": "Pacific/Auckland", "recurring": false, "destination": "group"}
\`\`\`

The current date/time is ${new Date().toISOString()}. For one-off tasks use "run_at" with the exact UTC ISO datetime — do NOT include a "cron" field. For recurring tasks use "cron" with a standard 5-field expression — do NOT include "run_at". Set "destination" based on the user's wording: use "group" if they say things like "ask the group", "post in the group chat", "tell the team", "message the team", "share with everyone"; use "dm" if they say "remind me", "message me", "send me", "let me know", "tell me". Default to "dm" when unclear. Only include this block when the user is explicitly requesting a scheduled or delayed task.`;
  }

  console.log(`${LOG} ✓ System prompt built: ${systemPrompt.length} chars`);
  console.log(`${LOG} ─── Calling Claude API ───`);
  console.log(`${LOG}   model: claude-sonnet-4-5-20250929`);
  console.log(`${LOG}   messages: ${messages.length}`);
  console.log(`${LOG}   system prompt preview: ${systemPrompt.slice(0, 200).replace(/\n/g, "↵")}...`);

  const anthropic = getAnthropicClient();
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });
  console.log(`${LOG} ✓ Claude stream created`);

  const encoder = new TextEncoder();
  let fullResponse = "";
  let chunkCount = 0;

  const readable = new ReadableStream({
    async start(controller) {
      console.log(`${LOG} ─── Stream started ───`);
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
            chunkCount++;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", text })}\n\n`
              )
            );
          }
        }

        console.log(`${LOG} ✓ Stream complete: ${chunkCount} chunk(s), ${fullResponse.length} chars total`);
        console.log(`${LOG}   Raw response preview: "${fullResponse.slice(0, 300).replace(/\n/g, "↵")}"`);

        // Detect schedule_request before cleaning
        const scheduleMatch = fullResponse.match(
          /```schedule_request\s*\n([\s\S]*?)\n```/
        );

        // Clean the response: strip any <search> blocks or tool markup
        const cleaned = cleanResponse(fullResponse);

        console.log(`${LOG}   Cleaned response length: ${cleaned.length} chars (was ${fullResponse.length})`);
        if (cleaned.length === 0 && fullResponse.length > 0) {
          console.log(`${LOG} ⚠ ENTIRE RESPONSE WAS STRIPPED by cleanResponse! Raw was:\n${fullResponse}`);
        }

        // Parse agent responses to check formatting
        const agentLines = cleaned.split("\n").filter((l) => l.trim());
        const parsedLines = agentLines.filter((l) => /^\[.+\]/.test(l));
        console.log(`${LOG}   Agent-tagged lines: ${parsedLines.length}/${agentLines.length} total lines`);
        if (parsedLines.length === 0 && cleaned.length > 0) {
          console.log(`${LOG} ⚠ No [Agent Name] tags found — response won't parse into agent bubbles. Content:\n${cleaned.slice(0, 500)}`);
        }

        // Save the cleaned response
        const { error: saveMsgError } = await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: cleaned,
        });
        if (saveMsgError) {
          console.log(`${LOG} ✗ Failed to save assistant message:`, saveMsgError);
        } else {
          console.log(`${LOG} ✓ Assistant message saved to DB`);
        }

        // If cleaning changed the text, send a replace event
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
            console.log(`${LOG}   Schedule request detected: ${JSON.stringify(schedule)}`);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "schedule_request", ...schedule })}\n\n`
              )
            );
          } catch {
            console.log(`${LOG} ⚠ Failed to parse schedule_request JSON`);
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        console.log(`${LOG} ✓ Done event sent`);
        controller.close();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Stream error";
        console.log(`${LOG} ✗ Stream error: ${errorMsg}`, err);
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
