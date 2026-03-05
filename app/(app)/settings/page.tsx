"use client";

import { useApp } from "../layout";
import { Avatar } from "@/components/Avatar";
import { PlusIcon, ArrowIcon, MenuIcon } from "@/components/Icons";
import Link from "next/link";

export default function SettingsPage() {
  const { agents, mobile, openDrawer } = useApp();

  return (
    <div className="flex-1 overflow-auto bg-[var(--color-surface)]">
      <div className="py-8 px-10 max-w-[520px] max-md:p-4">
        <div className="flex items-center gap-2.5 mb-5">
          {mobile && (
            <button
              onClick={openDrawer}
              className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
            >
              <MenuIcon />
            </button>
          )}
          <span className="text-lg font-semibold text-[var(--color-text)] flex-1">
            Your Team
          </span>
          <Link
            href="/settings/new"
            className="flex items-center gap-1.5 py-1.5 px-3 bg-[var(--color-accent)] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer no-underline"
          >
            <PlusIcon /> New
          </Link>
        </div>

        {agents.length === 0 && (
          <div className="py-10 px-5 text-center">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
              No agents yet
            </div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">
              Create your first team member to get started
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/settings/${a.id}`}
              className="flex items-center gap-3 p-3 px-3.5 border border-[var(--color-border)] rounded-[10px] cursor-pointer bg-[var(--color-surface)] hover:bg-[var(--color-hover)] no-underline transition-colors"
            >
              <Avatar name={a.name} color={a.color} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {a.name}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
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
    </div>
  );
}
