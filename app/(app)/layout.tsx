"use client";

import { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase";
import { SidebarContent, Drawer } from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/types";
import { preloadAllChats } from "@/lib/chat-cache";

interface AppContextValue {
  agents: Agent[];
  refreshAgents: () => Promise<void>;
  mobile: boolean;
  openDrawer: () => void;
}

const AppContext = createContext<AppContextValue>({
  agents: [],
  refreshAgents: async () => {},
  mobile: false,
  openDrawer: () => {},
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checked, setChecked] = useState(false);
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth");
      } else {
        setChecked(true);
        refreshAgents();
      }
    });
  }, [supabase, router, refreshAgents]);

  if (!checked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  return (
    <AppContext value={{ agents, refreshAgents, mobile, openDrawer: () => setDrawerOpen(true) }}>
      <div className="flex h-screen w-screen bg-[var(--color-page-bg)] overflow-hidden">
        {/* Desktop sidebar — hidden below 768px via CSS */}
        <div className="hidden md:flex w-[220px] min-w-[220px] bg-[var(--color-bg)] border-r border-[var(--color-border)] flex-col">
          <SidebarContent agents={agents} />
        </div>

        {/* Mobile drawer — always mounted, visibility controlled by open state */}
        <Drawer
          agents={agents}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </AppContext>
  );
}
