import { describe, it, expect } from "vitest";
import { chunkText, extractText } from "@/lib/rag";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const text = "Hello world. This is a short text.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("returns empty array for empty text", () => {
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });

  it("splits long text into multiple chunks", () => {
    // Create text longer than 2000 chars (500 tokens * 4 chars/token)
    const sentence = "This is a test sentence with some content. ";
    const text = sentence.repeat(100); // ~4400 chars
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be non-empty
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it("respects paragraph boundaries", () => {
    const para1 = "A".repeat(1200);
    const para2 = "B".repeat(1200);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk should mostly be A's
    expect(chunks[0]).toMatch(/^A+/);
  });

  it("respects sentence boundaries", () => {
    // Build text that would split mid-sentence without boundary detection
    const text = "First sentence here. " + "A".repeat(1800) + ". End of block.";
    const chunks = chunkText(text);

    // Should split at a sentence boundary, not mid-word
    for (const chunk of chunks) {
      // Chunks shouldn't start or end mid-word (unless at very end)
      expect(chunk.trim()).toBe(chunk);
    }
  });

  it("handles overlap between chunks", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text);

    if (chunks.length >= 2) {
      // The end of chunk 1 should overlap with the start of chunk 2
      const endOfFirst = chunks[0].slice(-100);
      const startOfSecond = chunks[1].slice(0, 200);
      // Some overlap content should appear in both
      const firstWords = endOfFirst.split(" ");
      const secondWords = startOfSecond.split(" ");
      const overlap = firstWords.filter((w) => secondWords.includes(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  it("normalizes whitespace", () => {
    const text = "Hello    world\r\n\r\nNew   paragraph";
    const chunks = chunkText(text);
    expect(chunks[0]).not.toContain("\r\n");
    expect(chunks[0]).not.toContain("    ");
  });

  it("accepts custom chunk size parameters", () => {
    const text = "word ".repeat(200); // 1000 chars
    const smallChunks = chunkText(text, 50, 10); // 50 tokens = 200 chars
    const bigChunks = chunkText(text, 500, 10); // 500 tokens = 2000 chars

    expect(smallChunks.length).toBeGreaterThan(bigChunks.length);
  });
});

describe("extractText", () => {
  it("extracts text from TXT files", async () => {
    const content = "Hello, this is a test document.";
    const buffer = Buffer.from(content, "utf-8");
    const text = await extractText(buffer, "test.txt");
    expect(text).toBe(content);
  });

  it("extracts text from CSV files", async () => {
    const content = "name,age\nAlice,30\nBob,25";
    const buffer = Buffer.from(content, "utf-8");
    const text = await extractText(buffer, "data.csv");
    expect(text).toBe(content);
  });

  it("extracts text from MD files", async () => {
    const content = "# Title\n\nSome **bold** text.";
    const buffer = Buffer.from(content, "utf-8");
    const text = await extractText(buffer, "readme.md");
    expect(text).toBe(content);
  });

  it("throws for unsupported file types", async () => {
    const buffer = Buffer.from("data");
    await expect(extractText(buffer, "file.xyz")).rejects.toThrow(
      "Unsupported file type"
    );
  });
});
