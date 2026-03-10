"use client";

import { NEON_CYAN } from "@/lib/landing-data";

interface GlowTextProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  delay?: number;
}

export default function GlowText({ children, color = NEON_CYAN, className = "", delay = 0 }: GlowTextProps) {
  return (
    <span
      className={className}
      style={{
        color,
        textShadow: `0 0 7px ${color}, 0 0 20px ${color}, 0 0 40px ${color}80`,
        animation: `flicker 3s ease-in-out ${delay}s infinite alternate`,
      }}
    >
      {children}
    </span>
  );
}
