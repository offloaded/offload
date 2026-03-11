"use client";

import { useState } from "react";

interface Feature {
  title: string;
  subtitle: string;
  desc: string;
  color: string;
  icon: string;
}

export default function FeatureCard({ feature }: { feature: Feature }) {
  const [hovered, setHovered] = useState(false);
  const c = feature.color;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative overflow-hidden rounded-sm py-7 px-6 cursor-default transition-all duration-400"
      style={{
        background: hovered ? `linear-gradient(135deg, ${c}08, ${c}04)` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? c + "60" : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered ? `0 0 30px ${c}15, inset 0 0 30px ${c}05` : "none",
      }}
    >
      {/* Corner accents */}
      <div
        className="absolute top-0 left-0 w-4 h-4 transition-opacity duration-300"
        style={{ borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}`, opacity: hovered ? 1 : 0.3 }}
      />
      <div
        className="absolute bottom-0 right-0 w-4 h-4 transition-opacity duration-300"
        style={{ borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}`, opacity: hovered ? 1 : 0.3 }}
      />

      <div className="text-2xl mb-3.5">{feature.icon}</div>
      <div
        className="font-['Press_Start_2P'] text-[10px] mb-1.5 tracking-[2px]"
        style={{ color: c, textShadow: `0 0 10px ${c}80` }}
      >
        {feature.title}
      </div>
      <div className="font-['Space_Mono'] text-xs text-white/45 mb-3.5 tracking-wider">
        {feature.subtitle}
      </div>
      <div className="font-['Space_Mono'] text-[13px] text-white/70 leading-7">
        {feature.desc}
      </div>
    </div>
  );
}
