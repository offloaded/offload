"use client";

interface MobileTabBarProps {
  activeSection: "dashboard" | "chat" | "work" | "scheduled" | "settings";
  onNavClick: (section: "dashboard" | "chat" | "work" | "scheduled" | "settings") => void;
  workNotificationCount?: number;
}

export default function MobileTabBar({
  activeSection,
  onNavClick,
  workNotificationCount = 0,
}: MobileTabBarProps) {
  const tabs: Array<{
    id: "dashboard" | "chat" | "work" | "settings";
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "dashboard",
      label: "Home",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="4" rx="1" />
          <rect x="14" y="11" width="7" height="10" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "chat",
      label: "Chat",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "work",
      label: "Work",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="flex md:hidden items-center justify-around shrink-0 border-t border-[var(--color-border)] bg-[var(--color-sidebar-bg)]"
      style={{
        height: "60px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeSection;
        return (
          <button
            key={tab.id}
            onClick={() => onNavClick(tab.id)}
            className="flex flex-col items-center justify-center flex-1 h-full bg-transparent border-none cursor-pointer transition-colors relative"
            style={{
              color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
            }}
          >
            <div className="relative">
              {tab.icon}
              {tab.id === "work" && workNotificationCount > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold text-white leading-none px-0.5"
                  style={{ background: "var(--color-accent)" }}
                >
                  {workNotificationCount > 9 ? "9+" : workNotificationCount}
                </span>
              )}
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium"
              style={{
                color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
