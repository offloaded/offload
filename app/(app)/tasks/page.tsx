"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../layout";
import {
  MenuIcon,
  PlusIcon,
  TrashIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "@/components/Icons";
import { Avatar } from "@/components/Avatar";
import type { ScheduledTask } from "@/lib/types";
import { describeCron, getNextRun } from "@/lib/cron";

// ─── Schedule builder helpers ───

type Frequency = "daily" | "weekdays" | "weekly" | "monthly";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function buildCron(
  frequency: Frequency,
  hour: number,
  minute: number,
  dayOfWeek: number,
  dayOfMonth: number
): string {
  switch (frequency) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekdays":
      return `${minute} ${hour} * * 1-5`;
    case "weekly":
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFutureTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays < 7) return `in ${diffDays}d`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Page component ───

export default function TasksPage() {
  const { agents, teams, openDrawer, refreshTaskCount } = useApp();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled-tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Sort by next_run_at ascending (next upcoming first)
  const sorted = [...tasks].sort((a, b) => {
    // Disabled tasks go to the bottom
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const aTime = a.next_run_at ? new Date(a.next_run_at).getTime() : Infinity;
    const bTime = b.next_run_at ? new Date(b.next_run_at).getTime() : Infinity;
    return aTime - bTime;
  });

  const toggleTask = async (taskId: string, enabled: boolean) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, enabled } : t))
    );
    await fetch("/api/scheduled-tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, enabled }),
    });
    loadTasks();
    refreshTaskCount();
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/scheduled-tasks?id=${taskId}`, { method: "DELETE" });
    loadTasks();
    refreshTaskCount();
  };

  const onTaskCreated = () => {
    setShowAddForm(false);
    loadTasks();
    refreshTaskCount();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-6 pt-safe">
        <div className="flex items-center gap-3">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
          >
            <MenuIcon />
          </button>
          <span className="text-[18px] font-semibold text-[var(--color-text)] flex-1">
            Scheduled Tasks
          </span>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 py-2 px-3.5 bg-[var(--color-accent)] text-white border-none rounded-lg text-[14px] font-semibold cursor-pointer"
          >
            <PlusIcon /> Add task
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-[56px] md:pt-0">
        <div className="max-w-[640px] w-full p-4 md:px-6 md:pt-4 md:pb-8">
          {/* Add task form */}
          {showAddForm && (
            <AddTaskForm
              agents={agents}
              teams={teams}
              onCreated={onTaskCreated}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* Loading */}
          {loading && tasks.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <span className="text-[15px] text-[var(--color-text-tertiary)]">
                Loading...
              </span>
            </div>
          )}

          {/* Empty state */}
          {!loading && tasks.length === 0 && !showAddForm && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-[15px] text-[var(--color-text-secondary)] mb-1">
                  No scheduled tasks
                </div>
                <div className="text-[14px] text-[var(--color-text-tertiary)]">
                  Add a task above or ask any agent in chat
                </div>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="flex flex-col gap-2">
            {sorted.map((task) => {
              const agent = agents.find((a) => a.id === task.agent_id);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  agent={agent}
                  onToggle={(enabled) => toggleTask(task.id, enabled)}
                  onDelete={() => deleteTask(task.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task card ───

function TaskCard({
  task,
  agent,
  onToggle,
  onDelete,
}: {
  task: ScheduledTask;
  agent?: { name: string; color: string };
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  let scheduleDesc: string;
  try {
    scheduleDesc = describeCron(task.cron);
  } catch {
    scheduleDesc = task.cron;
  }

  return (
    <div
      className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)] transition-opacity"
      style={{ opacity: task.enabled ? 1 : 0.55 }}
    >
      {/* Top row: agent + toggle + delete */}
      <div className="flex items-center gap-2 mb-2">
        {agent && (
          <>
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: agent.color }}
            />
            <span
              className="text-[13px] font-semibold"
              style={{ color: agent.color }}
            >
              {agent.name}
            </span>
          </>
        )}
        {!agent && (
          <span className="text-[13px] text-[var(--color-text-tertiary)]">
            Unknown agent
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => onToggle(!task.enabled)}
          className="bg-transparent border-none cursor-pointer py-0.5 px-2 rounded-md text-[12px] font-semibold transition-colors"
          style={{
            color: task.enabled
              ? "var(--color-accent)"
              : "var(--color-text-tertiary)",
            background: task.enabled
              ? "var(--color-accent-soft)"
              : "var(--color-hover)",
          }}
        >
          {task.enabled ? "Active" : task.recurring === false && task.last_run_at ? "Completed" : "Paused"}
        </button>
        <button
          onClick={onDelete}
          className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1 flex hover:text-[var(--color-red)] transition-colors"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Instruction */}
      <div className="text-[14px] text-[var(--color-text)] leading-relaxed mb-2">
        {task.instruction}
      </div>

      {/* Schedule + times */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-tertiary)]">
        <span className="flex items-center gap-1">
          <CalendarIcon />
          {task.recurring === false ? "One-off" : scheduleDesc}
        </span>
        <span>&middot;</span>
        <span>{task.timezone}</span>
        <span>&middot;</span>
        <span>{task.destination === "group" ? "# All" : task.destination?.startsWith("team:") ? "Team channel" : "DM"}</span>
        {task.last_run_at && (
          <>
            <span>&middot;</span>
            <span>Ran {formatRelativeTime(task.last_run_at)}</span>
          </>
        )}
        {task.next_run_at && task.enabled && (
          <>
            <span>&middot;</span>
            <span>Next {formatFutureTime(task.next_run_at)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Add task form ───

function AddTaskForm({
  agents,
  teams,
  onCreated,
  onCancel,
}: {
  agents: { id: string; name: string; color: string }[];
  teams: { id: string; name: string }[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [instruction, setInstruction] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [destination, setDestination] = useState<string>("dm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cron = buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth);

  let nextRunPreview = "";
  try {
    const next = getNextRun(cron, new Date());
    nextRunPreview = next.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    nextRunPreview = "Unable to calculate";
  }

  const selectedAgent = agents.find((a) => a.id === agentId);

  const save = async () => {
    if (!agentId || !instruction.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          instruction: instruction.trim(),
          cron,
          timezone,
          destination,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const amPm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return (
    <div className="border border-[var(--color-accent)] rounded-xl p-4 bg-[var(--color-surface)] mb-4">
      <div className="text-[15px] font-semibold text-[var(--color-text)] mb-4">
        New scheduled task
      </div>

      {error && (
        <div className="mb-3 text-[13px] text-[var(--color-red)] bg-[var(--color-red-soft)] px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Agent picker */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Agent
        </label>
        <div className="relative">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full py-2.5 pl-3 pr-8 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
            <ChevronDownIcon />
          </div>
        </div>
        {selectedAgent && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Avatar name={selectedAgent.name} color={selectedAgent.color} size={16} />
            <span className="text-[12px] text-[var(--color-text-tertiary)]">
              {selectedAgent.name} will run this task
            </span>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Instruction
        </label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="What should the agent do? e.g. 'Summarize the latest news about our industry'"
          rows={2}
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Schedule */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Schedule
        </label>

        {/* Frequency */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(
            [
              ["daily", "Daily"],
              ["weekdays", "Weekdays"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
            ] as [Frequency, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className="py-1.5 px-3 rounded-lg border text-[13px] font-medium cursor-pointer transition-colors"
              style={{
                borderColor:
                  frequency === f
                    ? "var(--color-accent)"
                    : "var(--color-border)",
                background:
                  frequency === f
                    ? "var(--color-accent-soft)"
                    : "transparent",
                color:
                  frequency === f
                    ? "var(--color-accent)"
                    : "var(--color-text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            at
          </span>
          <div className="relative">
            <select
              value={hour12}
              onChange={(e) => {
                const h12 = parseInt(e.target.value, 10);
                setHour(amPm === "AM" ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12));
              }}
              className="py-2 pl-3 pr-7 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
            >
              {Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              <ChevronDownIcon />
            </div>
          </div>
          <span className="text-[14px] text-[var(--color-text-secondary)]">:</span>
          <div className="relative">
            <select
              value={minute}
              onChange={(e) => setMinute(parseInt(e.target.value, 10))}
              className="py-2 pl-3 pr-7 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m.toString().padStart(2, "0")}
                </option>
              ))}
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              <ChevronDownIcon />
            </div>
          </div>
          <div className="relative">
            <select
              value={amPm}
              onChange={(e) => {
                const newAmPm = e.target.value;
                if (newAmPm === "AM" && hour >= 12) setHour(hour - 12);
                if (newAmPm === "PM" && hour < 12) setHour(hour + 12);
              }}
              className="py-2 pl-3 pr-7 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              <ChevronDownIcon />
            </div>
          </div>

          {/* Day of week (for weekly) */}
          {frequency === "weekly" && (
            <>
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                on
              </span>
              <div className="relative">
                <select
                  value={dayOfWeek}
                  onChange={(e) =>
                    setDayOfWeek(parseInt(e.target.value, 10))
                  }
                  className="py-2 pl-3 pr-7 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
                  <ChevronDownIcon />
                </div>
              </div>
            </>
          )}

          {/* Day of month (for monthly) */}
          {frequency === "monthly" && (
            <>
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                on day
              </span>
              <div className="relative">
                <select
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(parseInt(e.target.value, 10))
                  }
                  className="py-2 pl-3 pr-7 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
                  <ChevronDownIcon />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timezone */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Timezone
        </label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Deliver to */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5">
          Deliver to
        </label>
        <div className="relative">
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full py-2.5 pl-3 pr-8 border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none appearance-none cursor-pointer focus:border-[var(--color-accent)]"
          >
            <option value="dm">Direct message</option>
            <option value="group"># All (group chat)</option>
            {teams.map((t) => (
              <option key={t.id} value={`team:${t.id}`}>
                # {t.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-4 px-3 py-2.5 bg-[var(--color-input-bg)] rounded-lg">
        <div className="text-[12px] text-[var(--color-text-tertiary)] mb-0.5">
          Next run
        </div>
        <div className="text-[14px] text-[var(--color-text)] font-medium">
          {nextRunPreview}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!agentId || !instruction.trim() || saving}
          className="flex-1 py-2.5 px-4 border-none rounded-lg text-[14px] font-semibold cursor-pointer disabled:cursor-default transition-colors bg-[var(--color-accent)] text-white disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create task"}
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 bg-transparent border border-[var(--color-border)] rounded-lg text-[14px] text-[var(--color-text-secondary)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
