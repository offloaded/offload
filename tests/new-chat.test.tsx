import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChatView } from "@/components/ChatView";
import type { Agent } from "@/lib/types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Clear chat-cache module state between tests
vi.mock("@/lib/chat-cache", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat-cache")>("@/lib/chat-cache");
  return {
    ...actual,
    getCached: vi.fn(() => undefined), // Always return uncached
    clearCache: vi.fn(),
  };
});

const testAgent: Agent = {
  id: "agent-1",
  user_id: "user-1",
  workspace_id: "workspace-1",
  name: "HR Advisor",
  purpose: "Advise on HR policy",
  color: "#2C5FF6",
  web_search_enabled: false,
  role: null,
  working_style: null,
  communication_style: null,
  voice_samples: null,
  voice_profile: null,
  soft_skills: null,
  team_expectations: null,
  last_message_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("ChatView - New Chat", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ conversation_id: null, messages: [] }),
    });
  });

  it("renders new chat button in header", () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    const newChatButton = screen.getByTitle("New chat");
    expect(newChatButton).toBeInTheDocument();
  });

  it("renders agent name in header", () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    expect(screen.getAllByText("HR Advisor").length).toBeGreaterThanOrEqual(1);
  });

  it("loads specific conversation when initialConversationId is provided", async () => {
    render(
      <ChatView
        agent={testAgent}
        openDrawer={() => {}}
        initialConversationId="conv-123"
      />
    );

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("conversation_id=conv-123")
      );
    });
  });

  it("loads most recent conversation when no initialConversationId", async () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("agent_id=agent-1")
      );
    });
  });
});
