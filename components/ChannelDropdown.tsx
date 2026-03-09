"use client";

export interface ChannelOption {
  id: string;      // team ID, or "all" for #All
  name: string;     // display name
}

export function ChannelDropdown({
  channels,
  filter,
  onSelect,
  selectedIndex,
}: {
  channels: ChannelOption[];
  filter: string;
  onSelect: (channel: ChannelOption) => void;
  selectedIndex: number;
}) {
  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );
  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto max-w-full">
      {filtered.map((c, i) => (
        <button
          key={c.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(c);
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-none cursor-pointer transition-colors min-w-0"
          style={{
            background:
              i === selectedIndex ? "var(--color-hover)" : "transparent",
          }}
        >
          <span className="text-[14px] text-[var(--color-text-tertiary)]">#</span>
          <span className="text-[14px] font-medium text-[var(--color-text)]">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Build the list of channels from teams + #All */
export function buildChannelOptions(teams: { id: string; name: string }[]): ChannelOption[] {
  const options: ChannelOption[] = [{ id: "all", name: "All" }];
  for (const t of teams) {
    options.push({ id: t.id, name: t.name });
  }
  return options;
}

/** Extract #channel-name references from message text */
export function extractChannels(
  text: string,
  channels: ChannelOption[]
): ChannelOption[] {
  const found: ChannelOption[] = [];
  const lower = text.toLowerCase();
  for (const ch of channels) {
    const pattern = `#${ch.name.toLowerCase()}`;
    if (lower.includes(pattern)) {
      found.push(ch);
    }
  }
  return found;
}
