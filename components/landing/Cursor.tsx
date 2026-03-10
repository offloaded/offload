"use client";

import { NEON_CYAN } from "@/lib/landing-data";

export default function Cursor({ color = NEON_CYAN }: { color?: string }) {
  return (
    <span
      className="inline-block w-[3px] align-text-bottom"
      style={{
        height: "1.1em",
        backgroundColor: color,
        marginLeft: "4px",
        animation: "blink 1s step-end infinite",
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}
