"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { HashIcon, GearIcon, XIcon, ClockIcon, PlusIcon, RepeatClockIcon, ActivityIcon, SunIcon, MoonIcon, PeopleIcon, LockIcon, StorefrontIcon, SearchIcon, ReportIcon, ChevronDownIcon } from "./Icons";
import { createClient } from "@/lib/supabase";
import type { Agent, Team, Workspace } from "@/lib/types";

interface TeamWithAgents extends Team {
  agent_ids: string[];
}

function NavItem({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-[14px] no-underline transition-colors"
      style={{
        background: isActive ? "var(--color-accent-soft)" : "transparent",
        color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
        fontWeight: isActive ? 600 : 500,
      }}
    >
      {children}
    </Link>
  );
}

function SectionHeader({
  label,
  collapsed,
  onToggle,
  totalUnread,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  totalUnread?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 px-2 pt-3 pb-1.5 w-full bg-transparent border-none cursor-pointer text-left group"
    >
      <span
        className="transition-transform duration-150 text-[var(--color-text-tertiary)]"
        style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
      >
        <ChevronDownIcon />
      </span>
      <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider flex-1">
        {label}
      </span>
      {collapsed && totalUnread ? (
        <span className="text-[10px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[16px] text-center leading-none">
          {totalUnread}
        </span>
      ) : null}
    </button>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setDark(!dark);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-[14px] bg-transparent border-none cursor-pointer transition-colors font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
    >
      <span className="opacity-60">
        {dark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function WorkspaceSwitcher({
  workspace,
  workspaces,
  onSwitch,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!workspace) return null;

  const initial = workspace.name.charAt(0).toUpperCase();
  const hasMultiple = workspaces.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => hasMultiple && setOpen(!open)}
        className="w-full px-2.5 py-2.5 rounded-lg border border-[var(--color-border-light)] flex items-center gap-2.5 bg-transparent text-left transition-colors hover:bg-[var(--color-hover)]"
        style={{ cursor: hasMultiple ? "pointer" : "default" }}
      >
        <div className="w-7 h-7 rounded-md bg-[var(--color-active)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-secondary)]">
          {initial}
        </div>
        <div className="flex-1 min-w-0 text-[13px] font-medium text-[var(--color-text)] truncate">
          {workspace.name}
        </div>
        {hasMultiple && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-tertiary)] shrink-0">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                if (ws.id !== workspace.id) onSwitch(ws.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-none cursor-pointer transition-colors"
              style={{
                background: ws.id === workspace.id ? "var(--color-hover)" : "transparent",
              }}
            >
              <div className="w-6 h-6 rounded-md bg-[var(--color-active)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-secondary)]">
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-text)] truncate">{ws.name}</div>
                {ws.role && (
                  <div className="text-[11px] text-[var(--color-text-tertiary)]">{ws.role}</div>
                )}
              </div>
              {ws.id === workspace.id && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarContent({
  agents,
  teams = [],
  showClose,
  onClose,
  activeTaskCount = 0,
  unreadCounts = {},
  hasNewActivity = false,
  isAdmin = false,
  workspace = null,
  workspaces = [],
  workspaceRole = "member",
  onSwitchWorkspace,
  reportCount = 0,
}: {
  agents: Agent[];
  teams?: TeamWithAgents[];
  showClose?: boolean;
  onClose?: () => void;
  activeTaskCount?: number;
  unreadCounts?: Record<string, number>;
  hasNewActivity?: boolean;
  isAdmin?: boolean;
  workspace?: Workspace | null;
  workspaces?: Workspace[];
  workspaceRole?: "owner" | "admin" | "member";
  onSwitchWorkspace?: (id: string) => void;
  reportCount?: number;
}) {
  const pathname = usePathname();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  // Collapsible state with localStorage persistence
  const [channelsCollapsed, setChannelsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_channels_collapsed") === "true";
  });
  const [dmsCollapsed, setDmsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_dms_collapsed") === "true";
  });

  // Search filter
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleChannels = () => {
    const next = !channelsCollapsed;
    setChannelsCollapsed(next);
    localStorage.setItem("sidebar_channels_collapsed", String(next));
  };

  const toggleDms = () => {
    const next = !dmsCollapsed;
    setDmsCollapsed(next);
    localStorage.setItem("sidebar_dms_collapsed", String(next));
  };

  // Compute total unread counts for collapsed headers
  const channelUnread = useMemo(() => {
    let total = unreadCounts["group"] || 0;
    for (const t of teams) {
      total += unreadCounts[`team:${t.id}`] || 0;
    }
    return total;
  }, [unreadCounts, teams]);

  const dmUnread = useMemo(() => {
    let total = 0;
    for (const a of agents) {
      total += unreadCounts[a.id] || 0;
    }
    return total;
  }, [unreadCounts, agents]);

  // Filter channels and DMs by search
  const lowerSearch = search.toLowerCase();
  const filteredTeams = useMemo(() => {
    if (!lowerSearch) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(lowerSearch));
  }, [teams, lowerSearch]);

  const filteredAgents = useMemo(() => {
    if (!lowerSearch) return agents;
    return agents.filter((a) =>
      a.name.toLowerCase().includes(lowerSearch) ||
      (a.role && a.role.toLowerCase().includes(lowerSearch))
    );
  }, [agents, lowerSearch]);

  // When searching, expand both sections
  const showChannels = search ? true : !channelsCollapsed;
  const showDms = search ? true : !dmsCollapsed;

  // Show "All" channel in search
  const showAllChannel = !lowerSearch || "all".includes(lowerSearch);

  // When collapsed (no search), show items with unread as priority peek
  const unreadChannelPeek = useMemo(() => {
    if (!channelsCollapsed || search) return [];
    const items: { type: "group" | "team"; team?: TeamWithAgents }[] = [];
    if ((unreadCounts["group"] || 0) > 0) items.push({ type: "group" });
    for (const t of teams) {
      if ((unreadCounts[`team:${t.id}`] || 0) > 0) items.push({ type: "team", team: t });
    }
    return items;
  }, [channelsCollapsed, search, unreadCounts, teams]);

  const unreadDmPeek = useMemo(() => {
    if (!dmsCollapsed || search) return [];
    return agents.filter((a) => (unreadCounts[a.id] || 0) > 0);
  }, [dmsCollapsed, search, unreadCounts, agents]);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="text-[17px] font-bold text-[var(--color-text)] tracking-tight">
          Offload
        </span>
        {showClose && (
          <button
            onClick={onClose}
            className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex"
          >
            <XIcon />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-input-bg)] border border-[var(--color-border-light)]">
          <span className="text-[var(--color-text-tertiary)] shrink-0">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0 flex"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-2 flex flex-col gap-0.5 overflow-auto">
        <NavItem href="/activity" isActive={pathname === "/activity"}>
          <span className="opacity-60">
            <ActivityIcon />
          </span>
          <span className="flex-1">Activity</span>
          {hasNewActivity && pathname !== "/activity" && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
          )}
        </NavItem>

        {/* Channels section — collapsible */}
        <SectionHeader
          label="Channels"
          collapsed={channelsCollapsed && !search}
          onToggle={toggleChannels}
          totalUnread={channelUnread}
        />

        {showChannels ? (
          <>
            {showAllChannel && (
              <NavItem href="/chat" isActive={pathname === "/chat" || pathname.startsWith("/chat?")}>
                <span className="opacity-60">
                  <HashIcon />
                </span>
                <span className="flex-1"># All</span>
                {(unreadCounts["group"] || 0) > 0 && (
                  <span className="text-[11px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {unreadCounts["group"]}
                  </span>
                )}
              </NavItem>
            )}
            {/* System channels first */}
            {filteredTeams.filter((t) => t.is_system).map((team) => {
              const teamUnread = unreadCounts[`team:${team.id}`] || 0;
              return (
                <NavItem
                  key={team.id}
                  href={`/team/${team.id}`}
                  isActive={pathname === `/team/${team.id}`}
                >
                  <span className="opacity-60">
                    <PeopleIcon />
                  </span>
                  <span className="flex-1 flex items-center gap-1">
                    <span># {team.name}</span>
                  </span>
                  {teamUnread > 0 && (
                    <span className="text-[11px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {teamUnread}
                    </span>
                  )}
                </NavItem>
              );
            })}
            {/* Regular channels */}
            {filteredTeams.filter((t) => !t.is_system).map((team) => {
              const teamUnread = unreadCounts[`team:${team.id}`] || 0;
              return (
                <NavItem
                  key={team.id}
                  href={`/team/${team.id}`}
                  isActive={pathname === `/team/${team.id}`}
                >
                  <span className="opacity-60">
                    {team.visibility === "private" ? <LockIcon /> : <HashIcon />}
                  </span>
                  <span className="flex-1"># {team.name}</span>
                  {teamUnread > 0 && (
                    <span className="text-[11px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {teamUnread}
                    </span>
                  )}
                </NavItem>
              );
            })}
            {canManage && !search && (
              <Link
                href="/team/new"
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg w-full text-[13px] no-underline transition-colors font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)]"
              >
                <span className="opacity-60">
                  <PlusIcon />
                </span>
                <span>New channel</span>
              </Link>
            )}
          </>
        ) : (
          /* Collapsed peek: show channels with unread */
          unreadChannelPeek.length > 0 && (
            <>
              {unreadChannelPeek.map((item) =>
                item.type === "group" ? (
                  <NavItem key="group" href="/chat" isActive={pathname === "/chat"}>
                    <span className="opacity-60"><HashIcon /></span>
                    <span className="flex-1"># All</span>
                    <span className="text-[11px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {unreadCounts["group"]}
                    </span>
                  </NavItem>
                ) : item.team ? (
                  <NavItem key={item.team.id} href={`/team/${item.team.id}`} isActive={pathname === `/team/${item.team.id}`}>
                    <span className="opacity-60">
                      {item.team.is_system ? <PeopleIcon /> : item.team.visibility === "private" ? <LockIcon /> : <HashIcon />}
                    </span>
                    <span className="flex-1"># {item.team.name}</span>
                    <span className="text-[11px] font-semibold bg-[var(--color-accent)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {unreadCounts[`team:${item.team.id}`]}
                    </span>
                  </NavItem>
                ) : null
              )}
            </>
          )
        )}

        <NavItem href="/history" isActive={pathname === "/history"}>
          <span className="opacity-60">
            <ClockIcon />
          </span>
          <span>History</span>
        </NavItem>
        <NavItem href="/marketplace" isActive={pathname === "/marketplace" || pathname.startsWith("/marketplace/")}>
          <span className="opacity-60">
            <StorefrontIcon />
          </span>
          <span>Marketplace</span>
        </NavItem>
        <NavItem href="/reports" isActive={pathname === "/reports" || pathname.startsWith("/reports/")}>
          <span className="opacity-60">
            <ReportIcon />
          </span>
          <span className="flex-1">Reports</span>
          {reportCount > 0 && (
            <span className="text-[11px] font-semibold bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {reportCount}
            </span>
          )}
        </NavItem>

        {/* Direct messages section — collapsible with internal scroll */}
        {agents.length > 0 && (
          <>
            <SectionHeader
              label="Direct messages"
              collapsed={dmsCollapsed && !search}
              onToggle={toggleDms}
              totalUnread={dmUnread}
            />

            {showDms ? (
              <div className="flex flex-col gap-0.5" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                {filteredAgents.map((a) => {
                  const unread = unreadCounts[a.id] || 0;
                  return (
                    <NavItem
                      key={a.id}
                      href={`/agent/${a.id}`}
                      isActive={pathname === `/agent/${a.id}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: a.color,
                          opacity: pathname === `/agent/${a.id}` ? 1 : 0.5,
                        }}
                      />
                      <span className="flex-1 truncate">
                        {a.name}
                        {a.role && (
                          <span className="text-[11px] text-[var(--color-text-tertiary)] font-normal ml-1.5">{a.role}</span>
                        )}
                      </span>
                      {unread > 0 && (
                        <span
                          className="text-[11px] font-semibold text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
                          style={{ background: a.color }}
                        >
                          {unread}
                        </span>
                      )}
                    </NavItem>
                  );
                })}
              </div>
            ) : (
              /* Collapsed peek: show DMs with unread */
              unreadDmPeek.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {unreadDmPeek.map((a) => (
                    <NavItem
                      key={a.id}
                      href={`/agent/${a.id}`}
                      isActive={pathname === `/agent/${a.id}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: a.color }}
                      />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span
                        className="text-[11px] font-semibold text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
                        style={{ background: a.color }}
                      >
                        {unreadCounts[a.id]}
                      </span>
                    </NavItem>
                  ))}
                </div>
              )
            )}
          </>
        )}

        <div className="flex-1" />

        <div className="py-1 border-t border-[var(--color-border-light)] mt-2 pt-3 flex flex-col gap-0.5">
          {canManage && (
            <Link
              href="/settings/new"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-[14px] no-underline transition-colors font-medium border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
            >
              <span className="opacity-70">
                <PlusIcon />
              </span>
              <span>Create agent</span>
            </Link>
          )}
          <NavItem
            href="/tasks"
            isActive={pathname === "/tasks"}
          >
            <span className="opacity-60">
              <RepeatClockIcon />
            </span>
            <span className="flex-1">Scheduled</span>
            {activeTaskCount > 0 && (
              <span className="text-[11px] font-semibold bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {activeTaskCount}
              </span>
            )}
          </NavItem>
          <NavItem
            href="/settings"
            isActive={pathname === "/settings" || pathname.startsWith("/settings/") && !pathname.startsWith("/settings/members")}
          >
            <span className="opacity-60">
              <GearIcon />
            </span>
            <span>Settings</span>
          </NavItem>
          <NavItem
            href="/settings/members"
            isActive={pathname === "/settings/members"}
          >
            <span className="opacity-60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
            <span>Members</span>
          </NavItem>
          {isAdmin && (
            <NavItem href="/admin" isActive={false}>
              <span className="opacity-60">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </span>
              <span>Admin</span>
            </NavItem>
          )}
          <ThemeToggle />
        </div>
      </div>

      <div className="px-2 pt-2 pb-3">
        <WorkspaceSwitcher
          workspace={workspace}
          workspaces={workspaces}
          onSwitch={onSwitchWorkspace || (() => {})}
        />
        <LogOutButton />
      </div>
    </>
  );
}

function LogOutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full mt-2 px-2.5 py-2 bg-transparent border-none text-[13px] text-[var(--color-text-tertiary)] cursor-pointer text-left hover:text-[var(--color-text-secondary)] transition-colors"
    >
      Log out
    </button>
  );
}

export function Drawer({
  agents,
  teams,
  open,
  onClose,
  activeTaskCount,
  unreadCounts,
  hasNewActivity,
  isAdmin,
  workspace,
  workspaces,
  workspaceRole,
  onSwitchWorkspace,
  reportCount,
}: {
  agents: Agent[];
  teams?: TeamWithAgents[];
  open: boolean;
  onClose: () => void;
  activeTaskCount?: number;
  unreadCounts?: Record<string, number>;
  hasNewActivity?: boolean;
  isAdmin?: boolean;
  workspace?: Workspace | null;
  workspaces?: Workspace[];
  workspaceRole?: "owner" | "admin" | "member";
  onSwitchWorkspace?: (id: string) => void;
  reportCount?: number;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.15)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />
      <div
        className="fixed top-0 left-0 bottom-0 w-[270px] bg-[var(--color-surface)] z-[300] flex flex-col border-r border-[var(--color-border)] transition-transform duration-300"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <SidebarContent
          agents={agents}
          teams={teams}
          showClose
          onClose={onClose}
          activeTaskCount={activeTaskCount}
          unreadCounts={unreadCounts}
          hasNewActivity={hasNewActivity}
          isAdmin={isAdmin}
          workspace={workspace}
          workspaces={workspaces}
          workspaceRole={workspaceRole}
          onSwitchWorkspace={onSwitchWorkspace}
          reportCount={reportCount}
        />
      </div>
    </>
  );
}
