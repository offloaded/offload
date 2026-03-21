"use client";

import { useState } from "react";
import { PlusIcon } from "./Icons";
import type { WorkItem } from "@/lib/types";

interface Agent {
  id: string;
  name: string;
  color: string;
}

interface WorkSidebarProps {
  workItems: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  agents?: Agent[];
  onAssignAgent?: (workItemId: string, agentId: string) => void;
}

const STATUS_FILTERS = ["All", "Active", "Review", "Complete", "Unassigned"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function matchesFilter(item: WorkItem, filter: StatusFilter): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Active":
      return item.status === "draft" || item.status === "in_progress";
    case "Review":
      return item.status === "review";
    case "Complete":
      return item.status === "complete";
    case "Unassigned":
      return !item.agent_id;
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
  agents,
  onAssignAgent,
}: WorkSidebarProps) {
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const filtered = workItems.filter((item) => matchesFilter(item, filter));
  const unassignedCount = workItems.filter((item) => !item.agent_id).length;

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
        className="flex items-center gap-1 px-3 py-2 flex-wrap"
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
            {f === "Unassigned" && unassignedCount > 0 && (
              <span
                className="ml-1 px-1 rounded-full text-xs"
                style={{
                  background: "var(--color-orange-soft)",
                  color: "var(--color-orange)",
                }}
              >
                {unassignedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Work items list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => {
          const isSelected = item.id === selectedId;
          const isUnassigned = !item.agent_id;
          const isAssigning = assigningId === item.id;

          return (
            <div key={item.id}>
              <button
                onClick={() => onSelect(item.id)}
                className="w-full text-left bg-transparent border-none cursor-pointer px-3 py-2.5 transition-colors block"
                style={{
                  background: isSelected
                    ? "var(--color-accent-soft)"
                    : isUnassigned
                    ? "var(--color-orange-soft)"
                    : "transparent",
                  borderLeft: isSelected
                    ? "2px solid var(--color-accent)"
                    : isUnassigned
                    ? "2px solid var(--color-orange)"
                    : "2px solid transparent",
                  borderBottom: "1px solid var(--color-border-light)",
                  opacity: isUnassigned && !isSelected ? 0.9 : 1,
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
                  {isUnassigned ? (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-orange)" }}
                    >
                      Unassigned
                    </span>
                  ) : item.agent_name ? (
                    <span
                      className="text-xs truncate"
                      style={{ color: item.agent_color || "var(--color-text-tertiary)" }}
                    >
                      {item.agent_name}
                    </span>
                  ) : null}
                  {item.source === "email" && (
                    <span
                      className="flex items-center gap-0.5 text-xs"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      via email
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

              {/* Assign to agent dropdown — shown for unassigned items when selected */}
              {isUnassigned && isSelected && agents && agents.length > 0 && onAssignAgent && (
                <div
                  className="px-3 py-2"
                  style={{
                    background: "var(--color-orange-soft)",
                    borderBottom: "1px solid var(--color-border-light)",
                  }}
                >
                  {isAssigning ? (
                    <select
                      autoFocus
                      className="w-full text-xs rounded px-2 py-1.5 border"
                      style={{
                        background: "var(--color-bg)",
                        color: "var(--color-text)",
                        borderColor: "var(--color-border)",
                      }}
                      onChange={(e) => {
                        if (e.target.value) {
                          onAssignAgent(item.id, e.target.value);
                          setAssigningId(null);
                        }
                      }}
                      onBlur={() => setAssigningId(null)}
                    >
                      <option value="">Select an agent...</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssigningId(item.id);
                      }}
                      className="w-full text-xs font-medium rounded px-2 py-1.5 border cursor-pointer transition-colors"
                      style={{
                        background: "var(--color-bg)",
                        color: "var(--color-orange)",
                        borderColor: "var(--color-orange)",
                      }}
                    >
                      Assign to agent
                    </button>
                  )}
                </div>
              )}
            </div>
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
