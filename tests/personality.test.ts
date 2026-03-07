import { describe, it, expect } from "vitest";
import { buildStyleInstructions, buildSystemPrompt } from "@/lib/anthropic";

describe("buildStyleInstructions", () => {
  it("returns only re-engagement rule when no styles selected", () => {
    const result = buildStyleInstructions({});
    expect(result).toContain("CRITICAL: Never repeat a point");
    expect(result).not.toContain("Take initiative");
    expect(result).not.toContain("data-driven");
    expect(result).not.toContain("brief");
  });

  it("includes Proactive instructions when selected", () => {
    const result = buildStyleInstructions({ working_style: ["Proactive"] });
    expect(result).toContain("Take initiative");
    expect(result).toContain("Flag potential issues");
  });

  it("includes Analytical instructions when selected", () => {
    const result = buildStyleInstructions({ working_style: ["Analytical"] });
    expect(result).toContain("data-driven");
    expect(result).toContain("evidence-based");
  });

  it("includes Collaborative instructions when selected", () => {
    const result = buildStyleInstructions({ working_style: ["Collaborative"] });
    expect(result).toContain("Build on what others say");
    expect(result).toContain("colleagues");
  });

  it("includes Concise instructions when selected", () => {
    const result = buildStyleInstructions({ communication_style: ["Concise"] });
    expect(result).toContain("brief");
    expect(result).toContain("to the point");
  });

  it("includes Professional instructions when selected", () => {
    const result = buildStyleInstructions({ communication_style: ["Professional"] });
    expect(result).toContain("formal");
    expect(result).toContain("terminology");
  });

  it("includes Supportive instructions when selected", () => {
    const result = buildStyleInstructions({ communication_style: ["Supportive"] });
    expect(result).toContain("encouraging");
    expect(result).toContain("warm");
  });

  it("combines multiple working and communication styles", () => {
    const result = buildStyleInstructions({
      working_style: ["Proactive", "Analytical"],
      communication_style: ["Concise"],
    });
    expect(result).toContain("Take initiative");
    expect(result).toContain("data-driven");
    expect(result).toContain("brief");
  });

  it("always includes the universal re-engagement rule", () => {
    const result = buildStyleInstructions({
      working_style: ["Proactive"],
      communication_style: ["Supportive"],
    });
    expect(result).toContain("CRITICAL: Never repeat");
    expect(result).toContain("@mentioned");
    expect(result).toContain("genuinely NEW");
  });

  it("handles null working_style and communication_style", () => {
    const result = buildStyleInstructions({
      working_style: null,
      communication_style: null,
    });
    expect(result).toContain("CRITICAL: Never repeat");
  });

  it("ignores unknown style tags", () => {
    const result = buildStyleInstructions({
      working_style: ["Unknown"],
      communication_style: ["Nonexistent"],
    });
    // Should still have the re-engagement rule but no style instructions
    expect(result).toContain("CRITICAL");
    expect(result).not.toContain("Take initiative");
  });
});

describe("buildSystemPrompt - voice and skills", () => {
  it("includes voice profile when provided", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      voice_profile: "Writes in short, punchy sentences. Uses British spelling.",
    });
    expect(prompt).toContain("TONE OF VOICE");
    expect(prompt).toContain("short, punchy sentences");
    expect(prompt).toContain("British spelling");
  });

  it("omits voice section when no voice_profile", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      voice_profile: null,
    });
    expect(prompt).not.toContain("TONE OF VOICE");
  });

  it("includes soft skills when provided", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      soft_skills: [
        { skill: "Data Analysis", confidence: "high", note: "Core strength" },
        { skill: "Public Speaking", confidence: "low" },
      ],
    });
    expect(prompt).toContain("YOUR SOFT SKILLS");
    expect(prompt).toContain("Data Analysis (high)");
    expect(prompt).toContain("Core strength");
    expect(prompt).toContain("Public Speaking (low)");
    expect(prompt).toContain("Lean into these strengths");
  });

  it("omits skills section when no soft_skills", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      soft_skills: null,
    });
    expect(prompt).not.toContain("YOUR SOFT SKILLS");
  });

  it("includes schedule detection instructions when enabled", () => {
    const prompt = buildSystemPrompt(
      { name: "Agent", purpose: "Testing" },
      undefined,
      undefined,
      { enableScheduleDetection: true }
    );
    expect(prompt).toContain("schedule_request");
    expect(prompt).toContain("group_message_request");
    expect(prompt).toContain("RECURRING");
    expect(prompt).toContain("ONE-OFF");
  });

  it("includes web search results when provided", () => {
    const prompt = buildSystemPrompt(
      { name: "Agent", purpose: "Testing" },
      undefined,
      undefined,
      { webSearchResults: "Result 1: ...\nResult 2: ..." }
    );
    expect(prompt).toContain("Web search results");
    expect(prompt).toContain("Result 1");
  });

  it("includes disabled features instructions", () => {
    const prompt = buildSystemPrompt(
      { name: "Agent", purpose: "Testing" },
      undefined,
      undefined,
      {
        disabledFeatures: [
          { feature: "web_search", label: "Web Search", description: "Search the web" },
        ],
      }
    );
    expect(prompt).toContain("feature_request");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("Search the web");
  });

  it("includes formatting rule", () => {
    const prompt = buildSystemPrompt({ name: "Agent", purpose: "Testing" });
    expect(prompt).toContain("FORMATTING RULE");
    expect(prompt).toContain("No **bold**");
  });

  it("includes skills self-assessment instructions", () => {
    const prompt = buildSystemPrompt({ name: "Agent", purpose: "Testing" });
    expect(prompt).toContain("SKILLS SELF-ASSESSMENT");
    expect(prompt).toContain("skills_update");
  });

  it("includes working style instructions in system prompt", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      working_style: ["Proactive", "Analytical"],
    });
    expect(prompt).toContain("Take initiative");
    expect(prompt).toContain("data-driven");
  });

  it("includes communication style instructions in system prompt", () => {
    const prompt = buildSystemPrompt({
      name: "Agent",
      purpose: "Testing",
      communication_style: ["Concise", "Professional"],
    });
    expect(prompt).toContain("brief");
    expect(prompt).toContain("formal");
  });
});
