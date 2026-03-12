"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Avatar, UserAvatar } from "./Avatar";
import { SendIcon, MenuIcon, HashIcon, NewChatIcon, CalendarIcon, GearIcon, PeopleIcon, SaveIcon, PaperclipIcon, XIcon } from "./Icons";
import type { Agent, Message } from "@/lib/types";
import {
  setCache,
  prependMessages,
  clearCache,
  updateMessages,
  type ChatMessage,
} from "@/lib/chat-cache";
import {
  sendTeam,
  subscribe,
  resetInflight,
  clearScheduleRequest,
  type ScheduleRequest,
} from "@/lib/inflight";
import { useApp } from "@/app/(app)/layout";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useRouter } from "next/navigation";
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

function renderTextWithMentions(
  text: string,
  agents: Agent[]
): React.ReactNode {
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

const AgentMessage = memo(function AgentMessage({
  agent,
  text,
  time,
  agents,
  onSaveReport,
}: {
  agent: Agent;
  text: string;
  time: string;
  agents: Agent[];
  onSaveReport?: (title: string, content: string, agentId: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (saving || !onSaveReport) return;
    setSaving(true);
    const title = text.slice(0, 80).split("\n")[0] || "Untitled Report";
    onSaveReport(title, text, agent.id);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <div className="px-5 py-3 md:px-8 hover:bg-[var(--color-hover)] transition-colors group/msg">
      <div className="flex max-w-[760px] gap-3">
        <Avatar name={agent.name} color={agent.color} size={34} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[13px] font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{time}</span>
            {onSaveReport && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="opacity-0 group-hover/msg:opacity-100 bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] cursor-pointer p-1 ml-auto rounded-md hover:bg-[var(--color-hover)] flex items-center gap-1 transition-opacity text-[11px]"
                title="Save as report"
              >
                <SaveIcon />
                <span>{saving ? "Saved!" : "Save"}</span>
              </button>
            )}
          </div>
          <div className="text-[14px] leading-[1.75] text-[var(--color-text)] whitespace-pre-wrap break-words">
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

  // Parse file attachment from message content
  const fileMatch = text.match(/\[Attached: ([^\]]+)\]/);
  const fileName = fileMatch ? fileMatch[1] : null;
  let displayText = text;
  if (fileName) {
    displayText = displayText.replace(/\[Attached: [^\]]+\]\s*/g, "");
    displayText = displayText.replace(/\n*--- Attached file: .+? ---\n[\s\S]*$/, "");
    displayText = displayText.trim();
  }

  return (
    <div className="px-5 py-3 md:px-8">
      <div className="flex max-w-[760px] gap-3">
        <UserAvatar name={displayName} size={34} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[13px] font-semibold text-[var(--color-text)]">{displayName}</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{time}</span>
          </div>
          {fileName && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-accent-soft)] text-[12px] text-[var(--color-accent)] mb-1.5 w-fit font-medium">
              <PaperclipIcon />
              <span className="max-w-[300px] truncate">{fileName}</span>
            </div>
          )}
          {displayText && (
            <div className="text-[14px] leading-[1.75] text-[var(--color-text)] whitespace-pre-wrap break-words">
              {renderTextWithMentions(displayText, agents)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

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
            background: i === selectedIndex ? "var(--color-hover)" : "transparent",
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
          <span className="text-[14px] font-medium text-[var(--color-text)]">{a.name}</span>
          <span className="text-[12px] text-[var(--color-text-tertiary)] truncate">{a.purpose}</span>
        </button>
      ))}
    </div>
  );
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

export function TeamChatView({
  teamId,
  teamName,
  teamAgents,
  openDrawer,
  isSystem = false,
}: {
  teamId: string;
  teamName: string;
  teamAgents: Agent[];
  openDrawer: () => void;
  isSystem?: boolean;
}) {
  const { markRead, setActiveChatKey, unreadCounts, teams, refreshReportCount } = useApp();
  const router = useRouter();
  const channels = buildChannelOptions(teams);
  const CHAT_ID = `team:${teamId}`;
  const fetchUrl = `/api/conversations?team_id=${teamId}`;

  // Core message lifecycle
  const {
    messages, setMessages, loading, conversationId,
    conversationIdRef, hasMore, setHasMore, streaming,
    typingAgentName, typingAgentColor, streamMessages,
    initialScrollDone,
  } = useConversationMessages({
    chatId: CHAT_ID,
    fetchUrl,
    activeChatKey: CHAT_ID,
    unreadCount: unreadCounts[CHAT_ID] || 0,
    markRead,
    setActiveChatKey,
  });

  // Team-specific state
  const [loadingMore, setLoadingMore] = useState(false);
  const [scheduleRequest, setScheduleRequest] = useState<ScheduleRequest | null>(null);
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);

  // Input state
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [channelIndex, setChannelIndex] = useState(0);
  const [channelStart, setChannelStart] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredMentionAgents = mentionOpen
    ? teamAgents.filter((a) =>
        a.name.toLowerCase().includes(mentionFilter.toLowerCase())
      )
    : [];

  const filteredChannels = channelOpen
    ? channels.filter((c) =>
        c.name.toLowerCase().includes(channelFilter.toLowerCase())
      )
    : [];

  // Subscribe to team-specific events (schedule requests)
  useEffect(() => {
    return subscribe(CHAT_ID, (state) => {
      if (state.scheduleRequest) setScheduleRequest(state.scheduleRequest);
    });
  }, [CHAT_ID]);

  // Merge stream messages during streaming
  const displayMessages = streaming && streamMessages.length > 0
    ? [...messages, ...streamMessages]
    : messages;

  // Scroll
  useEffect(() => {
    if (!endRef.current) return;
    if (!initialScrollDone.current) {
      endRef.current.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      initialScrollDone.current = true;
    } else {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages, streaming, initialScrollDone]);

  // Lazy load older
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
        id: m.id, role: m.role, content: m.content, created_at: m.created_at,
      }));
      const more = data.has_more ?? false;
      setHasMore(more);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        prependMessages(CHAT_ID, older, more);
        requestAnimationFrame(() => {
          if (scroller) scroller.scrollTop = scroller.scrollHeight - prevHeight;
        });
      }
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, conversationId, messages, CHAT_ID]);

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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert("File too large. Maximum size is 20MB."); return; }
    setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    inputRef.current?.focus();
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if ((!text && !attachedFile) || streaming) return;
    const mentions = extractMentions(text || "", teamAgents);
    sendTeam(CHAT_ID, teamId, text || `[Attached: ${attachedFile!.name}]`, conversationIdRef.current, mentions, attachedFile || undefined);
    setInput("");
    setAttachedFile(null);
    setMentionOpen(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, attachedFile, streaming, teamAgents, CHAT_ID, teamId]);

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
    if (mentionOpen && filteredMentionAgents.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => i < filteredMentionAgents.length - 1 ? i + 1 : 0); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => i > 0 ? i - 1 : filteredMentionAgents.length - 1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filteredMentionAgents[mentionIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
    }
    if (channelOpen && filteredChannels.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setChannelIndex((i) => i < filteredChannels.length - 1 ? i + 1 : 0); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setChannelIndex((i) => i > 0 ? i - 1 : filteredChannels.length - 1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertChannel(filteredChannels[channelIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setChannelOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [mentionOpen, filteredMentionAgents, mentionIndex, insertMention, channelOpen, filteredChannels, channelIndex, insertChannel, send]);

  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const confirmSchedule = useCallback(async () => {
    if (!scheduleRequest || confirmingSchedule) return;
    setConfirmingSchedule(true);
    try {
      const agentId = scheduleRequest.agent_id || teamAgents[0]?.id;
      if (!agentId) return;
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          instruction: scheduleRequest.instruction,
          ...(scheduleRequest.recurring ? { cron: scheduleRequest.cron } : { run_at: scheduleRequest.run_at }),
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
      }
    } catch { /* ignore */ } finally {
      setScheduleRequest(null);
      clearScheduleRequest(CHAT_ID);
      setConfirmingSchedule(false);
    }
  }, [scheduleRequest, confirmingSchedule, teamAgents, CHAT_ID]);

  const handleSaveReport = useCallback(async (title: string, content: string, agentId: string) => {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, agent_id: agentId, conversation_id: conversationId, source: "manual" }),
    });
    refreshReportCount();
  }, [conversationId, refreshReportCount]);

  const handleNewChat = useCallback(() => {
    clearCache(CHAT_ID);
    resetInflight(CHAT_ID);
    window.location.reload();
  }, [CHAT_ID]);

  const canSend = (input.trim() || attachedFile) && !streaming;

  const renderMessage = (msg: ChatMessage, idx: number) => {
    if (msg.role === "user") {
      return <UserMessage key={msg.id || idx} text={msg.content} time={formatTime(msg.created_at)} agents={teamAgents} senderName={msg.sender_name} />;
    }
    const parsed = parseGroupResponse(msg.content, teamAgents);
    if (parsed.length > 0) {
      return parsed.map((p, j) => (
        <AgentMessage key={`${msg.id || idx}-${j}`} agent={p.agent} text={p.text} time={formatTime(msg.created_at)} agents={teamAgents} onSaveReport={handleSaveReport} />
      ));
    }
    return (
      <div key={msg.id || idx} className="px-5 py-3 md:px-8">
        <div className="text-[14px] leading-[1.75] text-[var(--color-text)] whitespace-pre-wrap break-words max-w-[760px]">
          {msg.content}
        </div>
      </div>
    );
  };

  const renderTypingIndicator = () => {
    const name = typingAgentName;
    const color = typingAgentColor ?? "var(--color-text-tertiary)";
    if (name) {
      return (
        <div className="px-5 py-3 md:px-8">
          <div className="flex max-w-[760px] gap-3">
            <Avatar name={name} color={color} size={34} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[13px] font-semibold" style={{ color }}>{name}</span>
              </div>
              <div className="flex items-center gap-1 pt-1">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-[6px] h-[6px] rounded-full" style={{ background: color, animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="px-5 py-3 md:px-8">
        <div className="flex items-center gap-1 pt-2.5">
          {[0, 1, 2].map((d) => (
            <div key={d} className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-tertiary)]" style={{ animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite` }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 h-[56px] px-4 md:px-6 pt-safe">
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 rounded-lg hover:bg-[var(--color-hover)] flex md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-[var(--color-text-tertiary)] text-base">
          {isSystem ? <PeopleIcon /> : <HashIcon />}
        </span>
        <span className="text-[14px] font-semibold text-[var(--color-text)]">
          {teamName}
        </span>
        <span className="text-[12px] text-[var(--color-text-tertiary)] flex-1">
          {isSystem ? "humans only" : `${teamAgents.length} agent${teamAgents.length !== 1 ? "s" : ""}`}
        </span>
        {!isSystem && (
          <button
            onClick={() => router.push(`/team/${teamId}/settings`)}
            className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1 rounded-lg hover:bg-[var(--color-hover)] flex items-center hover:text-[var(--color-text-secondary)] transition-colors"
            title="Team settings"
          >
            <GearIcon />
          </button>
        )}
        <button
          onClick={handleNewChat}
          className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-2 rounded-lg hover:bg-[var(--color-hover)] flex items-center gap-1.5 hover:text-[var(--color-text-secondary)] transition-colors"
          title="New chat"
        >
          <NewChatIcon />
          <span className="text-[12px] font-medium hidden md:inline">New chat</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden pt-[52px] pb-[72px] md:pt-4 md:pb-2 min-h-0">
        <div className="flex flex-col justify-end min-h-full">
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex items-center justify-center py-3">
              <span className="text-[13px] text-[var(--color-text-tertiary)]">Loading older messages...</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
            </div>
          )}

          {!loading && displayMessages.length === 0 && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] text-xl font-bold mb-4">#</div>
                <div className="text-[17px] font-semibold text-[var(--color-accent)]">
                  {teamName}
                </div>
                <div className="text-[13px] text-[var(--color-text-tertiary)] max-w-[360px] leading-relaxed mt-2">
                  {isSystem
                    ? "A space for humans only — no agents participate"
                    : `Message your ${teamName} team — only team members will respond`}
                </div>
                <div className="text-[13px] text-[var(--color-text-tertiary)] mt-4 opacity-60">Type a message to start the conversation</div>
              </div>
            </div>
          )}

          {displayMessages.map((m, i) => renderMessage(m, i))}

          {streaming && renderTypingIndicator()}

          {/* Schedule request banner */}
          {scheduleRequest && (
            <div className="mx-4 my-2 md:mx-6 p-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] flex items-start gap-3">
              <span className="text-[var(--color-accent)] mt-0.5"><CalendarIcon /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">Schedule task?</div>
                <div className="text-[13px] text-[var(--color-text-secondary)]">{scheduleRequest.instruction}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={confirmSchedule}
                    disabled={confirmingSchedule}
                    className="py-1.5 px-3 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white disabled:opacity-50"
                  >
                    {confirmingSchedule ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => { setScheduleRequest(null); clearScheduleRequest(CHAT_ID); }}
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

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <div className="relative">
          {mentionOpen && filteredMentionAgents.length > 0 && (
            <MentionDropdown
              agents={teamAgents}
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.xml,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {attachedFile && (
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-accent-soft)] border border-[var(--color-accent)] text-[12px] text-[var(--color-text)]">
                <PaperclipIcon />
                <span className="max-w-[200px] truncate">{attachedFile.name}</span>
                <span className="text-[var(--color-text-tertiary)]">
                  ({(attachedFile.size / 1024).toFixed(0)}KB)
                </span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer p-0 flex"
                >
                  <XIcon />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 items-end bg-[var(--color-input-bg)] rounded-2xl pl-2.5 pr-2 py-2 border border-[var(--color-border)]">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={streaming}
              className="w-8 h-8 rounded-full border-none shrink-0 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-active)] transition-colors cursor-pointer bg-transparent mb-0.5 disabled:opacity-40"
              title="Attach file"
            >
              <PaperclipIcon />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => { setTimeout(() => { setMentionOpen(false); setChannelOpen(false); }, 150); }}
              placeholder={isSystem ? `Message #${teamName}...` : `Message #${teamName}... (@ to mention)`}
              rows={1}
              className="flex-1 border-none bg-transparent text-[var(--color-text)] text-[14.5px] outline-none py-1.5 resize-none leading-relaxed placeholder:text-[var(--color-text-tertiary)]"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={send}
              disabled={!canSend}
              className="h-9 rounded-xl border-none shrink-0 flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-all duration-150 mb-0.5"
              style={{
                background: canSend ? "var(--color-accent)" : "transparent",
                color: canSend ? "#fff" : "var(--color-text-tertiary)",
                cursor: canSend ? "pointer" : "default",
                padding: canSend ? "0 14px" : "0 8px",
              }}
            >
              <SendIcon />
              {canSend && <span>Send</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
