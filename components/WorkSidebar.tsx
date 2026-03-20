"use client";

import { useState } from "react";
import { PlusIcon } from "./Icons";
import type { WorkItem } from "@/lib/types";

interface WorkSidebarProps {
  workItems: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const STATUS_FILTERS = ["All", "Active", "Review", "Complete"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function matchesFilter(status: WorkItem["status"], filter: StatusFilter): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Active":
      return status === "draft" || status === "in_progress";
    case "Review":
      return status === "review";
    case "Complete":
      return status === "complete";
  }
}

function statusLabel(status: WorkItem["status"]): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In Progress";
    case "review":
      return "Review";
    case "complete":
      return "Complete";
    default:
      return status;
  }
}

function statusStyle(status: WorkItem["status"]): React.CSSProperties {
  switch (status) {
    case "draft":
      return {
        background: "var(--color-hover)",
        color: "var(--color-text-tertiary)",
      };
    case "in_progress":
      return {
        background: "var(--color-orange-soft)",
        color: "var(--color-orange)",
      };
    case "review":
      return {
        background: "var(--color-accent-soft)",
        color: "var(--color-accent)",
      };
    case "complete":
      return {
        background: "var(--color-green-soft)",
        color: "var(--color-green)",
      };
    default:
      return {
        background: "var(--color-hover)",
        color: "var(--color-text-tertiary)",
      };
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export default function WorkSidebar({
  workItems,
  selectedId,
  onSelect,
  onNew,
}: WorkSidebarProps) {
  const [filter, setFilter] = useState<StatusFilter>("All");

  const filtered = workItems.filter((item) => matchesFilter(item.status, filter));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Work
        </span>
        <button
          onClick={onNew}
          className="flex items-center justify-center w-7 h-7 rounded-md border-none cursor-pointer bg-transparent transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Filter pills */}
      <div
        className="flex items-center gap-1 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors"
            style={
              filter === f
                ? {
                    background: "var(--color-accent-soft)",
                    color: "var(--color-accent)",
                    borderColor: "var(--color-accent-soft)",
                  }
                : {
                    background: "transparent",
                    color: "var(--color-text-tertiary)",
                    borderColor: "transparent",
                  }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* Work items list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full text-left bg-transparent border-none cursor-pointer px-3 py-2.5 transition-colors block"
              style={{
                background: isSelected ? "var(--color-accent-soft)" : "transparent",
                borderLeft: isSelected
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                borderBottom: "1px solid var(--color-border-light)",
              }}
            >
              {/* Title */}
              <div
                className="text-sm font-medium truncate"
                style={{
                  color: isSelected ? "var(--color-text)" : "var(--color-text-secondary)",
                }}
              >
                {item.title}
              </div>

              {/* Status badge + agent name */}
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="px-1.5 py-0.5 text-xs rounded font-medium leading-none"
                  style={statusStyle(item.status)}
                >
                  {statusLabel(item.status)}
                </span>
                {item.agent_name && (
                  <span
                    className="text-xs truncate"
                    style={{ color: item.agent_color || "var(--color-text-tertiary)" }}
                  >
                    {item.agent_name}
                  </span>
                )}
              </div>

              {/* Relative timestamp */}
              <div
                className="text-xs mt-1"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {relativeTime(item.updated_at)}
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div
            className="px-3 py-6 text-center text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            No work items
          </div>
        )}
      </div>
    </div>
  );
}
