import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock the app layout context
vi.mock("@/app/(app)/layout", () => ({
  useApp: () => ({
    agents: [],
    refreshAgents: async () => {},
    mobile: false,
    openDrawer: vi.fn(),
  }),
}));

// Mock chat-cache
vi.mock("@/lib/chat-cache", () => ({
  clearCache: vi.fn(),
  getCached: vi.fn(),
  setCache: vi.fn(),
  preloadAllChats: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("History Page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations: [], has_more: false }),
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    });
  });

  it("renders conversation entries", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          conversations: [
            {
              id: "conv-1",
              agent_id: "agent-1",
              agent_name: "HR Advisor",
              agent_color: "#2C5FF6",
              is_group: false,
              preview: "What is the hiring policy?",
              preview_role: "user",
              last_message_at: new Date().toISOString(),
              created_at: "2024-01-01T00:00:00Z",
              updated_at: new Date().toISOString(),
            },
            {
              id: "conv-2",
              agent_id: null,
              agent_name: null,
              agent_color: null,
              is_group: true,
              preview: "Good morning team",
              preview_role: "user",
              last_message_at: new Date().toISOString(),
              created_at: "2024-01-01T00:00:00Z",
              updated_at: new Date().toISOString(),
            },
          ],
          has_more: false,
        }),
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText("HR Advisor")).toBeInTheDocument();
      expect(screen.getByText("Team Chat")).toBeInTheDocument();
      expect(
        screen.getByText("What is the hiring policy?")
      ).toBeInTheDocument();
    });
  });

  it("navigates to agent chat when clicking an entry", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          conversations: [
            {
              id: "conv-1",
              agent_id: "agent-1",
              agent_name: "HR Advisor",
              agent_color: "#2C5FF6",
              is_group: false,
              preview: "Hello",
              preview_role: "user",
              last_message_at: new Date().toISOString(),
              created_at: "2024-01-01T00:00:00Z",
              updated_at: new Date().toISOString(),
            },
          ],
          has_more: false,
        }),
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText("HR Advisor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("HR Advisor"));
    expect(mockPush).toHaveBeenCalledWith("/agent/agent-1?c=conv-1");
  });

  it("navigates to group chat when clicking a group entry", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          conversations: [
            {
              id: "conv-2",
              agent_id: null,
              agent_name: null,
              agent_color: null,
              is_group: true,
              preview: "Hello team",
              preview_role: "user",
              last_message_at: new Date().toISOString(),
              created_at: "2024-01-01T00:00:00Z",
              updated_at: new Date().toISOString(),
            },
          ],
          has_more: false,
        }),
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText("Team Chat")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Team Chat"));
    expect(mockPush).toHaveBeenCalledWith("/chat?c=conv-2");
  });

  it("has a search input", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ conversations: [], has_more: false }),
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    const searchInput = screen.getByPlaceholderText("Search conversations...");
    expect(searchInput).toBeInTheDocument();
  });

  it("shows no results state for empty search", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Initial load
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              conversations: [
                {
                  id: "conv-1",
                  agent_id: "agent-1",
                  agent_name: "HR",
                  agent_color: "#000",
                  is_group: false,
                  preview: "Hi",
                  preview_role: "user",
                  last_message_at: new Date().toISOString(),
                  created_at: "2024-01-01T00:00:00Z",
                  updated_at: new Date().toISOString(),
                },
              ],
              has_more: false,
            }),
        });
      }
      // Search returns empty
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ conversations: [], has_more: false }),
      });
    });

    const HistoryPage = (await import("@/app/(app)/history/page")).default;
    render(<HistoryPage />);

    await vi.waitFor(() => {
      expect(screen.getByText("HR")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search conversations...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await vi.waitFor(
      () => {
        expect(screen.getByText("No results found")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
