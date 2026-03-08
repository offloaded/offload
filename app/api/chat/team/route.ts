import { createServerSupabase, createServiceSupabase } from "@/lib/supabase-server";
import { getAnthropicClient, cleanResponse } from "@/lib/anthropic";
import { logApiUsage, estimateCost } from "@/lib/api-usage";
import {
  classifyIntent,
  detectMessageAddressing,
  evaluateAgents,
  generateAgentResponse,
  scoreAgentRelevance,
  buildSmartHistory,
} from "@/lib/group-orchestration";

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
  const LOG = "[Team Chat]";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

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

  const body = await request.json();
  const { message, conversation_id, mentions, team_id } = body as {
    message: string;
    conversation_id?: string;
    mentions?: string[];
    team_id: string;
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }
  if (!team_id) {
    return new Response(JSON.stringify({ error: "team_id is required" }), { status: 400 });
  }

  // Verify team ownership
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, description")
    .eq("id", team_id)
    .eq("user_id", user.id)
    .single();

  if (teamError || !team) {
    return new Response(JSON.stringify({ error: "Team not found" }), { status: 404 });
  }

  // Load team member agent IDs
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("agent_id")
    .eq("team_id", team_id);

  const teamAgentIds = new Set((teamMembers || []).map((m) => m.agent_id));

  // Load only agents that belong to this team
  const { data: allAgents } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = (allAgents || []).filter((a: any) => teamAgentIds.has(a.id));

  if (agents.length === 0) {
    return new Response(JSON.stringify({ error: "No agents in this team." }), { status: 400 });
  }

  console.log(`${LOG} Team "${team.name}" — ${agents.length} agent(s): ${agents.map((a) => a.name).join(", ")}`);

  // Classify intent and detect addressing
  const intent = classifyIntent(message.trim());
  const { isTeamWide, mentionedAgentIds: detectedMentionIds } = detectMessageAddressing(message.trim(), agents);
  const effectiveIntent = isTeamWide && intent === "casual" ? "knowledge" : intent;

  // Resolve/create team conversation
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
    // Find or create a team conversation (agent_id = null, team_id = team_id)
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .is("agent_id", null)
      .eq("team_id", team_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, agent_id: null, team_id })
        .select("id")
        .single();
      if (convError || !newConv) {
        return new Response(JSON.stringify({ error: "Failed to create conversation" }), { status: 500 });
      }
      convId = newConv.id;
    }
  }

  // Save user message
  await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: message.trim() });
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

  // Load message history
  const anthropic = getAnthropicClient();
  const messages = await buildSmartHistory(supabase, anthropic, convId!);

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

  // Resolve @mentions
  const uiMentionIds = (mentions || [])
    .map((name) => agents.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));
  const allMentionedIds = [...new Set([...uiMentionIds, ...detectedMentionIds])];
  const mentionedAgents = agents.filter((a) => allMentionedIds.includes(a.id));
  const nonMentionedAgents = agents.filter((a) => !allMentionedIds.includes(a.id));

  // Build per-agent team expectations context (other agents' expectations)
  const buildTeamExpectationsForAgent = (agentId: string): string | undefined => {
    const otherExpectations: string[] = [];
    for (const a of agents) {
      if (a.id === agentId) continue;
      if (a.team_expectations && a.team_expectations.length > 0) {
        for (const e of a.team_expectations) {
          otherExpectations.push(`- ${a.name}: ${e.expectation}`);
        }
      }
    }
    if (otherExpectations.length === 0) return undefined;
    return `YOUR TEAM'S EXPECTATIONS (what your teammates commit to):\n${otherExpectations.slice(0, 20).join("\n")}\nBe aware of your teammates' standards when collaborating.`;
  };

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const DELAY_RANGES: Record<string, [number, number]> = {
        high: [3000, 5000],
        medium: [4000, 8000],
        low: [8000, 14000],
      };

      const teamMemberNames = agents.map((a) => a.name);
      const scheduleInstructions = intent === "action" ? buildScheduleInstructions() : undefined;

      try {
        send({ type: "conversation_id", conversation_id: convId });

        const allResponses: string[] = [];
        let schedulePayload: Record<string, unknown> | null = null;

        const runAgent = async (
          agent: typeof agents[0],
          urgency: "high" | "medium" | "low",
          weight: "full" | "brief",
          priorResponses: string
        ) => {
          const [minD, maxD] = DELAY_RANGES[urgency];
          const targetDelay = minD + Math.floor(Math.random() * (maxD - minD));

          send({ type: "agent_typing", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color });

          const [rawText] = await Promise.all([
            generateAgentResponse(
              anthropic, supabase, agent, messages, message.trim(),
              docsByAgent, teamMemberNames, scheduleInstructions, priorResponses, weight,
              user.id, buildTeamExpectationsForAgent(agent.id),
              { channelName: team.name, channelDescription: team.description || undefined }
            ),
            new Promise<void>((r) => setTimeout(r, targetDelay)),
          ]);

          const text = cleanResponse(rawText.replace(/YOUR_AGENT_ID/g, agent.id));

          if (!schedulePayload) {
            const m = rawText.match(/```schedule_request\s*\n?([\s\S]*?)\n?```/);
            if (m) {
              try { schedulePayload = JSON.parse(m[1]); } catch { /* ignore */ }
            }
          }

          send({ type: "agent_text", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color, text });
          allResponses.push(`[${agent.name}] ${text}`);
        };

        // CASUAL SHORTCUT
        if (effectiveIntent === "casual" && allMentionedIds.length === 0) {
          const scored = agents
            .map((a) => ({ agent: a, score: scoreAgentRelevance(message.trim(), a) }))
            .sort((a, b) => b.score - a.score);
          const casualAgents = scored.slice(0, Math.min(2, scored.length)).map((s) => s.agent);

          let priorResponses = "";
          for (let i = 0; i < casualAgents.length; i++) {
            const agent = casualAgents[i];
            const delay = i === 0 ? 2000 + Math.random() * 2000 : 3000 + Math.random() * 5000;
            send({ type: "agent_typing", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color });
            const systemPrompt = `You are ${agent.name}, responding in the #${team.name} channel.${team.description ? ` This channel is for: ${team.description}.` : ""} Only members of the ${team.name} team are in this channel.\nYour role: ${agent.purpose}\n\nWrite a brief, natural response (1-2 sentences). Plain text only, no markdown.\nNEVER prefix your response with your name or anyone else's name in brackets like [Name]. NEVER speak as the user or write [You]. The system handles attribution — just write your response naturally.\nNever @mention yourself or address yourself. You ARE yourself — just give your update directly.\nDon't tag every agent asking them to respond. Give your own update and let others respond naturally.${priorResponses ? `\n\nColleagues already said:\n${priorResponses}\nDon't repeat them.` : ""}`;
            const [response] = await Promise.all([
              anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 150,
                system: systemPrompt,
                messages,
              }),
              new Promise<void>((r) => setTimeout(r, delay)),
            ]);
            const casualTokensIn = response.usage?.input_tokens || 0;
            const casualTokensOut = response.usage?.output_tokens || 0;
            logApiUsage({
              user_id: user.id,
              service: "team_chat",
              model: "claude-haiku-4-5-20251001",
              tokens_in: casualTokensIn,
              tokens_out: casualTokensOut,
              cost: estimateCost("claude-haiku-4-5-20251001", casualTokensIn, casualTokensOut),
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = cleanResponse(response.content.filter((b: any) => b.type === "text").map((b: any) => b.text as string).join("").trim());
            send({ type: "agent_text", agent_id: agent.id, agent_name: agent.name, agent_color: agent.color, text });
            allResponses.push(`[${agent.name}] ${text}`);
            priorResponses += `[${agent.name}]: ${text}\n`;
          }
        } else {
          // EVALUATE PHASE
          const recentForEval = messages.slice(-4).map(
            (m) => `${m.role === "user" ? "User" : "Team"}: ${m.content.slice(0, 150)}`
          );

          let evalResults: Awaited<ReturnType<typeof evaluateAgents>> = [];

          if (isTeamWide) {
            evalResults = nonMentionedAgents.map((a) => ({
              agentId: a.id, respond: true, urgency: "medium" as const, weight: "full" as const, reason: "team-wide",
            }));
          } else if (nonMentionedAgents.length > 0) {
            evalResults = await evaluateAgents(anthropic, nonMentionedAgents, recentForEval, message.trim());
          }

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

          if (respondingAgents.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          // RESPOND PHASE (sequential)
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
        await supabase.from("messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: combined,
        });
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

        if (schedulePayload) {
          send({ type: "schedule_request", ...(schedulePayload as Record<string, unknown>) });
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Stream error";
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
