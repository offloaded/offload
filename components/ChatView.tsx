"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon, NewChatIcon, CalendarIcon, GlobeIcon, SaveIcon, PaperclipIcon, XIcon } from "./Icons";
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
  sendDM,
  subscribe,
  getInflightState,
  resetInflight,
  clearScheduleRequest,
  clearFeatureRequest,
  clearGroupMessageRequest,
  clearReportSaved,
  clearReportUpdated,
  type ScheduleRequest,
  type FeatureRequest,
  type GroupMessageRequest,
  type ReportSavedEvent,
  type ReportUpdatedEvent,
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

// Slack-style message row
const MessageRow = memo(function MessageRow({
  agent,
  text,
  time,
  isUser,
  messageId,
  conversationId,
  onSaveReport,
}: {
  agent?: Agent;
  text: string;
  time: string;
  isUser: boolean;
  messageId?: string;
  conversationId?: string | null;
  onSaveReport?: (title: string, content: string, agentId: string, messageId?: string, conversationId?: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);

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
            <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
              {text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  const handleSave = async () => {
    if (saving || !onSaveReport) return;
    setSaving(true);
    const title = text.slice(0, 80).split("\n")[0] || "Untitled Report";
    onSaveReport(title, text, agent.id, messageId, conversationId);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <div className="px-4 py-2 md:px-6 hover:bg-[var(--color-hover)] transition-colors group/msg">
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
            {onSaveReport && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="opacity-0 group-hover/msg:opacity-100 bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] cursor-pointer p-0 flex items-center gap-1 transition-opacity text-[11px]"
                title="Save as report"
              >
                <SaveIcon />
                <span>{saving ? "Saved!" : "Save"}</span>
              </button>
            )}
          </div>
          <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
});

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
              <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
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

// Memoized message list — won't re-render when input changes
const MessageList = memo(function MessageList({
  messages,
  agent,
  loading,
  loadingMore,
  streaming,
  streamText,
  conversationId,
  onSaveReport,
}: {
  messages: ChatMessage[];
  agent: Agent;
  loading: boolean;
  loadingMore: boolean;
  streaming: boolean;
  streamText: string;
  conversationId?: string | null;
  onSaveReport?: (title: string, content: string, agentId: string, messageId?: string, conversationId?: string | null) => void;
}) {
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
          messageId={m.id}
          conversationId={conversationId}
          onSaveReport={m.role === "assistant" ? onSaveReport : undefined}
        />
      ))}

      {streaming && (
        <TypingRow
          agent={agent}
          streamText={streamText || undefined}
        />
      )}
    </>
  );
});

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// Isolated input component with #channel support
const FILE_TYPES = ".pdf,.docx,.xlsx,.xls,.txt,.md,.csv";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function ChatInput({
  agentName,
  channels,
  streaming,
  onSend,
}: {
  agentName: string;
  channels: ChannelOption[];
  streaming: boolean;
  onSend: (text: string, file?: File) => void;
}) {
  const [input, setInput] = useState("");
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("");
  const [channelIndex, setChannelIndex] = useState(0);
  const [channelStart, setChannelStart] = useState(-1);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredChannels = channelOpen
    ? channels.filter((c) =>
        c.name.toLowerCase().includes(channelFilter.toLowerCase())
      )
    : [];

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

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    setInput(val);
    autoResize(e.target);

    const textBeforeCursor = val.slice(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf("#");
    if (hashIndex >= 0 && (hashIndex === 0 || textBeforeCursor[hashIndex - 1] === " " || textBeforeCursor[hashIndex - 1] === "\n")) {
      const query = textBeforeCursor.slice(hashIndex + 1);
      if (!query.includes("\n") && query.length <= 30) {
        setChannelOpen(true);
        setChannelFilter(query);
        setChannelStart(hashIndex);
        setChannelIndex(0);
        return;
      }
    }
    setChannelOpen(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert("File too large. Maximum size is 20MB.");
      return;
    }
    setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    inputRef.current?.focus();
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if ((!text && !attachedFile) || streaming) return;
    onSend(text || `[Attached: ${attachedFile!.name}]`, attachedFile || undefined);
    setInput("");
    setAttachedFile(null);
    setChannelOpen(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input, attachedFile, streaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (channelOpen && filteredChannels.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setChannelIndex((i) => i < filteredChannels.length - 1 ? i + 1 : 0); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setChannelIndex((i) => i > 0 ? i - 1 : filteredChannels.length - 1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertChannel(filteredChannels[channelIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setChannelOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [channelOpen, filteredChannels, channelIndex, insertChannel, send]);

  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus();
    }
  }, [streaming]);

  const canSend = (input.trim() || attachedFile) && !streaming;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 bg-[var(--color-surface)] px-3 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:px-5 md:pb-5"
    >
      <div className="relative">
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
          accept={FILE_TYPES}
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

        <div className="flex gap-2 items-end bg-[var(--color-input-bg)] rounded-xl pl-2 pr-1.5 py-1.5 border border-[var(--color-border)]">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            className="w-9 h-9 rounded-lg border-none shrink-0 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer bg-transparent mb-0.5 disabled:opacity-50"
            title="Attach file"
          >
            <PaperclipIcon />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={() => { setTimeout(() => setChannelOpen(false), 150); }}
            placeholder={`Message ${agentName}... (# for channels)`}
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

export function ChatView({
  agent,
  openDrawer,
  initialConversationId,
}: {
  agent: Agent;
  openDrawer: () => void;
  initialConversationId?: string | null;
}) {
  const { refreshAgents, markRead, setActiveChatKey, unreadCounts, teams, refreshReportCount, openReport, openReportId, reportEditCallback, setReportLiveUpdate } = useApp();
  const channels = buildChannelOptions(teams);
  const chatId = initialConversationId
    ? `conv:${initialConversationId}`
    : `agent:${agent.id}`;
  const inflight = getInflightState(chatId);
  // If there are unread messages and we're not mid-stream, clear stale cache so we fetch fresh from DB
  if (unreadCounts[agent.id] && !inflight.streaming) {
    clearCache(chatId);
  }
  const cached = getCached(chatId);

  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages || []);
  const [streaming, setStreaming] = useState(inflight.streaming);
  const [streamText, setStreamText] = useState(inflight.streamText);
  const [conversationId, setConversationId] = useState<string | null>(
    inflight.conversationId || (cached?.conversationId ?? initialConversationId ?? null)
  );
  const [loading, setLoading] = useState(!cached);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scheduleRequest, setScheduleRequest] = useState<ScheduleRequest | null>(null);
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const [featureRequest, setFeatureRequest] = useState<FeatureRequest | null>(null);
  const [confirmingFeature, setConfirmingFeature] = useState(false);
  const [groupMessageRequest, setGroupMessageRequest] = useState<GroupMessageRequest | null>(null);
  const [reportSaved, setReportSaved] = useState<ReportSavedEvent | null>(null);
  const [reportUpdated, setReportUpdated] = useState<ReportUpdatedEvent | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const [scrollReady, setScrollReady] = useState(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Track this chat as active so unread badges are suppressed
  useEffect(() => {
    setActiveChatKey(agent.id);
    return () => setActiveChatKey(null);
  }, [agent.id, setActiveChatKey]);

  // Subscribe to inflight state changes (background streaming)
  useEffect(() => {
    return subscribe(chatId, (state) => {
      setStreaming(state.streaming);
      setStreamText(state.streamText);
      if (state.conversationId) {
        setConversationId(state.conversationId);
      }
      if (state.scheduleRequest) {
        setScheduleRequest(state.scheduleRequest);
      }
      if (state.featureRequest) {
        setFeatureRequest(state.featureRequest);
      }
      if (state.groupMessageRequest) {
        setGroupMessageRequest(state.groupMessageRequest);
      }
      if (state.reportSaved) {
        setReportSaved(state.reportSaved);
      }
      if (state.reportUpdated) {
        setReportUpdated(state.reportUpdated);
        setReportLiveUpdate(state.reportUpdated);
        clearReportUpdated(chatId);
      }
      // Sync messages from cache when streaming state changes
      const c = getCached(chatId);
      if (c) {
        setMessages(c.messages);
      }
      // Mark read when streaming finishes so new message doesn't count as unread
      if (!state.streaming && conversationIdRef.current) {
        markRead(conversationIdRef.current);
      }
    });
  }, [chatId, markRead]);

  // Fetch initial messages
  useEffect(() => {
    initialScrollDone.current = false;
    setScrollReady(false);

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

    // Load specific conversation or most recent for this agent
    const url = initialConversationId
      ? `/api/conversations?conversation_id=${initialConversationId}`
      : `/api/conversations?agent_id=${agent.id}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        const convId = data.conversation_id || null;
        const allMsgs: ChatMessage[] = [];
        // If there's a previous conversation summary, show a divider at the top
        if (data.previous_summary) {
          allMsgs.push({
            role: "assistant",
            content: `--- Earlier messages archived --- \n${data.previous_summary}`,
            created_at: new Date(0).toISOString(), // sort to top
          });
        }
        allMsgs.push(...(data.messages || []).map((m: Message) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })));
        const more = data.has_more ?? false;
        setConversationId(convId);
        setMessages(allMsgs);
        setHasMore(more);
        setCache(chatId, { conversationId: convId, messages: allMsgs, hasMore: more });
        if (convId) markRead(convId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agent.id, chatId, initialConversationId]);

  // Scroll to bottom — instant on first render (before paint), smooth on subsequent updates
  useLayoutEffect(() => {
    if (!scrollRef.current || loading) return;
    if (!initialScrollDone.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      initialScrollDone.current = true;
      setScrollReady(true);
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!endRef.current || !initialScrollDone.current) return;
    endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // Auto-open report panel when a report is saved — pass content so no API fetch needed
  useEffect(() => {
    if (reportSaved?.report_id) {
      openReport(reportSaved.report_id, reportSaved.content ? {
        title: reportSaved.title,
        content: reportSaved.content,
        agent_name: reportSaved.agent_name,
        agent_id: reportSaved.agent_id,
      } : undefined);
    }
  }, [reportSaved, openReport]);

  // Register report edit feedback callback — sends diff to agent when user edits report
  useEffect(() => {
    reportEditCallback.current = (reportId: string, reportTitle: string, original: string, edited: string) => {
      const feedbackMessage = `I edited the report "${reportTitle}" (ID: ${reportId}). Here is the original version and my edited version for you to review.\n\nOriginal version:\n${original.slice(0, 3000)}${original.length > 3000 ? "\n[... truncated ...]" : ""}\n\nMy edited version:\n${edited.slice(0, 3000)}${edited.length > 3000 ? "\n[... truncated ...]" : ""}\n\nReview my changes and provide brief feedback — acknowledge what I changed, flag anything my edits may have introduced or missed, and suggest any improvements. If I approve your suggestions, you can update the report directly using the update_report tool with ID: ${reportId}`;
      sendDM(chatId, agent.id, feedbackMessage, conversationIdRef.current);
    };
    return () => {
      reportEditCallback.current = null;
    };
  }, [chatId, agent.id, reportEditCallback]);

  // Poll for new messages every 12 seconds (catches scheduled task responses)
  useEffect(() => {
    if (loading || !conversationId) return;
    const interval = setInterval(async () => {
      if (getInflightState(chatId).streaming) return;
      const newMsgs = await pollNewMessages(chatId);
      if (newMsgs.length > 0) {
        setMessages((prev) => [...prev, ...newMsgs]);
        markRead(conversationIdRef.current!);
      }
    }, 12_000);
    return () => clearInterval(interval);
  }, [chatId, loading, conversationId]);

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
  }, [loadingMore, conversationId, messages, chatId]);

  const handleSend = useCallback((text: string, file?: File) => {
    sendDM(chatId, agent.id, text, conversationIdRef.current, file);
  }, [chatId, agent.id]);

  const confirmSchedule = useCallback(async () => {
    if (!scheduleRequest || confirmingSchedule) return;
    setConfirmingSchedule(true);
    try {
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
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
            ? `${taskType} created \u2014 I'll run "${scheduleRequest.instruction}" ${desc} (${scheduleRequest.timezone}).`
            : `${taskType} created \u2014 I'll run "${scheduleRequest.instruction}" once at ${desc}.`,
          created_at: new Date().toISOString(),
        };
        updateMessages(chatId, (prev) => [...prev, successMsg]);
        setMessages((prev) => [...prev, successMsg]);
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `Failed to create scheduled task: ${data.error || `Error ${res.status}`}`,
          created_at: new Date().toISOString(),
        };
        updateMessages(chatId, (prev) => [...prev, errorMsg]);
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Failed to create scheduled task: ${err instanceof Error ? err.message : "Network error"}`,
        created_at: new Date().toISOString(),
      };
      updateMessages(chatId, (prev) => [...prev, errorMsg]);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setScheduleRequest(null);
      clearScheduleRequest(chatId);
      setConfirmingSchedule(false);
    }
  }, [scheduleRequest, confirmingSchedule, agent.id, chatId]);

  const confirmFeature = useCallback(async () => {
    if (!featureRequest || confirmingFeature) return;
    setConfirmingFeature(true);
    try {
      // Map feature ID to agent field
      const updates: Record<string, boolean> = {};
      if (featureRequest.feature === "web_search") {
        updates.web_search_enabled = true;
      }

      const res = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, ...updates }),
      });

      if (res.ok) {
        await refreshAgents();
        const enabledMsg: ChatMessage = {
          role: "assistant",
          content: `${featureRequest.label} is now enabled. Let me try that again.`,
          created_at: new Date().toISOString(),
        };
        updateMessages(chatId, (prev) => [...prev, enabledMsg]);
        setMessages((prev) => [...prev, enabledMsg]);

        // Re-send the user's last message so the agent can now use the feature
        const lastUserMsg = messages.findLast((m) => m.role === "user");
        if (lastUserMsg) {
          sendDM(chatId, agent.id, lastUserMsg.content, conversationIdRef.current);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: `Failed to enable ${featureRequest.label}: ${data.error || `Error ${res.status}`}`,
          created_at: new Date().toISOString(),
        };
        updateMessages(chatId, (prev) => [...prev, errorMsg]);
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Failed to enable ${featureRequest.label}: ${err instanceof Error ? err.message : "Network error"}`,
        created_at: new Date().toISOString(),
      };
      updateMessages(chatId, (prev) => [...prev, errorMsg]);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setFeatureRequest(null);
      clearFeatureRequest(chatId);
      setConfirmingFeature(false);
    }
  }, [featureRequest, confirmingFeature, agent.id, chatId, messages, refreshAgents]);

  const handleSaveReport = useCallback(async (title: string, content: string, agentId: string, messageId?: string, convId?: string | null) => {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, agent_id: agentId, message_id: messageId, conversation_id: convId }),
    });
    refreshReportCount();
  }, [refreshReportCount]);

  const handleApplyTemplate = useCallback(async (templateId: string) => {
    if (!reportSaved?.report_id || applyingTemplate) return;
    setApplyingTemplate(true);
    try {
      const res = await fetch("/api/report-templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportSaved.report_id,
          template_id: templateId,
          agent_id: agent.id,
        }),
      });
      if (res.ok) {
        setReportSaved(null);
        clearReportSaved(chatId);
      } else {
        const err = await res.json();
        console.error("Template apply failed:", err.error);
      }
    } catch (err) {
      console.error("Template apply error:", err);
    } finally {
      setApplyingTemplate(false);
    }
  }, [reportSaved, applyingTemplate, agent.id, chatId]);

  const handleNewChat = useCallback(() => {
    // Clear cache and inflight for current chat
    clearCache(chatId);
    resetInflight(chatId);
    // Also clear the default agent cache so it doesn't show stale data
    if (initialConversationId) {
      clearCache(`agent:${agent.id}`);
    }
    // Navigate to agent page without conversation_id (fresh chat)
    window.location.href = `/agent/${agent.id}`;
  }, [chatId, agent.id, initialConversationId]);

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
        <Avatar name={agent.name} color={agent.color} size={28} />
        <span className="text-[16px] font-semibold text-[var(--color-text)] flex-1">
          {agent.name}
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
        style={{ opacity: !loading && (scrollReady || messages.length === 0) ? 1 : 0 }}
      >
        <div className="flex flex-col justify-end min-h-full">
        <div ref={sentinelRef} className="h-1" />

        <MessageList
          messages={messages}
          agent={agent}
          loading={loading}
          loadingMore={loadingMore}
          streaming={streaming}
          streamText={streamText}
          conversationId={conversationId}
          onSaveReport={handleSaveReport}
        />

        {/* Schedule request banner — inside scrollable area so it's not hidden behind fixed input on mobile */}
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
                    clearScheduleRequest(chatId);
                  }}
                  className="py-1.5 px-3 rounded-md bg-transparent border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature activation banner */}
        {featureRequest && (
          <div className="mx-3 my-2 md:mx-5 p-3 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-soft)] flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">
              <GlobeIcon />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">
                Enable {featureRequest.label}?
              </div>
              <div className="text-[13px] text-[var(--color-text-secondary)]">
                This agent needs {featureRequest.label.toLowerCase()} to complete your request.
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={confirmFeature}
                  disabled={confirmingFeature}
                  className="py-1.5 px-3 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white disabled:opacity-50"
                >
                  {confirmingFeature ? "..." : "Enable"}
                </button>
                <button
                  onClick={() => {
                    setFeatureRequest(null);
                    clearFeatureRequest(chatId);
                  }}
                  className="py-1.5 px-3 rounded-md bg-transparent border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group/team message posted banner */}
        {groupMessageRequest && (
          <div className="mx-3 my-2 md:mx-5 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-hover)] flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[13px] text-[var(--color-text-secondary)]">
              Posted to {groupMessageRequest.team_id ? "team channel" : "group chat"}.
            </div>
            <a
              href={groupMessageRequest.team_id ? `/team/${groupMessageRequest.team_id}` : "/chat"}
              className="py-1.5 px-3 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white no-underline"
            >
              View
            </a>
            <button
              onClick={() => {
                setGroupMessageRequest(null);
                clearGroupMessageRequest(chatId);
              }}
              className="py-1.5 px-3 rounded-md bg-transparent border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Report saved with template picker */}
        {reportSaved && (
          <div className="mx-3 my-2 md:mx-5 p-3 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-soft)] flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">
              <SaveIcon />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">
                Report saved: {reportSaved.title}
              </div>
              {reportSaved.templates && reportSaved.templates.length > 0 ? (
                <>
                  <div className="text-[12px] text-[var(--color-text-secondary)] mb-2">
                    Apply a template to format this report?
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {reportSaved.templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleApplyTemplate(t.id)}
                        disabled={applyingTemplate}
                        className="py-1 px-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[12px] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-hover)] cursor-pointer transition-colors disabled:opacity-50"
                        title={t.description || t.name}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-[var(--color-text-secondary)]">
                  Report is ready for review.
                </div>
              )}
              <div className="flex gap-2">
                {reportSaved.report_id && (
                  <button
                    onClick={() => {
                      if (reportSaved.report_id) {
                        openReport(reportSaved.report_id, reportSaved.content ? {
                          title: reportSaved.title,
                          content: reportSaved.content,
                          agent_name: reportSaved.agent_name,
                          agent_id: reportSaved.agent_id,
                        } : undefined);
                      }
                      setReportSaved(null);
                      clearReportSaved(chatId);
                    }}
                    className="py-1.5 px-3 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white"
                  >
                    {openReportId === reportSaved.report_id ? "Viewing" : "Open"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setReportSaved(null);
                    clearReportSaved(chatId);
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
      <ChatInput
        agentName={agent.name}
        channels={channels}
        streaming={streaming}
        onSend={handleSend}
      />
    </div>
  );
}
