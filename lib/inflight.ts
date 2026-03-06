import {
  updateMessages,
  setConversationId as setCachedConvId,
  type ChatMessage,
} from "./chat-cache";

// ─── In-flight streaming state ───

export interface ScheduleRequest {
  instruction: string;
  cron: string;
  timezone: string;
}

interface InflightState {
  streaming: boolean;
  streamText: string;
  conversationId: string | null;
  scheduleRequest: ScheduleRequest | null;
}

type Listener = (state: InflightState) => void;

interface InflightEntry {
  state: InflightState;
  listeners: Set<Listener>;
}

const inflights = new Map<string, InflightEntry>();

function getOrCreate(chatId: string): InflightEntry {
  let entry = inflights.get(chatId);
  if (!entry) {
    entry = {
      state: { streaming: false, streamText: "", conversationId: null, scheduleRequest: null },
      listeners: new Set(),
    };
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
  return entry
    ? { ...entry.state }
    : { streaming: false, streamText: "", conversationId: null, scheduleRequest: null };
}

export function resetInflight(chatId: string) {
  const entry = inflights.get(chatId);
  if (entry) {
    entry.state = { streaming: false, streamText: "", conversationId: null, scheduleRequest: null };
    notify(chatId);
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
  entry.state = { streaming: true, streamText: "", conversationId, scheduleRequest: null };

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
            entry.state.streamText = fullText;
            notify(chatId);
          } else if (event.type === "schedule_request") {
            entry.state.scheduleRequest = {
              instruction: event.instruction,
              cron: event.cron,
              timezone: event.timezone,
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

    if (fullText) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: fullText,
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
  entry.state = { streaming: true, streamText: "", conversationId, scheduleRequest: null };

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

async function _streamGroup(
  chatId: string,
  message: string,
  conversationId: string | null,
  mentions: string[]
) {
  const entry = getOrCreate(chatId);

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
            entry.state.streamText = fullText;
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

    if (fullText) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: fullText,
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
