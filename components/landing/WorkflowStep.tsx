"use client";

import { useState } from "react";

interface Step {
  num: string;
  label: string;
  desc: string;
  color: string;
}

export default function WorkflowStep({ step }: { step: Step }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex gap-5 items-start p-6 transition-all duration-300"
      style={{
        borderLeft: `2px solid ${hovered ? step.color : "rgba(255,255,255,0.08)"}`,
        background: hovered ? `linear-gradient(90deg, ${step.color}06, transparent)` : "transparent",
      }}
    >
      <div
        className="font-['Press_Start_2P'] text-xl shrink-0 w-[50px]"
        style={{ color: step.color, textShadow: `0 0 15px ${step.color}60` }}
      >
        {step.num}
      </div>
      <div>
        <div
          className="font-['Press_Start_2P'] text-[11px] mb-2 tracking-[2px]"
          style={{ color: step.color, textShadow: `0 0 8px ${step.color}80` }}
        >
          {step.label}
        </div>
        <div className="font-['Space_Mono'] text-sm text-white/65 leading-7">
          {step.desc}
        </div>
      </div>
    </div>
  );
}
