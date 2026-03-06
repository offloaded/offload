"use client";

import { useParams } from "next/navigation";
import { useApp } from "../../layout";
import { ChatView } from "@/components/ChatView";

export default function AgentChatPage() {
  const params = useParams();
  const { agents, openDrawer } = useApp();
  const agent = agents.find((a) => a.id === params.id);

  if (!agent && agents.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Agent not found
      </div>
    );
  }

  if (!agent) return null;

  return (
    <ChatView agent={agent} openDrawer={openDrawer} />
  );
}
