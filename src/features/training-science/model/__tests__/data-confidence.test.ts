import { describe, expect, it } from "vitest";

import { assessDataConfidence } from "../data-confidence";
import type { SetEntry } from "@/features/workout-analytics/model/types";

const DAY = 86_400_000;

function makeEntry(daysAgo: number): SetEntry {
  return {
    date: new Date(Date.now() - daysAgo * DAY),
    muscle: "CHEST" as any,
    exerciseId: "ex1",
    setIndex: 0,
    weightKg: 60,
    reps: 10,
    durationSec: 0,
  };
}

describe("assessDataConfidence", () => {
  it("returns confident=false when fewer than 6 training days", () => {
    // 5 distinct days
    const sets = [0, 3, 7, 14, 21].map((d) => makeEntry(d));
    const result = assessDataConfidence(sets);
    expect(result.confident).toBe(false);
    expect(result.sessionDays).toBe(5);
    expect(result.threshold).toBe(6);
  });

  it("returns confident=true at exactly 6 training days (boundary)", () => {
    const sets = [0, 4, 8, 12, 16, 20].map((d) => makeEntry(d));
    const result = assessDataConfidence(sets);
    expect(result.confident).toBe(true);
    expect(result.sessionDays).toBe(6);
  });

  it("counts same-day sessions as a single training day", () => {
    // Multiple sets on same days, but only 3 distinct days
    const sets = [
      makeEntry(0), makeEntry(0), makeEntry(0),
      makeEntry(5), makeEntry(5),
      makeEntry(10),
    ];
    const result = assessDataConfidence(sets);
    expect(result.sessionDays).toBe(3);
    expect(result.confident).toBe(false);
  });

  it("ignores sessions older than 28 days", () => {
    const sets = [
      makeEntry(0), makeEntry(1), makeEntry(2),
      makeEntry(3), makeEntry(4), makeEntry(5),
      makeEntry(40), // outside window
    ];
    const result = assessDataConfidence(sets);
    expect(result.sessionDays).toBe(6);
    expect(result.confident).toBe(true);
  });

  it("returns confident=false for empty history", () => {
    const result = assessDataConfidence([]);
    expect(result.confident).toBe(false);
    expect(result.sessionDays).toBe(0);
  });

  it("handles sparse data scenario (1 session 4 weeks ago + 2 this week)", () => {
    // This is the exact scenario the gate protects against:
    // ACWR would spike to red, but the data is too sparse to trust.
    const sets = [
      makeEntry(27), // 4 weeks ago
      makeEntry(2),  // this week
      makeEntry(0),  // this week
    ];
    const result = assessDataConfidence(sets);
    expect(result.confident).toBe(false);
    expect(result.sessionDays).toBe(3);
  });
});
