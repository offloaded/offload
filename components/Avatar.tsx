"use client";

export function Avatar({
  name,
  color,
  size = 32,
  rounded = false,
}: {
  name: string;
  color: string;
  size?: number;
  rounded?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center shrink-0 font-semibold select-none"
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? "50%" : Math.max(size * 0.25, 6),
        background: `${color}16`,
        color: color,
        fontSize: size * 0.36,
        letterSpacing: "-0.02em",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function UserAvatar({
  name = "You",
  size = 32,
}: {
  name?: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center shrink-0 font-semibold select-none"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
        color: "#fff",
        fontSize: size * 0.36,
        letterSpacing: "-0.02em",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function StatusDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 2px var(--color-surface)`,
      }}
    />
  );
}
