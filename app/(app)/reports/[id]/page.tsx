"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/app/(app)/layout";
import { MenuIcon, BackIcon, CopyIcon, DownloadIcon, TrashIcon, SaveIcon } from "@/components/Icons";

interface Report {
  id: string;
  title: string;
  display_name: string | null;
  content: string;
  source: string;
  agent_id: string | null;
  agent_name: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { openDrawer, refreshReportCount } = useApp();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReport(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const startEditing = useCallback(() => {
    if (!report) return;
    setEditTitle(report.display_name || report.title);
    setEditContent(report.content);
    setEditing(true);
  }, [report]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!report) return;
    const currentDisplayName = report.display_name || report.title;
    const titleChanged = editTitle.trim() !== currentDisplayName;
    const contentChanged = editContent !== report.content;
    if (!titleChanged && !contentChanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (titleChanged) body.display_name = editTitle.trim();
      if (contentChanged) body.content = editContent;
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setReport({
          ...report,
          display_name: titleChanged ? editTitle.trim() : report.display_name,
          content: contentChanged ? editContent : report.content,
          updated_at: new Date().toISOString(),
        });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [report, editTitle, editContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (editing && contentRef.current) {
      const el = contentRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editing, editContent]);

  const handleCopy = useCallback(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  const handleDownloadPdf = useCallback(() => {
    if (!report) return;
    const displayTitle = report.display_name || report.title;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${displayTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
          pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
          code { font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>${displayTitle}</h1>
        <div class="meta">${report.agent_name ? `By ${report.agent_name} · ` : ""}${new Date(report.created_at).toLocaleDateString()}</div>
        <div style="white-space: pre-wrap;">${report.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }, [report]);

  const handleDelete = useCallback(async () => {
    if (!report || !confirm("Delete this report?")) return;
    const res = await fetch(`/api/reports?id=${report.id}`, { method: "DELETE" });
    if (res.ok) {
      refreshReportCount();
      router.push("/reports");
    }
  }, [report, router, refreshReportCount]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-[15px] text-[var(--color-text-tertiary)]">Report not found</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 py-3 px-4 md:py-3.5 md:px-6 pt-safe">
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
        >
          <MenuIcon />
        </button>
        <button
          onClick={() => router.push("/reports")}
          className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0.5 flex hover:text-[var(--color-text-secondary)]"
        >
          <BackIcon />
        </button>
        <span className="text-[16px] font-semibold text-[var(--color-text)] flex-1 truncate">
          {report.display_name || report.title}
        </span>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={cancelEditing}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] border-none text-white cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
              >
                <SaveIcon />
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleCopy}
                className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1.5 flex items-center gap-1 hover:text-[var(--color-text-secondary)] transition-colors rounded-md hover:bg-[var(--color-hover)]"
                title="Copy markdown"
              >
                <CopyIcon />
                {copied && <span className="text-[11px] text-[var(--color-accent)]">Copied</span>}
              </button>
              <button
                onClick={handleDownloadPdf}
                className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1.5 flex hover:text-[var(--color-text-secondary)] transition-colors rounded-md hover:bg-[var(--color-hover)]"
                title="Download PDF"
              >
                <DownloadIcon />
              </button>
              <button
                onClick={handleDelete}
                className="bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1.5 flex hover:text-red-500 transition-colors rounded-md hover:bg-[var(--color-hover)]"
                title="Delete report"
              >
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-[52px] md:pt-0">
        <div className="max-w-[720px] mx-auto px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-[22px] font-bold text-[var(--color-text)] bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-2 mb-2 outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            ) : (
              <h1 className="text-[22px] font-bold text-[var(--color-text)] mb-2">
                {report.display_name || report.title}
              </h1>
            )}
            <div className="text-[13px] text-[var(--color-text-tertiary)] flex items-center gap-2 flex-wrap">
              {report.agent_name && (
                <>
                  <span>By {report.agent_name}</span>
                  <span>·</span>
                </>
              )}
              <span>{formatDate(report.created_at)}</span>
              {report.source === "agent" && (
                <>
                  <span>·</span>
                  <span className="text-[var(--color-accent)]">Auto-generated</span>
                </>
              )}
              {report.updated_at !== report.created_at && (
                <>
                  <span>·</span>
                  <span>Edited {formatDate(report.updated_at)}</span>
                </>
              )}
            </div>
          </div>

          {editing ? (
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full text-[15px] leading-relaxed text-[var(--color-text)] bg-transparent border border-[var(--color-border)] rounded-lg px-4 py-3 outline-none focus:border-[var(--color-accent)] transition-colors resize-none min-h-[300px]"
              style={{ fontFamily: "inherit" }}
            />
          ) : (
            <div className="text-[15px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
              {report.content}
            </div>
          )}

          {/* Export options */}
          {!editing && (
            <div className="mt-8 pt-6 border-t border-[var(--color-border-light)]">
              <div className="text-[12px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
                Export
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] font-medium text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
                >
                  <CopyIcon />
                  {copied ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] font-medium text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
                >
                  <DownloadIcon />
                  Download PDF
                </button>
                <button
                  disabled
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[13px] font-medium text-[var(--color-text-tertiary)] cursor-not-allowed opacity-50"
                  title="Coming soon"
                >
                  Google Drive (coming soon)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
