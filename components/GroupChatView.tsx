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
}: {
  agent: Agent;
  text: string;
  time: string;
}) {
  return (
    <div className="px-4 py-2 md:px-6 hover:bg-[var(--color-hover)] transition-colors">
      <div className="flex max-w-[720px] gap-2.5 md:gap-3">
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
}: {
  text: string;
  time: string;
}) {
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

// Extract @mentions from message text by matching known agent names
function extractMentions(text: string, agents: Agent[]): string[] {
  const mentions: string[] = [];
  const lower = text.toLowerCase();
  for (const agent of agents) {
    const pattern = `@${agent.name.toLowerCase()}`;
    if (lower.includes(pattern)) {
      mentions.push(agent.name);
    }
  }
  return mentions;
}

// Mention dropdown component
function MentionDropdown({
  agents,
  filter,
  onSelect,
  selectedIndex,
}: {
  agents: Agent[];
  filter: string;
  onSelect: (agent: Agent) => void;
  selectedIndex: number;
}) {
  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase())
  );
  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto">
      {filtered.map((a, i) => (
        <button
          key={a.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(a);
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-none cursor-pointer transition-colors"
          style={{
            background:
              i === selectedIndex
                ? "var(--color-hover)"
                : "transparent",
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: a.color }}
          />
          <span className="text-[14px] font-medium text-[var(--color-text)]">
            {a.name}
          </span>
          <span className="text-[12px] text-[var(--color-text-tertiary)] truncate">
            {a.purpose}
          </span>
        </button>
      ))}
    </div>
  );
}

const CHAT_ID = "group";

export function GroupChatView({
  agents,
  openDrawer,
}: {
  agents: Agent[];
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
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
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

    const mentions = extractMentions(text, agents);

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
    setMentionOpen(false);
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
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
  }, [input, streaming, conversationId, agents]);

  const filteredMentionAgents = mentionOpen
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(mentionFilter.toLowerCase())
      )
    : [];

  const insertMention = useCallback(
    (agent: Agent) => {
      if (mentionStart < 0) return;
      const before = input.slice(0, mentionStart);
      const after = input.slice(
        mentionStart + 1 + mentionFilter.length
      );
      const newInput = `${before}@${agent.name} ${after}`;
      setInput(newInput);
      setMentionOpen(false);
      setMentionFilter("");
      setMentionStart(-1);
      setMentionIndex(0);
      // Focus and move cursor after inserted mention
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          const pos = before.length + agent.name.length + 2; // @Name + space
          el.focus();
          el.setSelectionRange(pos, pos);
        }
      });
    },
    [input, mentionStart, mentionFilter]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    setInput(val);

    // Detect @ mention trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === " ")) {
      const query = textBeforeCursor.slice(atIndex + 1);
      // Only show dropdown if query has no spaces beyond agent names or is short
      if (!query.includes("\n") && query.length <= 30) {
        setMentionOpen(true);
        setMentionFilter(query);
        setMentionStart(atIndex);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen && filteredMentionAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) =>
          i < filteredMentionAgents.length - 1 ? i + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) =>
          i > 0 ? i - 1 : filteredMentionAgents.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentionAgents[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
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
        />
      ));
    }

    return (
      <div
        key={msg.id || idx}
        className="px-4 py-2 md:px-6"
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
        <div className="px-4 py-2 md:px-6">
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
        />
      ));
    }

    return (
      <div className="px-4 py-2 md:px-6">
        <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap max-w-[720px]">
          {streamText}
          <span className="inline-block w-0.5 h-4 bg-[var(--color-text-tertiary)] ml-0.5 align-middle animate-[typing-dot_1s_steps(2)_infinite]" />
        </div>
      </div>
    );
  };

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

      {/* Input — fixed on mobile, in-flow on desktop */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-5 md:pb-5"
      >
        <div className="relative">
          {/* @mention dropdown */}
          {mentionOpen && filteredMentionAgents.length > 0 && (
            <MentionDropdown
              agents={agents}
              filter={mentionFilter}
              onSelect={insertMention}
              selectedIndex={mentionIndex}
            />
          )}

          <div className="flex gap-2 items-center bg-[var(--color-input-bg)] rounded-xl pl-4 pr-1.5 py-1.5 border border-[var(--color-border)]">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay so dropdown click registers first
                setTimeout(() => setMentionOpen(false), 150);
              }}
              placeholder="Message #All... (@ to mention)"
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
    </div>
  );
}
