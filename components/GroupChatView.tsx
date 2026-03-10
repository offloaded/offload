"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon, HashIcon, NewChatIcon, CalendarIcon } from "./Icons";
import type { Agent, Message } from "@/lib/types";
import {
  getCached,
  setCache,
  prependMessages,
  clearCache,
  updateMessages,
  pollNewMessages,
  type ChatMessage,
} from "@/lib/chat-cache";
import {
  sendGroup,
  subscribe,
  getInflightState,
  resetInflight,
  clearScheduleRequest,
  type ScheduleRequest,
} from "@/lib/inflight";
import { useApp } from "@/app/(app)/layout";
import { describeCron } from "@/lib/cron";
import {
  ChannelDropdown,
  buildChannelOptions,
  type ChannelOption,
} from "./ChannelDropdown";

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

const AgentMessage = memo(function AgentMessage({
  agent,
  text,
  time,
  agents,
}: {
  agent: Agent;
  text: string;
  time: string;
  agents: Agent[];
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
          <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
            {renderTextWithMentions(text, agents)}
          </div>
        </div>
      </div>
    </div>
  );
});

const UserMessage = memo(function UserMessage({
  text,
  time,
  agents,
  senderName,
}: {
  text: string;
  time: string;
  agents: Agent[];
  senderName?: string | null;
}) {
  const displayName = senderName || "You";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="px-4 py-2 md:px-6">
      <div className="flex max-w-[720px] gap-2.5 md:gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 bg-[var(--color-active)] text-[var(--color-text-secondary)] flex items-center justify-center text-xs font-bold">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[15px] font-semibold text-[var(--color-text)]">
              {displayName}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {time}
            </span>
          </div>
          <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
            {renderTextWithMentions(text, agents)}
          </div>
        </div>
      </div>
    </div>
  );
});

// Render text with @AgentName mentions highlighted in agent color
function renderTextWithMentions(
  text: string,
  agents: Agent[]
): React.ReactNode {
  // Build a regex that matches @AgentName or @You/@User (case-insensitive)
  const names = agents.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (names.length === 0) return text;
  const pattern = new RegExp(`(@(?:You|User|${names.join("|")}))`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return part;
    const name = part.slice(1).toLowerCase();
    if (name === "you" || name === "user") {
      return (
        <span key={i} className="font-semibold" style={{ color: "var(--color-accent)" }}>
          {part}
        </span>
      );
    }
    const agent = agents.find((a) => a.name.toLowerCase() === name);
    if (agent) {
      return (
        <span key={i} className="font-semibold" style={{ color: agent.color }}>
          {part}
        </span>
      );
    }
    return part;
  });
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
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto max-w-full">
      {filtered.map((a, i) => (
        <button
          key={a.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(a);
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-none cursor-pointer transition-colors min-w-0"
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

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// Memoized message list
const GroupMessageList = memo(function GroupMessageList({
  messages,
  agents,
  loading,
  loadingMore,
  streaming,
  typingAgentName,
  typingAgentColor,
}: {
  messages: ChatMessage[];
  agents: Agent[];
  loading: boolean;
  loadingMore: boolean;
  streaming: boolean;
  typingAgentName: string | null;
  typingAgentColor: string | null;
}) {
  const renderMessage = (msg: ChatMessage, idx: number) => {
    if (msg.role === "user") {
      return (
        <UserMessage
          key={msg.id || idx}
          text={msg.content}
          time={formatTime(msg.created_at)}
          agents={agents}
          senderName={msg.sender_name}
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
          agents={agents}
        />
      ));
    }

    return (
      <div
        key={msg.id || idx}
        className="px-4 py-2 md:px-6"
      >
        <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words max-w-[720px]">
          {msg.content}
        </div>
      </div>
    );
  };

  const renderTypingIndicator = () => {
    const name = typingAgentName;
    const color = typingAgentColor ?? "var(--color-text-tertiary)";
    if (name) {
      // Named per-agent typing indicator
      return (
        <div className="px-4 py-2 md:px-6">
          <div className="flex max-w-[720px] gap-2.5 md:gap-3">
            <Avatar name={name} color={color} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[15px] font-semibold" style={{ color }}>{name}</span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    className="w-[6px] h-[6px] rounded-full"
                    style={{ background: color, animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    // Generic dots while waiting for first agent_typing event
    return (
      <div className="px-4 py-2 md:px-6">
        <div className="flex items-center gap-1 pt-2.5">
          {[0, 1, 2].map((d) => (
            <div
              key={d}
              className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-tertiary)]"
              style={{ animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
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

      {streaming && renderTypingIndicator()}
    </>
  );
});

// Isolated input component with @mention and #channel support — manages its own state
function GroupChatInput({
  agents,
  channels,
  streaming,
  onSend,
}: {
  agents: Agent[];
  channels: ChannelOption[];
  streaming: boolean;
  onSend: (text: string, mentions: string[]) => void;
}) {
  const [input, setInput] = useState("");
  // @mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  // #channel state
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [channelIndex, setChannelIndex] = useState(0);
  const [channelStart, setChannelStart] = useState(-1);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredMentionAgents = mentionOpen
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(mentionFilter.toLowerCase())
      )
    : [];

  const filteredChannels = channelOpen
    ? channels.filter((c) =>
        c.name.toLowerCase().includes(channelFilter.toLowerCase())
      )
    : [];

  const insertMention = useCallback(
    (agent: Agent) => {
      if (mentionStart < 0) return;
      const before = input.slice(0, mentionStart);
      const after = input.slice(mentionStart + 1 + mentionFilter.length);
      const newInput = `${before}@${agent.name} ${after}`;
      setInput(newInput);
      setMentionOpen(false);
      setMentionFilter("");
      setMentionStart(-1);
      setMentionIndex(0);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          const pos = before.length + agent.name.length + 2;
          el.focus();
          el.setSelectionRange(pos, pos);
          autoResize(el);
        }
      });
    },
    [input, mentionStart, mentionFilter]
  );

  const insertChannel = useCallback(
    (channel: ChannelOption) => {
      if (channelStart < 0) return;
      const before = input.slice(0, channelStart);
      const after = input.slice(channelStart + 1 + channelFilter.length);
      const newInput = `${before}#${channel.name} ${after}`;
      setInput(newInput);
      setChannelOpen(false);
      setChannelFilter("");
      setChannelStart(-1);
      setChannelIndex(0);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          const pos = before.length + channel.name.length + 2;
          el.focus();
          el.setSelectionRange(pos, pos);
          autoResize(el);
        }
      });
    },
    [input, channelStart, channelFilter]
  );

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    const mentions = extractMentions(text, agents);
    onSend(text, mentions);
    setInput("");
    setMentionOpen(false);
    setChannelOpen(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input, streaming, agents, onSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    setInput(val);
    autoResize(e.target);

    const textBeforeCursor = val.slice(0, cursorPos);

    // Check for @ mentions
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === " " || textBeforeCursor[atIndex - 1] === "\n")) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes("\n") && query.length <= 30) {
        setMentionOpen(true);
        setMentionFilter(query);
        setMentionStart(atIndex);
        setMentionIndex(0);
        setChannelOpen(false);
        return;
      }
    }

    // Check for # channels
    const hashIndex = textBeforeCursor.lastIndexOf("#");
    if (hashIndex >= 0 && (hashIndex === 0 || textBeforeCursor[hashIndex - 1] === " " || textBeforeCursor[hashIndex - 1] === "\n")) {
      const query = textBeforeCursor.slice(hashIndex + 1);
      if (!query.includes("\n") && query.length <= 30) {
        setChannelOpen(true);
        setChannelFilter(query);
        setChannelStart(hashIndex);
        setChannelIndex(0);
        setMentionOpen(false);
        return;
      }
    }

    setMentionOpen(false);
    setChannelOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle @mention keyboard nav
    if (mentionOpen && filteredMentionAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => i < filteredMentionAgents.length - 1 ? i + 1 : 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => i > 0 ? i - 1 : filteredMentionAgents.length - 1);
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
    // Handle #channel keyboard nav
    if (channelOpen && filteredChannels.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setChannelIndex((i) => i < filteredChannels.length - 1 ? i + 1 : 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setChannelIndex((i) => i > 0 ? i - 1 : filteredChannels.length - 1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertChannel(filteredChannels[channelIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setChannelOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [mentionOpen, filteredMentionAgents, mentionIndex, insertMention, channelOpen, filteredChannels, channelIndex, insertChannel, send]);

  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus();
    }
  }, [streaming]);

  const canSend = input.trim() && !streaming;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-5 md:pb-5"
    >
      <div className="relative">
        {mentionOpen && filteredMentionAgents.length > 0 && (
          <MentionDropdown
            agents={agents}
            filter={mentionFilter}
            onSelect={insertMention}
            selectedIndex={mentionIndex}
          />
        )}

        {channelOpen && filteredChannels.length > 0 && (
          <ChannelDropdown
            channels={channels}
            filter={channelFilter}
            onSelect={insertChannel}
            selectedIndex={channelIndex}
          />
        )}

        <div className="flex gap-2 items-end bg-[var(--color-input-bg)] rounded-xl pl-4 pr-1.5 py-1.5 border border-[var(--color-border)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => { setMentionOpen(false); setChannelOpen(false); }, 150);
            }}
            placeholder="Message #All... (@ to mention, # for channels)"
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

export function GroupChatView({
  agents,
  openDrawer,
  initialConversationId,
}: {
  agents: Agent[];
  openDrawer: () => void;
  initialConversationId?: string | null;
}) {
  const { markRead, setActiveChatKey, unreadCounts, teams } = useApp();
  const channels = buildChannelOptions(teams);
  const CHAT_ID = initialConversationId
    ? `conv:${initialConversationId}`
    : "group";
  const inflight = getInflightState(CHAT_ID);
  // If there are unread messages and we're not mid-stream, clear stale cache so we fetch fresh from DB
  if (unreadCounts["group"] && !inflight.streaming) {
    clearCache(CHAT_ID);
  }
  const cached = getCached(CHAT_ID);

  const [messages, setMessages] = useState<ChatMessage[]>(
    inflight.streaming && inflight.streamMessages.length > 0
      ? [...(cached?.messages || []), ...inflight.streamMessages]
      : (cached?.messages || [])
  );
  const [streaming, setStreaming] = useState(inflight.streaming);
  const [typingAgentName, setTypingAgentName] = useState<string | null>(inflight.typingAgentName);
  const [typingAgentColor, setTypingAgentColor] = useState<string | null>(inflight.typingAgentColor);
  const [conversationId, setConversationId] = useState<string | null>(
    inflight.conversationId || (cached?.conversationId ?? initialConversationId ?? null)
  );
  const [loading, setLoading] = useState(!cached);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scheduleRequest, setScheduleRequest] = useState<ScheduleRequest | null>(null);
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Track this chat as active so unread badges are suppressed
  useEffect(() => {
    setActiveChatKey("group");
    return () => setActiveChatKey(null);
  }, [setActiveChatKey]);

  // Subscribe to inflight state changes (background streaming)
  useEffect(() => {
    return subscribe(CHAT_ID, (state) => {
      setStreaming(state.streaming);
      setTypingAgentName(state.typingAgentName ?? null);
      setTypingAgentColor(state.typingAgentColor ?? null);
      if (state.conversationId) {
        setConversationId(state.conversationId);
      }
      if (state.scheduleRequest) {
        setScheduleRequest(state.scheduleRequest);
      }
      const c = getCached(CHAT_ID);
      const cached = c?.messages ?? [];
      // During streaming, merge committed cache messages with in-progress stream messages
      if (state.streaming && state.streamMessages.length > 0) {
        setMessages([...cached, ...state.streamMessages]);
      } else {
        setMessages(cached);
      }
      // Mark read when streaming finishes so new messages don't count as unread
      if (!state.streaming && conversationIdRef.current) {
        markRead(conversationIdRef.current);
      }
    });
  }, [CHAT_ID, markRead]);

  // Fetch initial messages (skip if cached)
  useEffect(() => {
    initialScrollDone.current = false;

    if (cached) {
      setMessages(cached.messages);
      setConversationId(inflight.conversationId || cached.conversationId);
      setHasMore(cached.hasMore);
      setLoading(false);
      if (inflight.conversationId || cached.conversationId) {
        markRead(inflight.conversationId || cached.conversationId!);
      }
      return;
    }

    setLoading(true);
    setMessages([]);
    setConversationId(initialConversationId ?? null);

    const url = initialConversationId
      ? `/api/conversations?conversation_id=${initialConversationId}`
      : "/api/conversations?agent_id=group";
    fetch(url)
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
        if (convId) markRead(convId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [CHAT_ID, initialConversationId]);

  // Scroll to bottom — instant on first render, smooth on subsequent updates
  useEffect(() => {
    if (!endRef.current) return;
    if (!initialScrollDone.current) {
      endRef.current.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      initialScrollDone.current = true;
    } else {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streaming]);

  // Poll for new messages every 12 seconds (catches scheduled task responses)
  // When multi-agent responses arrive, stagger them with delays so each agent
  // appears individually rather than all at once.
  const pollQueueRef = useRef<ChatMessage[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading || !conversationId) return;

    // Drip-feed queued messages one at a time with random 3-8s gaps
    const drainNext = () => {
      const next = pollQueueRef.current.shift();
      if (!next) return;
      setMessages((prev) => [...prev, next]);
      if (pollQueueRef.current.length > 0) {
        const gap = 3000 + Math.random() * 5000;
        pollTimerRef.current = setTimeout(drainNext, gap);
      } else {
        pollTimerRef.current = null;
        markRead(conversationIdRef.current!);
      }
    };

    // Split a multi-agent assistant message into individual messages
    const splitAgentMessages = (msg: ChatMessage): ChatMessage[] => {
      if (msg.role !== "assistant") return [msg];
      const lines = msg.content.split("\n");
      const blocks: string[] = [];
      for (const line of lines) {
        if (/^\[[^\]]+\]\s/.test(line)) {
          blocks.push(line);
        } else if (blocks.length > 0) {
          blocks[blocks.length - 1] += "\n" + line;
        }
      }
      if (blocks.length <= 1) return [msg];
      return blocks.map((block) => ({
        ...msg,
        id: msg.id ? `${msg.id}-${blocks.indexOf(block)}` : undefined,
        content: block.trim(),
      }));
    };

    const interval = setInterval(async () => {
      if (getInflightState(CHAT_ID).streaming) return;
      if (pollQueueRef.current.length > 0) return; // still draining
      const newMsgs = await pollNewMessages(CHAT_ID);
      if (newMsgs.length === 0) return;

      // Split multi-agent messages and queue for staggered display
      const expanded: ChatMessage[] = [];
      for (const msg of newMsgs) {
        expanded.push(...splitAgentMessages(msg));
      }

      if (expanded.length === 1) {
        // Single message — show immediately
        setMessages((prev) => [...prev, expanded[0]]);
        markRead(conversationIdRef.current!);
      } else {
        // Multiple — show first immediately, queue rest with delays
        setMessages((prev) => [...prev, expanded[0]]);
        pollQueueRef.current = expanded.slice(1);
        const gap = 3000 + Math.random() * 5000;
        pollTimerRef.current = setTimeout(drainNext, gap);
      }
    }, 12_000);

    return () => {
      clearInterval(interval);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [CHAT_ID, loading, conversationId]);

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
        `/api/conversations?conversation_id=${conversationId}&before=${encodeURIComponent(oldest)}`
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

  const handleSend = useCallback((text: string, mentions: string[]) => {
    sendGroup(CHAT_ID, text, conversationIdRef.current, mentions);
  }, [CHAT_ID]);

  const confirmSchedule = useCallback(async () => {
    if (!scheduleRequest || confirmingSchedule) return;
    setConfirmingSchedule(true);
    try {
      const agentId = scheduleRequest.agent_id || agents[0]?.id;
      if (!agentId) return;
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          instruction: scheduleRequest.instruction,
          ...(scheduleRequest.recurring
            ? { cron: scheduleRequest.cron }
            : { run_at: scheduleRequest.run_at }),
          timezone: scheduleRequest.timezone,
          recurring: scheduleRequest.recurring,
          destination: scheduleRequest.destination,
        }),
      });
      if (res.ok) {
        let desc: string;
        if (scheduleRequest.recurring && scheduleRequest.cron) {
          try { desc = describeCron(scheduleRequest.cron); } catch { desc = scheduleRequest.cron; }
        } else if (scheduleRequest.run_at) {
          desc = new Date(scheduleRequest.run_at).toLocaleString();
        } else {
          desc = scheduleRequest.cron ?? "scheduled time";
        }
        const taskType = scheduleRequest.recurring ? "Scheduled task" : "One-off task";
        const successMsg: ChatMessage = {
          role: "assistant",
          content: scheduleRequest.recurring
            ? `${taskType} created — I'll run "${scheduleRequest.instruction}" ${desc} (${scheduleRequest.timezone}).`
            : `${taskType} created — I'll run "${scheduleRequest.instruction}" once at ${desc}.`,
          created_at: new Date().toISOString(),
        };
        updateMessages(CHAT_ID, (prev) => [...prev, successMsg]);
        setMessages((prev) => [...prev, successMsg]);
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `Failed to create scheduled task: ${data.error || `Error ${res.status}`}`,
          created_at: new Date().toISOString(),
        };
        updateMessages(CHAT_ID, (prev) => [...prev, errorMsg]);
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Failed to create scheduled task: ${err instanceof Error ? err.message : "Network error"}`,
        created_at: new Date().toISOString(),
      };
      updateMessages(CHAT_ID, (prev) => [...prev, errorMsg]);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setScheduleRequest(null);
      clearScheduleRequest(CHAT_ID);
      setConfirmingSchedule(false);
    }
  }, [scheduleRequest, confirmingSchedule, agents, CHAT_ID]);

  const handleNewChat = useCallback(() => {
    clearCache(CHAT_ID);
    resetInflight(CHAT_ID);
    if (initialConversationId) {
      clearCache("group");
    }
    window.location.href = "/chat";
  }, [CHAT_ID, initialConversationId]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header — fixed on mobile, in-flow on desktop */}
      <div
        className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 py-3 px-4 md:py-3.5 md:px-6 pt-safe"
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
        <span className="text-[13px] text-[var(--color-text-tertiary)] flex-1">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleNewChat}
          className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1 flex items-center gap-1.5 hover:text-[var(--color-text-secondary)] transition-colors"
          title="New chat"
        >
          <NewChatIcon />
          <span className="text-[13px] font-medium hidden md:inline">New chat</span>
        </button>
      </div>

      {/* Messages — padded for fixed header/input on mobile */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden pt-[52px] pb-[72px] md:pt-4 md:pb-2 min-h-0"
      >
        <div className="flex flex-col justify-end min-h-full">
        <div ref={sentinelRef} className="h-1" />

        <GroupMessageList
          messages={messages}
          agents={agents}
          loading={loading}
          loadingMore={loadingMore}
          streaming={streaming}
          typingAgentName={typingAgentName}
          typingAgentColor={typingAgentColor}
        />

        {/* Schedule request banner */}
        {scheduleRequest && (
          <div className="mx-3 my-2 md:mx-5 p-3 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-soft)] flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">
              <CalendarIcon />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">
                Schedule task?
              </div>
              <div className="text-[13px] text-[var(--color-text-secondary)]">
                {scheduleRequest.instruction}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {scheduleRequest.recurring
                  ? `${scheduleRequest.cron} · ${scheduleRequest.timezone}`
                  : scheduleRequest.run_at
                    ? new Date(scheduleRequest.run_at).toLocaleString()
                    : scheduleRequest.cron}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={confirmSchedule}
                  disabled={confirmingSchedule}
                  className="py-1.5 px-3 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white disabled:opacity-50"
                >
                  {confirmingSchedule ? "..." : "Confirm"}
                </button>
                <button
                  onClick={() => {
                    setScheduleRequest(null);
                    clearScheduleRequest(CHAT_ID);
                  }}
                  className="py-1.5 px-3 rounded-md bg-transparent border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
        </div>
      </div>

      {/* Input — isolated component with own state */}
      <GroupChatInput
        agents={agents}
        channels={channels}
        streaming={streaming}
        onSend={handleSend}
      />
    </div>
  );
}
