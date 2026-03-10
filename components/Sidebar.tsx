"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { HashIcon, GearIcon, XIcon, ClockIcon, PlusIcon, RepeatClockIcon, ActivityIcon, SunIcon, MoonIcon } from "./Icons";
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
}) {
  const pathname = usePathname();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-5">
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

        <div className="px-2 pt-2 pb-1.5">
          <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Channels
          </span>
        </div>
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
        {teams.map((team) => {
          const teamUnread = unreadCounts[`team:${team.id}`] || 0;
          return (
            <NavItem
              key={team.id}
              href={`/team/${team.id}`}
              isActive={pathname === `/team/${team.id}`}
            >
              <span className="opacity-60">
                <HashIcon />
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
        {canManage && (
          <Link
            href="/team/new"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg w-full text-[13px] no-underline transition-colors font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)]"
          >
            <span className="opacity-60">
              <PlusIcon />
            </span>
            <span>New team</span>
          </Link>
        )}
        <NavItem href="/history" isActive={pathname === "/history"}>
          <span className="opacity-60">
            <ClockIcon />
          </span>
          <span>History</span>
        </NavItem>

        {agents.length > 0 && (
          <>
            <div className="px-2 pt-4 pb-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Direct messages
              </span>
            </div>
            {agents.map((a) => {
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
        />
      </div>
    </>
  );
}
