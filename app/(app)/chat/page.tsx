"use client";

import { useApp } from "../layout";
import { GroupChatView } from "@/components/GroupChatView";

export default function ChatPage() {
  const { agents, openDrawer } = useApp();

  return (
    <GroupChatView agents={agents} openDrawer={openDrawer} />
  );
}
