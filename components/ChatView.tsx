"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "./Avatar";
import { SendIcon, MenuIcon } from "./Icons";
import type { Agent, Message } from "@/lib/types";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h > 12 ? h - 12 : h || 12}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "pm" : "am"}`;
}

function nowTime(): string {
  return formatTime(new Date().toISOString());
}

// Slack-style message row — matches prototype MessageRow
function MessageRow({
  agent,
  text,
  time,
  isUser,
  mobile,
}: {
  agent?: Agent;
  text: string;
  time: string;
  isUser: boolean;
  mobile: boolean;
}) {
  if (isUser) {
    return (
      <div className={mobile ? "px-4 py-1.5" : "px-6 py-1.5"}>
        <div
          className={`flex max-w-[720px] ${mobile ? "gap-2" : "gap-2.5"}`}
        >
          <div className="w-8 h-8 rounded-lg shrink-0 bg-[var(--color-active)] text-[var(--color-text-secondary)] flex items-center justify-center text-xs font-bold">
            Y
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                You
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {time}
              </span>
            </div>
            <div className="text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
              {text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div
      className={`${mobile ? "px-4 py-1.5" : "px-6 py-1.5"} hover:bg-[var(--color-hover)] transition-colors`}
    >
      <div
        className={`flex max-w-[720px] ${mobile ? "gap-2" : "gap-2.5"}`}
      >
        <Avatar name={agent.name} color={agent.color} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {time}
            </span>
          </div>
          <div className="text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

// Typing indicator — matches prototype TypingRow
function TypingRow({
  agent,
  mobile,
  streamText,
}: {
  agent: Agent;
  mobile: boolean;
  streamText?: string;
}) {
  return (
    <div className={mobile ? "px-4 py-1.5" : "px-6 py-1.5"}>
      <div className={`flex ${mobile ? "gap-2" : "gap-2.5"}`}>
        <Avatar name={agent.name} color={agent.color} size={32} />
        <div className="flex-1 min-w-0">
          {streamText ? (
            <>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span
                  className="text-sm font-semibold"
                  style={{ color: agent.color }}
                >
                  {agent.name}
                </span>
              </div>
              <div className="text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">
                {streamText}
                <span className="inline-block w-0.5 h-4 bg-[var(--color-text-tertiary)] ml-0.5 align-middle animate-[typing-dot_1s_steps(2)_infinite]" />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 pt-2">
              {[0, 1, 2].map((d) => (
                <div
                  key={d}
                  className="w-[5px] h-[5px] rounded-full bg-[var(--color-text-tertiary)]"
                  style={{
                    animation: `typing-dot 1.2s ease-in-out ${d * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function ChatView({
  agent,
  mobile,
  openDrawer,
}: {
  agent: Agent;
  mobile: boolean;
  openDrawer: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setConversationId(null);
    setInput("");
    setStreaming(false);
    setStreamText("");

    fetch(`/api/conversations?agent_id=${agent.id}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }
        setMessages(
          (data.messages || []).map((m: Message) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agent.id]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
          message: text,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Chat failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "conversation_id") {
              setConversationId(event.conversation_id);
            } else if (event.type === "text") {
              fullText += event.text;
              setStreamText(fullText);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // Finalize — move streamed text into messages
      if (fullText) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fullText,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMsg}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamText("");
      inputRef.current?.focus();
    }
  }, [input, streaming, agent.id, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const canSend = input.trim() && !streaming;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div
        className={`border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-2.5 ${mobile ? "py-2.5 px-4" : "py-3 px-6"}`}
      >
        {mobile && (
          <button
            onClick={openDrawer}
            className="bg-transparent border-none text-[var(--color-text-secondary)] cursor-pointer p-0.5 flex"
          >
            <MenuIcon />
          </button>
        )}
        <Avatar name={agent.name} color={agent.color} size={26} />
        <span className="text-[15px] font-semibold text-[var(--color-text)]">
          {agent.name}
        </span>
      </div>

      {/* Messages */}
      <div
        className={`flex-1 overflow-auto ${mobile ? "pt-2" : "pt-4"} pb-2`}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-[var(--color-text-tertiary)]">
              Loading...
            </span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div
                className="text-sm font-medium mb-1"
                style={{ color: agent.color }}
              >
                {agent.name}
              </div>
              <div className="text-[13px] text-[var(--color-text-tertiary)]">
                Start a conversation
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageRow
            key={m.id || i}
            isUser={m.role === "user"}
            agent={m.role === "assistant" ? agent : undefined}
            text={m.content}
            time={formatTime(m.created_at)}
            mobile={mobile}
          />
        ))}

        {streaming && (
          <TypingRow
            agent={agent}
            mobile={mobile}
            streamText={streamText || undefined}
          />
        )}

        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className={mobile ? "px-3 pt-2 pb-4" : "px-5 pt-2 pb-5"}>
        <div className="flex gap-2 items-center bg-[var(--color-input-bg)] rounded-[10px] pl-4 pr-1 py-1 border border-[var(--color-border)]">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 border-none bg-transparent text-[var(--color-text)] text-sm outline-none py-2.5"
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="w-[34px] h-[34px] rounded-lg border-none shrink-0 flex items-center justify-center transition-all duration-150"
            style={{
              background: canSend ? "var(--color-accent)" : "transparent",
              color: canSend ? "#fff" : "var(--color-text-tertiary)",
              cursor: canSend ? "pointer" : "default",
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
