"use client";

import { useState, useEffect } from "react";
import { NEON_CYAN, NEON_GREEN, NEON_PINK, DARK_BG } from "@/lib/landing-data";
import Cursor from "./Cursor";

export default function ReportEditDemo() {
  const [editMode, setEditMode] = useState(false);
  const [agentResponse, setAgentResponse] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      setEditMode(false);
      setAgentResponse(false);
      timers.push(setTimeout(() => setEditMode(true), 1500));
      timers.push(setTimeout(() => { setEditMode(false); setAgentResponse(true); }, 4000));
      timers.push(setTimeout(() => setAgentResponse(false), 7000));
    };

    cycle();
    const interval = setInterval(cycle, 8000);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-[2px] rounded overflow-hidden border border-white/[0.08]" style={{ background: "rgba(255,255,255,0.06)" }}>
      {/* Chat side */}
      <div className="p-4" style={{ background: DARK_BG }}>
        <div className="font-['Press_Start_2P'] text-[7px] text-white/30 tracking-[2px] mb-3">
          CHAT
        </div>
        <div className="bg-white/[0.04] rounded-lg px-3.5 py-2.5 mb-2 font-['Space_Mono'] text-[11px] text-white/70 leading-relaxed">
          <span className="font-['Press_Start_2P'] text-[7px]" style={{ color: NEON_PINK }}>YOU </span>
          I&apos;ve adjusted the risk section
        </div>
        <div
          className="bg-white/[0.04] rounded-lg px-3.5 py-2.5 font-['Space_Mono'] text-[11px] text-white/70 leading-relaxed transition-opacity duration-500"
          style={{ opacity: agentResponse ? 1 : 0.3 }}
        >
          <span className="font-['Press_Start_2P'] text-[7px]" style={{ color: NEON_CYAN }}>ANALYST </span>
          Good call adding supply chain risk. I&apos;d also flag the Q3 budget dependency. Want me to update it?
        </div>
      </div>

      {/* Report side */}
      <div className="p-4" style={{ background: `${DARK_BG}ee` }}>
        <div className="flex justify-between items-center mb-3">
          <div className="font-['Press_Start_2P'] text-[7px] text-white/30 tracking-[2px]">
            REPORT
          </div>
          <div
            className="font-['Press_Start_2P'] text-[7px] tracking-wider transition-all duration-300"
            style={{
              color: editMode ? NEON_GREEN : "rgba(255,255,255,0.3)",
              textShadow: editMode ? `0 0 6px ${NEON_GREEN}80` : "none",
            }}
          >
            {editMode ? "EDITING..." : "VIEW"}
          </div>
        </div>
        <div className="font-['Space_Mono'] text-[11px] text-white/60 leading-relaxed">
          <div className="font-['Press_Start_2P'] text-[9px] mb-1.5" style={{ color: NEON_CYAN }}>
            RISK ASSESSMENT
          </div>
          <div
            className="pl-2.5 transition-all duration-300"
            style={{
              borderLeft: editMode ? `2px solid ${NEON_GREEN}` : "2px solid transparent",
              background: editMode ? `${NEON_GREEN}08` : "transparent",
            }}
          >
            Supply chain disruption risk is{" "}
            <span className="transition-colors duration-300" style={{ color: editMode ? NEON_GREEN : "rgba(255,255,255,0.6)" }}>
              {editMode ? "high due to contractor shortages" : "moderate"}
            </span>
            .{editMode && <Cursor color={NEON_GREEN} />}
          </div>
        </div>
      </div>
    </div>
  );
}
