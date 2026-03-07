"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { HashIcon, GearIcon, XIcon, ClockIcon, PlusIcon, RepeatClockIcon, ActivityIcon, SunIcon, MoonIcon } from "./Icons";
import { createClient } from "@/lib/supabase";
import type { Agent } from "@/lib/types";

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

export function SidebarContent({
  agents,
  showClose,
  onClose,
  activeTaskCount = 0,
  unreadCounts = {},
  hasNewActivity = false,
}: {
  agents: Agent[];
  showClose?: boolean;
  onClose?: () => void;
  activeTaskCount?: number;
  unreadCounts?: Record<string, number>;
  hasNewActivity?: boolean;
}) {
  const pathname = usePathname();

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
          <Link
            href="/settings/new"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full text-[14px] no-underline transition-colors font-medium border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
          >
            <span className="opacity-70">
              <PlusIcon />
            </span>
            <span>Create agent</span>
          </Link>
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
            isActive={pathname.startsWith("/settings")}
          >
            <span className="opacity-60">
              <GearIcon />
            </span>
            <span>Settings</span>
          </NavItem>
          <ThemeToggle />
        </div>
      </div>

      <div className="px-2 pt-2 pb-3">
        <div className="px-2.5 py-2.5 rounded-lg border border-[var(--color-border-light)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[var(--color-active)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-secondary)]">
            N
          </div>
          <div className="text-[13px] font-medium text-[var(--color-text)]">
            Nick&apos;s Business
          </div>
        </div>
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
  open,
  onClose,
  activeTaskCount,
  unreadCounts,
  hasNewActivity,
}: {
  agents: Agent[];
  open: boolean;
  onClose: () => void;
  activeTaskCount?: number;
  unreadCounts?: Record<string, number>;
  hasNewActivity?: boolean;
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
          showClose
          onClose={onClose}
          activeTaskCount={activeTaskCount}
          unreadCounts={unreadCounts}
          hasNewActivity={hasNewActivity}
        />
      </div>
    </>
  );
}
