"use client";

import { useState, useEffect, useRef } from "react";
import {
  getCached,
  setCache,
  clearCache,
  pollNewMessages,
  type ChatMessage,
} from "@/lib/chat-cache";
import {
  subscribe,
  getInflightState,
} from "@/lib/inflight";
import type { Message } from "@/lib/types";

// Extract file name from [Attached: filename] pattern
function parseFileName(content: string, role: string): string | null {
  if (role !== "user") return null;
  const match = content.match(/\[Attached: ([^\]]+)\]/);
  return match ? match[1] : null;
}

interface UseConversationMessagesOpts {
  /** The cache/inflight key — e.g. "agent:xxx", "group", "team:xxx", "conv:xxx" */
  chatId: string;
  /** The API URL to fetch messages from when cache is empty */
  fetchUrl: string;
  /** The active chat key for unread suppression (e.g. agent.id, "group", "team:xxx") */
  activeChatKey: string;
  /** Whether to include file_name parsing on user messages */
  includeFileName?: boolean;
  /** Whether to include previous_summary divider (DM chat only) */
  includeSummaryDivider?: boolean;
  /** Unread count — if truthy on mount, clears cache to force fresh fetch */
  unreadCount?: number;
  /** Disable the built-in 12s poll (for components with custom poll logic) */
  disablePoll?: boolean;
  /** markRead callback */
  markRead: (conversationId: string) => void;
  /** setActiveChatKey callback */
  setActiveChatKey: (key: string | null) => void;
}

interface UseConversationMessagesResult {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  loading: boolean;
  conversationId: string | null;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  conversationIdRef: React.RefObject<string | null>;
  hasMore: boolean;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  streaming: boolean;
  streamText: string;
  typingAgentName: string | null;
  typingAgentColor: string | null;
  streamMessages: ChatMessage[];
  initialScrollDone: React.RefObject<boolean>;
}

export function useConversationMessages(opts: UseConversationMessagesOpts): UseConversationMessagesResult {
  const {
    chatId,
    fetchUrl,
    activeChatKey,
    includeFileName = false,
    includeSummaryDivider = false,
    unreadCount = 0,
    disablePoll = false,
    markRead,
    setActiveChatKey,
  } = opts;

  // --- State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [typingAgentName, setTypingAgentName] = useState<string | null>(null);
  const [typingAgentColor, setTypingAgentColor] = useState<string | null>(null);
  const [streamMessages, setStreamMessages] = useState<ChatMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const initialScrollDone = useRef(false);
  conversationIdRef.current = conversationId;

  // Stable refs for values used inside effects but that shouldn't trigger re-runs
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  const fetchUrlRef = useRef(fetchUrl);
  fetchUrlRef.current = fetchUrl;
  const includeFileNameRef = useRef(includeFileName);
  includeFileNameRef.current = includeFileName;
  const includeSummaryDividerRef = useRef(includeSummaryDivider);
  includeSummaryDividerRef.current = includeSummaryDivider;
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;

  // Track active chat for unread badge suppression
  useEffect(() => {
    setActiveChatKey(activeChatKey);
    return () => setActiveChatKey(null);
  }, [activeChatKey, setActiveChatKey]);

  // Subscribe to inflight state changes (streaming)
  useEffect(() => {
    return subscribe(chatId, (state) => {
      setStreaming(state.streaming);
      setStreamText(state.streamText);
      setTypingAgentName(state.typingAgentName ?? null);
      setTypingAgentColor(state.typingAgentColor ?? null);
      setStreamMessages([...state.streamMessages]);
      if (state.conversationId) {
        setConversationId(state.conversationId);
      }
      // Sync messages from cache when streaming state changes
      const c = getCached(chatId);
      if (c) {
        setMessages(c.messages);
      }
      // Mark read when streaming finishes
      if (!state.streaming && conversationIdRef.current) {
        markReadRef.current(conversationIdRef.current);
      }
    });
  }, [chatId]); // only chatId — callbacks via refs

  // Core fetch effect — fires ONLY when chatId changes.
  // Uses AbortController to cancel stale fetches when rapidly switching.
  useEffect(() => {
    initialScrollDone.current = false;
    const abortController = new AbortController();

    // If there are unreads, clear cache to force a fresh fetch
    if (unreadCountRef.current) {
      clearCache(chatId);
    }

    const currentInflight = getInflightState(chatId);
    const currentCached = getCached(chatId);

    if (currentCached) {
      setMessages(currentCached.messages);
      setConversationId(currentInflight.conversationId || currentCached.conversationId);
      setHasMore(currentCached.hasMore);
      setLoading(false);
      if (currentInflight.conversationId || currentCached.conversationId) {
        markReadRef.current(currentInflight.conversationId || currentCached.conversationId!);
      }
      return;
    }

    // No cache — fetch from API
    setLoading(true);
    setMessages([]);
    setConversationId(null);
    setHasMore(false);

    fetch(fetchUrlRef.current, { signal: abortController.signal })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (abortController.signal.aborted) return;
        const convId = data.conversation_id || null;
        const allMsgs: ChatMessage[] = [];
        if (includeSummaryDividerRef.current && data.previous_summary) {
          allMsgs.push({
            role: "assistant",
            content: `--- Earlier messages archived --- \n${data.previous_summary}`,
            created_at: new Date(0).toISOString(),
          });
        }
        const raw: Message[] = data.messages || [];
        const shouldParseFile = includeFileNameRef.current;
        allMsgs.push(
          ...raw.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            created_at: m.created_at,
            sender_id: m.sender_id ?? null,
            sender_name: m.sender_name ?? null,
            file_name: shouldParseFile ? parseFileName(m.content, m.role) : null,
          }))
        );
        const more = data.has_more ?? false;
        setConversationId(convId);
        setMessages(allMsgs);
        setHasMore(more);
        setCache(chatId, { conversationId: convId, messages: allMsgs, hasMore: more });
        if (convId) markReadRef.current(convId);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [chatId]); // ONLY chatId — everything else via refs

  // Poll for new messages every 12 seconds (skip if component has custom poll)
  const disablePollRef = useRef(disablePoll);
  disablePollRef.current = disablePoll;
  useEffect(() => {
    if (disablePollRef.current || loading || !conversationId) return;
    const interval = setInterval(async () => {
      if (getInflightState(chatId).streaming) return;
      const newMsgs = await pollNewMessages(chatId);
      if (newMsgs.length === 0) return;
      setMessages((prev) => [...prev, ...newMsgs]);
      if (conversationIdRef.current) markReadRef.current(conversationIdRef.current);
    }, 12_000);
    return () => clearInterval(interval);
  }, [chatId, loading, conversationId]);

  return {
    messages,
    setMessages,
    loading,
    conversationId,
    setConversationId,
    conversationIdRef,
    hasMore,
    setHasMore,
    streaming,
    streamText,
    typingAgentName,
    typingAgentColor,
    streamMessages,
    initialScrollDone,
  };
}
