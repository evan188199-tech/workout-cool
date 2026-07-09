import { describe, expect, it } from "vitest";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { getMuscleSize, getWeeklyVolumeTargets, getWeeklySetsForMuscle } from "../weekly-volume";

describe("getMuscleSize", () => {
  it("classifies large muscles", () => {
    expect(getMuscleSize(ExerciseAttributeValueEnum.QUADRICEPS)).toBe("large");
    expect(getMuscleSize(ExerciseAttributeValueEnum.CHEST)).toBe("large");
    expect(getMuscleSize(ExerciseAttributeValueEnum.BACK)).toBe("large");
    expect(getMuscleSize(ExerciseAttributeValueEnum.LATS)).toBe("large");
  });

  it("classifies medium muscles", () => {
    expect(getMuscleSize(ExerciseAttributeValueEnum.SHOULDERS)).toBe("medium");
    expect(getMuscleSize(ExerciseAttributeValueEnum.ABDOMINALS)).toBe("medium");
  });

  it("classifies small muscles", () => {
    expect(getMuscleSize(ExerciseAttributeValueEnum.BICEPS)).toBe("small");
    expect(getMuscleSize(ExerciseAttributeValueEnum.TRICEPS)).toBe("small");
    expect(getMuscleSize(ExerciseAttributeValueEnum.CALVES)).toBe("small");
  });
});

describe("getWeeklySetsForMuscle", () => {
  it("gives large muscles more volume than small for hypertrophy", () => {
    const large = getWeeklySetsForMuscle(ExerciseAttributeValueEnum.CHEST, "hypertrophy");
    const small = getWeeklySetsForMuscle(ExerciseAttributeValueEnum.BICEPS, "hypertrophy");
    expect(large).toBeGreaterThan(small);
  });

  it("gives strength less hypertrophy volume for small muscles", () => {
    const str = getWeeklySetsForMuscle(ExerciseAttributeValueEnum.BICEPS, "strength");
    const hyper = getWeeklySetsForMuscle(ExerciseAttributeValueEnum.BICEPS, "hypertrophy");
    expect(hyper).toBeGreaterThan(str);
  });
});

describe("getWeeklyVolumeTargets", () => {
  it("returns targets for each muscle", () => {
    const muscles = [
      ExerciseAttributeValueEnum.CHEST,
      ExerciseAttributeValueEnum.BICEPS,
      ExerciseAttributeValueEnum.SHOULDERS,
    ];
    const targets = getWeeklyVolumeTargets(muscles, "hypertrophy");

    expect(targets).toHaveLength(3);
    expect(targets[0].muscle).toBe(ExerciseAttributeValueEnum.CHEST);
    expect(targets[0].size).toBe("large");
    expect(targets[0].weeklySets).toBe(16);
  });

  it("all targets fall within the 6-20 Schoenfeld range", () => {
    const allMuscles = [
      ExerciseAttributeValueEnum.CHEST,
      ExerciseAttributeValueEnum.QUADRICEPS,
      ExerciseAttributeValueEnum.SHOULDERS,
      ExerciseAttributeValueEnum.BICEPS,
      ExerciseAttributeValueEnum.CALVES,
    ];
    const goals = ["strength", "hypertrophy", "endurance", "general"] as const;

    for (const goal of goals) {
      const targets = getWeeklyVolumeTargets(allMuscles, goal);
      for (const t of targets) {
        expect(t.weeklySets).toBeGreaterThanOrEqual(6);
        expect(t.weeklySets).toBeLessThanOrEqual(20);
      }
    }
  });
});
