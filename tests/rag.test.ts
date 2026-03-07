import { describe, it, expect } from "vitest";
import { chunkText, extractText } from "@/lib/rag";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const text = "Hello world. This is a short text.";
    const chunks = chunkText(text, "test.txt");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
  });

  it("returns empty array for empty text", () => {
    expect(chunkText("", "test.txt")).toHaveLength(0);
    expect(chunkText("   ", "test.txt")).toHaveLength(0);
  });

  it("splits long text into multiple chunks", () => {
    const sentence = "This is a test sentence with some content. ";
    const text = sentence.repeat(100); // ~4400 chars
    const chunks = chunkText(text, "test.txt");

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("respects paragraph boundaries", () => {
    const para1 = "A".repeat(1200);
    const para2 = "B".repeat(1200);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkText(text, "test.txt");

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].content).toMatch(/^A+/);
  });

  it("respects sentence boundaries", () => {
    const text = "First sentence here. " + "A".repeat(1800) + ". End of block.";
    const chunks = chunkText(text, "test.txt");

    for (const chunk of chunks) {
      expect(chunk.content.trim()).toBe(chunk.content);
    }
  });

  it("handles overlap between chunks", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, "test.txt");

    if (chunks.length >= 2) {
      // Check that the second chunk starts with content that appeared in the first chunk
      const firstContent = chunks[0].content;
      const secondContent = chunks[1].content;
      const secondStart = secondContent.split(" ")[0];
      // The start of chunk 2 should appear somewhere in chunk 1 (overlap)
      expect(firstContent).toContain(secondStart);
    }
  });

  it("normalizes whitespace", () => {
    const text = "Hello    world\r\n\r\nNew   paragraph";
    const chunks = chunkText(text, "test.txt");
    expect(chunks[0].content).not.toContain("\r\n");
    expect(chunks[0].content).not.toContain("    ");
  });

  it("accepts custom chunk size parameters", () => {
    const text = "word ".repeat(200); // 1000 chars
    const smallChunks = chunkText(text, "test.txt", 50, 10);
    const bigChunks = chunkText(text, "test.txt", 500, 10);

    expect(smallChunks.length).toBeGreaterThan(bigChunks.length);
  });

  it("includes metadata with total_chunks", () => {
    const text = "A".repeat(5000);
    const chunks = chunkText(text, "test.txt");

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.metadata.total_chunks).toBe(chunks.length);
    }
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
