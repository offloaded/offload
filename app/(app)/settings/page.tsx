"use client";

import { useApp } from "../layout";
import { Avatar } from "@/components/Avatar";
import { PlusIcon, ArrowIcon, MenuIcon } from "@/components/Icons";
import Link from "next/link";

export default function SettingsPage() {
  const { agents, mobile, openDrawer } = useApp();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0"
      >
        <div className="flex items-center gap-3 mb-0 max-w-[520px]">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
          >
            <MenuIcon />
          </button>
          <span className="text-[18px] font-semibold text-[var(--color-text)] flex-1">
            Your Team
          </span>
          <Link
            href="/settings/new"
            className="flex items-center gap-1.5 py-2 px-3.5 bg-[var(--color-accent)] text-white border-none rounded-lg text-[14px] font-semibold cursor-pointer no-underline"
          >
            <PlusIcon /> New
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
      </div>
    </div>
  );
}
