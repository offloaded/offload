import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/anthropic";

describe("buildSystemPrompt", () => {
  it("includes agent name and purpose", () => {
    const prompt = buildSystemPrompt({
      name: "HR Advisor",
      purpose: "Advise on HR policy and employment law.",
    });

    expect(prompt).toContain("You are HR Advisor.");
    expect(prompt).toContain("Advise on HR policy and employment law.");
  });

  it("includes the colleague instruction", () => {
    const prompt = buildSystemPrompt({
      name: "Test",
      purpose: "Testing",
    });

    expect(prompt).toContain("communicate like a competent colleague");
    expect(prompt).toContain("not an AI assistant");
  });

  it("handles empty purpose", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "",
    });

    expect(prompt).toContain("You are Agent.");
    expect(prompt).toContain("Your purpose:");
  });
});
