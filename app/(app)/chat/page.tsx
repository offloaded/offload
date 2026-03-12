"use client";

import { useSearchParams } from "next/navigation";
import { useApp } from "../layout";
import { GroupChatView } from "@/components/GroupChatView";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const { allAgents, openDrawer } = useApp();
  const conversationId = searchParams.get("c") || undefined;

  return (
    <GroupChatView
      key={conversationId || "group"}
      agents={allAgents}
      openDrawer={openDrawer}
      initialConversationId={conversationId}
    />
  );
}
