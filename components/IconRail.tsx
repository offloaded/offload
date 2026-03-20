"use client";

interface IconRailProps {
  activeSection: "chat" | "work" | "settings";
  onNavClick: (section: "chat" | "work" | "settings") => void;
  workspaceInitial: string;
}

export default function IconRail({
  activeSection,
  onNavClick,
  workspaceInitial,
}: IconRailProps) {
  return (
    <div
      className="flex flex-col items-center py-4 flex-shrink-0"
      style={{
        width: "52px",
        background: "color-mix(in srgb, var(--color-sidebar-bg) 70%, var(--color-page-bg) 30%)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Workspace initial */}
      <div
        className="w-8 h-8 rounded-lg mb-6 flex items-center justify-center"
        style={{ background: "var(--color-accent)" }}
      >
        <span className="text-white text-sm font-bold">{workspaceInitial}</span>
      </div>

      {/* Chat */}
      <NavButton
        active={activeSection === "chat"}
        onClick={() => onNavClick("chat")}
        title="Chat"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </NavButton>

      {/* Work */}
      <NavButton
        active={activeSection === "work"}
        onClick={() => onNavClick("work")}
        title="Work"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </NavButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <NavButton
        active={activeSection === "settings"}
        onClick={() => onNavClick("settings")}
        title="Settings"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42" />
        </svg>
      </NavButton>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
      style={{
        background: active ? "var(--color-accent-soft)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
      }}
      title={title}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--color-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }
      }}
    >
      {children}
    </button>
  );
}
