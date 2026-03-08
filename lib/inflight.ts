import {
  updateMessages,
  setConversationId as setCachedConvId,
  type ChatMessage,
} from "./chat-cache";
import { cleanResponse } from "./anthropic";

// ─── In-flight streaming state ───

export interface ScheduleRequest {
  instruction: string;
  cron?: string;    // recurring tasks only
  run_at?: string;  // one-off tasks: ISO datetime string
  timezone: string;
  recurring: boolean;
  destination: "dm" | "group";
  agent_id?: string;
}

export interface FeatureRequest {
  feature: string;
  label: string;
}

export interface GroupMessageRequest {
  conversation_id: string;
}

interface InflightState {
  streaming: boolean;
  streamText: string;
  conversationId: string | null;
  scheduleRequest: ScheduleRequest | null;
  featureRequest: FeatureRequest | null;
  groupMessageRequest: GroupMessageRequest | null;
  // Group chat: per-agent sequential delivery
  typingAgentName: string | null;
  typingAgentColor: string | null;
  streamMessages: ChatMessage[];
}

type Listener = (state: InflightState) => void;

interface InflightEntry {
  state: InflightState;
  listeners: Set<Listener>;
}

const inflights = new Map<string, InflightEntry>();

const EMPTY_STATE: () => InflightState = () => ({
  streaming: false, streamText: "", conversationId: null,
  scheduleRequest: null, featureRequest: null, groupMessageRequest: null,
  typingAgentName: null, typingAgentColor: null, streamMessages: [],
});

function getOrCreate(chatId: string): InflightEntry {
  let entry = inflights.get(chatId);
  if (!entry) {
    entry = { state: EMPTY_STATE(), listeners: new Set() };
    inflights.set(chatId, entry);
  }
  return entry;
}

function notify(chatId: string) {
  const entry = inflights.get(chatId);
  if (!entry) return;
  const snapshot = { ...entry.state };
  for (const fn of entry.listeners) {
    fn(snapshot);
  }
}

export function subscribe(chatId: string, listener: Listener): () => void {
  const entry = getOrCreate(chatId);
  entry.listeners.add(listener);
  listener({ ...entry.state });
  return () => {
    entry.listeners.delete(listener);
  };
}

export function getInflightState(chatId: string): InflightState {
  const entry = inflights.get(chatId);
  return entry ? { ...entry.state, streamMessages: [...entry.state.streamMessages] } : EMPTY_STATE();
}

export function resetInflight(chatId: string) {
  const entry = inflights.get(chatId);
  if (entry) {
    entry.state = EMPTY_STATE();
    notify(chatId);
  }
}

export function clearScheduleRequest(chatId: string) {
  const entry = inflights.get(chatId);
  if (entry) {
    entry.state.scheduleRequest = null;
  }
}

export function clearFeatureRequest(chatId: string) {
  const entry = inflights.get(chatId);
  if (entry) {
    entry.state.featureRequest = null;
  }
}

export function clearGroupMessageRequest(chatId: string) {
  const entry = inflights.get(chatId);
  if (entry) {
    entry.state.groupMessageRequest = null;
  }
}

// ─── Send DM (agent chat) ───

export function sendDM(
  chatId: string,
  agentId: string,
  message: string,
  conversationId: string | null
) {
  const entry = getOrCreate(chatId);
  entry.state = { ...EMPTY_STATE(), streaming: true, streamText: "", conversationId };

  // Add user message to cache BEFORE notifying so subscribers see it
  const userMsg: ChatMessage = {
    role: "user",
    content: message,
    created_at: new Date().toISOString(),
  };
  updateMessages(chatId, (prev) => [...prev, userMsg]);
  notify(chatId);

  // Fire and forget — runs in background
  _streamDM(chatId, agentId, message, conversationId).catch(() => {});
}

async function _streamDM(
  chatId: string,
  agentId: string,
  message: string,
  conversationId: string | null
) {
  const entry = getOrCreate(chatId);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        message,
        conversation_id: conversationId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chat failed (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "conversation_id") {
            entry.state.conversationId = event.conversation_id;
            setCachedConvId(chatId, event.conversation_id);
            notify(chatId);
          } else if (event.type === "text") {
            fullText += event.text;
            entry.state.streamText = cleanResponse(fullText, true);
            notify(chatId);
          } else if (event.type === "replace") {
            // Server sent the final cleaned version
            fullText = event.text;
            entry.state.streamText = fullText;
            notify(chatId);
          } else if (event.type === "schedule_request") {
            entry.state.scheduleRequest = {
              instruction: event.instruction,
              cron: event.cron,
              run_at: event.run_at,
              timezone: event.timezone,
              recurring: event.recurring !== false,
              destination: event.destination === "group" ? "group" : "dm",
            };
            notify(chatId);
          } else if (event.type === "feature_request") {
            entry.state.featureRequest = {
              feature: event.feature,
              label: event.label,
            };
            notify(chatId);
          } else if (event.type === "group_message_request") {
            entry.state.groupMessageRequest = {
              conversation_id: event.conversation_id,
            };
            notify(chatId);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    const cleaned = cleanResponse(fullText);
    if (cleaned) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: cleaned,
        created_at: new Date().toISOString(),
      };
      updateMessages(chatId, (prev) => [...prev, assistantMsg]);
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Something went wrong";
    const errMsg: ChatMessage = {
      role: "assistant",
      content: `Error: ${errorMsg}`,
      created_at: new Date().toISOString(),
    };
    updateMessages(chatId, (prev) => [...prev, errMsg]);
  } finally {
    entry.state.streaming = false;
    entry.state.streamText = "";
    notify(chatId);
  }
}

// ─── Send Group chat ───

export function sendGroup(
  chatId: string,
  message: string,
  conversationId: string | null,
  mentions: string[]
) {
  const entry = getOrCreate(chatId);
  entry.state = { ...EMPTY_STATE(), streaming: true, conversationId };

  // Add user message to cache BEFORE notifying so subscribers see it
  const userMsg: ChatMessage = {
    role: "user",
    content: message,
    created_at: new Date().toISOString(),
  };
  updateMessages(chatId, (prev) => [...prev, userMsg]);
  notify(chatId);

  _streamGroup(chatId, message, conversationId, mentions).catch(() => {});
}

// ─── Send Team chat ───

export function sendTeam(
  chatId: string,
  teamId: string,
  message: string,
  conversationId: string | null,
  mentions: string[]
) {
  const entry = getOrCreate(chatId);
  entry.state = { ...EMPTY_STATE(), streaming: true, conversationId };

  const userMsg: ChatMessage = {
    role: "user",
    content: message,
    created_at: new Date().toISOString(),
  };
  updateMessages(chatId, (prev) => [...prev, userMsg]);
  notify(chatId);

  _streamTeam(chatId, teamId, message, conversationId, mentions).catch(() => {});
}

async function _streamTeam(
  chatId: string,
  teamId: string,
  message: string,
  conversationId: string | null,
  mentions: string[]
) {
  const entry = getOrCreate(chatId);
  const streamMessages: ChatMessage[] = [];

  try {
    const res = await fetch("/api/chat/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        team_id: teamId,
        ...(mentions.length > 0 ? { mentions } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chat failed (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "conversation_id") {
            entry.state.conversationId = event.conversation_id;
            setCachedConvId(chatId, event.conversation_id);
            notify(chatId);
          } else if (event.type === "agent_typing") {
            entry.state.typingAgentName = event.agent_name;
            entry.state.typingAgentColor = event.agent_color;
            notify(chatId);
          } else if (event.type === "agent_text") {
            entry.state.typingAgentName = null;
            entry.state.typingAgentColor = null;
            const msg: ChatMessage = {
              role: "assistant",
              content: `[${event.agent_name}] ${event.text}`,
              created_at: new Date().toISOString(),
            };
            streamMessages.push(msg);
            entry.state.streamMessages = [...streamMessages];
            notify(chatId);
          } else if (event.type === "schedule_request") {
            entry.state.scheduleRequest = {
              instruction: event.instruction,
              cron: event.cron,
              run_at: event.run_at,
              timezone: event.timezone,
              recurring: event.recurring !== false,
              destination: event.destination === "group" ? "group" : "dm",
              agent_id: event.agent_id,
            };
            notify(chatId);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    const ts = new Date().toISOString();
    for (const msg of streamMessages) msg.created_at = ts;
    if (streamMessages.length > 0) {
      updateMessages(chatId, (prev) => [...prev, ...streamMessages]);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Something went wrong";
    const errMsg: ChatMessage = {
      role: "assistant",
      content: `Error: ${errorMsg}`,
      created_at: new Date().toISOString(),
    };
    updateMessages(chatId, (prev) => [...prev, errMsg]);
  } finally {
    entry.state.streaming = false;
    entry.state.streamText = "";
    entry.state.typingAgentName = null;
    entry.state.typingAgentColor = null;
    entry.state.streamMessages = [];
    notify(chatId);
  }
}

async function _streamGroup(
  chatId: string,
  message: string,
  conversationId: string | null,
  mentions: string[]
) {
  const entry = getOrCreate(chatId);
  const streamMessages: ChatMessage[] = [];

  try {
    const res = await fetch("/api/chat/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        ...(mentions.length > 0 ? { mentions } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chat failed (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "conversation_id") {
            entry.state.conversationId = event.conversation_id;
            setCachedConvId(chatId, event.conversation_id);
            notify(chatId);
          } else if (event.type === "agent_typing") {
            entry.state.typingAgentName = event.agent_name;
            entry.state.typingAgentColor = event.agent_color;
            notify(chatId);
          } else if (event.type === "agent_text") {
            entry.state.typingAgentName = null;
            entry.state.typingAgentColor = null;
            const msg: ChatMessage = {
              role: "assistant",
              content: `[${event.agent_name}] ${event.text}`,
              created_at: new Date().toISOString(),
            };
            streamMessages.push(msg);
            entry.state.streamMessages = [...streamMessages];
            notify(chatId);
          } else if (event.type === "schedule_request") {
            entry.state.scheduleRequest = {
              instruction: event.instruction,
              cron: event.cron,
              run_at: event.run_at,
              timezone: event.timezone,
              recurring: event.recurring !== false,
              destination: event.destination === "group" ? "group" : "dm",
              agent_id: event.agent_id,
            };
            notify(chatId);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    // Commit stream messages to cache with a timestamp set AFTER the server
    // has saved to DB — this ensures the poll cursor won't re-fetch them.
    const ts = new Date().toISOString();
    for (const msg of streamMessages) msg.created_at = ts;
    if (streamMessages.length > 0) {
      updateMessages(chatId, (prev) => [...prev, ...streamMessages]);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Something went wrong";
    const errMsg: ChatMessage = {
      role: "assistant",
      content: `Error: ${errorMsg}`,
      created_at: new Date().toISOString(),
    };
    updateMessages(chatId, (prev) => [...prev, errMsg]);
  } finally {
    entry.state.streaming = false;
    entry.state.streamText = "";
    entry.state.typingAgentName = null;
    entry.state.typingAgentColor = null;
    entry.state.streamMessages = [];
    notify(chatId);
  }
}
