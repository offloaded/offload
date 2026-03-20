"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../layout";
import { MenuIcon } from "@/components/Icons";

export default function WorkPage() {
  const { workItems, openDrawer, mobile } = useApp();
  const router = useRouter();

  // If there are work items, redirect to the most recent one
  useEffect(() => {
    if (workItems.length > 0) {
      router.replace(`/work/${workItems[0].id}`);
    }
  }, [workItems, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--color-surface)]">
      {mobile && (
        <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex md:hidden rounded-lg hover:bg-[var(--color-hover)]"
          >
            <MenuIcon />
          </button>
        </div>
      )}
      <div className="text-center px-6">
        <div className="text-[40px] mb-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mx-auto mb-2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h2 className="text-[18px] font-semibold text-[var(--color-text)] mb-2">
          No work items yet
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 max-w-[360px]">
          Create a work item to get started. Assign a task to an agent and they&apos;ll produce a draft for you to review.
        </p>
        <button
          onClick={() => router.push("/work/new")}
          className="px-5 py-2.5 bg-[var(--color-accent)] text-white border-none rounded-xl text-[14px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
        >
          New Work Item
        </button>
      </div>
    </div>
  );
}
