"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../../layout";
import { BackIcon, TrashIcon, LockIcon } from "@/components/Icons";
import type { WorkspaceMember } from "@/lib/types";

interface ChannelMember {
  channel_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string;
}

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const { agents, teams, refreshTeams, workspaceRole, workspace } = useApp();
  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  const team = teams.find((t) => t.id === teamId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Marketplace
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishDesc, setPublishDesc] = useState("");
  const [publishCategory, setPublishCategory] = useState("Custom");
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);

  // Private channel member management
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description);
      setSelectedAgentIds(team.agent_ids);
    }
  }, [team]);

  // Check if team is published to marketplace
  useEffect(() => {
    if (!team || team.is_system) return;
    fetch(`/api/marketplace?type=team&q=${encodeURIComponent(team.name)}`)
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then(({ listings }) => {
        const match = (listings || []).find((l: { source_team_id: string }) => l.source_team_id === teamId);
        if (match) setPublishedId(match.id);
      })
      .catch(() => {});
  }, [team, teamId]);

  // Load channel members for private channels
  useEffect(() => {
    if (!team || team.visibility !== "private") return;
    fetch(`/api/teams/members?team_id=${teamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setChannelMembers)
      .catch(() => {});
  }, [team, teamId]);

  // Load workspace members for add-member flow
  useEffect(() => {
    if (!workspace) return;
    fetch("/api/workspaces/members")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWorkspaceMembers)
      .catch(() => {});
  }, [workspace]);

  if (!canManage) {
    return (
      <div className="flex-1 flex items-center justify-center text-[14px] text-[var(--color-text-secondary)]">
        You don&apos;t have permission to edit teams
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center text-[14px] text-[var(--color-text-secondary)]">
        Team not found
      </div>
    );
  }

  // System channels cannot be edited
  if (team.is_system) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
        <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0">
          <button
            onClick={() => router.push(`/team/${teamId}`)}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex rounded-lg hover:bg-[var(--color-hover)]"
          >
            <BackIcon />
          </button>
          <span className="text-[16px] font-semibold text-[var(--color-text)]">
            Channel Settings
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-[400px] px-4">
            <div className="text-[14px] text-[var(--color-text-secondary)] mb-2">
              #{team.name} is a system channel
            </div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">
              This channel is automatically created for every workspace and cannot be modified or deleted.
            </div>
          </div>
        </div>
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

  const addChannelMember = async (userId: string) => {
    const res = await fetch("/api/teams/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, user_id: userId }),
    });
    if (res.ok) {
      // Refresh channel members
      const updated = await fetch(`/api/teams/members?team_id=${teamId}`).then((r) => r.json());
      setChannelMembers(updated);
      setShowAddMember(false);
    }
  };

  const removeChannelMember = async (userId: string) => {
    const res = await fetch(`/api/teams/members?team_id=${teamId}&user_id=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setChannelMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }
  };

  const existingMemberIds = new Set(channelMembers.map((m) => m.user_id));
  const availableMembers = workspaceMembers.filter((m) => !existingMemberIds.has(m.user_id));

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
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          Channel Settings
        </span>
        {team.visibility === "private" && (
          <span className="text-[var(--color-text-tertiary)] ml-1">
            <LockIcon />
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[600px] w-full p-4 md:px-10 md:pt-5 md:pb-8">
          {error && (
            <div className="mb-5 text-[14px] text-[var(--color-red)] bg-[var(--color-red-soft)] px-3.5 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Channel Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-xl text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel for?"
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-xl text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Private channel member management */}
          {team.visibility === "private" && (
            <div className="mb-7">
              <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
                Channel Members
              </label>
              <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">
                Only these workspace members can see this private channel.
              </p>
              <div className="flex flex-col gap-1.5 mb-3">
                {channelMembers.map((cm) => {
                  const wsMember = workspaceMembers.find((m) => m.user_id === cm.user_id);
                  return (
                    <div
                      key={cm.user_id}
                      className="flex items-center gap-3 py-2.5 px-4 rounded-xl border border-[var(--color-border)]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-[var(--color-text)]">
                          {wsMember?.display_name || wsMember?.email || "Member"}
                          <span className="text-[12px] text-[var(--color-text-tertiary)] font-normal ml-1.5">
                            {wsMember?.role}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeChannelMember(cm.user_id)}
                        className="text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-red)] bg-transparent border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
              {!showAddMember && availableMembers.length > 0 && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-[13px] font-medium text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline"
                >
                  + Add member
                </button>
              )}
              {showAddMember && (
                <div className="flex flex-col gap-1.5 mt-2 p-3 border border-[var(--color-border)] rounded-xl">
                  <div className="text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1">
                    Add a workspace member
                  </div>
                  {availableMembers.map((m) => (
                    <button
                      key={m.user_id}
                      onClick={() => addChannelMember(m.user_id)}
                      className="flex items-center gap-3 py-2 px-3 rounded-xl bg-transparent border border-[var(--color-border)] cursor-pointer text-left hover:bg-[var(--color-hover)] transition-colors"
                    >
                      <div className="text-[14px] text-[var(--color-text)]">
                        {m.display_name || m.email || "Member"}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAddMember(false)}
                    className="text-[12px] text-[var(--color-text-tertiary)] bg-transparent border-none cursor-pointer mt-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-1">
              Agent Members
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
                    className="flex items-center gap-3 py-3 px-4 rounded-xl border cursor-pointer text-left transition-all"
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
                Working standards set on individual agents. Edit these in each agent&apos;s settings.
              </p>
              <div className="flex flex-col gap-3">
                {teamExpectations.map(({ agent, expectations }) => (
                  <div key={agent.id} className="border border-[var(--color-border)] rounded-xl p-3">
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

          {/* Marketplace */}
          {canManage && (
            <div className="mb-7">
              <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
                Marketplace
              </label>
              {publishedId ? (
                <div className="flex items-center gap-3 py-3 px-4 border border-[var(--color-border)] rounded-xl">
                  <span className="text-[14px] text-[var(--color-green)] font-medium flex-1">Published to Marketplace</span>
                  <button
                    onClick={async () => {
                      setUnpublishing(true);
                      const res = await fetch(`/api/marketplace/publish?id=${publishedId}`, { method: "DELETE" });
                      if (res.ok) setPublishedId(null);
                      setUnpublishing(false);
                    }}
                    disabled={unpublishing}
                    className="text-[13px] text-[var(--color-red)] bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50"
                  >
                    {unpublishing ? "..." : "Unpublish"}
                  </button>
                </div>
              ) : publishOpen ? (
                <div className="border border-[var(--color-border)] rounded-xl p-4">
                  <div className="mb-3 p-3 bg-[var(--color-accent-soft)] rounded-xl text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    <div className="font-semibold text-[var(--color-text)] mb-1">Before publishing, please note:</div>
                    Publishing shares this team&apos;s full configuration, all agent configurations, AND knowledge base documents with all Offloaded users who adopt it.
                    Review each agent&apos;s knowledge base and remove any confidential, client-specific, or copyrighted material.
                    Conversation history, scheduled tasks, and API keys are never shared.
                  </div>
                  <div className="mb-3">
                    <label className="block text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1">Description (required)</label>
                    <textarea
                      value={publishDesc}
                      onChange={(e) => setPublishDesc(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Describe what this team does and who it's for..."
                      className="w-full py-2 px-3 border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-none focus:border-[var(--color-accent)]"
                    />
                    <div className="text-[11px] text-[var(--color-text-tertiary)] text-right mt-0.5">{publishDesc.length}/500</div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-[12px] font-medium text-[var(--color-text-tertiary)] mb-1">Category (required)</label>
                    <select
                      value={publishCategory}
                      onChange={(e) => setPublishCategory(e.target.value)}
                      className="w-full py-2 px-3 border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none"
                    >
                      {["Business Advisory","Coaching & Training","Operations","Research & Analysis","Health & Fitness","Legal & Compliance","Finance","Marketing","Custom"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!publishDesc.trim() || publishing) return;
                        setPublishing(true);
                        setError("");
                        try {
                          const res = await fetch("/api/marketplace/publish", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: "team", team_id: teamId, description: publishDesc.trim(), category: publishCategory }),
                          });
                          if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Publish failed"); }
                          const listing = await res.json();
                          setPublishedId(listing.id);
                          setPublishOpen(false);
                        } catch (err) { setError(err instanceof Error ? err.message : "Publish failed"); }
                        finally { setPublishing(false); }
                      }}
                      disabled={!publishDesc.trim() || publishing}
                      className="flex-1 py-2.5 border-none rounded-xl text-[13px] font-semibold cursor-pointer disabled:opacity-50 bg-[var(--color-accent)] text-white"
                    >
                      {publishing ? "Publishing..." : "Publish to Marketplace"}
                    </button>
                    <button
                      onClick={() => setPublishOpen(false)}
                      className="py-2.5 px-4 border border-[var(--color-border)] rounded-xl bg-transparent text-[13px] text-[var(--color-text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPublishOpen(true)}
                  className="w-full py-3 px-4 border border-dashed border-[var(--color-border)] rounded-xl bg-transparent cursor-pointer text-[14px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-hover)] transition-colors"
                >
                  Publish to Marketplace
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={!name.trim() || saving}
              className="flex-1 py-3 px-5 border-none rounded-xl text-[15px] font-semibold cursor-pointer disabled:cursor-default transition-colors"
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
              className="py-3 px-4 bg-[var(--color-red-soft)] text-[var(--color-red)] border-none rounded-xl cursor-pointer flex items-center"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
