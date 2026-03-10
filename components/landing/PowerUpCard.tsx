"use client";

import { useState } from "react";

interface PowerUp {
  icon: string;
  title: string;
  color: string;
  desc: string;
}

export default function PowerUpCard({ item }: { item: PowerUp }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden rounded-sm py-7 px-6 cursor-default transition-all duration-400"
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${item.color}08, ${item.color}04)`
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? item.color + "60" : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered
          ? `0 0 30px ${item.color}15, inset 0 0 30px ${item.color}05`
          : "none",
      }}
    >
      {/* Corner accents */}
      <div
        className="absolute top-0 left-0 w-5 h-5 transition-opacity duration-300"
        style={{
          borderTop: `2px solid ${item.color}`,
          borderLeft: `2px solid ${item.color}`,
          opacity: hovered ? 1 : 0.3,
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-5 h-5 transition-opacity duration-300"
        style={{
          borderBottom: `2px solid ${item.color}`,
          borderRight: `2px solid ${item.color}`,
          opacity: hovered ? 1 : 0.3,
        }}
      />

      <div
        className="text-[28px] mb-3.5 transition-[filter] duration-300"
        style={{ filter: hovered ? `drop-shadow(0 0 8px ${item.color})` : "none" }}
      >
        {item.icon}
      </div>
      <div
        className="font-['Press_Start_2P'] text-[10px] mb-2.5 tracking-[2px]"
        style={{
          color: item.color,
          textShadow: hovered ? `0 0 10px ${item.color}80` : "none",
        }}
      >
        {item.title}
      </div>
      <div className="font-['Space_Mono'] text-[13px] text-white/60 leading-relaxed">
        {item.desc}
      </div>
    </div>
  );
}
