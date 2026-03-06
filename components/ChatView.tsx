"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon } from "./Icons";
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

// Slack-style message row
function MessageRow({
  agent,
  text,
  time,
  isUser,
  mobile,
}: {
  agent?: Agent;
  text: string;
  time: string;
  isUser: boolean;
  mobile: boolean;
}) {
  if (isUser) {
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

  if (!agent) return null;

  return (
    <div
      className={`${mobile ? "px-4 py-2" : "px-6 py-2"} hover:bg-[var(--color-hover)] transition-colors`}
    >
      <div className={`flex max-w-[720px] ${mobile ? "gap-2.5" : "gap-3"}`}>
        <Avatar name={agent.name} color={agent.color} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[15px] font-semibold" style={{ color: agent.color }}>
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

// Typing indicator
function TypingRow({
  agent,
  mobile,
  streamText,
}: {
  agent: Agent;
  mobile: boolean;
  streamText?: string;
}) {
  return (
    <div className={mobile ? "px-4 py-2" : "px-6 py-2"}>
      <div className={`flex ${mobile ? "gap-2.5" : "gap-3"}`}>
        <Avatar name={agent.name} color={agent.color} size={36} />
        <div className="flex-1 min-w-0">
          {streamText ? (
            <>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: agent.color }}
                >
                  {agent.name}
                </span>
              </div>
              <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
                {streamText}
                <span className="inline-block w-0.5 h-4 bg-[var(--color-text-tertiary)] ml-0.5 align-middle animate-[typing-dot_1s_steps(2)_infinite]" />
              </div>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

export { MessageRow, TypingRow };
export type { ChatMessage };

export function ChatView({
  agent,
  mobile,
  openDrawer,
}: {
  agent: Agent;
  mobile: boolean;
  openDrawer: () => void;
}) {
  const chatId = `agent:${agent.id}`;
  const cached = getCached(chatId);

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

    fetch(`/api/conversations?agent_id=${agent.id}`)
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
        setCache(chatId, { conversationId: convId, messages: msgs, hasMore: more });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agent.id, chatId]);

  // Scroll to bottom — instant on first render, smooth on subsequent updates
  useEffect(() => {
    if (!endRef.current) return;
    if (!initialScrollDone.current) {
      // First render: jump to bottom instantly (no visible animation)
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
        `/api/conversations?agent_id=${agent.id}&before=${encodeURIComponent(oldest)}`
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
        prependMessages(chatId, older, more);
        // Maintain scroll position
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
  }, [loadingMore, conversationId, messages, agent.id, chatId]);

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
      updateMessages(chatId, () => next);
      return next;
    });
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
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
              setCachedConvId(chatId, event.conversation_id);
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
          updateMessages(chatId, () => next);
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
        updateMessages(chatId, () => next);
        return next;
      });
    } finally {
      setStreaming(false);
      setStreamText("");
      inputRef.current?.focus();
    }
  }, [input, streaming, agent.id, conversationId, chatId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const canSend = input.trim() && !streaming;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div
        className={`sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 shrink-0 ${mobile ? "py-3 px-4" : "py-3.5 px-6"}`}
      >
        {mobile && (
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
          >
            <MenuIcon />
          </button>
        )}
        <Avatar name={agent.name} color={agent.color} size={28} />
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          {agent.name}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto ${mobile ? "pt-3" : "pt-4"} pb-2`}
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
              <div
                className="text-[15px] font-medium mb-1"
                style={{ color: agent.color }}
              >
                {agent.name}
              </div>
              <div className="text-[14px] text-[var(--color-text-tertiary)]">
                Start a conversation
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageRow
            key={m.id || i}
            isUser={m.role === "user"}
            agent={m.role === "assistant" ? agent : undefined}
            text={m.content}
            time={formatTime(m.created_at)}
            mobile={mobile}
          />
        ))}

        {streaming && (
          <TypingRow
            agent={agent}
            mobile={mobile}
            streamText={streamText || undefined}
          />
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        className={`shrink-0 bg-[var(--color-surface)] ${mobile ? "px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]" : "px-5 pt-2 pb-5"}`}
      >
        <div className="flex gap-2 items-center bg-[var(--color-input-bg)] rounded-xl pl-4 pr-1.5 py-1.5 border border-[var(--color-border)]">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
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
