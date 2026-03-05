"use client";

import { useApp } from "../layout";
import { HashIcon, MenuIcon } from "@/components/Icons";

export default function ChatPage() {
  const { agents, mobile, openDrawer } = useApp();

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="py-3 px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-2.5 max-md:py-2.5 max-md:px-4">
        {mobile && (
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
          >
            <MenuIcon />
          </button>
        )}
        <span className="text-[var(--color-text-tertiary)] text-base">
          <HashIcon />
        </span>
        <span className="text-[15px] font-semibold text-[var(--color-text)]">
          All
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[var(--color-text-secondary)] mb-1">
            Operations Manager
          </div>
          <div className="text-[13px] text-[var(--color-text-tertiary)]">
            Chat coming in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
