"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/app/(app)/layout";
import { MenuIcon, ReportIcon, TrashIcon, UploadIcon, PlusIcon, FileIcon } from "@/components/Icons";

interface ReportSummary {
  id: string;
  title: string;
  source: string;
  agent_id: string | null;
  created_at: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  structure: Array<{ heading: string; description: string }>;
  file_name: string | null;
  created_at: string;
}

export default function ReportsPage() {
  const { openDrawer, agents, refreshReportCount, openReport, mobile } = useApp();
  const [tab, setTab] = useState<"reports" | "templates">("reports");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReports(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    fetch("/api/report-templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTemplates(data))
      .catch(() => {})
      .finally(() => { setTemplatesLoading(false); setTemplatesLoaded(true); });
  }, []);

  useEffect(() => {
    if (tab === "templates" && !templatesLoaded && !templatesLoading) {
      loadTemplates();
    }
  }, [tab, templatesLoaded, templatesLoading, loadTemplates]);

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
      refreshReportCount();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/report-templates?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/report-templates/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [data, ...prev]);
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveTemplateEdit = async (id: string) => {
    const res = await fetch("/api/report-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, description: editDesc }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      setEditingTemplate(null);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-50 md:static md:z-10 md:shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-3 py-3 px-4 md:py-3.5 md:px-6 pt-safe">
        <button
          onClick={openDrawer}
          className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-[16px] font-semibold text-[var(--color-text)]">
          Reports
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setTab("reports")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border-none cursor-pointer transition-colors ${
              tab === "reports"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium border-none cursor-pointer transition-colors ${
              tab === "templates"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
            }`}
          >
            Templates
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-[52px] md:pt-0">
        {tab === "reports" && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
              </div>
            )}

            {!loading && reports.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="text-[var(--color-text-tertiary)] mb-3 flex justify-center">
                    <ReportIcon />
                  </div>
                  <div className="text-[15px] text-[var(--color-text-tertiary)]">
                    No reports yet
                  </div>
                  <div className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                    Save agent responses as reports from any chat
                  </div>
                </div>
              </div>
            )}

            {!loading && reports.length > 0 && (
              <div className="max-w-[720px] mx-auto px-4 py-4 md:px-6 md:py-6">
                <div className="flex flex-col gap-1">
                  {reports.map((report) => {
                    const agent = report.agent_id ? agentMap[report.agent_id] : null;
                    return (
                      <div
                        key={report.id}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-hover)] transition-colors group cursor-pointer"
                        onClick={() => {
                          if (mobile) {
                            window.location.href = `/reports/${report.id}`;
                          } else {
                            openReport(report.id);
                          }
                        }}
                      >
                        <div
                          className="flex-1 min-w-0 no-underline flex items-center gap-3"
                        >
                          <span className="text-[var(--color-text-tertiary)] shrink-0">
                            <ReportIcon />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-medium text-[var(--color-text)] truncate">
                              {report.title}
                            </div>
                            <div className="text-[12px] text-[var(--color-text-tertiary)] flex items-center gap-2 mt-0.5">
                              {agent && (
                                <>
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ background: agent.color }}
                                  />
                                  <span>{agent.name}</span>
                                  <span>·</span>
                                </>
                              )}
                              <span>{formatDate(report.created_at)}</span>
                              {report.source === "agent" && (
                                <>
                                  <span>·</span>
                                  <span className="text-[var(--color-accent)]">auto</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                          className="opacity-0 group-hover:opacity-100 bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-red-500 cursor-pointer p-1 transition-opacity"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "templates" && (
          <div className="max-w-[720px] mx-auto px-4 py-4 md:px-6 md:py-6">
            {/* Upload button */}
            <div className="flex items-center gap-2 mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.md"
                onChange={handleUploadTemplate}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--color-border)] bg-transparent text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:border-[var(--color-accent)] cursor-pointer transition-colors disabled:opacity-50"
              >
                <UploadIcon />
                {uploading ? "Uploading..." : "Upload template (.docx, .txt, .md)"}
              </button>
            </div>

            {templatesLoading && (
              <div className="flex items-center justify-center py-16">
                <span className="text-[15px] text-[var(--color-text-tertiary)]">Loading...</span>
              </div>
            )}

            {!templatesLoading && templates.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="text-[var(--color-text-tertiary)] mb-3 flex justify-center">
                    <FileIcon />
                  </div>
                  <div className="text-[15px] text-[var(--color-text-tertiary)]">
                    No templates yet
                  </div>
                  <div className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                    Upload a .docx or .md file to create a report template
                  </div>
                </div>
              </div>
            )}

            {!templatesLoading && templates.length > 0 && (
              <div className="flex flex-col gap-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)] transition-colors group"
                  >
                    {editingTemplate === template.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-[14px] font-medium text-[var(--color-text)] bg-transparent border border-[var(--color-border)] rounded px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                        />
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          className="text-[13px] text-[var(--color-text-secondary)] bg-transparent border border-[var(--color-border)] rounded px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveTemplateEdit(template.id)}
                            className="px-3 py-1 rounded-md border-none text-[12px] font-semibold cursor-pointer bg-[var(--color-accent)] text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTemplate(null)}
                            className="px-3 py-1 rounded-md bg-transparent border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-[var(--color-text-tertiary)] shrink-0 mt-0.5">
                          <FileIcon />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-medium text-[var(--color-text)]">
                            {template.name}
                          </div>
                          {template.description && (
                            <div className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">
                              {template.description}
                            </div>
                          )}
                          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                            {template.structure.length} section{template.structure.length !== 1 ? "s" : ""}
                            {template.structure.length > 0 && (
                              <span className="ml-1">
                                — {template.structure.map((s) => s.heading).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingTemplate(template.id);
                              setEditName(template.name);
                              setEditDesc(template.description);
                            }}
                            className="bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] cursor-pointer p-1 text-[12px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-transparent border-none text-[var(--color-text-tertiary)] hover:text-red-500 cursor-pointer p-1"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
