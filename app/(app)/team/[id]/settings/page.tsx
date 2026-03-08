"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../../layout";
import { BackIcon, TrashIcon } from "@/components/Icons";

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { agents, teams, refreshTeams } = useApp();

  const team = teams.find((t) => t.id === teamId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description);
      setSelectedAgentIds(team.agent_ids);
    }
  }, [team]);

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center text-[15px] text-[var(--color-text-secondary)]">
        Team not found
      </div>
    );
  }

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teamId,
          name: name.trim(),
          description: description.trim(),
          agent_ids: selectedAgentIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      await refreshTeams();
      router.push(`/team/${teamId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save team");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/teams?id=${teamId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      await refreshTeams();
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setSaving(false);
    }
  };

  // Build expectations grouped by agent
  const teamExpectations = agents
    .filter((a) => selectedAgentIds.includes(a.id))
    .filter((a) => a.team_expectations && a.team_expectations.length > 0)
    .map((a) => ({
      agent: a,
      expectations: a.team_expectations!,
    }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0">
        <button
          onClick={() => router.push(`/team/${teamId}`)}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
        >
          <BackIcon />
        </button>
        <span className="text-[18px] font-semibold text-[var(--color-text)]">
          Team Settings
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
              Agents can be in multiple teams.
            </p>
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
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: agent.color }} />
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
          </div>

          {/* Team Expectations (read-only, aggregated from agents) */}
          {teamExpectations.length > 0 && (
            <div className="mb-7">
              <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
                Team Expectations
              </label>
              <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">
                Working standards set on individual agents. Edit these in each agent's settings.
              </p>
              <div className="flex flex-col gap-3">
                {teamExpectations.map(({ agent, expectations }) => (
                  <div key={agent.id} className="border border-[var(--color-border)] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: agent.color }} />
                      <span className="text-[13px] font-semibold text-[var(--color-text)]">{agent.name}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {expectations.map((exp, i) => (
                        <div key={i} className="text-[13px] text-[var(--color-text-secondary)] pl-4">
                          {exp.expectation}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={!name.trim() || saving}
              className="flex-1 py-3 px-5 border-none rounded-lg text-[15px] font-semibold cursor-pointer disabled:cursor-default transition-colors"
              style={{
                background: name.trim() ? "var(--color-accent)" : "var(--color-active)",
                color: name.trim() ? "#fff" : "var(--color-text-tertiary)",
              }}
            >
              {saving ? "..." : "Save"}
            </button>
            <button
              onClick={remove}
              disabled={saving}
              className="py-3 px-4 bg-[var(--color-red-soft)] text-[var(--color-red)] border-none rounded-lg cursor-pointer flex items-center"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
