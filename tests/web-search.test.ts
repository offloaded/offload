import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatSearchResults } from "@/lib/web-search";

describe("formatSearchResults", () => {
  it("formats results with title, url, content", () => {
    const results = [
      { title: "Test Page", url: "https://example.com", content: "Some content" },
      { title: "Another Page", url: "https://example.com/2", content: "More content" },
    ];
    const formatted = formatSearchResults(results);
    expect(formatted).toContain("[1] Test Page");
    expect(formatted).toContain("https://example.com");
    expect(formatted).toContain("[2] Another Page");
  });

  it("returns message for empty results", () => {
    expect(formatSearchResults([])).toBe("No search results found.");
  });
});
