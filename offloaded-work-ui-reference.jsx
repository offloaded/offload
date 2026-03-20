import { useState } from "react";

const OffloadedWorkUI = () => {
  const [activeSection, setActiveSection] = useState("work");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedWorkItem, setSelectedWorkItem] = useState(1);
  const [workItemStatus, setWorkItemStatus] = useState("review");

  const handleNavClick = (section) => {
    if (section === activeSection) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setActiveSection(section);
      setSidebarOpen(true);
    }
  };

  const workItems = [
    {
      id: 1,
      title: "Contract Variation — Katie Taylor",
      agent: "HR Form Completor",
      status: "review",
      updated: "2 min ago",
      preview: "Acting Manager Community Development extension...",
    },
    {
      id: 2,
      title: "Team Status Report — Week 12",
      agent: "Chief of Staff",
      status: "complete",
      updated: "1 hour ago",
      preview: "Directorate overview across all service areas...",
    },
    {
      id: 3,
      title: "Permit Assessment — De Louche Wedding",
      agent: "Event Permits Assessor",
      status: "complete",
      updated: "Yesterday",
      preview: "Wedding ceremony permit for Gnarabup beach...",
    },
    {
      id: 4,
      title: "1:1 Briefing — Jacinta",
      agent: "Chief of Staff",
      status: "in_progress",
      updated: "5 min ago",
      preview: "Preparing briefing for tomorrow's 1:1...",
    },
    {
      id: 5,
      title: "Fuel Security Risk Assessment",
      agent: "SEC Program Manager",
      status: "draft",
      updated: "2 days ago",
      preview: "Iran-Strait of Hormuz supply chain analysis...",
    },
  ];

  const chatMessages = [
    {
      role: "user",
      content:
        "HR sent me this contract variation form for Katie Taylor. She's been acting as Manager Community Development for 12 months. The substantive manager has returned but Katie needs to continue for 3 more months to finish the Community Health & Wellbeing Strategy. Can you fill out the form?",
    },
    {
      role: "assistant",
      agent: "HR Form Completor",
      content:
        "I've reviewed the form and your HR policies. I've drafted the contract variation with the following details:\n\n• Employee: Katie Taylor\n• Position: Acting Manager Community Development\n• Duration: 2 March – 30 June 2026\n• Remuneration: Coordinator base salary + $180/week higher duties allowance\n• Justification: Project continuity for CH&WS completion\n\nThe form requires CEO sign-off since the substantive manager has returned — this doesn't fall under the standard Higher Duties Procedure. I've noted that in the form.\n\nThe draft is ready for your review on the left.",
    },
    {
      role: "user",
      content:
        "Looks good. Can you change the justification to also mention that the returning manager needs to focus on the Economic Development Strategy?",
    },
    {
      role: "assistant",
      agent: "HR Form Completor",
      content:
        "Updated. The justification now reads:\n\n\"Continuity of the Community Health and Wellbeing Strategy which has three months remaining. The employee has led this project for 12 months and has the stakeholder relationships and context to deliver it effectively. The substantive Manager Community Development needs to focus on developing the Economic Development Strategy, making it impractical to transfer this project back.\"\n\nI've updated the draft on the left.",
    },
  ];

  const statusColors = {
    draft: { bg: "bg-neutral-700", text: "text-neutral-300", label: "Draft" },
    in_progress: {
      bg: "bg-amber-900/40",
      text: "text-amber-400",
      label: "In Progress",
    },
    review: {
      bg: "bg-blue-900/40",
      text: "text-blue-400",
      label: "Review",
    },
    complete: {
      bg: "bg-emerald-900/40",
      text: "text-emerald-400",
      label: "Complete",
    },
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background: "#1a1a1a",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Icon Rail — always visible */}
      <div
        className="flex flex-col items-center py-4 flex-shrink-0"
        style={{
          width: "52px",
          background: "#111111",
          borderRight: "1px solid #2a2a2a",
        }}
      >
        {/* Logo */}
        <div
          className="w-8 h-8 rounded-lg mb-6 flex items-center justify-center"
          style={{ background: "#e8740c" }}
        >
          <span className="text-white text-sm font-bold">O</span>
        </div>

        {/* Chat */}
        <button
          onClick={() => handleNavClick("chat")}
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
          style={{
            background:
              activeSection === "chat"
                ? "rgba(232, 116, 12, 0.15)"
                : "transparent",
            color: activeSection === "chat" ? "#e8740c" : "#777",
          }}
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
        </button>

        {/* Work */}
        <button
          onClick={() => handleNavClick("work")}
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
          style={{
            background:
              activeSection === "work"
                ? "rgba(232, 116, 12, 0.15)"
                : "transparent",
            color: activeSection === "work" ? "#e8740c" : "#777",
          }}
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
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings — anchored to bottom */}
        <button
          onClick={() => handleNavClick("settings")}
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-all duration-150"
          style={{
            background:
              activeSection === "settings"
                ? "rgba(232, 116, 12, 0.15)"
                : "transparent",
            color: activeSection === "settings" ? "#e8740c" : "#777",
          }}
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
        </button>
      </div>

      {/* Sidebar — collapsible */}
      <div
        className="flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          width: sidebarOpen ? "300px" : "0px",
          borderRight: sidebarOpen ? "1px solid #2a2a2a" : "none",
          background: "#1a1a1a",
        }}
      >
        <div className="w-[300px] h-full flex flex-col">
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid #2a2a2a" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "#e0e0e0" }}
            >
              {activeSection === "chat" ? "Conversations" : "Work"}
            </span>
            <button
              className="w-7 h-7 rounded flex items-center justify-center transition-colors"
              style={{ color: "#777" }}
              onMouseEnter={(e) => (e.target.style.color = "#e8740c")}
              onMouseLeave={(e) => (e.target.style.color = "#777")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Status filter pills */}
          {activeSection === "work" && (
            <div
              className="flex gap-1.5 px-4 py-2.5"
              style={{ borderBottom: "1px solid #2a2a2a" }}
            >
              {["All", "Active", "Review", "Complete"].map((filter, i) => (
                <button
                  key={filter}
                  className="px-2.5 py-1 rounded-full text-xs transition-all"
                  style={{
                    background: i === 0 ? "rgba(232, 116, 12, 0.15)" : "transparent",
                    color: i === 0 ? "#e8740c" : "#777",
                    border:
                      i === 0 ? "1px solid rgba(232, 116, 12, 0.3)" : "1px solid transparent",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}

          {/* Work items list */}
          <div className="flex-1 overflow-y-auto">
            {activeSection === "work" &&
              workItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedWorkItem(item.id)}
                  className="w-full text-left px-4 py-3 transition-all duration-100"
                  style={{
                    background:
                      selectedWorkItem === item.id
                        ? "rgba(232, 116, 12, 0.08)"
                        : "transparent",
                    borderBottom: "1px solid #222",
                    borderLeft:
                      selectedWorkItem === item.id
                        ? "2px solid #e8740c"
                        : "2px solid transparent",
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className="text-sm font-medium leading-tight line-clamp-2"
                      style={{
                        color:
                          selectedWorkItem === item.id ? "#f0f0f0" : "#ccc",
                      }}
                    >
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${statusColors[item.status].bg} ${statusColors[item.status].text}`}
                    >
                      {statusColors[item.status].label}
                    </span>
                    <span className="text-xs" style={{ color: "#666" }}>
                      {item.agent}
                    </span>
                  </div>
                  <span
                    className="text-xs mt-1 block"
                    style={{ color: "#555" }}
                  >
                    {item.updated}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main content — Report + Chat split */}
      <div className="flex-1 flex min-w-0">
        {/* Report panel (primary) */}
        <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: "1px solid #2a2a2a" }}>
          {/* Report header */}
          <div
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid #2a2a2a" }}
          >
            <div className="flex items-center gap-3">
              <h1
                className="text-base font-semibold"
                style={{ color: "#f0f0f0" }}
              >
                Contract Variation — Katie Taylor
              </h1>
              <span
                className={`px-2 py-0.5 rounded text-xs ${statusColors.review.bg} ${statusColors.review.text}`}
              >
                Review
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: "transparent",
                  color: "#999",
                  border: "1px solid #333",
                }}
              >
                Export
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{ background: "#e8740c", color: "#fff" }}
              >
                Mark Complete
              </button>
            </div>
          </div>

          {/* Report content — editable */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-2xl">
              <h2
                className="text-xl font-semibold mb-6"
                style={{ color: "#e0e0e0" }}
              >
                Authorisation Form — Contract Variation (Levels 1-5)
              </h2>

              <div className="mb-6">
                <h3
                  className="text-sm font-semibold mb-3 uppercase tracking-wide"
                  style={{ color: "#e8740c" }}
                >
                  Section 1 — Requisition and Employment Offer
                </h3>

                {[
                  {
                    label: "Appoint/modify role as per Workforce Plan/Budget/PD",
                    value: "No — CEO sign-off required",
                  },
                  { label: "Employee name", value: "Katie Taylor" },
                  {
                    label: "Position",
                    value: "Acting Manager Community Development",
                  },
                  {
                    label: "Contract commencement/term",
                    value: "2 March 2026 – 30 June 2026",
                  },
                  {
                    label: "Salary/benefits and hours",
                    value:
                      "Coordinator Community Development base salary + $180/week pro-rata higher duties allowance (max 76 hours per rostered fortnight)",
                  },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="mb-4 pb-4"
                    style={{ borderBottom: "1px solid #2a2a2a" }}
                  >
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "#888" }}
                    >
                      {field.label}
                    </div>
                    <div className="text-sm" style={{ color: "#ddd" }}>
                      {field.value}
                    </div>
                  </div>
                ))}

                <div className="mb-4">
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: "#888" }}
                  >
                    Justification for employment contract variation
                  </div>
                  <div
                    className="text-sm leading-relaxed"
                    style={{ color: "#ddd" }}
                  >
                    Continuity of the Community Health and Wellbeing Strategy
                    which has three months remaining. The employee has led this
                    project for 12 months and has the stakeholder relationships
                    and context to deliver it effectively. The substantive
                    Manager Community Development needs to focus on developing
                    the Economic Development Strategy, making it impractical to
                    transfer this project back. Direct appointment avoids
                    disruption to a time-critical strategic project.
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3
                  className="text-sm font-semibold mb-3 uppercase tracking-wide"
                  style={{ color: "#e8740c" }}
                >
                  Section 2 — Approval and HR Verification
                </h3>
                {[
                  { label: "HR Workforce Plan Verification", value: "Pending" },
                  { label: "Manager Approval", value: "Pending" },
                  { label: "Director Approval", value: "Pending" },
                  { label: "CEO Sign-off", value: "Required — Pending" },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="mb-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid #2a2a2a", paddingBottom: "12px" }}
                  >
                    <span className="text-xs" style={{ color: "#888" }}>
                      {field.label}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: "rgba(255, 180, 50, 0.1)",
                        color: "#ffb432",
                      }}
                    >
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat panel (secondary) */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{ width: "380px", background: "#161616" }}
        >
          {/* Chat header */}
          <div
            className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid #2a2a2a" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: "#e8740c", color: "#fff" }}
            >
              H
            </div>
            <span className="text-sm font-medium" style={{ color: "#ccc" }}>
              HR Form Completor
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded ml-1"
              style={{ background: "#2a2a2a", color: "#888" }}
            >
              Human Resources Advisor
            </span>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs" style={{ color: "#666" }}>
                        You
                      </span>
                    </div>
                    <div
                      className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[90%]"
                      style={{ background: "#2a2a2a" }}
                    >
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "#ddd" }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                        style={{ background: "#e8740c", color: "#fff" }}
                      >
                        H
                      </div>
                      <span className="text-xs" style={{ color: "#e8740c" }}>
                        {msg.agent}
                      </span>
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[90%]"
                      style={{ background: "#222" }}
                    >
                      <p
                        className="text-sm leading-relaxed whitespace-pre-line"
                        style={{ color: "#ccc" }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid #2a2a2a" }}>
            <div
              className="flex items-center rounded-xl px-3.5 py-2.5"
              style={{ background: "#222", border: "1px solid #333" }}
            >
              {/* Attachment */}
              <button className="mr-2" style={{ color: "#666" }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <input
                type="text"
                placeholder="Refine the draft..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#ccc" }}
              />
              {/* Send */}
              <button style={{ color: "#e8740c" }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffloadedWorkUI;
