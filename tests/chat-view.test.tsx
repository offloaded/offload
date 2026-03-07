import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChatView } from "@/components/ChatView";
import { clearAllCaches } from "@/lib/chat-cache";
import type { Agent } from "@/lib/types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const testAgent: Agent = {
  id: "agent-1",
  user_id: "user-1",
  name: "HR Advisor",
  purpose: "Advise on HR policy",
  color: "#2C5FF6",
  web_search_enabled: false,
  verbosity: 3,
  initiative: 3,
  reactivity: 3,
  repetition_tolerance: 3,
  warmth: 3,
  voice_samples: null,
  voice_profile: null,
  soft_skills: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("ChatView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    clearAllCaches();
  });

  beforeEach(() => {
    // Default: return empty conversation
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversation_id: null, messages: [] }),
    });
  });

  it("renders agent name in header", async () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    expect(screen.getAllByText("HR Advisor").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no messages", async () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    await vi.waitFor(() => {
      expect(
        screen.getAllByText("Start a conversation").length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the input with correct placeholder", () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    const inputs = screen.getAllByPlaceholderText("Message HR Advisor...");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("disables send button when input is empty", () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    // Find send buttons (the non-menu ones) — they should be disabled
    const buttons = screen.getAllByRole("button");
    const sendButtons = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(sendButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("enables send button when input has text", () => {
    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    const inputs = screen.getAllByPlaceholderText("Message HR Advisor...");
    fireEvent.change(inputs[0], { target: { value: "Hello" } });

    // After typing, send button should not be disabled
    const buttons = screen.getAllByRole("button");
    const enabledButtons = buttons.filter((b) => !b.hasAttribute("disabled"));
    expect(enabledButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows hamburger menu on mobile", () => {
    const openDrawer = vi.fn();
    render(
      <ChatView agent={testAgent} openDrawer={openDrawer} />
    );

    // Should have more buttons than desktop (menu + send)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[0]);
    expect(openDrawer).toHaveBeenCalled();
  });

  it("does not call openDrawer from non-menu buttons", () => {
    const openDrawer = vi.fn();
    render(
      <ChatView agent={testAgent} openDrawer={openDrawer} />
    );

    // The "New chat" and send buttons should not trigger openDrawer
    const newChatBtn = screen.getByTitle("New chat");
    fireEvent.click(newChatBtn);
    expect(openDrawer).not.toHaveBeenCalled();
  });

  it("loads conversation history on mount", async () => {
    const messages = [
      {
        id: "m1",
        conversation_id: "c1",
        role: "user",
        content: "Hello there",
        routed_to: null,
        created_at: "2024-01-01T09:00:00Z",
      },
      {
        id: "m2",
        conversation_id: "c1",
        role: "assistant",
        content: "Hi! How can I help?",
        routed_to: null,
        created_at: "2024-01-01T09:00:05Z",
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ conversation_id: "c1", messages }),
    });

    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Hello there")).toBeInTheDocument();
      expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
    });
  });

  it("adds user message to UI immediately on send", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ conversation_id: null, messages: [] }),
        });
      }
      // Simulate a stream that never resolves
      return new Promise(() => {});
    });

    render(
      <ChatView agent={testAgent} openDrawer={() => {}} />
    );

    // Wait for initial load
    await vi.waitFor(() => {
      expect(
        screen.getAllByText("Start a conversation").length
      ).toBeGreaterThanOrEqual(1);
    });

    const inputs = screen.getAllByPlaceholderText("Message HR Advisor...");
    fireEvent.change(inputs[0], { target: { value: "Test message" } });
    fireEvent.keyDown(inputs[0], { key: "Enter" });

    await vi.waitFor(() => {
      expect(screen.getByText("Test message")).toBeInTheDocument();
      expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
    });
  });
});
