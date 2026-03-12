"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useApp } from "../../layout";
import { ChatView } from "@/components/ChatView";

export default function AgentChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { allAgents, openDrawer } = useApp();
  const agent = allAgents.find((a) => a.id === params.id);
  const conversationId = searchParams.get("c") || undefined;

  if (!agent && allAgents.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Agent not found
      </div>
    );
  }

  if (!agent) return null;

  return (
    <ChatView
      key={`${agent.id}:${conversationId || ""}`}
      agent={agent}
      openDrawer={openDrawer}
      initialConversationId={conversationId}
    />
  );
}
