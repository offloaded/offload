"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useApp } from "../layout";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// -- Theme tokens (from mockup) -------------------------------------------------

const themes = {
  light: {
    pageBg: "var(--color-page-bg)",
    cardBg: "#FFFFFF",
    cardBorder: "var(--color-border)",
    cardHeadBg: "var(--color-hover)",
    textPrimary: "var(--color-text)",
    textSecondary: "var(--color-text-secondary)",
    textTertiary: "var(--color-text-tertiary)",
    rowBorder: "var(--color-border-light)",
    idleDot: "var(--color-border)",
  },
  dark: {
    pageBg: "var(--color-page-bg)",
    cardBg: "var(--color-surface)",
    cardBorder: "var(--color-border)",
    cardHeadBg: "var(--color-surface-raised)",
    textPrimary: "var(--color-text)",
    textSecondary: "var(--color-text-secondary)",
    textTertiary: "var(--color-text-tertiary)",
    rowBorder: "var(--color-border-light)",
    idleDot: "var(--color-border)",
  },
};

// -- Static style maps -----------------------------------------------------------

const iconStyles: Record<string, { bg: string; color: string; symbol: string }> = {
  email: { bg: "#E1F5EE", color: "#0F6E56", symbol: "\u2709" },
  report: { bg: "#E6F1FB", color: "#185FA5", symbol: "\u25A4" },
  sched: { bg: "#FAEEDA", color: "#854F0B", symbol: "\u25F7" },
  manual: { bg: "#E6F1FB", color: "#185FA5", symbol: "\u25A4" },
};

const badgeMap: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "New", bg: "#E1F5EE", color: "#085041" },
  in_progress: { label: "Running", bg: "#E6F1FB", color: "#0C447C" },
  review: { label: "Review", bg: "#E6F1FB", color: "#0C447C" },
  complete: { label: "Done", bg: "#EAF3DE", color: "#3B6D11" },
  overdue: { label: "Overdue", bg: "#FAEEDA", color: "#854F0B" },
};

const eventDotColors: Record<string, string> = {
  email_received: "#1D9E75",
  work_started: "#185FA5",
  work_completed: "#1D9E75",
  document_generated: "#534AB7",
  schedule_missed: "#BA7517",
};

// -- Helpers ---------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatScheduledTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  if (d >= today && d < tomorrow) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (d >= tomorrow && d < dayAfter) {
    return "Tomorrow";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// -- Types -----------------------------------------------------------------------

interface DashboardData {
  metrics: {
    activeWorkItems: number;
    completedToday: number;
    scheduledToday: number;
    overdueScheduled: number;
    emailsIngested: number;
  };
  workItems: {
    id: string;
    title: string;
    status: string;
    source: string;
    agent_name: string | null;
    updated_at: string;
  }[];
  agents: {
    id: string;
    name: string;
    color: string;
    initials: string;
    active: boolean;
    status: string;
  }[];
  upcomingScheduled: {
    id: string;
    name: string;
    next_run_at: string;
    agent_name: string | null;
  }[];
  activityFeed: {
    id: string;
    event_type: string;
    description: string;
    agent_name: string | null;
    created_at: string;
  }[];
}

// -- Sub-components (from mockup) ------------------------------------------------

function MetricCard({ label, value, sub, subColor, t }: {
  label: string; value: number; sub: string; subColor?: string; t: typeof themes.light;
}) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: t.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: t.textPrimary }}>{value}</div>
      <div style={{ fontSize: 11, marginTop: 4, color: subColor || t.textTertiary }}>{sub}</div>
    </div>
  );
}

function SkeletonBlock({ height = 40, t }: { height?: number; t: typeof themes.light }) {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        background: t.rowBorder,
        animation: "pulse-soft 1.5s ease-in-out infinite",
      }}
    />
  );
}

function SkeletonCard({ rows = 3, t }: { rows?: number; t: typeof themes.light }) {
  return (
    <Card t={t}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.cardBorder}`, background: t.cardHeadBg }}>
        <SkeletonBlock height={14} t={t} />
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock key={i} height={36} t={t} />
        ))}
      </div>
    </Card>
  );
}

function WorkItemRow({ title, status, source, agent_name, updated_at, t, onClick }: {
  title: string; status: string; source: string; agent_name: string | null; updated_at: string;
  t: typeof themes.light; onClick: () => void;
}) {
  const sourceKey = source === "email" ? "email" : source === "scheduled" ? "sched" : "report";
  const ic = iconStyles[sourceKey] || iconStyles.manual;
  const bd = badgeMap[status] || badgeMap.draft;
  const meta = [agent_name, source === "email" ? "via email" : source === "scheduled" ? "scheduled" : "report", timeAgo(updated_at)].filter(Boolean).join(" \u00B7 ");

  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${t.rowBorder}`, cursor: "pointer" }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 6, background: ic.bg, color: ic.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
        {ic.symbol}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{meta}</div>
      </div>
      <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500, flexShrink: 0, background: bd.bg, color: bd.color }}>{bd.label}</div>
    </div>
  );
}

function AgentRow({ initials, name, status, color, active, t, isLast }: {
  initials: string; name: string; status: string; color: string; active: boolean;
  t: typeof themes.light; isLast: boolean;
}) {
  // Derive avatar colors from agent color
  const avatarBg = color + "18";
  const avatarColor = color;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}` }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg, color: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{name}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status}</div>
      </div>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#1D9E75" : t.idleDot, flexShrink: 0 }} />
    </div>
  );
}

function SchedRow({ time, name, agent, t, isLast }: {
  time: string; name: string; agent: string; t: typeof themes.light; isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}`, alignItems: "flex-start" }}>
      <div style={{ fontSize: 11, color: t.textSecondary, minWidth: 54, flexShrink: 0, paddingTop: 1 }}>{time}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{agent}</div>
      </div>
    </div>
  );
}

function FeedRow({ dot, description, agent_name, time, t, isLast, isNew }: {
  dot: string; description: string; agent_name: string | null; time: string;
  t: typeof themes.light; isLast: boolean; isNew?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 16px",
        borderBottom: isLast ? "none" : `1px solid ${t.rowBorder}`,
        alignItems: "flex-start",
        animation: isNew ? "fade-in 0.4s ease" : undefined,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14, paddingTop: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: t.rowBorder, marginTop: 4, minHeight: 16 }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: t.textPrimary, lineHeight: 1.5 }}>
          {agent_name && <strong style={{ fontWeight: 500 }}>{agent_name}</strong>}
          {agent_name ? " " : ""}{description}
        </div>
        <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 3 }}>{time}</div>
      </div>
    </div>
  );
}

function Card({ children, t, style }: {
  children: React.ReactNode; t: typeof themes.light; style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, link, onClick, t }: {
  title: string; link?: string; onClick?: () => void; t: typeof themes.light;
}) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.cardBorder}`, background: t.cardHeadBg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: t.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      {link && (
        <span
          onClick={onClick}
          style={{ fontSize: 12, color: t.textTertiary, cursor: "pointer" }}
        >
          {link}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message, t }: { message: string; t: typeof themes.light }) {
  return (
    <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: t.textTertiary }}>
      {message}
    </div>
  );
}

// -- Main Dashboard Component ----------------------------------------------------

export default function DashboardPage() {
  const { workspace } = useApp();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());

  // Derive theme from global data-theme attribute
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const t = isDark ? themes.dark : themes.light;

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supabase Realtime subscriptions
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!workspace) return;

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_items", filter: `workspace_id=eq.${workspace.id}` },
        () => {
          // Refresh work items and metrics
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `workspace_id=eq.${workspace.id}` },
        (payload) => {
          // Prepend new event to feed
          const newEvent = payload.new as {
            id: string;
            event_type: string;
            description: string;
            agent_id: string | null;
            created_at: string;
          };
          setData((prev) => {
            if (!prev) return prev;
            // We don't have agent_name from the payload, so refetch
            fetchData();
            return prev;
          });
          // Mark as new for animation
          setNewEventIds((prev) => new Set(prev).add(newEvent.id));
          setTimeout(() => {
            setNewEventIds((prev) => {
              const next = new Set(prev);
              next.delete(newEvent.id);
              return next;
            });
          }, 2000);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduled_tasks", filter: `workspace_id=eq.${workspace.id}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace, supabase, fetchData]);

  // Subtitle summary
  const subtitle = useMemo(() => {
    if (!data) return "";
    const parts: string[] = [];
    const activeAgents = data.agents.filter((a) => a.active).length;
    if (activeAgents > 0) parts.push(`${activeAgents} agent${activeAgents > 1 ? "s" : ""} active`);
    const needsAttention = data.workItems.filter((w) => w.status === "draft" || w.status === "review").length;
    if (needsAttention > 0) parts.push(`${needsAttention} item${needsAttention > 1 ? "s" : ""} need attention`);
    if (parts.length === 0) parts.push("all quiet");
    const dayStr = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return `${dayStr} \u2014 ${parts.join(", ")}`;
  }, [data]);

  // Get user's first name from workspace or fallback
  const greeting = getGreeting();

  return (
    <div
      style={{
        background: t.pageBg,
        padding: 24,
        minHeight: "100vh",
        overflowY: "auto",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 500, color: t.textPrimary }}>{greeting}</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: "14px 16px" }}>
              <SkeletonBlock height={12} t={t} />
              <div style={{ marginTop: 10 }}><SkeletonBlock height={26} t={t} /></div>
              <div style={{ marginTop: 8 }}><SkeletonBlock height={10} t={t} /></div>
            </div>
          ))
        ) : data ? (
          <>
            <MetricCard label="Active work items" value={data.metrics.activeWorkItems} sub={`${data.metrics.activeWorkItems} in progress`} t={t} />
            <MetricCard
              label="Completed today"
              value={data.metrics.completedToday}
              sub={data.metrics.completedToday > 0 ? `across ${data.agents.filter((a) => a.active).length || 1} agents` : "none yet"}
              t={t}
            />
            <MetricCard
              label="Scheduled today"
              value={data.metrics.scheduledToday}
              sub={data.metrics.overdueScheduled > 0 ? `${data.metrics.overdueScheduled} overdue` : "on track"}
              subColor={data.metrics.overdueScheduled > 0 ? "#BA7517" : undefined}
              t={t}
            />
            <MetricCard label="Emails ingested" value={data.metrics.emailsIngested} sub="today" t={t} />
          </>
        ) : null}
      </div>

      {/* Main Grid: Work Items + Agent Activity / Upcoming */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", gap: 16, marginBottom: 16 }}>

        {/* Work Items */}
        {loading ? (
          <SkeletonCard rows={5} t={t} />
        ) : (
          <Card t={t}>
            <CardHead title="Work items" link="View all \u2192" onClick={() => router.push("/work")} t={t} />
            {data && data.workItems.length > 0 ? (
              data.workItems.map((w) => (
                <WorkItemRow
                  key={w.id}
                  title={w.title}
                  status={w.status}
                  source={w.source}
                  agent_name={w.agent_name}
                  updated_at={w.updated_at}
                  t={t}
                  onClick={() => router.push(`/work/${w.id}`)}
                />
              ))
            ) : (
              <EmptyState message="No active work items" t={t} />
            )}
          </Card>
        )}

        {/* Right column: Agent Activity + Upcoming Scheduled */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <>
              <SkeletonCard rows={4} t={t} />
              <SkeletonCard rows={3} t={t} />
            </>
          ) : (
            <>
              <Card t={t}>
                <CardHead title="Agent activity" t={t} />
                {data && data.agents.length > 0 ? (
                  data.agents.map((a, i) => (
                    <AgentRow
                      key={a.id}
                      initials={a.initials}
                      name={a.name}
                      status={a.status}
                      color={a.color}
                      active={a.active}
                      t={t}
                      isLast={i === data.agents.length - 1}
                    />
                  ))
                ) : (
                  <EmptyState message="No agents configured" t={t} />
                )}
              </Card>

              <Card t={t}>
                <CardHead title="Upcoming scheduled" link="View all \u2192" onClick={() => router.push("/tasks")} t={t} />
                {data && data.upcomingScheduled.length > 0 ? (
                  data.upcomingScheduled.map((s, i) => (
                    <SchedRow
                      key={s.id}
                      time={formatScheduledTime(s.next_run_at)}
                      name={s.name}
                      agent={s.agent_name || "Unassigned"}
                      t={t}
                      isLast={i === data.upcomingScheduled.length - 1}
                    />
                  ))
                ) : (
                  <EmptyState message="No tasks scheduled" t={t} />
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      {loading ? (
        <SkeletonCard rows={6} t={t} />
      ) : (
        <Card t={t}>
          <CardHead title="Activity feed" link="View full history \u2192" onClick={() => router.push("/activity")} t={t} />
          {data && data.activityFeed.length > 0 ? (
            data.activityFeed.map((e, i) => (
              <FeedRow
                key={e.id}
                dot={eventDotColors[e.event_type] || "#999"}
                description={e.description}
                agent_name={e.agent_name}
                time={timeAgo(e.created_at)}
                t={t}
                isLast={i === data.activityFeed.length - 1}
                isNew={newEventIds.has(e.id)}
              />
            ))
          ) : (
            <EmptyState message="No activity yet" t={t} />
          )}
        </Card>
      )}
    </div>
  );
}
