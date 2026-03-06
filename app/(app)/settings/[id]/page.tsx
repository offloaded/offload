"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../layout";
import {
  BackIcon,
  TrashIcon,
  FileIcon,
  PlusIcon,
  XIcon,
} from "@/components/Icons";
import type { Document } from "@/lib/types";

const PALETTE = [
  "#2C5FF6",
  "#16A34A",
  "#D97706",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#4F46E5",
  "#C026D3",
  "#059669",
  "#E11D48",
];

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { agents, refreshAgents, mobile } = useApp();
  const isNew = params.id === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = !isNew ? agents.find((a) => a.id === params.id) : null;

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPurpose(existing.purpose);
      setColor(existing.color);
    } else if (isNew) {
      setColor(PALETTE[agents.length % PALETTE.length]);
    }
  }, [existing, isNew, agents.length]);

  const loadDocs = useCallback(() => {
    if (!isNew && params.id) {
      fetch(`/api/agents/documents?agent_id=${params.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setDocs)
        .catch(() => {});
    }
  }, [isNew, params.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Poll for processing status
  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(loadDocs, 3000);
    return () => clearInterval(interval);
  }, [docs, loadDocs]);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/agents", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? {} : { id: params.id }),
          name: name.trim(),
          purpose: purpose.trim(),
          color,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      await refreshAgents();
      router.push("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/agents?id=${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      await refreshAgents();
      router.push("/settings");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete agent"
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("agent_id", params.id as string);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      loadDocs();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload document"
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (docId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/agents/documents?id=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || `Delete failed (${res.status})`
        );
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      e.target.value = "";
    }
  };

  if (!isNew && !existing && agents.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Agent not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header — sticky */}
      <div
        className={`sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-2.5 ${mobile ? "px-4 py-2.5 border-b border-[var(--color-border)]" : "px-10 pt-8 pb-0"}`}
      >
        <button
          onClick={() => router.push("/settings")}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
        >
          <BackIcon />
        </button>
        <span className="text-lg font-semibold text-[var(--color-text)]">
          {isNew ? "New Agent" : "Edit Agent"}
        </span>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto">
      <div className={`max-w-[520px] ${mobile ? "p-4" : "px-10 pt-5 pb-8"}`}>

        {error && (
          <div className="mb-5 text-sm text-[var(--color-red)] bg-[var(--color-red-soft)] px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Color picker */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
            Colour
          </label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <div
                key={c}
                onClick={() => setColor(c)}
                className="w-[26px] h-[26px] rounded-full cursor-pointer"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. HR Advisor, Marketing Lead..."
            className="w-full py-2.5 px-3.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Purpose */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
            Purpose
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={4}
            placeholder="Describe this agent's role and how it should behave..."
            className="w-full py-2.5 px-3.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Documents */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
            Documents
          </label>
          <div className="border border-[var(--color-border)] rounded-[10px] overflow-hidden">
            {docs.map((d) => (
              <div
                key={d.id}
                className="py-2.5 px-3.5 flex items-center gap-2 border-b border-[var(--color-border-light)]"
              >
                <div className="text-[var(--color-text-tertiary)]">
                  <FileIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--color-text)]">
                    {d.file_name}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-tertiary)]">
                    {formatSize(d.file_size)}
                    {d.status === "processing" && (
                      <span className="ml-2 text-[var(--color-accent)]">
                        Processing...
                      </span>
                    )}
                    {d.status === "error" && (
                      <span className="ml-2 text-[var(--color-red)]">
                        Error
                      </span>
                    )}
                    {d.status === "ready" && (
                      <span className="ml-2 text-[var(--color-green)]">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteDoc(d.id)}
                  className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-red)]"
                >
                  <XIcon />
                </button>
              </div>
            ))}
            {docs.length === 0 && !isNew && (
              <div className="py-3 px-3.5 text-[13px] text-[var(--color-text-tertiary)]">
                No documents uploaded yet
              </div>
            )}
            {!isNew && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-2.5 px-3.5 flex items-center gap-1.5 border-none bg-transparent cursor-pointer text-[var(--color-accent)] text-[13px] font-medium disabled:opacity-50"
                >
                  <PlusIcon />{" "}
                  {uploading ? "Uploading..." : "Upload document"}
                </button>
              </>
            )}
            {isNew && (
              <div className="py-3 px-3.5 text-[13px] text-[var(--color-text-tertiary)]">
                Save the agent first, then upload documents
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="flex-1 py-2.5 px-5 border-none rounded-lg text-sm font-semibold cursor-pointer disabled:cursor-default transition-colors"
            style={{
              background: name.trim()
                ? "var(--color-accent)"
                : "var(--color-active)",
              color: name.trim() ? "#fff" : "var(--color-text-tertiary)",
            }}
          >
            {saving ? "..." : isNew ? "Create Agent" : "Save"}
          </button>
          {!isNew && (
            <button
              onClick={remove}
              disabled={saving}
              className="py-2.5 px-3.5 bg-[var(--color-red-soft)] text-[var(--color-red)] border-none rounded-lg cursor-pointer flex items-center"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
