import { describe, it, expect } from "vitest";
import { cleanResponse } from "@/lib/anthropic";

describe("cleanResponse", () => {
  it("strips <search> blocks", () => {
    const input = `Here is the answer.\n\n<search><provider>brave</provider><query>latest news</query></search>\n\nThe results show that...`;
    const result = cleanResponse(input);
    expect(result).not.toContain("<search>");
    expect(result).not.toContain("</search>");
    expect(result).not.toContain("<provider>");
    expect(result).toContain("Here is the answer.");
    expect(result).toContain("The results show that...");
  });

  it("strips multiline <search> blocks", () => {
    const input = `Hello.\n\n<search>\n<provider>brave</provider>\n<query>test query</query>\n</search>\n\nGoodbye.`;
    const result = cleanResponse(input);
    expect(result).not.toContain("<search>");
    expect(result).toContain("Hello.");
    expect(result).toContain("Goodbye.");
  });

  it("strips schedule_request blocks", () => {
    const input = "I'll set that up for you.\n\n```schedule_request\n{\"instruction\": \"test\", \"cron\": \"0 9 * * 1-5\", \"timezone\": \"UTC\"}\n```\n\nDone.";
    const result = cleanResponse(input);
    expect(result).not.toContain("schedule_request");
    expect(result).not.toContain("cron");
    expect(result).toContain("I'll set that up for you.");
    expect(result).toContain("Done.");
  });

  it("strips <tool_call> blocks", () => {
    const input = `Searching...\n\n<tool_call>search("query")</tool_call>\n\nFound it.`;
    const result = cleanResponse(input);
    expect(result).not.toContain("<tool_call>");
    expect(result).toContain("Found it.");
  });

  it("collapses excessive newlines", () => {
    const input = "Hello.\n\n\n\n\n\nGoodbye.";
    const result = cleanResponse(input);
    expect(result).toBe("Hello.\n\nGoodbye.");
  });

  it("returns clean text unchanged", () => {
    const input = "This is a normal response with no markup.";
    expect(cleanResponse(input)).toBe(input);
  });

  it("handles multiple search blocks", () => {
    const input = `<search><query>q1</query></search>First result.\n\n<search><query>q2</query></search>Second result.`;
    const result = cleanResponse(input);
    expect(result).not.toContain("<search>");
    expect(result).toContain("First result.");
    expect(result).toContain("Second result.");
  });
});

describe("cleanResponse streaming mode", () => {
  it("strips incomplete <search> tag mid-stream", () => {
    const input = "Here is the answer.\n\n<search><provider>brave</provider><query>latest";
    const result = cleanResponse(input, true);
    expect(result).not.toContain("<search>");
    expect(result).not.toContain("<provider>");
    expect(result).not.toContain("latest");
    expect(result).toContain("Here is the answer.");
  });

  it("strips incomplete schedule_request block mid-stream", () => {
    const input = 'Sure.\n\n```schedule_request\n{"instruction": "do thing"';
    const result = cleanResponse(input, true);
    expect(result).not.toContain("schedule_request");
    expect(result).toContain("Sure.");
  });

  it("keeps clean text intact in streaming mode", () => {
    const input = "Normal text being streamed.";
    expect(cleanResponse(input, true)).toBe(input);
  });

  it("strips complete blocks in streaming mode too", () => {
    const input = "Before.\n\n<search><query>q</query></search>\n\nAfter the search.";
    const result = cleanResponse(input, true);
    expect(result).not.toContain("<search>");
    expect(result).toContain("Before.");
    expect(result).toContain("After the search.");
  });
});
