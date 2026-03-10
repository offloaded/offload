"use client";

import { useEffect, useState, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase";
import { SidebarContent, Drawer } from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import type { Agent, Team, Workspace } from "@/lib/types";
import { preloadAllChats } from "@/lib/chat-cache";

interface TeamWithAgents extends Team {
  agent_ids: string[];
}

interface AppContextValue {
  agents: Agent[];
  refreshAgents: () => Promise<void>;
  teams: TeamWithAgents[];
  refreshTeams: () => Promise<void>;
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
}

const AppContext = createContext<AppContextValue>({
  agents: [],
  refreshAgents: async () => {},
  teams: [],
  refreshTeams: async () => {},
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
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
  const mobile = useIsMobile();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const refreshAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data);
      preloadAllChats(data.map((a: Agent) => a.id));
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

  const refreshReportCount = useCallback(() => {
    fetch("/api/reports?count_only=true")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setReportCount(d.count || 0))
      .catch(() => {});
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/");
      } else {
        setChecked(true);
        refreshWorkspace();
        refreshAgents();
        refreshTeams();
        refreshTaskCount();
        refreshUnreadCounts();
        checkNewActivity();
        refreshReportCount();
        fetch("/api/admin/check").then(r => r.ok ? r.json() : { isAdmin: false }).then(d => setIsAdmin(d.isAdmin)).catch(() => {});
      }
    });
  }, [supabase, router, refreshAgents, refreshTeams, refreshTaskCount, refreshUnreadCounts, checkNewActivity, refreshWorkspace, refreshReportCount]);

  // Poll for unread counts and new activity every 20 seconds
  useEffect(() => {
    if (!checked) return;
    const interval = setInterval(() => {
      refreshUnreadCounts();
      checkNewActivity();
      refreshAgents();
      refreshTeams();
    }, 20_000);
    return () => clearInterval(interval);
  }, [checked, refreshUnreadCounts, checkNewActivity, refreshAgents, refreshTeams]);

  if (!checked) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <AppContext value={{ agents, refreshAgents, teams, refreshTeams, activeTaskCount, refreshTaskCount, mobile, openDrawer: () => setDrawerOpen(true), unreadCounts, refreshUnreadCounts, markRead, setActiveChatKey, hasNewActivity, isAdmin, workspace, workspaces, workspaceRole, switchWorkspace, refreshWorkspace, reportCount, refreshReportCount }}>
      <div className="flex h-screen w-full bg-[var(--color-page-bg)] overflow-hidden">
        {/* Desktop sidebar — hidden below 768px via CSS */}
        <div className="hidden md:flex w-[220px] min-w-[220px] bg-[var(--color-bg)] border-r border-[var(--color-border)] flex-col">
          <SidebarContent agents={agents} teams={teams} activeTaskCount={activeTaskCount} unreadCounts={unreadCounts} hasNewActivity={hasNewActivity} isAdmin={isAdmin} workspace={workspace} workspaces={workspaces} workspaceRole={workspaceRole} onSwitchWorkspace={switchWorkspace} reportCount={reportCount} />
        </div>

        {/* Mobile drawer — always mounted, visibility controlled by open state */}
        <Drawer
          agents={agents}
          teams={teams}
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
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </AppContext>
  );
}
