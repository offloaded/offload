"use client";

import { useApp } from "../layout";
import { GroupChatView } from "@/components/GroupChatView";

export default function ChatPage() {
  const { agents, mobile, openDrawer } = useApp();

  return (
    <GroupChatView agents={agents} mobile={mobile} openDrawer={openDrawer} />
  );
}
