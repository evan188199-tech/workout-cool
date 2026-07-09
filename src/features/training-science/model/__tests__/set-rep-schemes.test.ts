import { describe, expect, it } from "vitest";

import { generateSetRepScheme } from "../set-rep-schemes";
import type { ExerciseProfile, TrainingGoal } from "../types";

describe("generateSetRepScheme", () => {
  it("returns 3 timed sets for timed modality regardless of goal", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "timed" };
    const result = generateSetRepScheme(profile, "hypertrophy");

    expect(result).toHaveLength(3);
    expect(result.every((s) => s.types.includes("TIME"))).toBe(true);
    expect(result[0].valuesSec).toBeDefined();
    expect(result[0].valuesSec![0]).toBeGreaterThan(0);
  });

  it("returns 4x6 for strength + compound (weighted)", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    const result = generateSetRepScheme(profile, "strength");

    expect(result).toHaveLength(4);
    expect(result[0].types).toContain("WEIGHT");
    expect(result[0].types).toContain("REPS");
    expect(result[0].valuesInt![1]).toBe(6);
  });

  it("returns 3x8 for strength + isolation (weighted)", () => {
    const profile: ExerciseProfile = { mechanics: "isolation", modality: "weighted" };
    const result = generateSetRepScheme(profile, "strength");

    expect(result).toHaveLength(3);
    expect(result[0].valuesInt![1]).toBe(8);
  });

  it("returns 4x10 for hypertrophy + compound", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    const result = generateSetRepScheme(profile, "hypertrophy");

    expect(result).toHaveLength(4);
    expect(result[0].valuesInt![1]).toBe(10);
  });

  it("returns 3x12 for hypertrophy + isolation", () => {
    const profile: ExerciseProfile = { mechanics: "isolation", modality: "weighted" };
    const result = generateSetRepScheme(profile, "hypertrophy");

    expect(result).toHaveLength(3);
    expect(result[0].valuesInt![1]).toBe(12);
  });

  it("returns 3x18 for endurance", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    const result = generateSetRepScheme(profile, "endurance");

    expect(result).toHaveLength(3);
    expect(result[0].valuesInt![1]).toBe(18);
  });

  it("uses BODYWEIGHT type for bodyweight modality", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "bodyweight" };
    const result = generateSetRepScheme(profile, "general");

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].types).toContain("BODYWEIGHT");
    expect(result[0].valuesInt![0]).toBe(0);
  });

  it("produces sequential setIndex starting at 0", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    const result = generateSetRepScheme(profile, "hypertrophy");

    expect(result.map((s) => s.setIndex)).toEqual([0, 1, 2, 3]);
  });

  it("weighted sets include kg unit", () => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    const result = generateSetRepScheme(profile, "strength");

    expect(result[0].units).toBeDefined();
    expect(result[0].units![0]).toBe("kg");
  });
});

describe("generateSetRepScheme - goal coverage", () => {
  const goals: TrainingGoal[] = ["strength", "hypertrophy", "endurance", "general"];
  const mechanics = ["compound", "isolation", "unknown"] as const;

  it("produces valid schemes for every goal x mechanics combo", () => {
    for (const goal of goals) {
      for (const mech of mechanics) {
        const profile: ExerciseProfile = { mechanics: mech, modality: "weighted" };
        const result = generateSetRepScheme(profile, goal);
        expect(result.length).toBeGreaterThanOrEqual(3);
        expect(result.every((s) => s.setIndex >= 0)).toBe(true);
      }
    }
  });
});
