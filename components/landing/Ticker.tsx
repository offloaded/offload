"use client";

import { socialProof, NEON_PINK } from "@/lib/landing-data";

export default function Ticker() {
  const items = [...socialProof, ...socialProof, ...socialProof];

  return (
    <div className="overflow-hidden w-full py-5">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "scroll 20s linear infinite" }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="font-['Press_Start_2P'] text-[10px] text-white/25 tracking-[3px]"
          >
            {item}{" "}
            <span className="mx-3" style={{ color: NEON_PINK }}>
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
