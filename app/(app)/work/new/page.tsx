"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../layout";
import { Avatar } from "@/components/Avatar";
import { MenuIcon, XIcon } from "@/components/Icons";

export default function NewWorkItemPage() {
  const { agents, mobile, openDrawer, refreshWorkItems } = useApp();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        agent_id: agentId || undefined,
      };
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create work item");
        return;
      }
      const workItem = await res.json();
      await refreshWorkItems();

      // If there are files, upload them to the work item's conversation
      if (files.length > 0 && workItem.conversation_id) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("agent_id", workItem.agent_id || "");
          formData.append("conversation_id", workItem.conversation_id);
          formData.append("message", `[Attached file: ${file.name}]`);
          formData.append("file", file);
          await fetch("/api/chat", { method: "POST", body: formData }).catch(() => {});
        }
      }

      router.push(`/work/${workItem.id}`);
    } catch {
      setError("Failed to create work item");
    } finally {
      setCreating(false);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 px-4 py-3 border-b border-[var(--color-border)] md:px-8 md:py-4">
        <div className="flex items-center gap-3 max-w-[600px]">
          {mobile && (
            <button
              onClick={openDrawer}
              className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex md:hidden rounded-lg hover:bg-[var(--color-hover)]"
            >
              <MenuIcon />
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex rounded-lg hover:bg-[var(--color-hover)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[16px] font-semibold text-[var(--color-text)]">New Work Item</h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-[600px] w-full mx-auto p-4 md:p-8 md:pt-6">
        {/* Title */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)] transition-colors"
            autoFocus
          />
        </div>

        {/* Assign to agent */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">
            Assign to agent
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAgentId("")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition-all border"
              style={{
                background: !agentId ? "var(--color-accent-soft)" : "transparent",
                borderColor: !agentId ? "var(--color-accent)" : "var(--color-border)",
                color: !agentId ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              General Assistant
            </button>
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setAgentId(a.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition-all border"
                style={{
                  background: agentId === a.id ? "var(--color-accent-soft)" : "transparent",
                  borderColor: agentId === a.id ? "var(--color-accent)" : "var(--color-border)",
                  color: agentId === a.id ? "var(--color-accent)" : "var(--color-text-secondary)",
                }}
              >
                <Avatar name={a.name} color={a.color} size={20} />
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">
            Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Describe what needs to be done..."
            rows={5}
            className="w-full py-2.5 px-3 border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)] transition-colors resize-y"
          />
        </div>

        {/* File attachments */}
        <div className="mb-6">
          <label className="block text-[12px] font-semibold text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wider">
            Attachments
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text-secondary)] cursor-pointer hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all bg-transparent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            Attach files
          </button>
          {files.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-hover)] text-[13px]">
                  <span className="flex-1 truncate text-[var(--color-text-secondary)]">{f.name}</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">{(f.size / 1024).toFixed(0)}KB</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0 flex hover:text-[var(--color-red)]"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        {error && (
          <div className="mb-4 text-[13px] text-[var(--color-red)]">{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || creating}
          className="w-full py-3 bg-[var(--color-accent)] text-white border-none rounded-xl text-[14px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default hover:opacity-90 transition-opacity"
        >
          {creating ? "Creating..." : "Create Work Item"}
        </button>
      </div>
    </div>
  );
}
