import { describe, expect, it } from "vitest";

import { recommendNextDay, type SessionRecord } from "../day-recommender";
import { generateSplit } from "../split-generator";

const DAY = 86_400_000;
const NOW = new Date("2026-07-06T12:00:00Z");

function session(daysAgo: number, splitDay: number | null): SessionRecord {
  return { startedAt: new Date(NOW.getTime() - daysAgo * DAY), splitDay };
}

describe("recommendNextDay", () => {
  it("recommends Day 1 when no recent sessions", () => {
    const split = generateSplit(3);
    const result = recommendNextDay(split, [], NOW);
    expect(result.recommendedDay).toBe(1);
    expect(result.lastTrainedDay).toBeNull();
  });

  it("recommends Day 2 after training Day 1", () => {
    const split = generateSplit(3);
    const sessions = [session(2, 1)];
    const result = recommendNextDay(split, sessions, NOW);
    expect(result.recommendedDay).toBe(2);
    expect(result.lastTrainedDay).toBe(1);
  });

  it("wraps to Day 1 after the last day of the split", () => {
    const split = generateSplit(3);
    const sessions = [session(1, 3)]; // trained Day 3 (last day of PPL)
    const result = recommendNextDay(split, sessions, NOW);
    expect(result.recommendedDay).toBe(1);
    expect(result.lastTrainedDay).toBe(3);
  });

  it("ignores free-mode sessions (splitDay = null)", () => {
    const split = generateSplit(3);
    const sessions = [session(1, null), session(3, 1)];
    const result = recommendNextDay(split, sessions, NOW);
    // The Day 1 session (3 days ago) is the last split session, so recommend Day 2
    expect(result.recommendedDay).toBe(2);
  });

  it("ignores sessions older than 7 days", () => {
    const split = generateSplit(3);
    const sessions = [session(10, 2)]; // 10 days ago
    const result = recommendNextDay(split, sessions, NOW);
    expect(result.recommendedDay).toBe(1);
    expect(result.lastTrainedDay).toBeNull();
  });

  it("uses the most recent split session for sequencing", () => {
    const split = generateSplit(4);
    const sessions = [session(5, 1), session(3, 2), session(1, 3)];
    const result = recommendNextDay(split, sessions, NOW);
    // Most recent was Day 3, split has 4 days, so recommend Day 4
    expect(result.recommendedDay).toBe(4);
  });

  it("reports rest days since last session", () => {
    const split = generateSplit(3);
    const sessions = [session(2, 1)];
    const result = recommendNextDay(split, sessions, NOW);
    expect(result.restDays).toBe(2);
  });
});
