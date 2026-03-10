"use client";

import { useState, useEffect } from "react";
import { builderSteps, NEON_PINK, NEON_YELLOW, NEON_GREEN } from "@/lib/landing-data";
import Cursor from "./Cursor";

export default function AgentBuilderDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % (builderSteps.length + 2));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const deployReady = step >= builderSteps.length;
  const deployDone = step >= builderSteps.length + 1;

  return (
    <div className="bg-black/40 border border-white/[0.08] rounded p-7 font-['Space_Mono'] relative overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: NEON_PINK }} />
          <div className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: NEON_YELLOW }} />
          <div className="w-2 h-2 rounded-full opacity-80" style={{ backgroundColor: NEON_GREEN }} />
        </div>
        <span className="font-['Press_Start_2P'] text-[8px] text-white/30 tracking-[2px] ml-2">
          AGENT BUILDER v2.0
        </span>
      </div>

      {/* Builder fields */}
      {builderSteps.map((s, i) => (
        <div
          key={i}
          className="flex gap-3 mb-3.5 transition-all duration-400"
          style={{
            opacity: step > i ? 1 : step === i ? 0.7 : 0.2,
            transform: step >= i ? "translateX(0)" : "translateX(-8px)",
          }}
        >
          <span
            className="font-['Press_Start_2P'] text-[8px] w-[52px] shrink-0 pt-[3px]"
            style={{
              color: s.color,
              textShadow: step >= i ? `0 0 8px ${s.color}60` : "none",
            }}
          >
            {s.label}
          </span>
          <div
            className="flex-1 rounded-sm px-3 py-2 text-[13px] transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${step === i ? s.color + "50" : "rgba(255,255,255,0.05)"}`,
              color: step > i ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
              boxShadow: step === i ? `0 0 12px ${s.color}15` : "none",
            }}
          >
            {step > i ? (
              s.value
            ) : step === i ? (
              <span>
                {s.value.slice(0, Math.floor(s.value.length * 0.6))}
                <Cursor color={s.color} />
              </span>
            ) : (
              "..."
            )}
          </div>
        </div>
      ))}

      {/* Deploy line */}
      <div
        className="mt-5 flex items-center gap-2.5 transition-all duration-500"
        style={{
          opacity: deployReady ? 1 : 0,
          transform: deployReady ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full transition-all duration-400"
          style={{
            backgroundColor: deployDone ? NEON_GREEN : NEON_YELLOW,
            boxShadow: `0 0 8px ${deployDone ? NEON_GREEN : NEON_YELLOW}`,
          }}
        />
        <span
          className="font-['Press_Start_2P'] text-[9px] tracking-[2px]"
          style={{
            color: deployDone ? NEON_GREEN : NEON_YELLOW,
            textShadow: `0 0 8px ${deployDone ? NEON_GREEN : NEON_YELLOW}80`,
          }}
        >
          {deployDone ? "✓ AGENT DEPLOYED" : "DEPLOYING..."}
        </span>
      </div>
    </div>
  );
}
