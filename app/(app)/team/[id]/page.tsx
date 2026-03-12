"use client";

import { useParams } from "next/navigation";
import { useApp } from "../../layout";
import { TeamChatView } from "@/components/TeamChatView";

export default function TeamChatPage() {
  const params = useParams();
  const teamId = params.id as string;
  const { allAgents, openDrawer, teams } = useApp();

  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center text-[15px] text-[var(--color-text-secondary)]">
        Team not found
      </div>
    );
  }

  const teamAgents = team.is_system ? [] : allAgents.filter((a) => team.agent_ids.includes(a.id));

  return (
    <TeamChatView
      key={teamId}
      teamId={teamId}
      teamName={team.name}
      teamAgents={teamAgents}
      openDrawer={openDrawer}
      isSystem={team.is_system}
    />
  );
}
