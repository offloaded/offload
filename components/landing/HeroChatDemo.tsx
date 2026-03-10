"use client";

import { useState, useEffect } from "react";
import { agents, NEON_PINK } from "@/lib/landing-data";
import Cursor from "./Cursor";

function ChatBubble({ agent, index }: { agent: typeof agents[number]; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600 + index * 450);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="flex gap-3 items-start mb-3 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
        style={{
          background: `linear-gradient(135deg, ${agent.color}30, ${agent.color}10)`,
          border: `1px solid ${agent.color}60`,
          boxShadow: `0 0 12px ${agent.color}30`,
        }}
      >
        {agent.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-['Press_Start_2P'] text-[9px] mb-1.5 tracking-wider"
          style={{ color: agent.color, textShadow: `0 0 8px ${agent.color}80` }}
        >
          {agent.name}
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-[0_12px_12px_12px] px-4 py-3 font-['Space_Mono'] text-[13px] text-white/85 leading-relaxed">
          {agent.msg}
        </div>
      </div>
    </div>
  );
}

export default function HeroChatDemo() {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded p-6 relative">
      {/* Chat header */}
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/[0.06]">
        <div
          className="font-['Press_Start_2P'] text-[9px] tracking-[2px]"
          style={{ color: "#00f0ff", textShadow: "0 0 8px rgba(0,240,255,0.4)" }}
        >
          # OPERATIONS CREW
        </div>
        <div className="flex gap-1.5">
          {agents.map((a, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full opacity-70"
              style={{ backgroundColor: a.color, boxShadow: `0 0 6px ${a.color}` }}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      {agents.map((agent, i) => (
        <ChatBubble key={i} agent={agent} index={i} />
      ))}

      {/* Typing indicator */}
      <div className="flex items-center gap-2 mt-2 opacity-50 font-['Space_Mono'] text-xs text-white/40">
        <span style={{ color: NEON_PINK }}>YOU</span>
        <span>Type a message...</span>
        <Cursor color={NEON_PINK} />
      </div>
    </div>
  );
}
