"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../layout";
import { Avatar } from "@/components/Avatar";
import { PlusIcon, ArrowIcon, MenuIcon, ChevronDownIcon, GlobeIcon } from "@/components/Icons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

type Tab = "profile" | "agents" | "integrations";

export default function SettingsPage() {
  const { agents, openDrawer, workspaceRole } = useApp();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return t === "integrations" || t === "agents" ? t : "profile";
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0">
        <div className="flex items-center gap-3 mb-0 max-w-[520px]">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
          >
            <MenuIcon />
          </button>
          <span className="text-[18px] font-semibold text-[var(--color-text)] flex-1">
            Settings
          </span>
          {tab === "agents" && canManage && (
            <Link
              href="/settings/new"
              className="flex items-center gap-1.5 py-2 px-3.5 bg-[var(--color-accent)] text-white border-none rounded-lg text-[14px] font-semibold cursor-pointer no-underline"
            >
              <PlusIcon /> New
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-3 max-w-[520px]">
          {(["profile", "agents", "integrations"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-2 px-4 bg-transparent border-none text-[14px] font-medium cursor-pointer transition-colors relative capitalize"
              style={{
                color: tab === t ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              {t}
              {tab === t && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {tab === "profile" ? (
          <ProfileTab />
        ) : tab === "agents" ? (
          <AgentsTab agents={agents} canManage={canManage} />
        ) : (
          <IntegrationsTab />
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ───

function ProfileTab() {
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      }
    } catch {
      // ignore
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
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)] transition-colors"
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
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text-secondary)] bg-[var(--color-input-bg)] outline-none cursor-not-allowed"
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
            className="w-full py-2.5 pl-3 pr-8 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)] transition-colors"
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
        className="py-2.5 px-5 border-none rounded-lg text-[14px] font-semibold cursor-pointer disabled:cursor-default transition-colors bg-[var(--color-accent)] text-white disabled:opacity-40"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
      </button>
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
            <Avatar name={a.name} color={a.color} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-[var(--color-text)]">
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

// ─── Integrations Tab ───

function IntegrationsTab() {
  const [asanaStatus, setAsanaStatus] = useState<{
    connected: boolean;
    asana_user_name?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const fetchStatus = useCallback(() => {
    fetch("/api/integrations/asana/status")
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then(setAsanaStatus)
      .catch(() => setAsanaStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/asana/disconnect", { method: "DELETE" });
      if (res.ok) {
        setAsanaStatus({ connected: false });
        setConfirmDisconnect(false);
      }
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

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

      {/* Asana card */}
      <div className="border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-hover)] flex items-center justify-center text-lg">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Asana</div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">
              Task management and project tracking
            </div>
          </div>
          <span
            className="text-[12px] font-medium px-2 py-0.5 rounded-full"
            style={{
              color: asanaStatus?.connected ? "var(--color-green, #16a34a)" : "var(--color-text-tertiary)",
              background: asanaStatus?.connected ? "var(--color-green-bg, rgba(22,163,74,0.1))" : "var(--color-hover)",
            }}
          >
            {asanaStatus?.connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {asanaStatus?.connected && asanaStatus.asana_user_name && (
          <div className="text-[13px] text-[var(--color-text-secondary)] mb-3 px-1">
            Connected as <span className="font-medium">{asanaStatus.asana_user_name}</span>
          </div>
        )}

        {asanaStatus?.connected ? (
          <>
            {confirmDisconnect ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--color-text-secondary)] flex-1">
                  This will remove Asana access from all agents. Continue?
                </span>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="py-1.5 px-3 bg-transparent border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="py-1.5 px-3 bg-red-600 border-none rounded-lg text-[13px] text-white font-medium cursor-pointer disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="py-2 px-4 bg-transparent border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
              >
                Disconnect
              </button>
            )}
          </>
        ) : (
          <a
            href="/api/integrations/asana/connect"
            className="inline-flex items-center gap-2 py-2 px-4 bg-[var(--color-accent)] border-none rounded-lg text-[13px] text-white font-medium cursor-pointer no-underline hover:opacity-90 transition-opacity"
          >
            Connect Asana
          </a>
        )}
      </div>

      {/* Placeholder for future integrations */}
      <div className="border border-dashed border-[var(--color-border)] rounded-xl p-4 mt-3 opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-hover)] flex items-center justify-center text-lg">
            📅
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Google Calendar</div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">Coming soon</div>
          </div>
        </div>
      </div>

      <div className="border border-dashed border-[var(--color-border)] rounded-xl p-4 mt-3 opacity-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-hover)] flex items-center justify-center text-lg">
            ✉️
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[var(--color-text)]">Email</div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">Coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}
