"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../layout";
import { BackIcon } from "@/components/Icons";

export default function NewTeamPage() {
  const router = useRouter();
  const { agents, refreshTeams, workspaceRole } = useApp();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    if (selectedAgentIds.length === 0) {
      setError("Add at least one agent to the team");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          agent_ids: selectedAgentIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      const team = await res.json();
      await refreshTeams();
      router.push(`/team/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex-1 flex items-center justify-center text-[15px] text-[var(--color-text-secondary)]">
        You don&apos;t have permission to create teams
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0">
        <button
          onClick={() => router.back()}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
        >
          <BackIcon />
        </button>
        <span className="text-[18px] font-semibold text-[var(--color-text)]">
          New Team
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[600px] w-full p-4 md:px-10 md:pt-5 md:pb-8">
          {error && (
            <div className="mb-5 text-[14px] text-[var(--color-red)] bg-[var(--color-red-soft)] px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Team Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Scrum, Marketing, Engineering..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
              Team Members
            </label>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">
              Select which agents belong to this team. Agents can be in multiple teams.
            </p>

            {agents.length === 0 ? (
              <div className="py-3.5 px-4 text-[14px] text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded-lg">
                No agents created yet. Create agents first.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {agents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className="flex items-center gap-3 py-3 px-4 rounded-lg border cursor-pointer text-left transition-all"
                      style={{
                        background: selected ? "var(--color-accent-soft)" : "transparent",
                        borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: agent.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-[var(--color-text)]">
                          {agent.name}
                          {agent.role && (
                            <span className="text-[12px] text-[var(--color-text-tertiary)] font-normal ml-1.5">{agent.role}</span>
                          )}
                        </div>
                      </div>
                      <div
                        className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
                          background: selected ? "var(--color-accent)" : "transparent",
                        }}
                      >
                        {selected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="w-full py-3 px-5 border-none rounded-lg text-[15px] font-semibold cursor-pointer disabled:cursor-default transition-colors"
            style={{
              background: name.trim() ? "var(--color-accent)" : "var(--color-active)",
              color: name.trim() ? "#fff" : "var(--color-text-tertiary)",
            }}
          >
            {saving ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
