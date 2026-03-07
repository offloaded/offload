import { describe, it, expect, beforeEach } from "vitest";
import {
  getCached,
  setCache,
  updateMessages,
  setConversationId,
  prependMessages,
  clearCache,
  clearAllCaches,
} from "@/lib/chat-cache";
import type { ChatMessage } from "@/lib/chat-cache";

describe("chat-cache", () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it("returns undefined for uncached chat", () => {
    expect(getCached("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves cached chat", () => {
    const messages: ChatMessage[] = [
      { id: "m1", role: "user", content: "Hello", created_at: "2024-01-01T00:00:00Z" },
    ];
    setCache("chat-1", { conversationId: "c1", messages, hasMore: false });

    const cached = getCached("chat-1");
    expect(cached).toBeDefined();
    expect(cached!.conversationId).toBe("c1");
    expect(cached!.messages).toHaveLength(1);
    expect(cached!.messages[0].content).toBe("Hello");
  });

  it("updates messages in an existing cache entry", () => {
    setCache("chat-1", { conversationId: "c1", messages: [], hasMore: false });

    const newMessage: ChatMessage = { id: "m1", role: "user", content: "Hi", created_at: "2024-01-01T00:00:00Z" };
    updateMessages("chat-1", (prev) => [...prev, newMessage]);

    const cached = getCached("chat-1");
    expect(cached!.messages).toHaveLength(1);
    expect(cached!.messages[0].content).toBe("Hi");
  });

  it("does nothing when updating nonexistent cache", () => {
    updateMessages("nonexistent", (prev) => [...prev, { id: "m1", role: "user", content: "Hi", created_at: "2024-01-01T00:00:00Z" }]);
    expect(getCached("nonexistent")).toBeUndefined();
  });

  it("sets conversation ID on existing cache", () => {
    setCache("chat-1", { conversationId: null, messages: [], hasMore: false });

    setConversationId("chat-1", "c1");

    const cached = getCached("chat-1");
    expect(cached!.conversationId).toBe("c1");
  });

  it("prepends messages to existing cache", () => {
    const existing: ChatMessage[] = [
      { id: "m2", role: "user", content: "Second", created_at: "2024-01-01T01:00:00Z" },
    ];
    setCache("chat-1", { conversationId: "c1", messages: existing, hasMore: true });

    const older: ChatMessage[] = [
      { id: "m1", role: "user", content: "First", created_at: "2024-01-01T00:00:00Z" },
    ];
    prependMessages("chat-1", older, false);

    const cached = getCached("chat-1");
    expect(cached!.messages).toHaveLength(2);
    expect(cached!.messages[0].content).toBe("First");
    expect(cached!.messages[1].content).toBe("Second");
    expect(cached!.hasMore).toBe(false);
  });

  it("clears a specific chat cache", () => {
    setCache("chat-1", { conversationId: "c1", messages: [], hasMore: false });
    setCache("chat-2", { conversationId: "c2", messages: [], hasMore: false });

    clearCache("chat-1");

    expect(getCached("chat-1")).toBeUndefined();
    expect(getCached("chat-2")).toBeDefined();
  });

  it("clears all caches", () => {
    setCache("chat-1", { conversationId: "c1", messages: [], hasMore: false });
    setCache("chat-2", { conversationId: "c2", messages: [], hasMore: false });

    clearAllCaches();

    expect(getCached("chat-1")).toBeUndefined();
    expect(getCached("chat-2")).toBeUndefined();
  });
});
