"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon, HashIcon } from "./Icons";
import type { Agent, Message } from "@/lib/types";
import {
  getCached,
  setCache,
  updateMessages,
  setConversationId as setCachedConvId,
  prependMessages,
  type ChatMessage,
} from "@/lib/chat-cache";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h > 12 ? h - 12 : h || 12}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "pm" : "am"}`;
}

function parseGroupResponse(
  text: string,
  agents: Agent[]
): { agent: Agent; text: string }[] {
  const results: { agent: Agent; text: string }[] = [];
  const lines = text.split("\n");
  let currentAgent: Agent | null = null;
  let currentText = "";

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)/);
    if (match) {
      if (currentAgent && currentText.trim()) {
        results.push({ agent: currentAgent, text: currentText.trim() });
      }
      const agentName = match[1];
      currentAgent =
        agents.find(
          (a) => a.name.toLowerCase() === agentName.toLowerCase()
        ) || null;
      currentText = match[2] || "";
    } else if (currentAgent) {
      currentText += "\n" + line;
    }
  }

  if (currentAgent && currentText.trim()) {
    results.push({ agent: currentAgent, text: currentText.trim() });
  }

  return results;
}

function AgentMessage({
  agent,
  text,
  time,
  mobile,
}: {
  agent: Agent;
  text: string;
  time: string;
  mobile: boolean;
}) {
  return (
    <div
      className={`${mobile ? "px-4 py-2" : "px-6 py-2"} hover:bg-[var(--color-hover)] transition-colors`}
    >
      <div className={`flex max-w-[720px] ${mobile ? "gap-2.5" : "gap-3"}`}>
        <Avatar name={agent.name} color={agent.color} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-[15px] font-semibold"
              style={{ color: agent.color }}
            >
              {agent.name}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {time}
            </span>
          </div>
          <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMessage({
  text,
  time,
  mobile,
}: {
  text: string;
  time: string;
  mobile: boolean;
}) {
  return (
    <div className={mobile ? "px-4 py-2" : "px-6 py-2"}>
      <div className={`flex max-w-[720px] ${mobile ? "gap-2.5" : "gap-3"}`}>
        <div className="w-9 h-9 rounded-lg shrink-0 bg-[var(--color-active)] text-[var(--color-text-secondary)] flex items-center justify-center text-xs font-bold">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[15px] font-semibold text-[var(--color-text)]">
              You
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {time}
            </span>
          </div>
          <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

const CHAT_ID = "group";

export function GroupChatView({
  agents,
  mobile,
  openDrawer,
}: {
  agents: Agent[];
  mobile: boolean;
  openDrawer: () => void;
}) {
  const cached = getCached(CHAT_ID);

  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages || []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(cached?.conversationId ?? null);
  const [loading, setLoading] = useState(!cached);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialScrollDone = useRef(false);

  // Fetch initial messages (skip if cached)
  useEffect(() => {
    initialScrollDone.current = false;

    if (cached) {
      setMessages(cached.messages);
      setConversationId(cached.conversationId);
      setHasMore(cached.hasMore);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessages([]);
    setConversationId(null);
    setInput("");
    setStreaming(false);
    setStreamText("");

    fetch("/api/conversations?agent_id=group")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        const convId = data.conversation_id || null;
        const msgs: ChatMessage[] = (data.messages || []).map((m: Message) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        }));
        const more = data.has_more ?? false;
        setConversationId(convId);
        setMessages(msgs);
        setHasMore(more);
        setCache(CHAT_ID, { conversationId: convId, messages: msgs, hasMore: more });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Scroll to bottom — instant on first render, smooth on subsequent updates
  useEffect(() => {
    if (!endRef.current) return;
    if (!initialScrollDone.current) {
      endRef.current.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      initialScrollDone.current = true;
    } else {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamText]);

  // Scroll-to-top lazy loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = scrollRef.current;
    if (!sentinel || !scroller || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !streaming) {
          loadOlder();
        }
      },
      { root: scroller, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, streaming]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !conversationId || !messages.length) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const scroller = scrollRef.current;
    const prevHeight = scroller?.scrollHeight || 0;

    try {
      const res = await fetch(
        `/api/conversations?agent_id=group&before=${encodeURIComponent(oldest)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: ChatMessage[] = (data.messages || []).map((m: Message) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
      const more = data.has_more ?? false;
      setHasMore(more);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        prependMessages(CHAT_ID, older, more);
        requestAnimationFrame(() => {
          if (scroller) {
            scroller.scrollTop = scroller.scrollHeight - prevHeight;
          }
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, conversationId, messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, userMsg];
      updateMessages(CHAT_ID, () => next);
      return next;
    });
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
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
              setConversationId(event.conversation_id);
              setCachedConvId(CHAT_ID, event.conversation_id);
            } else if (event.type === "text") {
              fullText += event.text;
              setStreamText(fullText);
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
        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          updateMessages(CHAT_ID, () => next);
          return next;
        });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Something went wrong";
      const errChatMsg: ChatMessage = {
        role: "assistant",
        content: `Error: ${errorMsg}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, errChatMsg];
        updateMessages(CHAT_ID, () => next);
        return next;
      });
    } finally {
      setStreaming(false);
      setStreamText("");
      inputRef.current?.focus();
    }
  }, [input, streaming, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const canSend = input.trim() && !streaming;

  const renderMessage = (msg: ChatMessage, idx: number) => {
    if (msg.role === "user") {
      return (
        <UserMessage
          key={msg.id || idx}
          text={msg.content}
          time={formatTime(msg.created_at)}
          mobile={mobile}
        />
      );
    }

    const parsed = parseGroupResponse(msg.content, agents);
    if (parsed.length > 0) {
      return parsed.map((p, j) => (
        <AgentMessage
          key={`${msg.id || idx}-${j}`}
          agent={p.agent}
          text={p.text}
          time={formatTime(msg.created_at)}
          mobile={mobile}
        />
      ));
    }

    return (
      <div
        key={msg.id || idx}
        className={`${mobile ? "px-4 py-2" : "px-6 py-2"}`}
      >
        <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap max-w-[720px]">
          {msg.content}
        </div>
      </div>
    );
  };

  const renderStreamingBubbles = () => {
    if (!streamText) {
      return (
        <div className={mobile ? "px-4 py-2" : "px-6 py-2"}>
          <div className="flex items-center gap-1 pt-2.5">
            {[0, 1, 2].map((d) => (
              <div
                key={d}
                className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-tertiary)]"
                style={{
                  animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    const parsed = parseGroupResponse(streamText, agents);
    if (parsed.length > 0) {
      return parsed.map((p, j) => (
        <AgentMessage
          key={`stream-${j}`}
          agent={p.agent}
          text={p.text}
          time={formatTime(new Date().toISOString())}
          mobile={mobile}
        />
      ));
    }

    return (
      <div className={mobile ? "px-4 py-2" : "px-6 py-2"}>
        <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap max-w-[720px]">
          {streamText}
          <span className="inline-block w-0.5 h-4 bg-[var(--color-text-tertiary)] ml-0.5 align-middle animate-[typing-dot_1s_steps(2)_infinite]" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 shrink-0 py-3 px-4 md:py-3.5 md:px-6"
      >
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-[var(--color-text-tertiary)] text-base">
          <HashIcon />
        </span>
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          All
        </span>
        <span className="text-[13px] text-[var(--color-text-tertiary)]">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-3 md:pt-4 pb-2"
      >
        {/* Sentinel for loading older messages */}
        <div ref={sentinelRef} className="h-1" />

        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <span className="text-[13px] text-[var(--color-text-tertiary)]">
              Loading older messages...
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-[15px] text-[var(--color-text-tertiary)]">
              Loading...
            </span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-[15px] font-medium text-[var(--color-accent)] mb-1">
                # All
              </div>
              <div className="text-[14px] text-[var(--color-text-tertiary)]">
                Message your team — the right agents will respond
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => renderMessage(m, i))}

        {streaming && renderStreamingBubbles()}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-5 md:pb-5"
      >
        <div className="flex gap-2 items-center bg-[var(--color-input-bg)] rounded-xl pl-4 pr-1.5 py-1.5 border border-[var(--color-border)]">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message #All..."
            className="flex-1 border-none bg-transparent text-[var(--color-text)] text-[15px] outline-none py-2"
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="w-9 h-9 rounded-lg border-none shrink-0 flex items-center justify-center transition-all duration-150"
            style={{
              background: canSend ? "var(--color-accent)" : "transparent",
              color: canSend ? "#fff" : "var(--color-text-tertiary)",
              cursor: canSend ? "pointer" : "default",
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
