"use client";

import { useState, useEffect } from "react";
import { heroChatMessages, NEON_PINK } from "@/lib/landing-data";
import Cursor from "./Cursor";

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
    const t = setTimeout(() => setVisible(true), 400 + index * 500);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="flex gap-3 items-start mb-2.5 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="w-9 h-9 flex items-center justify-center text-base shrink-0"
        style={{
          borderRadius: entry.isHuman ? "50%" : "8px",
          background: `linear-gradient(135deg, ${entry.color}${entry.isHuman ? "50" : "30"}, ${entry.color}${entry.isHuman ? "20" : "10"})`,
          border: `1px solid ${entry.color}60`,
          boxShadow: `0 0 12px ${entry.color}30`,
        }}
      >
        {entry.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-['Press_Start_2P'] text-[7px] mb-1.5 tracking-wider flex items-center gap-2"
          style={{ color: entry.color, textShadow: `0 0 8px ${entry.color}80` }}
        >
          {entry.name}
          {entry.isHuman && (
            <span className="text-[6px] text-white/30 border border-white/15 px-1.5 py-px rounded-sm">
              HUMAN
            </span>
          )}
        </div>
        <div
          className="rounded-[0_10px_10px_10px] px-3.5 py-2.5 font-['Space_Mono'] text-xs text-white/80 leading-relaxed"
          style={{
            background: entry.isHuman ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${entry.isHuman ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
          }}
        >
          {entry.msg}
        </div>
      </div>
    </div>
  );
}

export default function HeroChatDemo() {
  const humans = heroChatMessages.filter((m) => m.isHuman).length;
  const agents = heroChatMessages.filter((m) => !m.isHuman).length;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded p-5 relative">
      {/* Chat header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
        <div
          className="font-['Press_Start_2P'] text-[8px] tracking-[2px]"
          style={{ color: "#00f0ff", textShadow: "0 0 8px rgba(0,240,255,0.4)" }}
        >
          # OPERATIONS CREW
        </div>
        <div className="flex gap-1 items-center">
          <span className="font-['Space_Mono'] text-[9px] text-white/25 mr-1.5">
            {humans} humans &bull; {agents} agents
          </span>
          {heroChatMessages.map((a, i) => (
            <div
              key={i}
              className="w-[7px] h-[7px] opacity-70"
              style={{
                borderRadius: a.isHuman ? "50%" : "2px",
                backgroundColor: a.color,
                boxShadow: `0 0 6px ${a.color}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      {heroChatMessages.map((entry, i) => (
        <ChatBubble key={i} entry={entry} index={i} />
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
