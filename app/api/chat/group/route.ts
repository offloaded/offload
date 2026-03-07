import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, cleanResponse } from "@/lib/anthropic";
import {
  classifyIntent,
  detectMessageAddressing,
  evaluateAgents,
  generateAgentResponse,
  scoreAgentRelevance,
} from "@/lib/group-orchestration";

// Schedule detection instructions included in agent prompts when intent is "action"
function buildScheduleInstructions(): string {
  return `If the user is asking you to schedule, remind, or delay something, acknowledge the request and include a JSON block at the END of your response.

For RECURRING tasks ("every morning", "daily at 5pm", "every Monday"):
\`\`\`schedule_request
{"agent_id": "YOUR_AGENT_ID", "instruction": "the task to perform", "cron": "0 9 * * *", "timezone": "Pacific/Auckland", "recurring": true, "destination": "group"}
\`\`\`

For ONE-OFF tasks ("in 5 minutes", "at 3pm today", "tomorrow at noon"):
\`\`\`schedule_request
{"agent_id": "YOUR_AGENT_ID", "instruction": "the task to perform", "run_at": "${new Date().toISOString()}", "timezone": "Pacific/Auckland", "recurring": false, "destination": "dm"}
\`\`\`

Current date/time: ${new Date().toISOString()}. Only include this block when scheduling is explicitly requested. Set destination: "group" for team posts, "dm" for personal reminders.`;
}

export async function POST(request: Request) {
  const LOG = "[Group Chat]";
  console.log(`${LOG} ─── Request received ───`);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json();
  const { message, conversation_id, mentions } = body as {
    message: string;
    conversation_id?: string;
    mentions?: string[];
  };

  console.log(`${LOG} Message: "${message?.slice(0, 100)}${message?.length > 100 ? "..." : ""}"`);

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  // Load agents
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (agentsError || !agents?.length) {
    return new Response(JSON.stringify({ error: "No agents found. Create agents first." }), { status: 400 });
  }
  console.log(`${LOG} ✓ ${agents.length} agent(s): ${agents.map((a) => a.name).join(", ")}`);

  // Classify intent and detect addressing
  const intent = classifyIntent(message.trim());
  const { isTeamWide, mentionedAgentIds: detectedMentionIds } = detectMessageAddressing(message.trim(), agents);
  const effectiveIntent = isTeamWide && intent === "casual" ? "knowledge" : intent;
  console.log(`${LOG} intent=${intent} effective=${effectiveIntent} isTeamWide=${isTeamWide}`);

  // Resolve/create conversation
  let convId = conversation_id;
  if (convId) {
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .single();
    if (!existingConv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
    }
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, agent_id: null })
      .select("id")
      .single();
    if (convError || !newConv) {
      return new Response(JSON.stringify({ error: "Failed to create conversation" }), { status: 500 });
    }
    convId = newConv.id;
  }
  console.log(`${LOG} ✓ Conversation: ${convId}`);

  // Save user message
  await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: message.trim() });
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

  // Load message history
  const historyLimit = effectiveIntent === "casual" && !isTeamWide ? 6 : 20;
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(historyLimit);

  if (history) history.reverse();
  const messages = (history || []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Validate no consecutive same-role messages (causes Claude API 400)
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) {
      console.log(`${LOG} ⚠ Consecutive ${messages[i].role} messages at index ${i - 1},${i}`);
    }
  }
  console.log(`${LOG} ✓ History: ${messages.length} message(s)`);

  // Load docs per agent
  const { data: allDocs } = await supabase
    .from("documents")
    .select("agent_id, file_name")
    .in("agent_id", agents.map((a) => a.id))
    .eq("status", "ready");

  const docsByAgent = new Map<string, string[]>();
  for (const doc of allDocs || []) {
    const list = docsByAgent.get(doc.agent_id) || [];
    list.push(doc.file_name);
    docsByAgent.set(doc.agent_id, list);
  }
  console.log(`${LOG} ✓ Docs: ${allDocs?.length ?? 0} ready doc(s)`);

  // Resolve all @mentioned agents (from UI + from text detection)
  const uiMentionIds = (mentions || [])
    .map((name) => agents.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));
  const allMentionedIds = [...new Set([...uiMentionIds, ...detectedMentionIds])];
  const mentionedAgents = agents.filter((a) => allMentionedIds.includes(a.id));
  const nonMentionedAgents = agents.filter((a) => !allMentionedIds.includes(a.id));

  const anthropic = getAnthropicClient();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "conversation_id", conversation_id: convId });

        let combined = "";

        // ── CASUAL SHORTCUT ────────────────────────────────────────────────
        // For clearly casual messages with no @mentions: skip evaluate phase,
        // pick 1-2 agents by relevance, use Haiku, no RAG.
        if (effectiveIntent === "casual" && allMentionedIds.length === 0) {
          console.log(`${LOG} Casual shortcut`);

          const scored = agents
            .map((a) => ({ agent: a, score: scoreAgentRelevance(message.trim(), a) }))
            .sort((a, b) => b.score - a.score);
          const casualAgents = scored.slice(0, Math.min(2, scored.length)).map((s) => s.agent);

          const casualResponses = await Promise.all(
            casualAgents.map(async (agent) => {
              const systemPrompt = `You are ${agent.name}, a member of a team group chat.\nYour role: ${agent.purpose}\n\nWrite a brief, natural response (1-2 sentences). Plain text only, no markdown. Do NOT start with your name.`;
              const response = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 150,
                system: systemPrompt,
                messages,
              });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const text = response.content
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text as string)
                .join("")
                .trim();
              return `[${agent.name}] ${cleanResponse(text)}`;
            })
          );

          combined = casualResponses.filter((r) => r.trim()).join("\n");
          console.log(`${LOG} Casual: ${casualAgents.length} agent(s) → ${combined.length} chars`);
        } else {
          // ── EVALUATE PHASE ───────────────────────────────────────────────
          // Parallel cheap Haiku calls to decide who should respond.
          // @mentioned agents bypass evaluation and always respond.

          const recentForEval = messages.slice(-4).map(
            (m) => `${m.role === "user" ? "User" : "Team"}: ${m.content.slice(0, 150)}`
          );

          let evalResults: Awaited<ReturnType<typeof evaluateAgents>> = [];

          if (isTeamWide) {
            // All agents respond — skip eval
            evalResults = nonMentionedAgents.map((a) => ({
              agentId: a.id,
              respond: true,
              reason: "team-wide message",
            }));
            console.log(`${LOG} Team-wide: all ${agents.length} agents respond`);
          } else if (nonMentionedAgents.length > 0) {
            console.log(`${LOG} Evaluating ${nonMentionedAgents.length} agent(s)...`);
            evalResults = await evaluateAgents(
              anthropic,
              nonMentionedAgents,
              recentForEval,
              message.trim()
            );
            for (const r of evalResults) {
              const name = agents.find((a) => a.id === r.agentId)?.name ?? r.agentId;
              console.log(`${LOG}   ${name} → ${r.respond ? "YES" : "NO"} (${r.reason})`);
            }
          }

          // ── RESPOND PHASE ─────────────────────────────────────────────
          // Mentioned agents always respond; self-selected agents also respond.
          // Run full pipeline (RAG + individual system prompt) in parallel.

          const respondingIds = new Set<string>([
            ...mentionedAgents.map((a) => a.id),
            ...evalResults.filter((r) => r.respond).map((r) => r.agentId),
          ]);
          const respondingAgents = agents.filter((a) => respondingIds.has(a.id));

          console.log(`${LOG} Responding: [${respondingAgents.map((a) => a.name).join(", ") || "none"}]`);

          if (respondingAgents.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          const scheduleInstructions = intent === "action" ? buildScheduleInstructions() : undefined;

          const agentResponses = await Promise.all(
            respondingAgents.map(async (agent) => {
              const text = await generateAgentResponse(
                anthropic,
                supabase,
                agent,
                messages,
                message.trim(),
                docsByAgent,
                scheduleInstructions
              );
              // Replace placeholder agent_id with real id in any schedule_request block
              return `[${agent.name}] ${text.replace(/YOUR_AGENT_ID/g, agent.id)}`;
            })
          );

          combined = agentResponses.filter((r) => r.trim()).join("\n");
          console.log(`${LOG} Respond phase: ${respondingAgents.length} agent(s) → ${combined.length} chars`);
        }

        if (!combined) {
          send({ type: "done" });
          controller.close();
          return;
        }

        // Detect schedule_request block before stripping (for action intent)
        const scheduleMatch = combined.match(/```schedule_request\s*\n([\s\S]*?)\n```/);

        // Clean the combined response
        const cleaned = cleanResponse(combined);
        console.log(`${LOG} Cleaned: ${cleaned.length} chars`);

        // Stream the assembled response
        send({ type: "text", text: cleaned });

        // Save to DB
        const { error: saveMsgError } = await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: cleaned,
        });
        if (saveMsgError) {
          console.log(`${LOG} ✗ Failed to save assistant message:`, saveMsgError);
        } else {
          console.log(`${LOG} ✓ Saved to DB`);
        }

        // If cleaning modified the text, send a replace event so the client shows the clean version
        if (cleaned !== combined) {
          send({ type: "replace", text: cleaned });
        }

        // Forward schedule_request if detected
        if (scheduleMatch) {
          try {
            const schedule = JSON.parse(scheduleMatch[1]);
            console.log(`${LOG} Schedule request: ${JSON.stringify(schedule)}`);
            send({ type: "schedule_request", ...schedule });
          } catch {
            console.log(`${LOG} ⚠ Failed to parse schedule_request JSON`);
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Stream error";
        console.log(`${LOG} ✗ Error: ${errorMsg}`, err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`)
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
