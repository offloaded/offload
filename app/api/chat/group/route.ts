import { createServerSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, cleanResponse } from "@/lib/anthropic";
import {
  classifyIntent,
  detectMessageAddressing,
  detectFollowUpTriggers,
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

  // Resolve/create conversation.
  // If no conversation_id provided, reuse the most recent group conversation rather than
  // creating a new one — prevents orphaned conversations when the cache is cleared.
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
    // Try to find the most recent group conversation first
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .is("agent_id", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      convId = existing.id;
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

      // Minimum delay (ms) before each agent's response appears.
      // Generation runs concurrently with the delay so the user sees the
      // typing indicator immediately, and the response appears once both
      // the minimum wait AND generation complete.
      const DELAY_RANGES: Record<string, [number, number]> = {
        high:   [3000,  5000],
        medium: [4000,  8000],
        low:    [8000, 14000],
      };

      const teamMemberNames = agents.map((a) => a.name);
      const scheduleInstructions = intent === "action" ? buildScheduleInstructions() : undefined;

      try {
        send({ type: "conversation_id", conversation_id: convId });

        // Ordered list of agent responses accumulated for DB save and prior-context
        const allResponses: string[] = [];
        let schedulePayload: Record<string, unknown> | null = null;

        // ── Helper: run one agent sequentially ─────────────────────────
        const runAgent = async (
          agent: typeof agents[0],
          urgency: "high" | "medium" | "low",
          weight: "full" | "brief",
          priorResponses: string
        ) => {
          const [minD, maxD] = DELAY_RANGES[urgency];
          const targetDelay = minD + Math.floor(Math.random() * (maxD - minD));

          send({ type: "agent_typing", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color });

          // Generate response and enforce minimum delay simultaneously
          const [rawText] = await Promise.all([
            generateAgentResponse(
              anthropic, supabase, agent, messages, message.trim(),
              docsByAgent, teamMemberNames, scheduleInstructions, priorResponses, weight
            ),
            new Promise<void>((r) => setTimeout(r, targetDelay)),
          ]);

          const text = cleanResponse(rawText.replace(/YOUR_AGENT_ID/g, agent.id));

          // Capture schedule block from raw text before cleaning
          if (!schedulePayload) {
            const m = rawText.match(/```schedule_request\s*\n([\s\S]*?)\n```/);
            if (m) {
              try { schedulePayload = JSON.parse(m[1]); } catch { /* ignore */ }
            }
          }

          send({ type: "agent_text", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color, text });
          allResponses.push(`[${agent.name}] ${text}`);
          console.log(`${LOG} ${agent.name} (${urgency}/${weight}): ${text.slice(0, 80)}`);
        };

        // ── CASUAL SHORTCUT ────────────────────────────────────────────
        if (effectiveIntent === "casual" && allMentionedIds.length === 0) {
          console.log(`${LOG} Casual shortcut`);

          const scored = agents
            .map((a) => ({ agent: a, score: scoreAgentRelevance(message.trim(), a) }))
            .sort((a, b) => b.score - a.score);
          const casualAgents = scored.slice(0, Math.min(2, scored.length)).map((s) => s.agent);

          let priorResponses = "";
          for (let i = 0; i < casualAgents.length; i++) {
            const agent = casualAgents[i];
            const delay = i === 0 ? 2000 + Math.random() * 2000 : 3000 + Math.random() * 5000;
            send({ type: "agent_typing", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color });
            const systemPrompt = `You are ${agent.name}, a member of a team group chat.\nYour role: ${agent.purpose}\n\nWrite a brief, natural response (1-2 sentences). Plain text only, no markdown.\nNEVER prefix your response with your name or anyone else's name in brackets like [Name]. NEVER speak as the user or write [You]. The system handles attribution — just write your response naturally.${priorResponses ? `\n\nColleagues already said:\n${priorResponses}\nDon't repeat them.` : ""}`;
            const [response] = await Promise.all([
              anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 150,
                system: systemPrompt,
                messages,
              }),
              new Promise<void>((r) => setTimeout(r, delay)),
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = cleanResponse(response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim());
            send({ type: "agent_text", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color, text });
            allResponses.push(`[${agent.name}] ${text}`);
            priorResponses += `[${agent.name}]: ${text}\n`;
          }
          console.log(`${LOG} Casual: ${casualAgents.length} agent(s)`);

        } else {
          // ── EVALUATE PHASE (parallel) ──────────────────────────────────
          const recentForEval = messages.slice(-4).map(
            (m) => `${m.role === "user" ? "User" : "Team"}: ${m.content.slice(0, 150)}`
          );

          let evalResults: Awaited<ReturnType<typeof evaluateAgents>> = [];

          if (isTeamWide) {
            evalResults = nonMentionedAgents.map((a) => ({
              agentId: a.id, respond: true, urgency: "medium" as const, weight: "full" as const, reason: "team-wide",
            }));
            console.log(`${LOG} Team-wide: all ${agents.length} agents respond`);
          } else if (nonMentionedAgents.length > 0) {
            console.log(`${LOG} Evaluating ${nonMentionedAgents.length} agent(s)...`);
            evalResults = await evaluateAgents(anthropic, nonMentionedAgents, recentForEval, message.trim());
            for (const r of evalResults) {
              const name = agents.find((a) => a.id === r.agentId)?.name ?? r.agentId;
              console.log(`${LOG}   ${name} → ${r.respond ? "YES" : "NO"} urgency=${r.urgency} weight=${r.weight} (${r.reason})`);
            }
          }

          // Build ordered list: @mentioned (high urgency) first, then eval results sorted by urgency
          const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          const getUrgency = (id: string): "high" | "medium" | "low" =>
            allMentionedIds.includes(id) ? "high" : (evalResults.find((r) => r.agentId === id)?.urgency ?? "medium");
          const getWeight = (id: string): "full" | "brief" =>
            allMentionedIds.includes(id) ? "full" : (evalResults.find((r) => r.agentId === id)?.weight ?? "full");

          const respondingIds = new Set<string>([
            ...mentionedAgents.map((a) => a.id),
            ...evalResults.filter((r) => r.respond).map((r) => r.agentId),
          ]);
          const respondingAgents = agents
            .filter((a) => respondingIds.has(a.id))
            .sort((a, b) => urgencyOrder[getUrgency(a.id)] - urgencyOrder[getUrgency(b.id)]);

          console.log(`${LOG} Responding: [${respondingAgents.map((a) => a.name).join(", ") || "none"}]`);

          if (respondingAgents.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          // ── RESPOND PHASE (sequential) ─────────────────────────────────
          let priorResponses = "";
          for (const agent of respondingAgents) {
            await runAgent(agent, getUrgency(agent.id), getWeight(agent.id), priorResponses);
            priorResponses += `[${agent.name}]: ${allResponses[allResponses.length - 1].replace(/^\[[^\]]+\] /, "")}\n`;
          }
        }

        if (allResponses.length === 0) {
          send({ type: "done" });
          controller.close();
          return;
        }

        // Save combined to DB
        const combined = allResponses.join("\n");
        const { error: saveMsgError } = await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: combined,
        });
        if (saveMsgError) {
          console.log(`${LOG} ✗ Failed to save to DB:`, saveMsgError);
        } else {
          console.log(`${LOG} ✓ Saved ${allResponses.length} response(s) to DB`);
        }
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

        // Forward schedule_request if any agent included one
        if (schedulePayload) {
          console.log(`${LOG} Schedule request: ${JSON.stringify(schedulePayload)}`);
          send({ type: "schedule_request", ...(schedulePayload as Record<string, unknown>) });
        }

        // ── FOLLOW-UP DETECTION — agents responding to each other ────────
        // After agents respond, check if any asked a question that should
        // trigger other agents. Up to 2 follow-up rounds within the same SSE stream.
        const respondedIds = new Set<string>(allResponses.map((r) => {
          const m = r.match(/^\[([^\]]+)\]/);
          return m ? agents.find((a) => a.name === m[1])?.id : undefined;
        }).filter((id): id is string => Boolean(id)));
        const hardExcludeIds = new Set<string>(); // no hard excludes for user-initiated flow

        let followUpRound = 0;
        let lastCombined = combined;

        while (followUpRound < 2) {
          const followUp = detectFollowUpTriggers(lastCombined, agents, hardExcludeIds, respondedIds);
          if (!followUp) {
            console.log(`${LOG} No follow-up triggers after round ${followUpRound} — done`);
            break;
          }

          followUpRound++;
          const targetNames = agents
            .filter((a) => followUp.targetAgentIds.includes(a.id))
            .map((a) => a.name)
            .join(", ");
          console.log(`${LOG} Follow-up round ${followUpRound} → [${targetNames}] reason: ${followUp.reason}`);

          const followUpAgents = agents.filter((a) => followUp.targetAgentIds.includes(a.id));
          const followUpResponses: string[] = [];
          // Full conversation context: all responses so far
          let followUpPrior = allResponses.join("\n");

          for (const agent of followUpAgents) {
            await runAgent(agent, "medium", "full", followUpPrior);
            const latestResponse = allResponses[allResponses.length - 1];
            followUpResponses.push(latestResponse);
            followUpPrior += "\n" + latestResponse;
            respondedIds.add(agent.id);
          }

          // Save follow-up round to DB
          if (followUpResponses.length > 0) {
            const followUpCombined = followUpResponses.join("\n");
            await supabase.from("messages").insert({
              conversation_id: convId,
              role: "assistant",
              content: followUpCombined,
            });
            await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
            console.log(`${LOG} ✓ Saved ${followUpResponses.length} follow-up response(s)`);
            lastCombined = followUpCombined;
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
