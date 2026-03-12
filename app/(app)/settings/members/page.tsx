"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../layout";
import { MenuIcon } from "@/components/Icons";
import type { WorkspaceMember, WorkspaceInvite } from "@/lib/types";

export default function MembersPage() {
  const { mobile, openDrawer, workspace, workspaceRole, refreshWorkspace } = useApp();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const canManage = workspaceRole === "owner" || workspaceRole === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      fetch("/api/workspaces/members"),
      fetch("/api/workspaces/invite"),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (invitesRes.ok) setInvites(await invitesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const res = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
      } else {
        setInviteSuccess(
          data.immediate
            ? `${inviteEmail.trim()} has been added to the workspace.`
            : `Invite sent to ${inviteEmail.trim()}`
        );
        setInviteEmail("");
        loadData();
      }
    } catch {
      setInviteError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const res = await fetch(`/api/workspaces/members?user_id=${userId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const res = await fetch("/api/workspaces/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (res.ok) loadData();
  };

  const handleCancelInvite = async (inviteId: string) => {
    const res = await fetch(`/api/workspaces/invite?id=${inviteId}`, {
      method: "DELETE",
    });
    if (res.ok) loadData();
  };

  const handleRenameWorkspace = async () => {
    const name = prompt("Workspace name:", workspace?.name || "");
    if (!name?.trim() || name.trim() === workspace?.name) return;
    const res = await fetch("/api/workspaces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: workspace?.id, name: name.trim() }),
    });
    if (res.ok) refreshWorkspace();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0">
        <div className="flex items-center gap-3 mb-0 max-w-[520px]">
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex md:hidden rounded-lg hover:bg-[var(--color-hover)]"
          >
            <MenuIcon />
          </button>
          <span className="text-[16px] font-semibold text-[var(--color-text)] flex-1">
            Team Members
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[520px] p-4 pt-3 md:px-10 md:pt-5 md:pb-8">
          {/* Workspace info */}
          <div className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[14px] font-semibold text-[var(--color-text)]">
                {workspace?.name || "Workspace"}
              </div>
              {canManage && (
                <button
                  onClick={handleRenameWorkspace}
                  className="text-[13px] text-[var(--color-accent)] bg-transparent border-none cursor-pointer hover:underline"
                >
                  Rename
                </button>
              )}
            </div>
            <div className="text-[13px] text-[var(--color-text-tertiary)]">
              {members.length} member{members.length !== 1 ? "s" : ""} · Your role: {workspaceRole}
            </div>
          </div>

          {/* Invite section */}
          {canManage && (
            <div className="mb-6">
              <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Invite member
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError("");
                    setInviteSuccess("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] text-[14px] outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-xl border-none text-[14px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white disabled:opacity-50"
                >
                  {inviting ? "..." : "Invite"}
                </button>
              </div>
              {inviteError && (
                <div className="text-[13px] text-red-500 mt-1.5">{inviteError}</div>
              )}
              {inviteSuccess && (
                <div className="text-[13px] text-green-600 mt-1.5">{inviteSuccess}</div>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="mb-6">
            <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Members
            </div>

            {loading ? (
              <div className="py-4 text-center text-[14px] text-[var(--color-text-tertiary)]">
                Loading...
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)]"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-active)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-secondary)]">
                      {(m.display_name || m.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[var(--color-text)] truncate">
                        {m.display_name || m.email || "Unknown"}
                      </div>
                      {m.display_name && m.email && (
                        <div className="text-[12px] text-[var(--color-text-tertiary)] truncate">
                          {m.email}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage && m.role !== "owner" ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                          className="text-[12px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[var(--color-text-secondary)] outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-[12px] text-[var(--color-text-tertiary)] px-2 py-1 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                          {m.role}
                        </span>
                      )}
                      {canManage && m.role !== "owner" && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-[12px] text-red-500 bg-transparent border-none cursor-pointer hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {invites.filter((i) => i.status === "pending").length > 0 && (
            <div>
              <div className="text-[13px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Pending invitations
              </div>
              <div className="flex flex-col gap-1">
                {invites
                  .filter((i) => i.status === "pending")
                  .map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--color-border)]"
                    >
                      <div className="w-8 h-8 rounded-xl bg-[var(--color-hover)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-tertiary)]">
                        ?
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] text-[var(--color-text-secondary)] truncate">
                          {invite.email}
                        </div>
                        <div className="text-[12px] text-[var(--color-text-tertiary)]">
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="text-[12px] text-[var(--color-text-tertiary)] bg-transparent border-none cursor-pointer hover:text-red-500"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
