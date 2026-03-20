"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../layout";
import { Avatar } from "@/components/Avatar";
import { MenuIcon, SendIcon, PaperclipIcon } from "@/components/Icons";
import { sendDM } from "@/lib/inflight";
import type { WorkItem, Message } from "@/lib/types";

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

  // Fetch conversation messages
  const loadMessages = useCallback(async () => {
    if (!workItem?.conversation_id) return;
    try {
      const res = await fetch(`/api/conversations?conversation_id=${workItem.conversation_id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* non-fatal */ }
  }, [workItem?.conversation_id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!workItem?.conversation_id) return;
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [workItem?.conversation_id, loadMessages]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!chatInput.trim() || !workItem?.agent_id || !workItem?.conversation_id || sending) return;
    const msg = chatInput.trim();
    setChatInput("");
    setSending(true);
    try {
      await sendDM(`work:${workItem.id}`, workItem.agent_id, msg, workItem.conversation_id);
      // Reload messages and work item after agent responds
      setTimeout(() => { loadMessages(); loadWorkItem(); }, 1000);
    } finally {
      setSending(false);
    }
  }, [chatInput, workItem, sending, loadMessages, loadWorkItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const updateStatus = async (status: string) => {
    if (!workItem) return;
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

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[var(--color-surface)]">
      {/* Report panel (primary) */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--color-border)]">
        {/* Report header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {mobile && (
              <button
                onClick={openDrawer}
                className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-1 flex md:hidden rounded-lg hover:bg-[var(--color-hover)]"
              >
                <MenuIcon />
              </button>
            )}
            <h1 className="text-[15px] font-semibold text-[var(--color-text)] truncate">
              {workItem.title}
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
              style={{ background: statusConfig.bg, color: statusConfig.text }}
            >
              {statusConfig.label}
            </span>
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
                  {workItem.status === "draft" || workItem.status === "in_progress"
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

      {/* Chat panel (secondary) */}
      <div className="flex flex-col shrink-0 w-full md:w-[380px] bg-[var(--color-bg)]">
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
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={msg.id || i}>
              {msg.role === "user" ? (
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">You</span>
                  </div>
                  <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[90%] bg-[var(--color-hover)]">
                    <p className="text-[13px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
                      {msg.content}
                    </p>
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
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]">
          <div className="flex items-center rounded-xl px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                // Handle file upload via chat
                if (e.target.files?.[0] && workItem.agent_id && workItem.conversation_id) {
                  const file = e.target.files[0];
                  const formData = new FormData();
                  formData.append("agent_id", workItem.agent_id);
                  formData.append("conversation_id", workItem.conversation_id);
                  formData.append("message", `Please review the attached file: ${file.name}`);
                  formData.append("file", file);
                  fetch("/api/chat", { method: "POST", body: formData });
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mr-2 bg-transparent border-none text-[var(--color-text-tertiary)] cursor-pointer p-0 flex hover:text-[var(--color-text-secondary)]"
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
              className="bg-transparent border-none text-[var(--color-accent)] cursor-pointer p-0 flex disabled:opacity-30"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
