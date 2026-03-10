"use client";

import { useState } from "react";
import { reportEntries } from "@/lib/landing-data";

export default function ReportsDemo() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="bg-black/40 border border-white/[0.08] rounded overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
        <div className="font-['Press_Start_2P'] text-[8px] text-white/30 tracking-[2px]">
          SAVED REPORTS
        </div>
        <div className="font-['Space_Mono'] text-[11px] text-white/20">
          {reportEntries.length} files
        </div>
      </div>

      {/* Entries */}
      {reportEntries.map((r, i) => (
        <div
          key={i}
          onClick={() => setSelected(i)}
          className="flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.04] cursor-pointer transition-all duration-200"
          style={{
            background: selected === i ? `${r.color}08` : "transparent",
            borderLeft: selected === i ? `3px solid ${r.color}` : "3px solid transparent",
          }}
        >
          {/* File icon */}
          <div
            className="w-8 h-10 rounded-sm flex items-center justify-center font-['Press_Start_2P'] text-[6px] shrink-0"
            style={{
              background: `linear-gradient(135deg, ${r.color}20, ${r.color}08)`,
              border: `1px solid ${r.color}30`,
              color: r.color,
            }}
          >
            PDF
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div
              className="font-['Space_Mono'] text-[13px] mb-1 transition-colors duration-200 truncate"
              style={{
                color: selected === i ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
              }}
            >
              {r.title}
            </div>
            <div className="font-['Space_Mono'] text-[11px] text-white/25 flex gap-3">
              <span style={{ color: r.color + "80" }}>{r.agent}</span>
              <span>&bull;</span>
              <span>{r.pages} pages</span>
              <span>&bull;</span>
              <span>{r.date}</span>
            </div>
          </div>

          {/* Open indicator */}
          <div
            className="font-['Press_Start_2P'] text-[6px] text-white/20 transition-opacity duration-200"
            style={{ opacity: selected === i ? 1 : 0 }}
          >
            OPEN &rarr;
          </div>
        </div>
      ))}
    </div>
  );
}
