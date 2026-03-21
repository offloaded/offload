"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../layout";
import { Avatar } from "@/components/Avatar";
import { MenuIcon, SendIcon, PaperclipIcon } from "@/components/Icons";
import { sendDM } from "@/lib/inflight";
import type { WorkItem, WorkExecutionContext, Message } from "@/lib/types";

/** Max lines to show before collapsing a user message */
const COLLAPSE_LINE_LIMIT = 6;

function CollapsibleText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const shouldCollapse = lines.length > COLLAPSE_LINE_LIMIT;

  if (!shouldCollapse || expanded) {
    return (
      <>
        <p className="text-[13px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">{text}</p>
        {shouldCollapse && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-1 bg-transparent border-none p-0 text-[12px] text-[var(--color-accent)] cursor-pointer hover:underline"
          >
            See less
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <p className="text-[13px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
        {lines.slice(0, COLLAPSE_LINE_LIMIT).join("\n")}
      </p>
      <button
        onClick={() => setExpanded(true)}
        className="mt-1 bg-transparent border-none p-0 text-[12px] text-[var(--color-accent)] cursor-pointer hover:underline"
      >
        See more
      </button>
    </>
  );
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "var(--color-hover)", text: "var(--color-text-secondary)", label: "Draft" },
  in_progress: { bg: "var(--color-orange-soft)", text: "var(--color-orange)", label: "In Progress" },
  review: { bg: "var(--color-accent-soft)", text: "var(--color-accent)", label: "Review" },
  complete: { bg: "var(--color-green-soft)", text: "var(--color-green)", label: "Complete" },
};

export default function WorkItemPage() {
  const params = useParams();
  const router = useRouter();
  const { agents, mobile, openDrawer, refreshWorkItems, openReport } = useApp();
  const workItemId = params.id as string;

  const [workItem, setWorkItem] = useState<(WorkItem & { report_content?: string; report_title?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportContent, setReportContent] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // Execution context state
  const [execCtx, setExecCtx] = useState<WorkExecutionContext | null>(null);
  const [startingRun, setStartingRun] = useState(false);
  // Mobile: toggle between report and chat views
  const [mobileView, setMobileView] = useState<"report" | "chat">("chat");
  const [showReassign, setShowReassign] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agent = workItem?.agent_id ? agents.find((a) => a.id === workItem.agent_id) : null;

  // Load work item data
  const loadWorkItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-items/${workItemId}`);
      if (!res.ok) {
        router.push("/work");
        return;
      }
      const data = await res.json();
      setWorkItem(data);
      setReportContent(data.report_content || "");
      setReportTitle(data.report_title || data.title);
    } catch {
      router.push("/work");
    } finally {
      setLoading(false);
    }
  }, [workItemId, router]);

  useEffect(() => {
    loadWorkItem();
  }, [loadWorkItem]);

  // Load the most recent execution context for this work item
  const loadExecution = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-items/${workItemId}/executions`);
      if (res.ok) {
        const executions: WorkExecutionContext[] = await res.json();
        if (executions.length > 0) {
          setExecCtx(executions[0]); // Most recent (ordered by created_at desc)
        }
      }
    } catch { /* non-fatal */ }
  }, [workItemId]);

  useEffect(() => {
    loadExecution();
  }, [loadExecution]);

  // Fetch messages from the execution context's conversation (NOT the work item's original conversation)
  const loadMessages = useCallback(async () => {
    const convId = execCtx?.conversation_id;
    if (!convId) return;
    try {
      const res = await fetch(`/api/conversations?conversation_id=${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* non-fatal */ }
  }, [execCtx?.conversation_id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!execCtx?.conversation_id) return;
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [execCtx?.conversation_id, loadMessages]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start a new execution run
  const startNewRun = useCallback(async () => {
    if (startingRun) return;
    setStartingRun(true);
    try {
      const res = await fetch(`/api/work-items/${workItemId}/executions`, {
        method: "POST",
      });
      if (res.ok) {
        const newExec: WorkExecutionContext = await res.json();
        setExecCtx(newExec);
        setMessages([]); // Fresh conversation
        loadWorkItem(); // Reload to get updated status/conversation_id
        refreshWorkItems();
      }
    } finally {
      setStartingRun(false);
    }
  }, [workItemId, startingRun, loadWorkItem, refreshWorkItems]);

  const handleSend = useCallback(async () => {
    if (!chatInput.trim() || !workItem?.agent_id || !execCtx?.conversation_id || sending) return;
    const msg = chatInput.trim();
    setChatInput("");
    setSending(true);
    try {
      // Send to the execution context's conversation, NOT the work item's original conversation
      await sendDM(`work:${workItem.id}`, workItem.agent_id, msg, execCtx.conversation_id);
      // Reload messages and work item after agent responds
      setTimeout(() => { loadMessages(); loadWorkItem(); }, 1000);
    } finally {
      setSending(false);
    }
  }, [chatInput, workItem, execCtx, sending, loadMessages, loadWorkItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const reassignAgent = async (newAgentId: string) => {
    if (!workItem || newAgentId === workItem.agent_id) {
      setShowReassign(false);
      return;
    }
    await fetch(`/api/work-items/${workItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: newAgentId }),
    });
    setShowReassign(false);
    loadWorkItem();
    refreshWorkItems();
  };

  const updateStatus = async (status: string) => {
    if (!workItem) return;
    // If marking complete, also mark the execution context as complete
    if (status === "complete" && execCtx && execCtx.status === "running") {
      await fetch(`/api/work-items/${workItem.id}/executions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution_id: execCtx.id, status: "complete" }),
      }).catch(() => {});
    }
    await fetch(`/api/work-items/${workItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setWorkItem({ ...workItem, status: status as WorkItem["status"] });
    refreshWorkItems();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    );
  }

  if (!workItem) return null;

  const statusConfig = STATUS_CONFIG[workItem.status] || STATUS_CONFIG.draft;
  const hasExecution = !!execCtx;
  const canChat = hasExecution && !!workItem.agent_id;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--color-surface)]">
      {/* Mobile header: title + agent assignment + tab toggle */}
      <div className="flex flex-col md:hidden shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Title + agent bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)]">
          <button
            onClick={() => { if (mobile) router.push("/work"); }}
            className="md:hidden bg-transparent border-none cursor-pointer p-1 flex text-[var(--color-text-secondary)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[14px] font-semibold text-[var(--color-text)] truncate flex-1">
            {workItem.title}
          </h1>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
            style={{ background: statusConfig.bg, color: statusConfig.text }}
          >
            {statusConfig.label}
          </span>
          {showReassign ? (
            <select
              autoFocus
              className="text-[12px] rounded-lg px-2 py-1 border shrink-0"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-text)",
                borderColor: "var(--color-border)",
              }}
              defaultValue={workItem.agent_id || ""}
              onChange={(e) => {
                if (e.target.value) reassignAgent(e.target.value);
              }}
              onBlur={() => setShowReassign(false)}
            >
              <option value="" disabled>Select agent...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          ) : agent ? (
            <button
              onClick={() => setShowReassign(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-transparent border border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-hover)] shrink-0"
            >
              <Avatar name={agent.name} color={agent.color} size={18} />
              <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">{agent.name}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowReassign(true)}
              className="px-2 py-1 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors hover:bg-[var(--color-hover)] shrink-0"
              style={{
                background: "transparent",
                color: "var(--color-orange)",
                borderColor: "var(--color-orange)",
              }}
            >
              Assign agent
            </button>
          )}
        </div>
        {/* Mobile action buttons */}
        {(workItem.report_id || workItem.status === "review" || workItem.status === "complete") && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
            {workItem.report_id && (
              <button
                onClick={() => openReport(workItem.report_id!)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)]"
              >
                Export
              </button>
            )}
            {workItem.status === "review" && (
              <button
                onClick={() => updateStatus("complete")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-[var(--color-accent)] text-white border-none cursor-pointer hover:opacity-90"
              >
                Mark Complete
              </button>
            )}
            {workItem.status === "complete" && (
              <button
                onClick={() => updateStatus("in_progress")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)]"
              >
                Reopen
              </button>
            )}
          </div>
        )}
        {/* Tab toggle */}
        <div className="flex items-center">
          <button
            onClick={() => setMobileView("chat")}
            className="flex-1 py-2.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors relative"
            style={{ color: mobileView === "chat" ? "var(--color-accent)" : "var(--color-text-secondary)" }}
          >
            Chat
            {mobileView === "chat" && (
              <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full" style={{ background: "var(--color-accent)" }} />
            )}
          </button>
          <button
            onClick={() => setMobileView("report")}
            className="flex-1 py-2.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors relative"
            style={{ color: mobileView === "report" ? "var(--color-accent)" : "var(--color-text-secondary)" }}
          >
            Report
            {mobileView === "report" && (
              <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full" style={{ background: "var(--color-accent)" }} />
            )}
          </button>
        </div>
      </div>

      {/* Report panel (primary) — hidden on mobile when chat is active */}
      <div className={`flex-1 flex-col min-w-0 border-r border-[var(--color-border)] ${mobileView === "report" ? "flex" : "hidden md:flex"}`}>
        {/* Report header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-[var(--color-text)] truncate">
              {workItem.title}
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
              style={{ background: statusConfig.bg, color: statusConfig.text }}
            >
              {statusConfig.label}
            </span>
            {/* Agent assignment / reassignment */}
            {showReassign ? (
              <select
                autoFocus
                className="text-[12px] rounded-lg px-2 py-1 border shrink-0"
                style={{
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  borderColor: "var(--color-border)",
                }}
                defaultValue={workItem.agent_id || ""}
                onChange={(e) => {
                  if (e.target.value) reassignAgent(e.target.value);
                }}
                onBlur={() => setShowReassign(false)}
              >
                <option value="" disabled>Select agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : agent ? (
              <button
                onClick={() => setShowReassign(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-transparent border border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-hover)] shrink-0"
              >
                <Avatar name={agent.name} color={agent.color} size={18} />
                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">{agent.name}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setShowReassign(true)}
                className="px-2 py-1 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors hover:bg-[var(--color-hover)] shrink-0"
                style={{
                  background: "transparent",
                  color: "var(--color-orange)",
                  borderColor: "var(--color-orange)",
                }}
              >
                Assign agent
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {workItem.report_id && (
              <button
                onClick={() => openReport(workItem.report_id!)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)]"
              >
                Export
              </button>
            )}
            {workItem.status === "review" && (
              <button
                onClick={() => updateStatus("complete")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-[var(--color-accent)] text-white border-none cursor-pointer hover:opacity-90"
              >
                Mark Complete
              </button>
            )}
            {workItem.status === "complete" && (
              <button
                onClick={() => updateStatus("in_progress")}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-hover)]"
              >
                Reopen
              </button>
            )}
          </div>
        </div>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6">
          <div className="max-w-2xl">
            {reportContent ? (
              <div
                className="text-[14px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: reportContent.replace(/\n/g, "<br/>") }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mb-4">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-[14px] text-[var(--color-text-secondary)] mb-1">
                  {workItem.status === "draft"
                    ? "Ready to start. Click \"Run\" in the chat panel to begin."
                    : workItem.status === "in_progress"
                    ? "Your agent is working on this."
                    : "No report content yet."}
                </p>
                <p className="text-[13px] text-[var(--color-text-tertiary)]">
                  The draft will appear here once ready.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel (secondary) — shows execution context messages */}
      <div className={`flex-col shrink-0 w-full md:w-[380px] bg-[var(--color-bg)] ${mobileView === "chat" ? "flex" : "hidden md:flex"}`}>
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          {agent ? (
            <>
              <Avatar name={agent.name} color={agent.color} size={24} />
              <span className="text-[13px] font-medium text-[var(--color-text)]">{agent.name}</span>
              {agent.role && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-hover)] text-[var(--color-text-tertiary)]">
                  {agent.role}
                </span>
              )}
            </>
          ) : (
            <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">Chat</span>
          )}
          <div className="flex-1" />
          {/* Run / Re-run button */}
          {workItem.agent_id && workItem.status !== "complete" && (
            <button
              onClick={startNewRun}
              disabled={startingRun}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all border-none cursor-pointer disabled:opacity-40"
              style={{
                background: hasExecution ? "var(--color-hover)" : "var(--color-accent)",
                color: hasExecution ? "var(--color-text-secondary)" : "#fff",
              }}
            >
              {startingRun ? "Starting..." : hasExecution ? "Re-run" : "Run"}
            </button>
          )}
        </div>

        {/* Messages — from execution context conversation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!hasExecution ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mb-3">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <p className="text-[13px] text-[var(--color-text-secondary)] mb-1">
                No execution yet
              </p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">
                {workItem.agent_id
                  ? "Click \"Run\" to start the agent on this work item."
                  : "Assign an agent to run this work item."}
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={msg.id || i}>
                  {msg.role === "user" ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-[var(--color-text-tertiary)]">You</span>
                      </div>
                      <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[90%] bg-[var(--color-hover)]">
                        <CollapsibleText text={msg.content} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5 mb-1">
                        {agent && <Avatar name={agent.name} color={agent.color} size={20} />}
                        <span className="text-[11px] text-[var(--color-accent)]">{agent?.name || "Assistant"}</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[90%] bg-[var(--color-surface-raised)]">
                        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {/* Typing indicator — show when agent is working on a response */}
              {agent && (sending || (execCtx?.status === "running" && (messages.length === 0 || messages[messages.length - 1]?.role === "user"))) && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Avatar name={agent.name} color={agent.color} size={20} />
                    <span className="text-[11px] text-[var(--color-accent)]">{agent.name}</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-[var(--color-surface-raised)]">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((d) => (
                        <div
                          key={d}
                          className="w-[6px] h-[6px] rounded-full bg-[var(--color-text-tertiary)]"
                          style={{ animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Chat input — only shown when there's an active execution */}
        {canChat && (
          <div className="px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:pb-3 border-t border-[var(--color-border)]">
            <div className="flex items-center rounded-xl px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0] && workItem.agent_id && execCtx?.conversation_id) {
                    const file = e.target.files[0];
                    const formData = new FormData();
                    formData.append("agent_id", workItem.agent_id);
                    formData.append("conversation_id", execCtx.conversation_id);
                    formData.append("message", `Please review the attached file: ${file.name}`);
                    formData.append("file", file);
                    fetch("/api/chat", { method: "POST", body: formData });
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mr-2 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-1.5 flex hover:text-[var(--color-text-secondary)]"
              >
                <PaperclipIcon />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Refine the draft..."
                className="flex-1 bg-transparent text-[13px] outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] border-none"
              />
              <button
                onClick={handleSend}
                disabled={!chatInput.trim() || sending}
                className="bg-transparent border-none text-[var(--color-accent)] cursor-pointer p-1.5 flex disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
