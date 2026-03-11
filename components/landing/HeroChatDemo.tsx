"use client";

import { useState, useEffect } from "react";
import { heroMessages } from "@/lib/landing-data";

interface ChatEntry {
  name: string;
  icon: string;
  color: string;
  msg: string;
  isHuman?: boolean;
}

function ChatBubble({ entry, index }: { entry: ChatEntry; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600 + index * 500);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="flex gap-3 items-start mb-3 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        flexDirection: entry.isHuman ? "row-reverse" : "row",
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
        style={{
          background: `linear-gradient(135deg, ${entry.color}30, ${entry.color}10)`,
          border: `1px solid ${entry.color}60`,
          boxShadow: `0 0 12px ${entry.color}30`,
        }}
      >
        {entry.icon}
      </div>
      <div className="flex-1" style={{ maxWidth: "85%" }}>
        <div
          className="font-['Press_Start_2P'] text-[8px] mb-1.5 tracking-wider"
          style={{
            color: entry.color,
            textShadow: `0 0 8px ${entry.color}80`,
            textAlign: entry.isHuman ? "right" : "left",
          }}
        >
          {entry.name}
        </div>
        <div
          className="px-3.5 py-2.5 font-['Space_Mono'] text-xs text-white/85 leading-relaxed"
          style={{
            background: entry.isHuman ? `${entry.color}15` : "rgba(255,255,255,0.04)",
            border: `1px solid ${entry.isHuman ? entry.color + "30" : "rgba(255,255,255,0.08)"}`,
            borderRadius: entry.isHuman ? "12px 0 12px 12px" : "0 12px 12px 12px",
          }}
        >
          {entry.msg}
        </div>
      </div>
    </div>
  );
}

export default function HeroChatDemo() {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded p-5 relative">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
        <div
          className="font-['Press_Start_2P'] text-[8px] tracking-[2px]"
          style={{ color: "#00f0ff", textShadow: "0 0 8px rgba(0,240,255,0.4)" }}
        >
          # OPERATIONS TEAM
        </div>
        <div className="font-['Space_Mono'] text-[9px] text-white/30">
          3 agents
        </div>
      </div>

      {heroMessages.map((msg, i) => (
        <ChatBubble key={i} entry={msg} index={i} />
      ))}
    </div>
  );
}
