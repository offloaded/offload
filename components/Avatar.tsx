"use client";

export function Avatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: `${color}18`,
        color: color,
        fontSize: size * 0.4,
      }}
    >
      {name.charAt(0)}
    </div>
  );
}
