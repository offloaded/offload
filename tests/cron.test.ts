import { describe, it, expect } from "vitest";
import { parseCron, cronMatches, getNextRun, describeCron } from "@/lib/cron";

describe("parseCron", () => {
  it("parses a simple expression", () => {
    const fields = parseCron("0 9 * * 1-5");
    expect(fields.minute).toEqual([0]);
    expect(fields.hour).toEqual([9]);
    expect(fields.dayOfMonth).toHaveLength(31);
    expect(fields.month).toHaveLength(12);
    expect(fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses wildcards", () => {
    const fields = parseCron("* * * * *");
    expect(fields.minute).toHaveLength(60);
    expect(fields.hour).toHaveLength(24);
  });

  it("parses steps", () => {
    const fields = parseCron("*/15 * * * *");
    expect(fields.minute).toEqual([0, 15, 30, 45]);
  });

  it("parses lists", () => {
    const fields = parseCron("0 9,17 * * *");
    expect(fields.hour).toEqual([9, 17]);
  });

  it("rejects invalid expression", () => {
    expect(() => parseCron("0 9 *")).toThrow("expected 5 fields");
  });
});

describe("cronMatches", () => {
  it("matches 9am on a Monday", () => {
    // 2024-01-08 is a Monday
    const date = new Date(2024, 0, 8, 9, 0, 0);
    expect(cronMatches("0 9 * * 1", date)).toBe(true);
  });

  it("does not match wrong time", () => {
    const date = new Date(2024, 0, 8, 10, 0, 0);
    expect(cronMatches("0 9 * * 1", date)).toBe(false);
  });

  it("does not match wrong day", () => {
    // 2024-01-07 is a Sunday
    const date = new Date(2024, 0, 7, 9, 0, 0);
    expect(cronMatches("0 9 * * 1-5", date)).toBe(false);
  });
});

describe("getNextRun", () => {
  it("finds next occurrence", () => {
    const after = new Date(2024, 0, 8, 9, 0, 0); // Monday 9:00
    const next = getNextRun("0 9 * * 1-5", after);
    // Should be Tuesday 9:00
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDay()).toBe(2); // Tuesday
  });

  it("skips weekends for weekday cron", () => {
    const friday = new Date(2024, 0, 5, 17, 0, 0); // Friday 5pm
    const next = getNextRun("0 9 * * 1-5", friday);
    expect(next.getDay()).toBe(1); // Monday
  });

  it("handles every-15-minutes", () => {
    const now = new Date(2024, 0, 1, 10, 3, 0);
    const next = getNextRun("*/15 * * * *", now);
    expect(next.getMinutes()).toBe(15);
  });
});

describe("describeCron", () => {
  it("describes weekday morning", () => {
    const desc = describeCron("0 9 * * 1-5");
    expect(desc).toContain("9:00 AM");
    expect(desc).toContain("weekdays");
  });

  it("describes every-N-minutes", () => {
    const desc = describeCron("*/15 * * * *");
    expect(desc).toContain("15 minutes");
  });

  it("returns raw expression for invalid input", () => {
    expect(describeCron("bad")).toBe("bad");
  });
});
