"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { XIcon, SaveIcon } from "./Icons";

interface Report {
  id: string;
  title: string;
  content: string;
  source: string;
  agent_id: string | null;
  agent_name: string | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportPanelProps {
  reportId: string;
  onClose: () => void;
  onDoneEditing?: (report: Report, originalContent: string, editedContent: string) => void;
  // Live update from agent's update_report tool
  liveUpdate?: { report_id: string; title: string; content: string } | null;
  // Pre-loaded data from save_report event — avoids API round-trip
  initialData?: { title: string; content: string; agent_name?: string; agent_id?: string } | null;
}

export function ReportPanel({ reportId, onClose, onDoneEditing, liveUpdate, initialData }: ReportPanelProps) {
  const [report, setReport] = useState<Report | null>(() => {
    // If we have initial data from the save_report event, use it immediately
    if (initialData) {
      return {
        id: reportId,
        title: initialData.title,
        content: initialData.content,
        source: "agent",
        agent_id: initialData.agent_id || null,
        agent_name: initialData.agent_name || null,
        conversation_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(!initialData);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [originalContentSnapshot, setOriginalContentSnapshot] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Fetch report data — skip if we already have initialData
  useEffect(() => {
    if (initialData) return; // Already have data, no fetch needed
    setLoading(true);
    fetch(`/api/reports/${reportId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setReport(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId, initialData]);

  // Handle live updates from agent
  useEffect(() => {
    if (liveUpdate && liveUpdate.report_id === reportId && report && !editing) {
      setReport({
        ...report,
        title: liveUpdate.title,
        content: liveUpdate.content,
        updated_at: new Date().toISOString(),
      });
    }
  }, [liveUpdate, reportId, editing]);

  // Auto-resize textarea
  useEffect(() => {
    if (editing && contentRef.current) {
      const el = contentRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editing, editContent]);

  const startEditing = useCallback(() => {
    if (!report) return;
    setEditContent(report.content);
    setOriginalContentSnapshot(report.content);
    setEditing(true);
  }, [report]);

  const handleDoneEditing = useCallback(async () => {
    if (!report) return;
    const contentChanged = editContent !== originalContentSnapshot;
    if (!contentChanged) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        const updatedReport = {
          ...report,
          content: editContent,
          updated_at: new Date().toISOString(),
        };
        setReport(updatedReport);
        setEditing(false);

        // Trigger the feedback loop — send diff to agent
        if (onDoneEditing) {
          onDoneEditing(updatedReport, originalContentSnapshot, editContent);
        }
      }
    } finally {
      setSaving(false);
    }
  }, [report, editContent, originalContentSnapshot, onDoneEditing]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-surface)]">
        <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-surface)]">
        <span className="text-[15px] text-[var(--color-text-tertiary)]">Report not found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] overflow-hidden">
      {/* Panel header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[var(--color-text)] truncate">
            {report.title}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">
            {report.agent_name && `By ${report.agent_name}`}
            {report.agent_name && report.source === "agent" && " · Auto-generated"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={cancelEditing}
                className="px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDoneEditing}
                disabled={saving}
                className="px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] border-none text-white cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
              >
                <SaveIcon />
                {saving ? "Saving..." : "Done editing"}
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)] transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors flex"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {editing ? (
          <textarea
            ref={contentRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full text-[14px] leading-relaxed text-[var(--color-text)] bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg px-3 py-3 outline-none focus:border-[var(--color-accent)] transition-colors resize-none min-h-[300px]"
            style={{ fontFamily: "inherit" }}
          />
        ) : (
          <div className="text-[14px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
            {report.content}
          </div>
        )}
      </div>
    </div>
  );
}
