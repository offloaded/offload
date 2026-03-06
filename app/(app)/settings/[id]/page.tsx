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

interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: "uploading" | "processing" | "ready" | "error";
  errorMessage?: string;
}

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
  const [uploads, setUploads] = useState<UploadItem[]>([]);

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

  const uploadSingleFile = async (file: File, uploadId: string) => {
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
      const doc = await res.json();
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, status: doc.status === "ready" ? "ready" : doc.status === "error" ? "error" : "processing" }
            : u
        )
      );
      loadDocs();
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                status: "error" as const,
                errorMessage:
                  err instanceof Error ? err.message : "Upload failed",
              }
            : u
        )
      );
    }
  };

  const uploadFiles = async (files: File[]) => {
    setError("");

    const newUploads: UploadItem[] = files.map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: file.name,
      fileSize: file.size,
      status: "uploading" as const,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Process up to 3 files concurrently
    const concurrency = 3;
    const queue = [...files.map((file, i) => ({ file, uploadId: newUploads[i].id }))];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        await uploadSingleFile(item.file, item.uploadId);
      }
    });

    await Promise.all(workers);
  };

  const deleteDoc = async (docId: string) => {
    setError("");
    try {
      const res = await fetch(`/api/agents/documents?id=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      uploadFiles(Array.from(fileList));
      e.target.value = "";
    }
  };

  const dismissUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  const hasActiveUploads = uploads.some(
    (u) => u.status === "uploading" || u.status === "processing"
  );

  if (!isNew && !existing && agents.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[15px] text-[var(--color-text-secondary)]">
        Agent not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[var(--color-surface)] shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] md:px-10 md:pt-8 md:pb-0 md:border-b-0"
      >
        <button
          onClick={() => router.push("/settings")}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
        >
          <BackIcon />
        </button>
        <span className="text-[18px] font-semibold text-[var(--color-text)]">
          {isNew ? "New Agent" : "Edit Agent"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[520px] p-4 md:px-10 md:pt-5 md:pb-8">
          {error && (
            <div className="mb-5 text-[14px] text-[var(--color-red)] bg-[var(--color-red-soft)] px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Color picker */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Colour
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {PALETTE.map((c) => (
                <div
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full cursor-pointer"
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
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HR Advisor, Marketing Lead..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Purpose */}
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Purpose
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Describe this agent's role and how it should behave..."
              className="w-full py-3 px-4 border border-[var(--color-border)] rounded-lg text-[15px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none resize-y leading-relaxed focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Documents */}
          <div className="mb-7">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              Documents
            </label>
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              {/* Active uploads */}
              {uploads.map((u) => (
                <div
                  key={u.id}
                  className="py-3 px-4 flex items-center gap-2.5 border-b border-[var(--color-border-light)]"
                >
                  <div className="text-[var(--color-text-tertiary)]">
                    {u.status === "uploading" ? (
                      <SpinnerIcon />
                    ) : (
                      <FileIcon />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--color-text)]">
                      {u.fileName}
                    </div>
                    <div className="text-[12px] text-[var(--color-text-tertiary)]">
                      {formatSize(u.fileSize)}
                      {u.status === "uploading" && (
                        <span className="ml-2 text-[var(--color-accent)]">
                          Uploading...
                        </span>
                      )}
                      {u.status === "processing" && (
                        <span className="ml-2 text-[var(--color-accent)]">
                          Processing...
                        </span>
                      )}
                      {u.status === "ready" && (
                        <span className="ml-2 text-[var(--color-green)]">
                          Ready
                        </span>
                      )}
                      {u.status === "error" && (
                        <span className="ml-2 text-[var(--color-red)]">
                          {u.errorMessage || "Error"}
                        </span>
                      )}
                    </div>
                  </div>
                  {(u.status === "ready" || u.status === "error") && (
                    <button
                      onClick={() => dismissUpload(u.id)}
                      className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-text)]"
                    >
                      <XIcon />
                    </button>
                  )}
                </div>
              ))}

              {/* Existing documents */}
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="py-3 px-4 flex items-center gap-2.5 border-b border-[var(--color-border-light)]"
                >
                  <div className="text-[var(--color-text-tertiary)]">
                    <FileIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[var(--color-text)]">
                      {d.file_name}
                    </div>
                    <div className="text-[12px] text-[var(--color-text-tertiary)]">
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
              {docs.length === 0 && uploads.length === 0 && !isNew && (
                <div className="py-3.5 px-4 text-[14px] text-[var(--color-text-tertiary)]">
                  No documents uploaded yet
                </div>
              )}
              {!isNew && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={hasActiveUploads}
                    className="w-full py-3 px-4 flex items-center gap-2 border-none bg-transparent cursor-pointer text-[var(--color-accent)] text-[14px] font-medium disabled:opacity-50"
                  >
                    <PlusIcon />{" "}
                    {hasActiveUploads
                      ? `Uploading ${uploads.filter((u) => u.status === "uploading" || u.status === "processing").length} file(s)...`
                      : "Upload documents"}
                  </button>
                </>
              )}
              {isNew && (
                <div className="py-3.5 px-4 text-[14px] text-[var(--color-text-tertiary)]">
                  Save the agent first, then upload documents
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={!name.trim() || saving}
              className="flex-1 py-3 px-5 border-none rounded-lg text-[15px] font-semibold cursor-pointer disabled:cursor-default transition-colors"
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
                className="py-3 px-4 bg-[var(--color-red-soft)] text-[var(--color-red)] border-none rounded-lg cursor-pointer flex items-center"
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

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28 10"
        opacity="0.6"
      />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
