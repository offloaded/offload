"use client";

import { DARK_BG, GRID_COLOR } from "@/lib/landing-data";

export default function GridFloor() {
  return (
    <div
      className="absolute bottom-0 left-0 w-full opacity-60"
      style={{
        height: "45%",
        background: `
          linear-gradient(to bottom, transparent 0%, ${DARK_BG} 100%),
          repeating-linear-gradient(90deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px),
          repeating-linear-gradient(0deg, ${GRID_COLOR} 0px, transparent 1px, transparent 80px)
        `,
        transform: "perspective(400px) rotateX(45deg)",
        transformOrigin: "bottom center",
      }}
    />
  );
}
