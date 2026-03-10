"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/app/(app)/layout";
import { MenuIcon, ReportIcon, TrashIcon } from "@/components/Icons";

interface ReportSummary {
  id: string;
  title: string;
  source: string;
  agent_id: string | null;
  created_at: string;
}

export default function ReportsPage() {
  const { openDrawer, agents, refreshReportCount } = useApp();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReports(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
      refreshReportCount();
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
      </div>

      <div className="flex-1 overflow-y-auto pt-[52px] md:pt-0">
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
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-hover)] transition-colors group"
                  >
                    <Link
                      href={`/reports/${report.id}`}
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
                    </Link>
                    <button
                      onClick={() => handleDelete(report.id)}
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
      </div>
    </div>
  );
}
