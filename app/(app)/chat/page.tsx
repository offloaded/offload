"use client";

import { useSearchParams } from "next/navigation";
import { useApp } from "../layout";
import { GroupChatView } from "@/components/GroupChatView";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const { agents, openDrawer } = useApp();
  const conversationId = searchParams.get("c") || undefined;

  return (
    <GroupChatView
      agents={agents}
      openDrawer={openDrawer}
      initialConversationId={conversationId}
    />
  );
}
