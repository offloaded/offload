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

  it("includes document names when provided", () => {
    const prompt = buildSystemPrompt(
      { name: "HR", purpose: "HR policy" },
      undefined,
      ["policy.pdf", "handbook.docx"]
    );

    expect(prompt).toContain("documents in your knowledge base");
    expect(prompt).toContain("- policy.pdf");
    expect(prompt).toContain("- handbook.docx");
  });

  it("includes RAG context when provided", () => {
    const context = [
      { content: "Section 1: Leave policy allows 20 days annual leave.", fileName: "policy.pdf" },
      { content: "Section 5: Overtime must be approved by manager.", fileName: "handbook.pdf" },
    ];

    const prompt = buildSystemPrompt(
      { name: "HR", purpose: "HR policy" },
      context
    );

    expect(prompt).toContain("Relevant excerpts from your knowledge base");
    expect(prompt).toContain('[1] From "policy.pdf"');
    expect(prompt).toContain("Leave policy allows 20 days");
    expect(prompt).toContain('[2] From "handbook.pdf"');
    expect(prompt).toContain("reference the relevant documents");
  });

  it("omits context section when no context provided", () => {
    const prompt = buildSystemPrompt({
      name: "HR",
      purpose: "HR policy",
    });

    expect(prompt).not.toContain("Relevant excerpts");
    expect(prompt).not.toContain("knowledge base");
  });
});
