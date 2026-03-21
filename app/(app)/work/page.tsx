"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../layout";
import WorkSidebar from "@/components/WorkSidebar";

export default function WorkPage() {
  const { workItems, refreshWorkItems, mobile, agents } = useApp();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  // Ensure work items are fetched
  useEffect(() => {
    refreshWorkItems().then(() => setLoaded(true));
  }, [refreshWorkItems]);

  // Desktop: if there are work items, redirect to the most recent one
  useEffect(() => {
    if (!mobile && loaded && workItems.length > 0) {
      router.replace(`/work/${workItems[0].id}`);
    }
  }, [workItems, router, mobile, loaded]);

  // Mobile: show the work items list directly
  if (mobile) {
    return (
      <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
        <WorkSidebar
          workItems={workItems}
          selectedId={null}
          onSelect={(id) => router.push(`/work/${id}`)}
          onNew={() => router.push("/work/new")}
          agents={agents.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
          onAssignAgent={async (workItemId, agentId) => {
            try {
              await fetch(`/api/work-items/${workItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agent_id: agentId }),
              });
              refreshWorkItems();
            } catch {}
          }}
        />
      </div>
    );
  }

  // Desktop: show empty state while loading or if no items
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  if (workItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="text-center px-6">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mx-auto mb-4">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
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

  // Desktop with items: redirect happens via the useEffect above
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
      <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
    </div>
  );
}
