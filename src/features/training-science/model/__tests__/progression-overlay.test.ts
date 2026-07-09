import { describe, expect, it } from "vitest";

import { applyProgressionOverlay, type OverlayExerciseInput } from "../progression-overlay";
import type { SetEntry } from "@/features/workout-analytics/model/types";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

function makeSet(
  exerciseId: string,
  daysAgo: number,
  weightKg: number,
  reps = 10,
  muscle = "CHEST" as any,
): SetEntry {
  return {
    date: new Date(Date.now() - daysAgo * DAY),
    muscle,
    exerciseId,
    setIndex: 0,
    weightKg,
    reps,
    durationSec: 0,
  };
}

function denseHistory(): SetEntry[] {
  // 8 distinct days over 28 days with consistent volume (no spike)
  const sets: SetEntry[] = [];
  for (let week = 0; week < 4; week++) {
    sets.push(makeSet("bench", week * 7, 80, 10));
    sets.push(makeSet("squat", week * 7, 100, 5));
  }
  return sets;
}

describe("applyProgressionOverlay - progressive overload (Track 1, ungated)", () => {
  it("suggests +2.5kg when plateau detected, regardless of global confidence", () => {
    // Plateau: same weight for 4+ sessions, < MIN_SESSIONS threshold met
    const history: SetEntry[] = [];
    for (let i = 0; i < 5; i++) {
      history.push(makeSet("bench", i * 7, 80, 10));
    }

    const exercises: OverlayExerciseInput[] = [
      { exerciseId: "bench", suggestedSets: 4, suggestedWeightKg: 0 },
    ];

    const result = applyProgressionOverlay(exercises, history);

    expect(result.exercises[0].adjustedWeightKg).toBe(82.5); // 80 + 2.5
    expect(result.exercises[0].notes.length).toBeGreaterThan(0);
    expect(result.exercises[0].notes[0]).toContain("Plateau");
  });

  it("does NOT increase weight when trend is increasing", () => {
    const history: SetEntry[] = [];
    for (let i = 0; i < 5; i++) {
      history.push(makeSet("bench", (4 - i) * 7, 80 + i * 5, 10)); // 80, 85, 90, 95, 100
    }

    const exercises: OverlayExerciseInput[] = [
      { exerciseId: "bench", suggestedSets: 4, suggestedWeightKg: 0 },
    ];

    const result = applyProgressionOverlay(exercises, history);
    // Trend is increasing, no plateau suggestion
    expect(result.exercises[0].notes.filter((n) => n.includes("Plateau"))).toHaveLength(0);
  });
});

describe("applyProgressionOverlay - ACWR deload (Track 2, gated)", () => {
  it("does NOT trigger deload with sparse data even if ACWR would be red", () => {
    // The exact scenario we designed against: 1 session 4 weeks ago + 2 this week
    const sparseHistory: SetEntry[] = [
      makeSet("bench", 27, 80, 10),
      makeSet("bench", 2, 80, 10),
      makeSet("bench", 0, 80, 10),
    ];

    const exercises: OverlayExerciseInput[] = [
      { exerciseId: "bench", suggestedSets: 4, suggestedWeightKg: 0 },
    ];

    const result = applyProgressionOverlay(exercises, sparseHistory);

    expect(result.deloadTriggered).toBe(false);
    expect(result.exercises[0].adjustedSets).toBe(4); // unchanged
  });

  it("does not trigger deload for normal training volume", () => {
    const history = denseHistory();

    const exercises: OverlayExerciseInput[] = [
      { exerciseId: "bench", suggestedSets: 4, suggestedWeightKg: 0 },
    ];

    const result = applyProgressionOverlay(exercises, history);
    expect(result.deloadTriggered).toBe(false);
  });
});

describe("applyProgressionOverlay - fail-safe", () => {
  it("returns plan unchanged when no history", () => {
    const exercises: OverlayExerciseInput[] = [
      { exerciseId: "bench", suggestedSets: 4, suggestedWeightKg: 60 },
    ];

    const result = applyProgressionOverlay(exercises, []);

    expect(result.exercises[0].adjustedWeightKg).toBe(60);
    expect(result.exercises[0].adjustedSets).toBe(4);
    expect(result.deloadTriggered).toBe(false);
  });
});
