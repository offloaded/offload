"use client";

import { useState } from "react";

interface Agent {
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export default function MarketplaceMiniCard({ agent }: { agent: Agent }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-sm p-4 transition-all duration-300 cursor-default"
      style={{
        background: hovered ? `${agent.color}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? agent.color + "50" : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered ? `0 0 20px ${agent.color}15` : "none",
      }}
    >
      <div className="text-[22px] mb-2.5">{agent.icon}</div>
      <div
        className="font-['Press_Start_2P'] text-[8px] mb-1.5 tracking-wider leading-snug transition-all duration-300"
        style={{
          color: agent.color,
          textShadow: hovered ? `0 0 6px ${agent.color}60` : "none",
        }}
      >
        {agent.name}
      </div>
      <div className="font-['Space_Mono'] text-[11px] text-white/50 leading-relaxed">
        {agent.desc}
      </div>
    </div>
  );
}
