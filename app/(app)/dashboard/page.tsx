"use client";

import { useApp } from "../layout";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";

export default function DashboardPage() {
  const { agents } = useApp();

  return (
    <div className="flex-1 overflow-auto bg-[var(--color-surface)]">
      <div className="py-8 px-10 max-w-[720px] max-md:p-4">
        <h1 className="text-[18px] font-semibold text-[var(--color-text)] mb-6">
          Dashboard
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agent/${a.id}`}
              className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-hover)] no-underline transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar name={a.name} color={a.color} size={34} />
                <span className="text-[15px] font-semibold text-[var(--color-text)]">
                  {a.name}
                </span>
              </div>
              <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed line-clamp-2 m-0">
                {a.purpose}
              </p>
            </Link>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-10">
            <div className="text-[15px] text-[var(--color-text-secondary)] mb-1">
              No agents yet
            </div>
            <div className="text-[14px] text-[var(--color-text-tertiary)]">
              Go to Settings to create your first team member
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
