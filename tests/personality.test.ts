import { describe, it, expect } from "vitest";
import { buildPersonalityInstructions, buildSystemPrompt } from "@/lib/anthropic";

describe("buildPersonalityInstructions", () => {
  it("returns empty-ish output for default traits (3)", () => {
    const result = buildPersonalityInstructions({
      verbosity: 3,
      initiative: 3,
      reactivity: 3,
      repetition_tolerance: 3,
      warmth: 3,
    });
    // Level 3 has no specific instructions, only the universal re-engagement rule
    expect(result).toContain("CRITICAL: Never repeat a point");
    // Should NOT contain instructions for levels 1,2,4,5
    expect(result).not.toContain("Short, direct");
    expect(result).not.toContain("Be thorough");
  });

  it("includes verbose instructions for high verbosity", () => {
    const result = buildPersonalityInstructions({ verbosity: 5 });
    expect(result).toContain("detailed");
    expect(result).toContain("comprehensive");
  });

  it("includes terse instructions for low verbosity", () => {
    const result = buildPersonalityInstructions({ verbosity: 1 });
    expect(result).toContain("Short, direct");
  });

  it("includes warmth instructions", () => {
    const warm = buildPersonalityInstructions({ warmth: 5 });
    expect(warm).toContain("casual");
    expect(warm).toContain("emoji");

    const cold = buildPersonalityInstructions({ warmth: 1 });
    expect(cold).toContain("professional");
    expect(cold).toContain("No small talk");
  });

  it("includes initiative instructions", () => {
    const high = buildPersonalityInstructions({ initiative: 5 });
    expect(high).toContain("proactive");

    const low = buildPersonalityInstructions({ initiative: 1 });
    expect(low).toContain("stay quiet");
  });

  it("includes reactivity instructions", () => {
    const high = buildPersonalityInstructions({ reactivity: 5 });
    expect(high).toContain("collaborate");

    const low = buildPersonalityInstructions({ reactivity: 1 });
    expect(low).toContain("independent");
  });

  it("includes repetition tolerance instructions", () => {
    const high = buildPersonalityInstructions({ repetition_tolerance: 5 });
    expect(high).toContain("Re-engage");

    const low = buildPersonalityInstructions({ repetition_tolerance: 1 });
    expect(low).toContain("one contribution");
  });

  it("always includes the universal re-engagement rule", () => {
    const result = buildPersonalityInstructions({});
    expect(result).toContain("CRITICAL: Never repeat");
    expect(result).toContain("@mentioned");
    expect(result).toContain("genuinely NEW");
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
});
