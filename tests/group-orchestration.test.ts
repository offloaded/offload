import { describe, it, expect } from "vitest";
import {
  classifyIntent,
  scoreAgentRelevance,
  detectMessageAddressing,
  detectFollowUpTriggers,
} from "@/lib/group-orchestration";

describe("classifyIntent", () => {
  it("classifies greetings as casual", () => {
    expect(classifyIntent("hi")).toBe("casual");
    expect(classifyIntent("Hello everyone")).toBe("casual");
    expect(classifyIntent("good morning")).toBe("casual");
    expect(classifyIntent("hey")).toBe("casual");
    expect(classifyIntent("thanks")).toBe("casual");
    expect(classifyIntent("sounds good")).toBe("casual");
  });

  it("classifies acknowledgements as casual", () => {
    expect(classifyIntent("ok")).toBe("casual");
    expect(classifyIntent("got it")).toBe("casual");
    expect(classifyIntent("no worries")).toBe("casual");
    expect(classifyIntent("cool")).toBe("casual");
  });

  it("classifies search queries as search", () => {
    expect(classifyIntent("What's the latest news on AI?")).toBe("search");
    expect(classifyIntent("look up the current stock prices")).toBe("search");
    expect(classifyIntent("today's headlines")).toBe("search");
  });

  it("classifies scheduling as action", () => {
    expect(classifyIntent("schedule a meeting for tomorrow")).toBe("action");
    expect(classifyIntent("remind me at 3pm")).toBe("action");
    expect(classifyIntent("send a daily report every morning")).toBe("action");
    expect(classifyIntent("set up a weekly sync")).toBe("action");
  });

  it("classifies knowledge questions as knowledge", () => {
    expect(classifyIntent("What is our leave policy?")).toBe("knowledge");
    expect(classifyIntent("Explain the difference between REST and GraphQL")).toBe("knowledge");
    expect(classifyIntent("How does the authentication system work?")).toBe("knowledge");
  });

  it("does not classify long messages as casual even with casual start", () => {
    const longMessage = "hey " + "word ".repeat(15);
    expect(classifyIntent(longMessage)).not.toBe("casual");
  });
});

describe("scoreAgentRelevance", () => {
  it("scores higher when message contains agent purpose words", () => {
    const agent = { name: "HR Advisor", purpose: "Advise on HR policy and employment law" };
    const score = scoreAgentRelevance("What does our HR policy say about leave?", agent);
    expect(score).toBeGreaterThan(0);
  });

  it("gives high score when agent name is mentioned", () => {
    const agent = { name: "Finance", purpose: "Budget analysis" };
    const score = scoreAgentRelevance("Finance, can you look at this?", agent);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it("returns 0 for completely unrelated message", () => {
    const agent = { name: "Chef", purpose: "Cooking recipes and meal planning" };
    const score = scoreAgentRelevance("Fix the bug", agent);
    expect(score).toBe(0);
  });

  it("ignores short words (<=3 chars)", () => {
    const agent = { name: "Bot", purpose: "Do the job for the team" };
    // "the", "for", "do", "job" — most are <=3 chars
    const score = scoreAgentRelevance("The the the the", agent);
    expect(score).toBe(0);
  });
});

describe("detectMessageAddressing", () => {
  const agents = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  it("detects team-wide addressing", () => {
    expect(detectMessageAddressing("Hey team, what's the status?", agents).isTeamWide).toBe(true);
    expect(detectMessageAddressing("Everyone, please check in", agents).isTeamWide).toBe(true);
    expect(detectMessageAddressing("Any updates?", agents).isTeamWide).toBe(true);
    expect(detectMessageAddressing("thoughts?", agents).isTeamWide).toBe(true);
  });

  it("detects standup patterns as team-wide", () => {
    expect(detectMessageAddressing("Let's do a standup", agents).isTeamWide).toBe(true);
    expect(detectMessageAddressing("Weekly sync time", agents).isTeamWide).toBe(true);
  });

  it("detects @mentions", () => {
    const result = detectMessageAddressing("@Alice what do you think?", agents);
    expect(result.mentionedAgentIds).toContain("1");
    expect(result.mentionedAgentIds).not.toContain("2");
  });

  it("detects name followed by comma as mention", () => {
    const result = detectMessageAddressing("Bob, can you review this?", agents);
    expect(result.mentionedAgentIds).toContain("2");
  });

  it("detects name followed by question mark", () => {
    const result = detectMessageAddressing("What about Charlie?", agents);
    expect(result.mentionedAgentIds).toContain("3");
  });

  it("detects multiple mentions", () => {
    const result = detectMessageAddressing("@Alice and @Bob, thoughts?", agents);
    expect(result.mentionedAgentIds).toContain("1");
    expect(result.mentionedAgentIds).toContain("2");
    expect(result.isTeamWide).toBe(true); // "thoughts?"
  });

  it("returns empty mentions for unaddressed message", () => {
    const result = detectMessageAddressing("I think the design looks good", agents);
    expect(result.mentionedAgentIds).toHaveLength(0);
    expect(result.isTeamWide).toBe(false);
  });

  it("detects 'what are your' as team-wide", () => {
    const result = detectMessageAddressing("What are your top concerns?", agents);
    expect(result.isTeamWide).toBe(true);
  });
});

describe("detectFollowUpTriggers", () => {
  const agents = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  it("returns null when no question marks in response", () => {
    const result = detectFollowUpTriggers(
      "[Alice] The policy looks solid.",
      agents,
      new Set(),
      new Set(["1"])
    );
    expect(result).toBeNull();
  });

  it("detects specific agent named in question", () => {
    const result = detectFollowUpTriggers(
      "[Alice] What do you think, Bob?",
      agents,
      new Set(),
      new Set(["1"])
    );
    expect(result).not.toBeNull();
    expect(result!.targetAgentIds).toContain("2");
  });

  it("excludes hard-excluded agents from targets", () => {
    const result = detectFollowUpTriggers(
      "[Alice] What do you think, Bob?",
      agents,
      new Set(["2"]), // Bob is hard-excluded
      new Set(["1"])
    );
    // Bob should not appear as a target since he's hard-excluded
    expect(result?.targetAgentIds || []).not.toContain("2");
  });

  it("detects ambiguous questions and targets non-responders", () => {
    const result = detectFollowUpTriggers(
      "[Alice] Any thoughts from the rest of you?",
      agents,
      new Set(),
      new Set(["1"]) // Alice already responded
    );
    expect(result).not.toBeNull();
    // Should target agents who haven't responded (Bob, Charlie) not Alice
    expect(result!.targetAgentIds).not.toContain("1");
  });

  it("returns null when no blocks found", () => {
    const result = detectFollowUpTriggers(
      "Just plain text without agent blocks",
      agents,
      new Set(),
      new Set()
    );
    expect(result).toBeNull();
  });

  it("handles @mention in follow-up", () => {
    const result = detectFollowUpTriggers(
      "[Bob] @Charlie, have you seen this issue?",
      agents,
      new Set(),
      new Set(["2"])
    );
    expect(result).not.toBeNull();
    expect(result!.targetAgentIds).toContain("3");
    expect(result!.askerAgentIds).toContain("2");
  });
});
