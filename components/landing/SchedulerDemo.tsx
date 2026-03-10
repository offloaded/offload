"use client";

import { useState, useEffect } from "react";
import { scheduledTasks, NEON_GREEN, DARK_BG } from "@/lib/landing-data";

export default function SchedulerDemo() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="bg-black/40 border border-white/[0.08] rounded overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
        <div className="font-['Press_Start_2P'] text-[8px] text-white/30 tracking-[2px]">
          SCHEDULED TASKS
        </div>
        <div className="flex items-center gap-1.5 font-['Space_Mono'] text-[11px]" style={{ color: NEON_GREEN }}>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: NEON_GREEN,
              boxShadow: `0 0 6px ${NEON_GREEN}`,
              animation: "blink 2s ease-in-out infinite",
            }}
          />
          ALL SYSTEMS GO
        </div>
      </div>

      {/* Tasks */}
      {scheduledTasks.map((task, i) => {
        const isRunning = tick % scheduledTasks.length === i;
        return (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.04] transition-all duration-400"
            style={{ background: isRunning ? `${task.color}06` : "transparent" }}
          >
            <div className="text-xl w-7 text-center">{task.icon}</div>
            <div className="flex-1 min-w-0">
              <div
                className="font-['Space_Mono'] text-[13px] mb-1 transition-colors duration-400"
                style={{
                  color: isRunning ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                }}
              >
                {task.name}
              </div>
              <div className="font-['Space_Mono'] text-[11px] text-white/25 flex gap-3">
                <span style={{ color: task.color + "80" }}>{task.agent}</span>
                <span>&bull;</span>
                <span>{task.schedule}</span>
              </div>
            </div>
            <div
              className="font-['Press_Start_2P'] text-[7px] px-2.5 py-1 rounded-sm tracking-wider transition-all duration-400"
              style={{
                color: isRunning ? DARK_BG : task.color,
                background: isRunning ? task.color : "transparent",
                border: `1px solid ${isRunning ? task.color : task.color + "40"}`,
              }}
            >
              {isRunning ? "RUNNING" : "READY"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
