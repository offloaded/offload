"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { HashIcon, GearIcon, XIcon, ClockIcon, PlusIcon, RepeatClockIcon, ActivityIcon, SunIcon, MoonIcon, PeopleIcon, LockIcon, StorefrontIcon, SearchIcon, ReportIcon, ChevronDownIcon } from "./Icons";
import { createClient } from "@/lib/supabase";
import type { Agent, Team, Workspace, WorkspaceMember } from "@/lib/types";
import { useApp } from "@/app/(app)/layout";

interface TeamWithAgents extends Team {
  agent_ids: string[];
}

/* ── NavItem ── */
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
      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg w-full text-[13px] no-underline transition-colors ${
        isActive
          ? "bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-medium"
          : "hover:bg-[var(--color-hover)] font-normal"
      }`}
      style={{
        color: isActive ? "var(--color-text)" : "var(--color-text-secondary)",
      }}
    >
      {children}
    </Link>
  );
}

/* ── Section Header ── */
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
      className="flex items-center gap-1.5 px-2.5 pt-5 pb-1 w-full bg-transparent border-none cursor-pointer text-left group"
    >
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        className="text-[var(--color-text-tertiary)] transition-transform duration-150 shrink-0"
        style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}
      >
        <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] flex-1">
        {label}
      </span>
      {collapsed && totalUnread ? (
        <span className="text-[10px] font-semibold bg-[var(--color-accent)] text-white rounded-full w-[18px] h-[18px] flex items-center justify-center leading-none">
          {totalUnread}
        </span>
      ) : null}
    </button>
  );
}

/* ── Theme Toggle ── */
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
      className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg w-full text-[13px] bg-transparent border-none cursor-pointer transition-colors font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
    >
      <span className="opacity-50 w-4 flex items-center justify-center">
        {dark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

/* ── Workspace Switcher ── */
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
        className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] text-left transition-all hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ cursor: hasMultiple ? "pointer" : "default" }}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-[13px] font-bold text-white shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--color-text)] truncate">{workspace.name}</div>
        </div>
        {hasMultiple && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-tertiary)] shrink-0">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                if (ws.id !== workspace.id) onSwitch(ws.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-none cursor-pointer transition-colors"
              style={{
                background: ws.id === workspace.id ? "var(--color-hover)" : "transparent",
              }}
            >
              <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-[11px] font-bold text-white">
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-text)] truncate">{ws.name}</div>
                {ws.role && (
                  <div className="text-[11px] text-[var(--color-text-tertiary)] capitalize">{ws.role}</div>
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

/* ── Unread Badge ── */
function UnreadBadge({ count, color }: { count: number; color?: string }) {
  return (
    <span
      className="text-[10px] font-semibold text-white rounded-full w-[18px] h-[18px] flex items-center justify-center leading-none shrink-0"
      style={{ background: color || "var(--color-accent)" }}
    >
      {count}
    </span>
  );
}

/* ── Compose Modal ── */
interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  workspaceId: string | null;
  canCreateTeam: boolean;
}

interface Participant {
  type: "agent" | "member";
  id: string;
  name: string;
  role?: string | null;
  color?: string;
  email?: string | null;
}

function ComposeModal({ open, onClose, agents, workspaceId, canCreateTeam }: ComposeModalProps) {
  const router = useRouter();
  const { refreshTeams, refreshActiveDms } = useApp();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Participant[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [teamName, setTeamName] = useState("");
  const [showTeamName, setShowTeamName] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !workspaceId) return;
    fetch("/api/workspaces/members")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: WorkspaceMember[]) => setMembers(data))
      .catch(() => {});
  }, [open, workspaceId]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected([]);
      setTeamName("");
      setShowTeamName(false);
      setCreating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const lowerSearch = search.toLowerCase();

  const filteredParticipants = useMemo(() => {
    const results: Participant[] = [];
    const selectedIds = new Set(selected.map((s) => `${s.type}:${s.id}`));
    for (const a of agents) {
      if (selectedIds.has(`agent:${a.id}`)) continue;
      if (lowerSearch && !a.name.toLowerCase().includes(lowerSearch) && !(a.role && a.role.toLowerCase().includes(lowerSearch))) continue;
      results.push({ type: "agent", id: a.id, name: a.name, role: a.role, color: a.color });
    }
    for (const m of members) {
      if (selectedIds.has(`member:${m.user_id}`)) continue;
      const displayName = m.display_name || m.email || "Member";
      if (lowerSearch && !displayName.toLowerCase().includes(lowerSearch) && !(m.email && m.email.toLowerCase().includes(lowerSearch))) continue;
      results.push({ type: "member", id: m.user_id, name: displayName, email: m.email, role: m.role });
    }
    return results;
  }, [agents, members, selected, lowerSearch]);

  const addParticipant = useCallback((p: Participant) => {
    setSelected((prev) => [...prev, p]);
    setSearch("");
    inputRef.current?.focus();
  }, []);

  const removeParticipant = useCallback((id: string, type: string) => {
    setSelected((prev) => prev.filter((p) => !(p.id === id && p.type === type)));
  }, []);

  const handleGo = useCallback(async () => {
    if (selected.length === 0) return;
    if (selected.length === 1 && selected[0].type === "agent") {
      onClose();
      router.push(`/agent/${selected[0].id}`);
      return;
    }
    if (!showTeamName) { setShowTeamName(true); return; }
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const agentIds = selected.filter((p) => p.type === "agent").map((p) => p.id);
      const memberIds = selected.filter((p) => p.type === "member").map((p) => p.id);
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim(), description: "", agent_ids: agentIds, visibility: memberIds.length > 0 ? "private" : "public", member_ids: memberIds.length > 0 ? memberIds : undefined }),
      });
      if (res.ok) {
        const team = await res.json();
        refreshTeams();
        onClose();
        router.push(`/team/${team.id}`);
      }
    } finally { setCreating(false); }
  }, [selected, showTeamName, teamName, onClose, router, refreshTeams, refreshActiveDms]);

  if (!open) return null;

  const needsTeamName = selected.length > 1 || (selected.length === 1 && selected[0].type === "member");
  const buttonLabel = selected.length === 0 ? "Select participants" : selected.length === 1 && selected[0].type === "agent" ? "Open DM" : showTeamName ? creating ? "Creating..." : "Create Team" : "Next";

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        ref={modalRef}
        className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[440px] max-w-[90vw] max-h-[60vh] flex flex-col overflow-hidden"
        style={{ animation: "fade-in 0.15s ease" }}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <span className="text-[15px] font-semibold text-[var(--color-text)]">New conversation</span>
          <button onClick={onClose} className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1 flex rounded-lg hover:bg-[var(--color-hover)]">
            <XIcon />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {selected.map((p) => (
              <span key={`${p.type}:${p.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                {p.type === "agent" && <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />}
                {p.name}
                <button onClick={() => removeParticipant(p.id, p.type)} className="bg-transparent border-none text-[var(--color-accent)] cursor-pointer p-0 flex ml-0.5 hover:opacity-70"><XIcon /></button>
              </span>
            ))}
            <input
              ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={selected.length === 0 ? "Search agents or members..." : "Add more..."}
              className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] py-1"
              onKeyDown={(e) => { if (e.key === "Backspace" && !search && selected.length > 0) { const last = selected[selected.length - 1]; removeParticipant(last.id, last.type); } }}
            />
          </div>
        </div>

        {showTeamName && needsTeamName && (
          <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5 block">Team name</label>
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Marketing, Scrum..." className="w-full bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]" autoFocus onKeyDown={(e) => { if (e.key === "Enter" && teamName.trim()) handleGo(); }} />
          </div>
        )}

        {!showTeamName && (
          <div className="flex-1 overflow-y-auto py-1">
            {filteredParticipants.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-[var(--color-text-tertiary)]">
                {search ? "No matches found" : "No participants available"}
              </div>
            ) : (
              filteredParticipants.map((p) => (
                <button key={`${p.type}:${p.id}`} onClick={() => addParticipant(p)} className="w-full flex items-center gap-3 px-5 py-2.5 bg-transparent border-none cursor-pointer text-left hover:bg-[var(--color-hover)] transition-colors">
                  {p.type === "agent" ? (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0" style={{ background: `${p.color}16`, color: p.color }}>{p.name.charAt(0)}</div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-active)] flex items-center justify-center text-[12px] font-semibold text-[var(--color-text-tertiary)] shrink-0">{p.name.charAt(0)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--color-text)] truncate">{p.name}</div>
                    {p.role && <div className="text-[11px] text-[var(--color-text-tertiary)]">{p.role}</div>}
                    {p.type === "member" && p.email && p.email !== p.name && <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">{p.email}</div>}
                  </div>
                  <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase bg-[var(--color-active)] px-1.5 py-0.5 rounded">{p.type === "agent" ? "Agent" : "Member"}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0">
          <button
            onClick={handleGo}
            disabled={selected.length === 0 || creating || (showTeamName && !teamName.trim()) || (!canCreateTeam && needsTeamName)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:cursor-default disabled:opacity-40 transition-colors"
            style={{ background: selected.length > 0 ? "var(--color-accent)" : "var(--color-active)", color: selected.length > 0 ? "#fff" : "var(--color-text-tertiary)" }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Sidebar Content ── */
export function SidebarContent({
  agents,
  teams = [],
  activeDmAgentIds = null,
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
  onHideDm,
}: {
  agents: Agent[];
  teams?: TeamWithAgents[];
  activeDmAgentIds?: string[] | null;
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
  onHideDm?: (agentId: string) => void;
}) {
  const pathname = usePathname();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  const [channelsCollapsed, setChannelsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_teams_collapsed") === "true";
  });
  const [dmsCollapsed, setDmsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_dms_collapsed") === "true";
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleChannels = () => { const next = !channelsCollapsed; setChannelsCollapsed(next); localStorage.setItem("sidebar_teams_collapsed", String(next)); };
  const toggleDms = () => { const next = !dmsCollapsed; setDmsCollapsed(next); localStorage.setItem("sidebar_dms_collapsed", String(next)); };

  const channelUnread = useMemo(() => {
    let total = unreadCounts["group"] || 0;
    for (const t of teams) { total += unreadCounts[`team:${t.id}`] || 0; }
    return total;
  }, [unreadCounts, teams]);

  const dmUnread = useMemo(() => {
    let total = 0;
    for (const a of agents) { total += unreadCounts[a.id] || 0; }
    return total;
  }, [unreadCounts, agents]);

  const lowerSearch = search.toLowerCase();
  const filteredTeams = useMemo(() => !lowerSearch ? teams : teams.filter((t) => t.name.toLowerCase().includes(lowerSearch)), [teams, lowerSearch]);

  const activeAgents = useMemo(() => {
    if (lowerSearch) return agents.filter((a) => a.name.toLowerCase().includes(lowerSearch) || (a.role && a.role.toLowerCase().includes(lowerSearch)));
    if (!activeDmAgentIds) return [];
    const activeSet = new Set(activeDmAgentIds);
    return agents.filter((a) => activeSet.has(a.id));
  }, [agents, lowerSearch, activeDmAgentIds]);

  const showChannels = search ? true : !channelsCollapsed;
  const showDms = search ? true : !dmsCollapsed;
  const showAllChannel = !lowerSearch || "all".includes(lowerSearch);

  const unreadChannelPeek = useMemo(() => {
    if (!channelsCollapsed || search) return [];
    const items: { type: "group" | "team"; team?: TeamWithAgents }[] = [];
    if ((unreadCounts["group"] || 0) > 0) items.push({ type: "group" });
    for (const t of teams) { if ((unreadCounts[`team:${t.id}`] || 0) > 0) items.push({ type: "team", team: t }); }
    return items;
  }, [channelsCollapsed, search, unreadCounts, teams]);

  const unreadDmPeek = useMemo(() => {
    if (!dmsCollapsed || search) return [];
    return agents.filter((a) => (unreadCounts[a.id] || 0) > 0);
  }, [dmsCollapsed, search, unreadCounts, agents]);

  return (
    <>
      {/* Workspace header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          {workspace && (
            <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-[12px] font-bold text-white shrink-0">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[14px] font-semibold text-[var(--color-text)] truncate">
            {workspace?.name || "Offload"}
          </span>
        </div>
        {showClose && (
          <button onClick={onClose} className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1 flex rounded-lg hover:bg-[var(--color-hover)]">
            <XIcon />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-2 px-2.5 py-[7px] rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <span className="text-[var(--color-text-tertiary)] shrink-0 opacity-60">
            <SearchIcon />
          </span>
          <input
            ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0 flex hover:text-[var(--color-text-secondary)]">
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* Main nav */}
      <div className="flex-1 px-2.5 flex flex-col gap-px overflow-auto">
        <NavItem href="/activity" isActive={pathname === "/activity"}>
          <span className="w-4 flex items-center justify-center opacity-50"><ActivityIcon /></span>
          <span className="flex-1">Activity</span>
          {hasNewActivity && pathname !== "/activity" && <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />}
        </NavItem>
        <NavItem href="/marketplace" isActive={pathname === "/marketplace" || pathname.startsWith("/marketplace/")}>
          <span className="w-4 flex items-center justify-center opacity-50"><StorefrontIcon /></span>
          <span>Marketplace</span>
        </NavItem>
        <NavItem href="/reports" isActive={pathname === "/reports" || pathname.startsWith("/reports/")}>
          <span className="w-4 flex items-center justify-center opacity-50"><ReportIcon /></span>
          <span className="flex-1">Reports</span>
          {reportCount > 0 && (
            <span className="text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-accent-soft)] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {reportCount}
            </span>
          )}
        </NavItem>
        <NavItem href="/history" isActive={pathname === "/history"}>
          <span className="w-4 flex items-center justify-center opacity-50"><ClockIcon /></span>
          <span>History</span>
        </NavItem>

        {/* New conversation */}
        {!search && (
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg w-full text-[13px] bg-transparent border border-dashed border-[var(--color-border)] cursor-pointer transition-all font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] mt-2"
          >
            <span className="w-4 flex items-center justify-center opacity-50"><PlusIcon /></span>
            <span>New conversation</span>
          </button>
        )}

        {/* Teams section */}
        <SectionHeader label="Teams" collapsed={channelsCollapsed && !search} onToggle={toggleChannels} totalUnread={channelUnread} />

        {showChannels ? (
          <>
            {showAllChannel && (
              <NavItem href="/chat" isActive={pathname === "/chat" || pathname.startsWith("/chat?")}>
                <span className="w-4 flex items-center justify-center opacity-50"><HashIcon /></span>
                <span className="flex-1">All</span>
                {(unreadCounts["group"] || 0) > 0 && <UnreadBadge count={unreadCounts["group"]} />}
              </NavItem>
            )}
            {filteredTeams.filter((t) => t.is_system).map((team) => {
              const teamUnread = unreadCounts[`team:${team.id}`] || 0;
              return (
                <NavItem key={team.id} href={`/team/${team.id}`} isActive={pathname === `/team/${team.id}`}>
                  <span className="w-4 flex items-center justify-center opacity-50"><PeopleIcon /></span>
                  <span className="flex-1">{team.name}</span>
                  {teamUnread > 0 && <UnreadBadge count={teamUnread} />}
                </NavItem>
              );
            })}
            {filteredTeams.filter((t) => !t.is_system).map((team) => {
              const teamUnread = unreadCounts[`team:${team.id}`] || 0;
              return (
                <NavItem key={team.id} href={`/team/${team.id}`} isActive={pathname === `/team/${team.id}`}>
                  <span className="w-4 flex items-center justify-center opacity-50">{team.visibility === "private" ? <LockIcon /> : <HashIcon />}</span>
                  <span className="flex-1">{team.name}</span>
                  {teamUnread > 0 && <UnreadBadge count={teamUnread} />}
                </NavItem>
              );
            })}
          </>
        ) : (
          unreadChannelPeek.length > 0 && (
            <>
              {unreadChannelPeek.map((item) =>
                item.type === "group" ? (
                  <NavItem key="group" href="/chat" isActive={pathname === "/chat"}>
                    <span className="w-4 flex items-center justify-center opacity-50"><HashIcon /></span>
                    <span className="flex-1">All</span>
                    <UnreadBadge count={unreadCounts["group"]} />
                  </NavItem>
                ) : item.team ? (
                  <NavItem key={item.team.id} href={`/team/${item.team.id}`} isActive={pathname === `/team/${item.team.id}`}>
                    <span className="w-4 flex items-center justify-center opacity-50">{item.team.is_system ? <PeopleIcon /> : item.team.visibility === "private" ? <LockIcon /> : <HashIcon />}</span>
                    <span className="flex-1">{item.team.name}</span>
                    <UnreadBadge count={unreadCounts[`team:${item.team.id}`]} />
                  </NavItem>
                ) : null
              )}
            </>
          )
        )}

        {/* Direct Messages */}
        {(activeAgents.length > 0 || search) && (
          <>
            <SectionHeader label="Direct Messages" collapsed={dmsCollapsed && !search} onToggle={toggleDms} totalUnread={dmUnread} />
            {showDms ? (
              <div className="flex flex-col gap-px" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                {activeAgents.map((a) => {
                  const unread = unreadCounts[a.id] || 0;
                  const active = pathname === `/agent/${a.id}`;
                  return (
                    <div key={a.id} className="group/dm relative flex items-center">
                      <NavItem href={`/agent/${a.id}`} isActive={active}>
                        <div className="w-[18px] h-[18px] rounded-md flex items-center justify-center text-[9px] font-semibold shrink-0" style={{ background: `${a.color}18`, color: a.color }}>
                          {a.name.charAt(0)}
                        </div>
                        <span className="flex-1 truncate">{a.name}</span>
                        {unread > 0 && <UnreadBadge count={unread} color={a.color} />}
                      </NavItem>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            await fetch("/api/conversations/hide", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ agent_id: a.id }),
                            });
                            onHideDm?.(a.id);
                          } catch { /* ignore */ }
                        }}
                        className="absolute right-1 opacity-0 group-hover/dm:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                        title="Hide from sidebar"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              unreadDmPeek.length > 0 && (
                <div className="flex flex-col gap-px">
                  {unreadDmPeek.map((a) => (
                    <NavItem key={a.id} href={`/agent/${a.id}`} isActive={pathname === `/agent/${a.id}`}>
                      <div className="w-[18px] h-[18px] rounded-md flex items-center justify-center text-[9px] font-semibold shrink-0" style={{ background: `${a.color}18`, color: a.color }}>
                        {a.name.charAt(0)}
                      </div>
                      <span className="flex-1 truncate">{a.name}</span>
                      <UnreadBadge count={unreadCounts[a.id]} color={a.color} />
                    </NavItem>
                  ))}
                </div>
              )
            )}
          </>
        )}

        <div className="flex-1" />

        {/* Bottom section */}
        <div className="py-2 border-t border-[var(--color-border)] mt-3 pt-3 flex flex-col gap-px">
          {canManage && (
            <Link
              href="/settings/new"
              className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg w-full text-[13px] no-underline transition-all font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
            >
              <span className="w-4 flex items-center justify-center opacity-50"><PlusIcon /></span>
              <span>Create agent</span>
            </Link>
          )}
          <NavItem href="/tasks" isActive={pathname === "/tasks"}>
            <span className="w-4 flex items-center justify-center opacity-50"><RepeatClockIcon /></span>
            <span className="flex-1">Scheduled</span>
            {activeTaskCount > 0 && (
              <span className="text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-accent-soft)] rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">{activeTaskCount}</span>
            )}
          </NavItem>
          <NavItem href="/settings" isActive={pathname === "/settings" || pathname.startsWith("/settings/") && !pathname.startsWith("/settings/members")}>
            <span className="w-4 flex items-center justify-center opacity-50"><GearIcon /></span>
            <span>Settings</span>
          </NavItem>
          <NavItem href="/settings/members" isActive={pathname === "/settings/members"}>
            <span className="w-4 flex items-center justify-center opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
            <span>Members</span>
          </NavItem>
          {isAdmin && (
            <NavItem href="/admin" isActive={false}>
              <span className="w-4 flex items-center justify-center opacity-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </span>
              <span>Admin</span>
            </NavItem>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Workspace switcher + logout */}
      <div className="px-3 pt-2 pb-3">
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} onSwitch={onSwitchWorkspace || (() => {})} />
        <LogOutButton />
      </div>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} agents={agents} workspaceId={workspace?.id || null} canCreateTeam={canManage} />
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
      className="w-full mt-1.5 px-3 py-1.5 bg-transparent border-none text-[12px] text-[var(--color-text-tertiary)] cursor-pointer text-left hover:text-[var(--color-text-secondary)] transition-colors rounded-lg hover:bg-[var(--color-hover)]"
    >
      Log out
    </button>
  );
}

export function Drawer({
  agents, teams, activeDmAgentIds, open, onClose, activeTaskCount, unreadCounts, hasNewActivity, isAdmin, workspace, workspaces, workspaceRole, onSwitchWorkspace, reportCount, onHideDm,
}: {
  agents: Agent[];
  teams?: TeamWithAgents[];
  activeDmAgentIds?: string[] | null;
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
  onHideDm?: (agentId: string) => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.2)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <div
        className="fixed top-0 left-0 bottom-0 w-[280px] bg-[var(--color-sidebar-bg)] z-[300] flex flex-col border-r border-[var(--color-border)] transition-transform duration-300"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        <SidebarContent
          agents={agents} teams={teams} activeDmAgentIds={activeDmAgentIds} showClose onClose={onClose}
          activeTaskCount={activeTaskCount} unreadCounts={unreadCounts} hasNewActivity={hasNewActivity} isAdmin={isAdmin}
          workspace={workspace} workspaces={workspaces} workspaceRole={workspaceRole} onSwitchWorkspace={onSwitchWorkspace} reportCount={reportCount} onHideDm={onHideDm}
        />
      </div>
    </>
  );
}
