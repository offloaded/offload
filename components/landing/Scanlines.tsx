"use client";

export default function Scanlines() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }}
    />
  );
}
