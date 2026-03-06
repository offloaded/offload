"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon } from "./Icons";
import type { Agent, Message } from "@/lib/types";
import {
  getCached,
  setCache,
  prependMessages,
  type ChatMessage,
} from "@/lib/chat-cache";
import { sendDM, subscribe, getInflightState } from "@/lib/inflight";

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
}: {
  agent?: Agent;
  text: string;
  time: string;
  isUser: boolean;
}) {
  if (isUser) {
    return (
      <div className="px-4 py-2 md:px-6">
        <div className="flex max-w-[720px] gap-2.5 md:gap-3">
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
    <div className="px-4 py-2 md:px-6 hover:bg-[var(--color-hover)] transition-colors">
      <div className="flex max-w-[720px] gap-2.5 md:gap-3">
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
  streamText,
}: {
  agent: Agent;
  streamText?: string;
}) {
  return (
    <div className="px-4 py-2 md:px-6">
      <div className="flex gap-2.5 md:gap-3">
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

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

export function ChatView({
  agent,
  openDrawer,
}: {
  agent: Agent;
  openDrawer: () => void;
}) {
  const chatId = `agent:${agent.id}`;
  const cached = getCached(chatId);
  const inflight = getInflightState(chatId);

  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages || []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(inflight.streaming);
  const [streamText, setStreamText] = useState(inflight.streamText);
  const [conversationId, setConversationId] = useState<string | null>(
    inflight.conversationId || (cached?.conversationId ?? null)
  );
  const [loading, setLoading] = useState(!cached);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialScrollDone = useRef(false);

  // Subscribe to inflight state changes (background streaming)
  useEffect(() => {
    return subscribe(chatId, (state) => {
      setStreaming(state.streaming);
      setStreamText(state.streamText);
      if (state.conversationId) {
        setConversationId(state.conversationId);
      }
      // Sync messages from cache when streaming state changes
      const c = getCached(chatId);
      if (c) {
        setMessages(c.messages);
      }
    });
  }, [chatId]);

  // Fetch initial messages (skip if cached)
  useEffect(() => {
    initialScrollDone.current = false;

    if (cached) {
      setMessages(cached.messages);
      setConversationId(inflight.conversationId || cached.conversationId);
      setHasMore(cached.hasMore);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessages([]);
    setConversationId(null);
    setInput("");

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

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Delegate to inflight module — runs in background, survives navigation
    sendDM(chatId, agent.id, text, conversationId);
  }, [input, streaming, agent.id, conversationId, chatId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResize(e.target);
  };

  const canSend = input.trim() && !streaming;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header — fixed on mobile, in-flow on desktop */}
      <div
        className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 py-3 px-4 md:py-3.5 md:px-6"
      >
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
        >
          <MenuIcon />
        </button>
        <Avatar name={agent.name} color={agent.color} size={28} />
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          {agent.name}
        </span>
      </div>

      {/* Messages — padded for fixed header/input on mobile */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-[52px] pb-[72px] md:pt-4 md:pb-2 min-h-0"
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
          />
        ))}

        {streaming && (
          <TypingRow
            agent={agent}
            streamText={streamText || undefined}
          />
        )}

        <div ref={endRef} />
      </div>

      {/* Input — fixed on mobile, in-flow on desktop */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-5 md:pb-5"
      >
        <div className="flex gap-2 items-end bg-[var(--color-input-bg)] rounded-xl pl-4 pr-1.5 py-1.5 border border-[var(--color-border)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            rows={1}
            className="flex-1 border-none bg-transparent text-[var(--color-text)] text-[15px] outline-none py-2 resize-none leading-relaxed"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="w-9 h-9 rounded-lg border-none shrink-0 flex items-center justify-center transition-all duration-150 mb-0.5"
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
