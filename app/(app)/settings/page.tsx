"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useApp } from "../layout";
import { Avatar } from "@/components/Avatar";
import { PlusIcon, ArrowIcon, MenuIcon, ChevronDownIcon, GlobeIcon, PeopleIcon } from "@/components/Icons";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { WorkspaceMember, WorkspaceInvite } from "@/lib/types";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Brisbane",
  "Pacific/Auckland",
];

type Tab = "profile" | "agents" | "integrations" | "members" | "documents";

// ─── Nav Icons ───

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PeopleAddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// ─── Nav Items Config ───

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <UserIcon /> },
  { id: "agents", label: "Agents", icon: <GridIcon /> },
  { id: "members", label: "Members", icon: <PeopleAddIcon /> },
  { id: "documents", label: "Documents", icon: <DocIcon /> },
  { id: "integrations", label: "Integrations", icon: <PlugIcon /> },
];

export default function SettingsPage() {
  const { agents, openDrawer, workspaceRole } = useApp();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return t === "integrations" || t === "agents" || t === "members" || t === "documents" ? t : "profile";
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Mobile header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex rounded-lg hover:bg-[var(--color-hover)]"
          >
            <MenuIcon />
          </button>
          <span className="text-[16px] font-semibold text-[var(--color-text)] flex-1">
            Settings
          </span>
        </div>

        {/* Mobile nav: horizontal scrollable pills */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap border-none cursor-pointer transition-colors ${
                tab === item.id
                  ? "bg-[var(--color-surface-raised)] shadow-sm font-medium text-[var(--color-text)]"
                  : "bg-transparent font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          {canManage && (
            <Link
              href="/settings/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap border-none cursor-pointer transition-colors bg-transparent font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] no-underline"
            >
              <PlusIcon />
              Create Agent
            </Link>
          )}
        </div>
      </div>

      {/* Desktop layout: left nav + content */}
      <div className="flex-1 flex overflow-hidden bg-[var(--color-surface)]">
        {/* Left nav pane */}
        <div className="hidden md:flex w-[200px] min-w-[200px] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* Nav header */}
          <div className="px-4 pt-6 pb-3">
            <span className="text-[14px] font-semibold text-[var(--color-text)]">Settings</span>
          </div>
          {/* Nav items */}
          <div className="flex-1 px-2 flex flex-col gap-px">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full text-left flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] border-none cursor-pointer transition-colors ${
                  tab === item.id
                    ? "bg-[var(--color-surface-raised)] shadow-sm font-medium text-[var(--color-text)]"
                    : "bg-transparent font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Create agent link at bottom for admins */}
            {canManage && (
              <Link
                href="/settings/new"
                className="w-full text-left flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] border-none cursor-pointer transition-colors bg-transparent font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] no-underline"
              >
                <PlusIcon />
                Create Agent
              </Link>
            )}

            {/* Logout */}
            <div className="border-t border-[var(--color-border)] mt-2 pt-2">
              <LogoutButton />
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {tab === "profile" ? (
            <ProfileTab />
          ) : tab === "agents" ? (
            <AgentsTab agents={agents} canManage={canManage} />
          ) : tab === "members" ? (
            <MembersTab />
          ) : tab === "documents" ? (
            <DocumentTemplatesTab />
          ) : (
            <IntegrationsTab />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ───

function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };
  return (
    <button
      onClick={handleLogout}
      className="w-full text-left flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] bg-transparent border-none cursor-pointer transition-colors font-normal text-[var(--color-text-tertiary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-red)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Log out
    </button>
  );
}

function ProfileTab() {
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);

  // Track original values to detect changes
  const [origName, setOrigName] = useState("");
  const [origTz, setOrigTz] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setEmail(data.email);
          const name = data.display_name || "";
          const tz = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          setDisplayName(name);
          setTimezone(tz);
          setOrigName(name);
          setOrigTz(tz);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setDirty(displayName !== origName || timezone !== origTz);
    setSaved(false);
  }, [displayName, timezone, origName, origTz]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, timezone }),
      });
      if (res.ok) {
        setOrigName(displayName);
        setOrigTz(timezone);
        setDirty(false);
        setSaved(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save profile");
      }
    } catch {
      setSaveError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [displayName, timezone]);

  // Include browser timezone in dropdown if not already in the list
  const browserTz = typeof window !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";
  const tzOptions = COMMON_TIMEZONES.includes(browserTz)
    ? COMMON_TIMEZONES
    : [browserTz, ...COMMON_TIMEZONES];

  if (loading) {
    return (
      <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5">
        <span className="text-[14px] text-[var(--color-text-tertiary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5 md:pb-8">
      {/* Display name */}
      <div className="mb-5">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Display name
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)] transition-colors"
        />
      </div>

      {/* Email (read-only) */}
      <div className="mb-5">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Email
        </label>
        <input
          value={email}
          disabled
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-secondary)] bg-[var(--color-input-bg)] outline-none cursor-not-allowed"
        />
        <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
          Email is managed through your login provider
        </div>
      </div>

      {/* Timezone */}
      <div className="mb-6">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Timezone
        </label>
        <div className="relative">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full py-2.5 pl-3 pr-8 border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)] transition-colors"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
            <ChevronDownIcon />
          </div>
        </div>
        <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
          Used for scheduled task times
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="py-2.5 px-5 border-none rounded-xl text-[14px] font-semibold cursor-pointer disabled:cursor-default transition-colors bg-[var(--color-accent)] text-white disabled:opacity-40"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
      </button>
      {saveError && (
        <div className="mt-2 text-[13px] text-[var(--color-red)]">{saveError}</div>
      )}
    </div>
  );
}

// ─── Agents Tab ───

function AgentsTab({
  agents,
  canManage,
}: {
  agents: { id: string; name: string; purpose: string; color: string }[];
  canManage: boolean;
}) {
  return (
    <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5 md:pb-8">
      {agents.length === 0 && (
        <div className="py-10 px-5 text-center">
          <div className="text-[15px] text-[var(--color-text-secondary)] mb-1">
            No agents yet
          </div>
          <div className="text-[14px] text-[var(--color-text-tertiary)]">
            Create your first team member to get started
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {agents.map((a) => (
          <Link
            key={a.id}
            href={`/settings/${a.id}`}
            className="flex items-center gap-3.5 p-3.5 border border-[var(--color-border)] rounded-xl cursor-pointer bg-[var(--color-surface)] hover:bg-[var(--color-hover)] no-underline transition-colors"
          >
            <Avatar name={a.name} color={a.color} size={34} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--color-text)]">
                {a.name}
              </div>
              <div className="text-[13px] text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                {a.purpose}
              </div>
            </div>
            <div className="text-[var(--color-text-tertiary)]">
              <ArrowIcon />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Members Tab ───

function MembersTab() {
  const { workspace, workspaceRole, refreshWorkspace } = useApp();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      fetch("/api/workspaces/members"),
      fetch("/api/workspaces/invite"),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (invitesRes.ok) setInvites(await invitesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const res = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
      } else {
        setInviteSuccess(
          data.immediate
            ? `${inviteEmail.trim()} has been added to the workspace.`
            : `Invite sent to ${inviteEmail.trim()}`
        );
        setInviteEmail("");
        loadData();
      }
    } catch {
      setInviteError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const res = await fetch(`/api/workspaces/members?user_id=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const res = await fetch("/api/workspaces/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (res.ok) loadData();
  };

  const handleCancelInvite = async (inviteId: string) => {
    const res = await fetch(`/api/workspaces/invite?id=${inviteId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  };

  const handleRenameWorkspace = async () => {
    const name = prompt("Workspace name:", workspace?.name || "");
    if (!name?.trim() || name.trim() === workspace?.name) return;
    const res = await fetch("/api/workspaces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: workspace?.id, name: name.trim() }),
    });
    if (res.ok) refreshWorkspace();
  };

  return (
    <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5 md:pb-8">
      {/* Workspace info */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[14px] font-semibold text-[var(--color-text)]">
            {workspace?.name || "Workspace"}
          </div>
          {canManage && (
            <button
              onClick={handleRenameWorkspace}
              className="text-[13px] text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline"
            >
              Rename
            </button>
          )}
        </div>
        <div className="text-[13px] text-[var(--color-text-tertiary)]">
          {members.length} member{members.length !== 1 ? "s" : ""} · Your role: {workspaceRole}
        </div>
      </div>

      {/* Invite section */}
      {canManage && (
        <div className="mb-6">
          <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Invite member
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError("");
                setInviteSuccess("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="email@example.com"
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] text-[14px] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-xl border-none text-[14px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white disabled:opacity-50"
            >
              {inviting ? "..." : "Invite"}
            </button>
          </div>
          {inviteError && (
            <div className="text-[13px] text-red-500 mt-1.5">{inviteError}</div>
          )}
          {inviteSuccess && (
            <div className="text-[13px] text-green-600 mt-1.5">{inviteSuccess}</div>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="mb-6">
        <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
          Members
        </div>

        {loading ? (
          <div className="py-4 text-center text-[14px] text-[var(--color-text-tertiary)]">
            Loading...
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)]"
              >
                <div className="w-8 h-8 rounded-xl bg-[var(--color-active)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-secondary)]">
                  {(m.display_name || m.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--color-text)] truncate">
                    {m.display_name || m.email || "Unknown"}
                  </div>
                  {m.display_name && m.email && (
                    <div className="text-[12px] text-[var(--color-text-tertiary)] truncate">
                      {m.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && m.role !== "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                      className="text-[12px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-text-secondary)] outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-[12px] text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                      {m.role}
                    </span>
                  )}
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      className="text-[12px] text-red-500 bg-transparent border-none cursor-pointer hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.filter((i) => i.status === "pending").length > 0 && (
        <div>
          <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Pending invitations
          </div>
          <div className="flex flex-col gap-1">
            {invites
              .filter((i) => i.status === "pending")
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--color-border)]"
                >
                  <div className="w-8 h-8 rounded-xl bg-[var(--color-hover)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-tertiary)]">
                    ?
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--color-text-secondary)] truncate">
                      {invite.email}
                    </div>
                    <div className="text-[12px] text-[var(--color-text-tertiary)]">
                      Invited {new Date(invite.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-[12px] text-[var(--color-text-tertiary)] bg-transparent border-none cursor-pointer hover:text-red-500"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Integrations Tab ───

function IntegrationCard({
  icon,
  name,
  description,
  connected,
  configured = true,
  connectedLabel,
  connectUrl,
  connectLabel,
  disconnectUrl,
  disconnectWarning,
}: {
  icon: string;
  name: string;
  description: string;
  connected: boolean;
  configured?: boolean;
  connectedLabel?: string;
  connectUrl: string;
  connectLabel: string;
  disconnectUrl: string;
  disconnectWarning: string;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [isConnected, setIsConnected] = useState(connected);

  useEffect(() => { setIsConnected(connected); }, [connected]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(disconnectUrl, { method: "DELETE" });
      if (res.ok) {
        setIsConnected(false);
        setConfirmDisconnect(false);
      }
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-hover)] flex items-center justify-center text-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-text)]">{name}</div>
          <div className="text-[13px] text-[var(--color-text-tertiary)]">{description}</div>
        </div>
        <span
          className="text-[12px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color: isConnected ? "var(--color-green, #16a34a)" : "var(--color-text-tertiary)",
            background: isConnected ? "var(--color-green-bg, rgba(22,163,74,0.1))" : "var(--color-hover)",
          }}
        >
          {isConnected ? "Connected" : "Not connected"}
        </span>
      </div>

      {isConnected && connectedLabel && (
        <div className="text-[13px] text-[var(--color-text-secondary)] mb-3 px-1">
          Connected as <span className="font-medium">{connectedLabel}</span>
        </div>
      )}

      {isConnected ? (
        <>
          {confirmDisconnect ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[var(--color-text-secondary)] flex-1">
                {disconnectWarning}
              </span>
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="py-1.5 px-3 bg-transparent border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="py-1.5 px-3 bg-red-600 border-none rounded-xl text-[13px] text-white font-medium cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="py-2 px-4 bg-transparent border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
            >
              Disconnect
            </button>
          )}
        </>
      ) : configured ? (
        <a
          href={connectUrl}
          className="inline-flex items-center gap-2 py-2 px-4 bg-[var(--color-accent)] border-none rounded-xl text-[13px] text-white font-medium cursor-pointer no-underline hover:opacity-90 transition-opacity"
        >
          {connectLabel}
        </a>
      ) : (
        <span className="text-[13px] text-[var(--color-text-tertiary)]">
          Not available — ask your administrator to configure this integration.
        </span>
      )}
    </div>
  );
}

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));

interface DocTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  file_name: string;
  file_size: number;
  placeholders: Array<{ name: string; label: string; description: string }>;
  created_at: string;
  updated_at: string;
}

function DocumentTemplatesTab() {
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/document-templates");
      if (res.ok) setTemplates(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const selected = templates.find((t) => t.id === selectedId) || null;

  const openTemplate = (t: DocTemplate) => {
    setSelectedId(t.id);
    setEditContent(t.content || "");
    setEditName(t.name);
    setEditDescription(t.description || "");
    setDirty(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/document-templates/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription, content: editContent }),
      });
      if (res.ok) {
        setDirty(false);
        await loadTemplates();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/document-templates/upload", { method: "POST", body: formData });
      if (res.ok) {
        const newTmpl = await res.json();
        await loadTemplates();
        // Auto-open the newly uploaded template
        setSelectedId(newTmpl.id);
        setEditContent(newTmpl.content || "");
        setEditName(newTmpl.name);
        setEditDescription("");
        setDirty(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Upload failed");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/document-templates?id=${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    loadTemplates();
  };

  // Detail/editor view
  if (selectedId && selected) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 px-6 md:px-8 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <button
            onClick={() => { if (dirty && !confirm("Discard unsaved changes?")) return; setSelectedId(null); }}
            className="bg-transparent border-none cursor-pointer p-1 flex text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-lg hover:bg-[var(--color-hover)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setDirty(true); }}
              className="w-full text-[15px] font-semibold text-[var(--color-text)] bg-transparent border-none outline-none"
              placeholder="Template name"
            />
            <input
              value={editDescription}
              onChange={(e) => { setEditDescription(e.target.value); setDirty(true); }}
              className="w-full text-[12px] text-[var(--color-text-secondary)] bg-transparent border-none outline-none mt-0.5"
              placeholder="Add a description for this template..."
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-1.5 bg-[var(--color-accent)] text-white border-none rounded-lg text-[13px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Placeholder pills */}
        {selected.placeholders.length > 0 && (
          <div className="shrink-0 px-6 md:px-8 py-2 border-b border-[var(--color-border)] flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium uppercase tracking-wider">Placeholders:</span>
            {selected.placeholders.map((ph) => (
              <span
                key={ph.name}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                title={ph.description}
              >
                {`{{${ph.name}}}`}
              </span>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5">
          <Suspense fallback={<div className="text-[13px] text-[var(--color-text-tertiary)]">Loading editor...</div>}>
            <RichTextEditor
              content={editContent}
              onChange={(html) => { setEditContent(html); setDirty(true); }}
              placeholder="Write or edit the template content. Agents will use this as guidance for filling the template..."
            />
          </Suspense>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-3">
            Agents read this content as instructions. Use headings, bold, and lists to structure guidance clearly.
          </p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-text)]">Document Templates</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Upload Word (.docx) templates with {"{{placeholder}}"} tags. Click a template to view and edit its content.
          </p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-[var(--color-accent)] text-white border-none rounded-xl text-[13px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload Template"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--color-text-tertiary)]">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mx-auto mb-4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-[14px] text-[var(--color-text-secondary)] mb-2">No document templates yet</p>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            Upload a .docx file with {"{{placeholder}}"} tags to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              className="w-full text-left border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--color-text)]">{t.name}</div>
                  {t.description && (
                    <div className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t.description}</div>
                  )}
                  <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                    {t.file_name} &middot; {(t.file_size / 1024).toFixed(0)}KB &middot; {new Date(t.created_at).toLocaleDateString()}
                    {t.content ? "" : " — no content yet"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-red)] cursor-pointer p-1"
                  >
                    Delete
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
              {t.placeholders.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.placeholders.map((ph) => (
                    <span
                      key={ph.name}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      title={ph.description}
                    >
                      {`{{${ph.name}}}`}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationsTab() {
  const [asanaStatus, setAsanaStatus] = useState<{
    connected: boolean;
    configured?: boolean;
    asana_user_name?: string;
  } | null>(null);
  const [githubStatus, setGithubStatus] = useState<{
    connected: boolean;
    configured?: boolean;
    github_name?: string;
    github_username?: string;
  } | null>(null);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<{
    connected: boolean;
    configured?: boolean;
    google_email?: string;
    google_name?: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const integrationError = searchParams.get("error");
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    Promise.all([
      fetch("/api/integrations/asana/status").then((r) => (r.ok ? r.json() : { connected: false })).catch(() => ({ connected: false })),
      fetch("/api/integrations/github/status").then((r) => (r.ok ? r.json() : { connected: false })).catch(() => ({ connected: false })),
      fetch("/api/integrations/google-calendar/status").then((r) => (r.ok ? r.json() : { connected: false })).catch(() => ({ connected: false })),
    ]).then(([asana, github, googleCalendar]) => {
      setAsanaStatus(asana);
      setGithubStatus(github);
      setGoogleCalendarStatus(googleCalendar);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5">
        <span className="text-[14px] text-[var(--color-text-tertiary)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5 md:pb-8">
      <p className="text-[13px] text-[var(--color-text-tertiary)] mb-5">
        Connect external services to give your agents new capabilities.
      </p>

      {integrationError === "not_configured" && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--color-hover)] text-[13px] text-[var(--color-text-secondary)]">
          This integration hasn&apos;t been configured yet. Please contact your administrator.
        </div>
      )}

      {/* Asana card */}
      <IntegrationCard
        icon="📋"
        name="Asana"
        description="Task management and project tracking"
        connected={asanaStatus?.connected || false}
        configured={asanaStatus?.configured !== false}
        connectedLabel={asanaStatus?.asana_user_name}
        connectUrl="/api/integrations/asana/connect"
        connectLabel="Connect Asana"
        disconnectUrl="/api/integrations/asana/disconnect"
        disconnectWarning="This will remove Asana access from all agents. Continue?"
      />

      {/* GitHub card */}
      <div className="mt-3">
        <IntegrationCard
          icon="🐙"
          name="GitHub"
          description="Issues, repositories, and code collaboration"
          connected={githubStatus?.connected || false}
          configured={githubStatus?.configured !== false}
          connectedLabel={githubStatus?.github_name || githubStatus?.github_username}
          connectUrl="/api/integrations/github/connect"
          connectLabel="Connect GitHub"
          disconnectUrl="/api/integrations/github/disconnect"
          disconnectWarning="This will remove GitHub access from all agents. Continue?"
        />
        {!githubStatus?.connected && githubStatus?.configured !== false && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5 px-1">
            Offloaded will have access to your public and private repositories.
          </p>
        )}
      </div>

      {/* Google Calendar card */}
      <div className="mt-3">
        <IntegrationCard
          icon="📅"
          name="Google Calendar"
          description="Events, scheduling, and availability"
          connected={googleCalendarStatus?.connected || false}
          configured={googleCalendarStatus?.configured !== false}
          connectedLabel={googleCalendarStatus?.google_name || googleCalendarStatus?.google_email}
          connectUrl="/api/integrations/google-calendar/connect"
          connectLabel="Connect Google Calendar"
          disconnectUrl="/api/integrations/google-calendar/disconnect"
          disconnectWarning="This will remove Google Calendar access from all agents. Continue?"
        />
        {!googleCalendarStatus?.connected && googleCalendarStatus?.configured !== false && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5 px-1">
            Offloaded will have read and write access to your calendar events.
          </p>
        )}
      </div>

      {/* Email Ingestion */}
      <div className="mt-3">
        <EmailIngestionCard />
      </div>
    </div>
  );
}

function EmailIngestionCard() {
  const [copied, setCopied] = useState(false);
  const inboundAddress = `messages@${process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN || "offloaded.life"}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inboundAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-hover)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-text)]">Email Ingestion</div>
          <div className="text-[13px] text-[var(--color-text-tertiary)]">Forward emails to create work items</div>
        </div>
        <span
          className="text-[12px] font-medium px-2 py-0.5 rounded-full"
          style={{
            color: "var(--color-green, #16a34a)",
            background: "var(--color-green-bg, rgba(22,163,74,0.1))",
          }}
        >
          Active
        </span>
      </div>

      <div>
        <div className="text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1.5">Forward emails to:</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-input-bg)] border border-[var(--color-border)] text-[13px] text-[var(--color-text)] font-mono truncate">
            {inboundAddress}
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg text-[12px] font-medium border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">
          Forward or send emails from your registered email address. They&apos;ll be automatically routed to the best-fit agent and create a work item.
        </p>
      </div>
    </div>
  );
}
