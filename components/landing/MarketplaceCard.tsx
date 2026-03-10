"use client";

import { NEON_YELLOW, NEON_CYAN } from "@/lib/landing-data";

interface MarketplaceAgent {
  name: string;
  icon: string;
  color: string;
  tier: "S" | "A" | "B";
  stats: Record<string, number>;
  desc: string;
  tags: string[];
}

export default function MarketplaceCard({
  agent,
  index,
  selected,
  onSelect,
}: {
  agent: MarketplaceAgent;
  index: number;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const isActive = selected === index;

  return (
    <div
      onClick={() => onSelect(index)}
      className="relative overflow-hidden rounded-sm p-5 cursor-pointer transition-all duration-300"
      style={{
        background: isActive
          ? `linear-gradient(180deg, ${agent.color}12, ${agent.color}04)`
          : "rgba(255,255,255,0.02)",
        border: `2px solid ${isActive ? agent.color : "rgba(255,255,255,0.06)"}`,
        boxShadow: isActive ? `0 0 25px ${agent.color}25, inset 0 0 25px ${agent.color}08` : "none",
        transform: isActive ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Tier badge */}
      <div
        className="absolute top-2.5 right-2.5 font-['Press_Start_2P'] text-[10px]"
        style={{
          color: agent.tier === "S" ? NEON_YELLOW : agent.tier === "A" ? NEON_CYAN : "rgba(255,255,255,0.4)",
          textShadow: agent.tier === "S" ? `0 0 10px ${NEON_YELLOW}` : "none",
        }}
      >
        {agent.tier}
      </div>

      {/* Icon */}
      <div
        className="text-[32px] mb-3 transition-[filter] duration-300"
        style={{ filter: isActive ? `drop-shadow(0 0 8px ${agent.color})` : "none" }}
      >
        {agent.icon}
      </div>

      {/* Name */}
      <div
        className="font-['Press_Start_2P'] text-[8px] mb-2.5 tracking-wider leading-snug"
        style={{
          color: agent.color,
          textShadow: isActive ? `0 0 8px ${agent.color}80` : "none",
        }}
      >
        {agent.name}
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-1 mb-3">
        {Object.entries(agent.stats).map(([stat, val]) => (
          <div key={stat} className="flex items-center gap-1.5">
            <span className="font-['Press_Start_2P'] text-[6px] text-white/30 w-6">{stat}</span>
            <div className="flex-1 h-1 bg-white/[0.06] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-[width] duration-500"
                style={{
                  width: `${val * 10}%`,
                  background: agent.color,
                  boxShadow: `0 0 6px ${agent.color}60`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap">
        {agent.tags.map((tag, i) => (
          <span
            key={i}
            className="font-['Space_Mono'] text-[8px] text-white/35 border border-white/[0.08] px-1.5 py-0.5 rounded-sm tracking-wider"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
