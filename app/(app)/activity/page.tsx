"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/app/(app)/layout";
import { MenuIcon, CheckCircleIcon, AlertCircleIcon, SpinnerIcon, GlobeIcon, FileIcon } from "@/components/Icons";

interface Activity {
  id: string;
  agent_id: string | null;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  agents: { name: string; color: string } | null;
}

function statusIcon(type: string) {
  if (type === "task_completed" || type === "document_processed") return <span className="text-[var(--color-green)]"><CheckCircleIcon /></span>;
  if (type === "task_failed" || type === "document_failed") return <span className="text-[var(--color-red)]"><AlertCircleIcon /></span>;
  if (type === "task_started") return <span className="text-[var(--color-accent)]"><SpinnerIcon /></span>;
  if (type === "web_search") return <span className="text-[var(--color-accent)]"><GlobeIcon /></span>;
  if (type.startsWith("document")) return <span className="text-[var(--color-text-tertiary)]"><FileIcon /></span>;
  return <span className="text-[var(--color-text-tertiary)]"><CheckCircleIcon /></span>;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const h = d.getHours();
  const m = d.getMinutes();
  const time = `${h > 12 ? h - 12 : h || 12}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "pm" : "am"}`;

  if (diffHours < 48) return `yesterday ${time}`;

  const month = d.toLocaleString("default", { month: "short" });
  return `${month} ${d.getDate()} ${time}`;
}

export default function ActivityPage() {
  const { openDrawer } = useApp();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchActivities = useCallback(async (before?: string) => {
    const url = before
      ? `/api/activity?before=${encodeURIComponent(before)}`
      : "/api/activity";
    const res = await fetch(url);
    if (!res.ok) return { activities: [], has_more: false };
    return res.json();
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchActivities().then((data) => {
      setActivities(data.activities || []);
      setHasMore(data.has_more || false);
      setLoading(false);
    });

    // Mark activity as seen (store timestamp in localStorage)
    localStorage.setItem("activity_last_seen", new Date().toISOString());
  }, [fetchActivities]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivities().then((data) => {
        setActivities(data.activities || []);
        setHasMore(data.has_more || false);
        // Update last seen on each refresh while viewing
        localStorage.setItem("activity_last_seen", new Date().toISOString());
      });
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || activities.length === 0) return;
    setLoadingMore(true);
    const oldest = activities[activities.length - 1].created_at;
    const data = await fetchActivities(oldest);
    setActivities((prev) => [...prev, ...(data.activities || [])]);
    setHasMore(data.has_more || false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, activities, fetchActivities]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 py-3 px-4 md:py-3.5 md:px-6 pt-safe">
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          Activity
        </span>
        <span className="text-[13px] text-[var(--color-text-tertiary)]">
          Real-time agent activity
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pt-[52px] md:pt-0 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-[15px] font-medium text-[var(--color-text-secondary)] mb-1">
                No activity yet
              </div>
              <div className="text-[14px] text-[var(--color-text-tertiary)]">
                Agent activity will appear here as they run tasks, search the web, and process documents
              </div>
            </div>
          </div>
        )}

        {activities.filter((a) => a.type !== "task_started").map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 px-4 py-3 md:px-6 border-b border-[var(--color-border-light)] hover:bg-[var(--color-hover)] transition-colors"
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {statusIcon(a.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {a.agents && (
                  <>
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: a.agents.color }}
                    />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: a.agents.color }}
                    >
                      {a.agents.name}
                    </span>
                  </>
                )}
                <span className="text-[11px] text-[var(--color-text-tertiary)]">
                  {formatTime(a.created_at)}
                </span>
              </div>
              <div className="text-[14px] text-[var(--color-text)] leading-relaxed">
                {a.description}
              </div>
              {a.metadata && typeof a.metadata === "object" && "error" in a.metadata && (
                <div className="text-[12px] text-red-400 mt-0.5">
                  {String(a.metadata.error)}
                </div>
              )}
            </div>
          </div>
        ))}

        {hasMore && (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-[13px] text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
