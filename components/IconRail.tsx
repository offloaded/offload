"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Workspace } from "@/lib/types";

interface IconRailProps {
  activeSection: "chat" | "work" | "scheduled" | "settings";
  onNavClick: (section: "chat" | "work" | "scheduled" | "settings") => void;
  workspaceInitial: string;
  workspace: Workspace | null;
  workspaces: Workspace[];
  onSwitchWorkspace: (id: string) => void;
}

export default function IconRail({
  activeSection,
  onNavClick,
  workspaceInitial,
  workspace,
  workspaces,
  onSwitchWorkspace,
}: IconRailProps) {
  return (
    <div
      className="flex flex-col items-center py-4 flex-shrink-0"
      style={{
        width: "52px",
        background: "color-mix(in srgb, var(--color-sidebar-bg) 70%, var(--color-page-bg) 30%)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Workspace initial */}
      <div
        className="w-8 h-8 rounded-lg mb-6 flex items-center justify-center"
        style={{ background: "var(--color-accent)" }}
      >
        <span className="text-white text-sm font-bold">{workspaceInitial}</span>
      </div>

      {/* Chat */}
      <NavButton
        active={activeSection === "chat"}
        onClick={() => onNavClick("chat")}
        title="Chat"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </NavButton>

      {/* Work */}
      <NavButton
        active={activeSection === "work"}
        onClick={() => onNavClick("work")}
        title="Work"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </NavButton>

      {/* Scheduled */}
      <NavButton
        active={activeSection === "scheduled"}
        onClick={() => onNavClick("scheduled")}
        title="Scheduled"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </NavButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dark/Light Mode Toggle */}
      <ThemeToggleButton />

      {/* Settings */}
      <NavButton
        active={activeSection === "settings"}
        onClick={() => onNavClick("settings")}
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42" />
        </svg>
      </NavButton>

      {/* Workspace Switcher */}
      <WorkspaceSwitcherButton
        workspace={workspace}
        workspaces={workspaces}
        onSwitch={onSwitchWorkspace}
      />
    </div>
  );
}

function NavButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
      style={{
        background: active ? "var(--color-accent-soft)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
      }}
      title={title}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }
      }}
    >
      {children}
    </button>
  );
}

function ThemeToggleButton() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setDark(!dark);
  }, [dark]);

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
      style={{
        background: "transparent",
        color: "var(--color-text-tertiary)",
      }}
      title={dark ? "Light mode" : "Dark mode"}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--color-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {dark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function WorkspaceSwitcherButton({
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
    <div ref={ref} className="relative mt-2">
      <button
        onClick={() => hasMultiple && setOpen(!open)}
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150"
        style={{
          background: open ? "var(--color-accent-soft)" : "transparent",
          cursor: hasMultiple ? "pointer" : "default",
        }}
        title={workspace.name}
        onMouseEnter={(e) => {
          if (hasMultiple && !open) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--color-hover)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }
        }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: "var(--color-accent)" }}
        >
          {initial}
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50 w-[200px]">
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Workspaces</span>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                if (ws.id !== workspace.id) onSwitch(ws.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-none cursor-pointer transition-colors"
              style={{
                background: ws.id === workspace.id ? "var(--color-hover)" : "transparent",
              }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: "var(--color-accent)" }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[var(--color-text)] truncate">{ws.name}</div>
                {ws.role && (
                  <div className="text-[10px] text-[var(--color-text-tertiary)] capitalize">{ws.role}</div>
                )}
              </div>
              {ws.id === workspace.id && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
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
