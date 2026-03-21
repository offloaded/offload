"use client";

import { useEffect, useState, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase";
import { SidebarContent, Drawer } from "@/components/Sidebar";
import { ReportPanel } from "@/components/ReportPanel";
import IconRail from "@/components/IconRail";
import WorkSidebar from "@/components/WorkSidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { useRouter, usePathname } from "next/navigation";
import type { Agent, Team, Workspace, WorkItem } from "@/lib/types";
// preloadAllChats removed — chats are loaded on-demand when opened

interface TeamWithAgents extends Team {
  agent_ids: string[];
}

type NavSection = "dashboard" | "chat" | "work" | "scheduled" | "settings";

interface AppContextValue {
  agents: Agent[];
  allAgents: Agent[];
  refreshAgents: () => Promise<void>;
  teams: TeamWithAgents[];
  refreshTeams: () => Promise<void>;
  activeDmAgentIds: string[] | null;
  refreshActiveDms: () => void;
  ensureActiveDm: (agentId: string) => void;
  activeTaskCount: number;
  refreshTaskCount: () => void;
  mobile: boolean;
  openDrawer: () => void;
  unreadCounts: Record<string, number>;
  refreshUnreadCounts: () => void;
  markRead: (conversationId: string) => void;
  setActiveChatKey: (chatKey: string | null) => void;
  hasNewActivity: boolean;
  isAdmin: boolean;
  // Workspace
  workspace: Workspace | null;
  workspaces: Workspace[];
  workspaceRole: "owner" | "admin" | "member";
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  // Reports
  reportCount: number;
  refreshReportCount: () => void;
  // Report side panel
  openReportId: string | null;
  openReport: (reportId: string, initialData?: { title: string; content: string; agent_name?: string; agent_id?: string }) => void;
  closeReport: () => void;
  // Feedback loop: called when user finishes editing a report in the panel
  reportEditCallback: React.MutableRefObject<((reportId: string, reportTitle: string, original: string, edited: string) => void) | null>;
  // Live update for report panel
  reportLiveUpdate: { report_id: string; title: string; content: string } | null;
  setReportLiveUpdate: (update: { report_id: string; title: string; content: string } | null) => void;
  // Navigation
  activeSection: NavSection;
  sidebarOpen: boolean;
  // Work items
  workItems: WorkItem[];
  refreshWorkItems: () => Promise<void>;
  workNotificationCount: number;
  markWorkNotificationsRead: () => void;
}

const AppContext = createContext<AppContextValue>({
  agents: [],
  allAgents: [],
  refreshAgents: async () => {},
  teams: [],
  refreshTeams: async () => {},
  activeDmAgentIds: null,
  refreshActiveDms: () => {},
  ensureActiveDm: () => {},
  activeTaskCount: 0,
  refreshTaskCount: () => {},
  mobile: false,
  openDrawer: () => {},
  unreadCounts: {},
  refreshUnreadCounts: () => {},
  markRead: () => {},
  setActiveChatKey: () => {},
  hasNewActivity: false,
  isAdmin: false,
  workspace: null,
  workspaces: [],
  workspaceRole: "member",
  switchWorkspace: async () => {},
  refreshWorkspace: async () => {},
  reportCount: 0,
  refreshReportCount: () => {},
  openReportId: null,
  openReport: () => {},
  closeReport: () => {},
  reportEditCallback: { current: null },
  reportLiveUpdate: null,
  setReportLiveUpdate: () => {},
  activeSection: "dashboard",
  sidebarOpen: true,
  workItems: [],
  refreshWorkItems: async () => {},
  workNotificationCount: 0,
  markWorkNotificationsRead: () => {},
});

export function useApp() {
  return useContext(AppContext);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function ResizeHandle({ onResize }: { onResize: (pct: number) => void }) {
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      // Find the flex container (parent of the handle)
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rightPct = ((rect.right - e.clientX) / rect.width) * 100;
      // Clamp between 20% and 70%
      onResize(Math.min(70, Math.max(20, rightPct)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onResize]);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className="hidden md:flex w-[3px] shrink-0 cursor-col-resize items-center justify-center group transition-colors relative hover:w-[4px]"
      style={{ background: "var(--color-border)" }}
    >
      <div className="absolute inset-0 bg-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<TeamWithAgents[]>([]);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceRole, setWorkspaceRole] = useState<"owner" | "admin" | "member">("member");
  const [reportCount, setReportCount] = useState(0);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [initialReportData, setInitialReportData] = useState<{ title: string; content: string; agent_name?: string; agent_id?: string } | null>(null);
  const [reportPanelWidth, setReportPanelWidth] = useState(50); // percentage
  const [reportLiveUpdate, setReportLiveUpdate] = useState<{ report_id: string; title: string; content: string } | null>(null);
  const [activeDmAgentIds, setActiveDmAgentIds] = useState<string[] | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const reportEditCallback = useRef<((reportId: string, reportTitle: string, original: string, edited: string) => void) | null>(null);
  const mobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  // Navigation state — persisted in localStorage
  const [activeSection, setActiveSectionState] = useState<NavSection>(() => {
    if (typeof window === "undefined") return "dashboard";
    return (localStorage.getItem("nav_section") as NavSection) || "dashboard";
  });
  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebar_open");
    return stored === null ? true : stored === "true";
  });

  // Work items state
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workNotificationCount, setWorkNotificationCount] = useState(0);

  const setActiveSection = useCallback((section: NavSection) => {
    setActiveSectionState(section);
    localStorage.setItem("nav_section", section);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    localStorage.setItem("sidebar_open", String(open));
  }, []);

  const handleNavClick = useCallback((section: NavSection) => {
    if (section === "dashboard") {
      setActiveSection("dashboard");
      router.push("/dashboard");
      return;
    }
    if (section === "settings") {
      router.push("/settings");
      return;
    }
    if (section === "scheduled") {
      router.push("/tasks");
      return;
    }

    // On mobile, tapping Chat or Work opens the drawer for navigation
    if (mobile) {
      setActiveSection(section);
      if (section === "chat") {
        setDrawerOpen(true);
      } else if (section === "work") {
        router.push("/work");
      }
      return;
    }

    // Desktop: If we're on a page that doesn't show the sidebar, navigate away
    const isOnSidebarlessPage = pathname.startsWith("/settings") || pathname.startsWith("/tasks") || pathname.startsWith("/dashboard");
    if (isOnSidebarlessPage) {
      setActiveSection(section);
      setSidebarOpen(true);
      router.push(section === "work" ? "/work" : "/chat");
      return;
    }
    if (section === activeSection) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setActiveSection(section);
      setSidebarOpen(true);
      // Navigate to the section's default page if not already there
      if (section === "work" && !pathname.startsWith("/work")) {
        router.push("/work");
      } else if (section === "chat" && pathname.startsWith("/work")) {
        router.push("/chat");
      }
    }
  }, [activeSection, sidebarOpen, setActiveSection, setSidebarOpen, router, pathname]);

  // Cmd/Ctrl+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen, setSidebarOpen]);

  // Sync activeSection with current route
  useEffect(() => {
    if (pathname.startsWith("/dashboard")) {
      if (activeSection !== "dashboard") setActiveSection("dashboard");
    } else if (pathname.startsWith("/work")) {
      if (activeSection !== "work") setActiveSection("work");
    } else if (pathname.startsWith("/settings") || pathname.startsWith("/tasks")) {
      // Don't change section for settings or tasks — accessed via icon rail
    } else {
      if (activeSection !== "chat") setActiveSection("chat");
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear work notifications when user navigates to the Work section
  useEffect(() => {
    if (pathname.startsWith("/work") && workNotificationCount > 0) {
      // markWorkNotificationsRead defined below — safe in useEffect since it runs after render
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      }).then(() => setWorkNotificationCount(0)).catch(() => {});
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAgents = useCallback(async () => {
    const [res, resAll] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/agents?include_deleted=true"),
    ]);
    if (res.ok) {
      const data = await res.json();
      setAgents(data);
    }
    if (resAll.ok) {
      const dataAll = await resAll.json();
      setAllAgents(dataAll);
    }
  }, []);

  const refreshTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data);
    }
  }, []);

  const refreshTaskCount = useCallback(() => {
    fetch("/api/scheduled-tasks")
      .then((r) => (r.ok ? r.json() : []))
      .then((tasks: { enabled: boolean }[]) => {
        setActiveTaskCount(tasks.filter((t) => t.enabled).length);
      })
      .catch(() => {});
  }, []);

  const activeChatKeyRef = useRef<string | null>(null);

  const setActiveChatKey = useCallback((chatKey: string | null) => {
    activeChatKeyRef.current = chatKey;
    // Immediately zero out unread count for the active chat
    if (chatKey) {
      setUnreadCounts((prev) => {
        if (!prev[chatKey]) return prev;
        const next = { ...prev };
        delete next[chatKey];
        return next;
      });
    }
  }, []);

  const refreshUnreadCounts = useCallback(() => {
    fetch("/api/unread-counts")
      .then((r) => (r.ok ? r.json() : {}))
      .then((counts: Record<string, number>) => {
        // Don't show unread for the chat the user is currently viewing
        const activeKey = activeChatKeyRef.current;
        if (activeKey && counts[activeKey]) {
          delete counts[activeKey];
        }
        setUnreadCounts(counts);
      })
      .catch(() => {});
  }, []);

  const checkNewActivity = useCallback(() => {
    fetch("/api/activity/latest")
      .then((r) => (r.ok ? r.json() : { latest: null }))
      .then(({ latest }) => {
        if (!latest) return;
        const lastSeen = localStorage.getItem("activity_last_seen");
        setHasNewActivity(!lastSeen || latest > lastSeen);
      })
      .catch(() => {});
  }, []);

  const openReport = useCallback((reportId: string, initialData?: { title: string; content: string; agent_name?: string; agent_id?: string }) => {
    setInitialReportData(initialData || null);
    setOpenReportId(reportId);
  }, []);

  const closeReport = useCallback(() => {
    setOpenReportId(null);
  }, []);

  const refreshReportCount = useCallback(() => {
    fetch("/api/reports?count_only=true")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setReportCount(d.count || 0))
      .catch(() => {});
  }, []);

  const refreshActiveDms = useCallback(() => {
    fetch("/api/conversations/active-dms")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { agent_id: string; last_message_at: string }[]) => {
        setActiveDmAgentIds(data.map((d) => d.agent_id));
      })
      .catch(() => {});
  }, []);

  const hideDm = useCallback((agentId: string) => {
    // Optimistic: remove immediately
    setActiveDmAgentIds((prev) => (prev ? prev.filter((id) => id !== agentId) : prev));

    // Fire API call in background
    fetch("/api/conversations/hide", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId }),
    }).then((r) => {
      if (!r.ok) throw new Error();
    }).catch(() => {
      // Rollback: re-add agent
      setActiveDmAgentIds((prev) => (prev && !prev.includes(agentId) ? [...prev, agentId] : prev));
      setSidebarError("Failed to hide conversation");
      setTimeout(() => setSidebarError(null), 3000);
    });
  }, []);

  const ensureActiveDm = useCallback((agentId: string) => {
    setActiveDmAgentIds((prev) => {
      if (!prev) return [agentId];
      if (prev.includes(agentId)) return prev;
      return [agentId, ...prev];
    });
    // Also unhide in DB so the next poll doesn't revert the optimistic update
    fetch("/api/conversations/hide", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, hidden: false }),
    }).catch(() => {});
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const [currentRes, allRes] = await Promise.all([
      fetch("/api/workspaces/current"),
      fetch("/api/workspaces"),
    ]);
    if (currentRes.ok) {
      const data = await currentRes.json();
      setWorkspace(data);
      setWorkspaceRole(data.role || "member");
    }
    if (allRes.ok) {
      const data = await allRes.json();
      setWorkspaces(data);
    }
  }, []);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const res = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    if (res.ok) {
      // Reload everything for the new workspace
      await refreshWorkspace();
      await Promise.all([refreshAgents(), refreshTeams(), refreshTaskCount(), refreshUnreadCounts()]);
      router.push("/chat");
    }
  }, [refreshWorkspace, refreshAgents, refreshTeams, refreshTaskCount, refreshUnreadCounts, router]);

  const markRead = useCallback((conversationId: string) => {
    fetch("/api/conversations/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    }).then(() => refreshUnreadCounts()).catch(() => {});
  }, [refreshUnreadCounts]);

  const refreshWorkItems = useCallback(async () => {
    try {
      const res = await fetch("/api/work-items");
      if (res.ok) {
        const data = await res.json();
        setWorkItems(data);
      } else {
        console.error("[WorkItems] Fetch failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[WorkItems] Fetch error:", err);
    }
  }, []);

  const refreshWorkNotifications = useCallback(() => {
    fetch("/api/notifications?unread_only=true")
      .then((r) => (r.ok ? r.json() : { unread_count: 0 }))
      .then((d) => setWorkNotificationCount(d.unread_count || 0))
      .catch(() => {});
  }, []);

  const markWorkNotificationsRead = useCallback(() => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    }).then(() => setWorkNotificationCount(0)).catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/");
      } else {
        setChecked(true);
        refreshWorkspace();
        refreshAgents();
        refreshTeams();
        refreshActiveDms();
        refreshTaskCount();
        refreshUnreadCounts();
        checkNewActivity();
        refreshReportCount();
        refreshWorkItems();
        refreshWorkNotifications();
        fetch("/api/admin/check").then(r => r.ok ? r.json() : { isAdmin: false }).then(d => setIsAdmin(d.isAdmin)).catch(() => {});
      }
    });
  }, [supabase, router, refreshAgents, refreshTeams, refreshActiveDms, refreshTaskCount, refreshUnreadCounts, checkNewActivity, refreshWorkspace, refreshReportCount, refreshWorkItems, refreshWorkNotifications]);

  // Poll for unread counts and new activity — pause when tab is hidden
  useEffect(() => {
    if (!checked) return;
    let tickCount = 0;
    const interval = setInterval(() => {
      // Don't poll when tab is hidden — saves resources
      if (document.hidden) return;
      tickCount++;
      // Fast poll (every 30s): unread counts, notifications
      refreshUnreadCounts();
      refreshWorkNotifications();
      // Slow poll (every 60s): agents, teams, active DMs, activity
      if (tickCount % 2 === 0) {
        checkNewActivity();
        refreshAgents();
        refreshTeams();
        refreshActiveDms();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [checked, refreshUnreadCounts, checkNewActivity, refreshAgents, refreshTeams, refreshActiveDms, refreshWorkNotifications]);

  // Realtime: listen for new conversations (cross-tab, background tasks)
  useEffect(() => {
    if (!checked) return;
    const channel = supabase
      .channel("sidebar-conversations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        () => {
          refreshActiveDms();
          refreshTeams();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          refreshActiveDms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checked, supabase, refreshActiveDms, refreshTeams]);

  if (!checked) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  const workspaceInitial = workspace?.name?.charAt(0)?.toUpperCase() || "O";
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isSettingsPage = pathname.startsWith("/settings");
  const isTasksPage = pathname.startsWith("/tasks");
  const isSidebarlessPage = isDashboardPage || isSettingsPage || isTasksPage;

  // Determine which icon should be highlighted in the rail
  const railActiveSection: "dashboard" | "chat" | "work" | "scheduled" | "settings" = isDashboardPage
    ? "dashboard"
    : isSettingsPage
    ? "settings"
    : isTasksPage
    ? "scheduled"
    : activeSection;

  return (
    <AppContext value={{ agents, allAgents, refreshAgents, teams, refreshTeams, activeDmAgentIds, refreshActiveDms, ensureActiveDm, activeTaskCount, refreshTaskCount, mobile, openDrawer: () => setDrawerOpen(true), unreadCounts, refreshUnreadCounts, markRead, setActiveChatKey, hasNewActivity, isAdmin, workspace, workspaces, workspaceRole, switchWorkspace, refreshWorkspace, reportCount, refreshReportCount, openReportId, openReport, closeReport, reportEditCallback, reportLiveUpdate, setReportLiveUpdate, activeSection, sidebarOpen, workItems, refreshWorkItems, workNotificationCount, markWorkNotificationsRead }}>
      <div className="flex flex-col md:flex-row h-screen w-full bg-[var(--color-page-bg)] overflow-hidden">
        {/* Icon Rail — desktop only */}
        <div className="hidden md:flex">
          <IconRail
            activeSection={railActiveSection}
            onNavClick={handleNavClick}
            workspaceInitial={workspaceInitial}
            workspace={workspace}
            workspaces={workspaces}
            onSwitchWorkspace={switchWorkspace}
            workNotificationCount={workNotificationCount}
          />
        </div>

        {/* Collapsible sidebar — desktop only, hidden on settings/tasks pages */}
        {!isSidebarlessPage && (
          <div
            className="hidden md:flex flex-shrink-0 overflow-hidden bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] flex-col"
            style={{
              width: sidebarOpen ? "280px" : "0px",
              transition: "width 200ms ease-in-out",
            }}
          >
            <div className="w-[280px] h-full flex flex-col min-w-[280px]">
              {activeSection === "chat" && (
                <SidebarContent agents={agents} teams={teams} activeDmAgentIds={activeDmAgentIds} activeTaskCount={activeTaskCount} unreadCounts={unreadCounts} hasNewActivity={hasNewActivity} isAdmin={isAdmin} workspace={workspace} workspaces={workspaces} workspaceRole={workspaceRole} onSwitchWorkspace={switchWorkspace} reportCount={reportCount} onHideDm={hideDm} />
              )}
              {activeSection === "work" && (
                <WorkSidebar
                  workItems={workItems}
                  selectedId={pathname.startsWith("/work/") ? pathname.split("/work/")[1] : null}
                  onSelect={(id) => router.push(`/work/${id}`)}
                  onNew={() => router.push("/work/new")}
                  agents={agents.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
                  onAssignAgent={async (workItemId, agentId) => {
                    try {
                      await fetch(`/api/work-items/${workItemId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ agent_id: agentId }),
                      });
                      refreshWorkItems();
                    } catch {}
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Mobile drawer — always mounted, visibility controlled by open state */}
        <Drawer
          agents={agents}
          teams={teams}
          activeDmAgentIds={activeDmAgentIds}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTaskCount={activeTaskCount}
          unreadCounts={unreadCounts}
          hasNewActivity={hasNewActivity}
          isAdmin={isAdmin}
          workspace={workspace}
          workspaces={workspaces}
          workspaceRole={workspaceRole}
          onSwitchWorkspace={switchWorkspace}
          reportCount={reportCount}
          onHideDm={hideDm}
        />

        {/* Main content area — fills between top and bottom tab bar on mobile */}
        <div className="flex-1 flex flex-row overflow-hidden min-w-0">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {children}
          </div>
          {openReportId && (
            <>
              <ResizeHandle onResize={setReportPanelWidth} />
              <div
                className="hidden md:flex flex-col overflow-hidden"
                style={{ width: `${reportPanelWidth}%`, minWidth: 300 }}
              >
                <ReportPanel
                  reportId={openReportId}
                  onClose={closeReport}
                  onDoneEditing={(report, original, edited) => {
                    if (reportEditCallback.current) {
                      reportEditCallback.current(report.id, report.title, original, edited);
                    }
                  }}
                  liveUpdate={reportLiveUpdate}
                  initialData={initialReportData}
                />
              </div>
            </>
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar
          activeSection={railActiveSection}
          onNavClick={handleNavClick}
          workNotificationCount={workNotificationCount}
        />
      </div>
      {sidebarError && (
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {sidebarError}
        </div>
      )}
    </AppContext>
  );
}
