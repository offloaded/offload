"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../layout";
import { SearchIcon, MenuIcon, HashIcon } from "@/components/Icons";
import { Avatar } from "@/components/Avatar";
import { clearCache } from "@/lib/chat-cache";

interface ConversationEntry {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_color: string | null;
  is_group: boolean;
  preview: string;
  preview_role: string | null;
  snippet?: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const h = d.getHours();
  const m = d.getMinutes();
  const time = `${h > 12 ? h - 12 : h || 12}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "pm" : "am"}`;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${day}, ${time}`;
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export default function HistoryPage() {
  const { openDrawer } = useApp();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadConversations = useCallback(async (query: string, cursor?: string) => {
    const isSearch = !!query.trim();
    if (isSearch) setSearching(true);
    else if (!cursor) setLoading(true);

    try {
      let url = "/api/history";
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (cursor) params.set("cursor", cursor);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (cursor) {
        setConversations((prev) => [...prev, ...data.conversations]);
      } else {
        setConversations(data.conversations || []);
      }
      setHasMore(data.has_more || false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations("");
  }, [loadConversations]);

  // Debounced search
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        loadConversations(q);
      }, 300);
    },
    [loadConversations]
  );

  const openConversation = useCallback(
    (entry: ConversationEntry) => {
      // Clear relevant caches so the chat view loads fresh
      clearCache(`conv:${entry.id}`);
      if (entry.is_group) {
        router.push(`/chat?c=${entry.id}`);
      } else if (entry.agent_id) {
        router.push(`/agent/${entry.agent_id}?c=${entry.id}`);
      }
    },
    [router]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loading || searching) return;
    const last = conversations[conversations.length - 1];
    if (last) {
      loadConversations(searchQuery, last.last_message_at);
    }
  }, [hasMore, loading, searching, conversations, searchQuery, loadConversations]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-6 pt-safe">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex md:hidden rounded-lg hover:bg-[var(--color-hover)]"
          >
            <MenuIcon />
          </button>
          <span className="text-[16px] font-semibold text-[var(--color-text)]">
            History
          </span>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-[var(--color-input-bg)] rounded-xl px-3 py-2 border border-[var(--color-border)]">
          <span className="text-[var(--color-text-tertiary)] shrink-0">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="flex-1 border-none bg-transparent text-[var(--color-text)] text-[14px] outline-none"
          />
          {searching && (
            <span className="text-[12px] text-[var(--color-text-tertiary)]">
              Searching...
            </span>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-[108px] md:pt-0">
        {loading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-[14px] text-[var(--color-text-tertiary)]">
              Loading...
            </span>
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-[14px] text-[var(--color-text-secondary)] mb-1">
                {searchQuery ? "No results found" : "No conversations yet"}
              </div>
              <div className="text-[14px] text-[var(--color-text-tertiary)]">
                {searchQuery
                  ? "Try a different search term"
                  : "Start a chat to see your history here"}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-[760px]">
          {conversations.map((entry) => (
            <button
              key={entry.id}
              onClick={() => openConversation(entry)}
              className="w-full flex items-start gap-3 px-5 py-3 md:px-8 border-none bg-transparent cursor-pointer hover:bg-[var(--color-hover)] transition-colors text-left"
            >
              {/* Avatar / icon */}
              {entry.is_group ? (
                <div className="w-[34px] h-[34px] rounded-xl shrink-0 bg-[var(--color-active)] flex items-center justify-center text-[var(--color-text-secondary)]">
                  <HashIcon />
                </div>
              ) : entry.agent_color ? (
                <Avatar
                  name={entry.agent_name || "?"}
                  color={entry.agent_color}
                  size={34}
                />
              ) : (
                <div className="w-[34px] h-[34px] rounded-xl shrink-0 bg-[var(--color-active)] flex items-center justify-center text-[var(--color-text-tertiary)] text-xs font-bold">
                  ?
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className="text-[14px] font-semibold truncate"
                    style={{
                      color: entry.is_group
                        ? "var(--color-text)"
                        : entry.agent_color || "var(--color-text)",
                    }}
                  >
                    {entry.is_group
                      ? "Team Chat"
                      : entry.agent_name || "Unknown Agent"}
                  </span>
                  <span className="text-[12px] text-[var(--color-text-tertiary)] shrink-0">
                    {formatDate(entry.last_message_at)}
                  </span>
                </div>
                <div className="text-[13px] text-[var(--color-text-secondary)] truncate">
                  {entry.snippet ? (
                    <HighlightedSnippet
                      text={entry.snippet}
                      query={searchQuery}
                    />
                  ) : (
                    entry.preview
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={loadMore}
              className="text-[14px] text-[var(--color-accent)] bg-transparent border-none cursor-pointer font-medium hover:underline"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
