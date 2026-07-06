import { ExerciseAttributeValueEnum } from "@prisma/client";

import type { DaysPerWeek, SplitDay, TrainingGoal, TrainingSplit, DayVolumeAllocation } from "./types";
import { getWeeklySetsForMuscle } from "./weekly-volume";

/**
 * Generate a scientifically structured training split for the given number of
 * days per week. Each split ensures every major muscle group is trained at
 * least 2x/week (except the 2-day full-body split, which is high-frequency
 * by nature).
 *
 * Splits (per the agreed plan):
 *   2 days -> Full Body A/B
 *   3 days -> Push/Pull/Legs (PPL)
 *   4 days -> Upper/Lower A/B
 *   5 days -> PPL + Upper/Lower
 */
export function generateSplit(daysPerWeek: DaysPerWeek): TrainingSplit {
  switch (daysPerWeek) {
    case 2:
      return FULL_BODY_SPLIT;
    case 3:
      return PPL_SPLIT;
    case 4:
      return UPPER_LOWER_SPLIT;
    case 5:
      return PPL_UL_SPLIT;
    default:
      return PPL_SPLIT;
  }
}

const FULL_BODY_SPLIT: TrainingSplit = {
  daysPerWeek: 2,
  type: "fullbody",
  days: [
    {
      dayNumber: 1,
      labelKey: "training_science.split.fullbody_a",
      muscles: [
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.TRICEPS,
        ExerciseAttributeValueEnum.ABDOMINALS,
      ],
    },
    {
      dayNumber: 2,
      labelKey: "training_science.split.fullbody_b",
      muscles: [
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.LATS,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.CALVES,
      ],
    },
  ],
};

const PPL_SPLIT: TrainingSplit = {
  daysPerWeek: 3,
  type: "ppl",
  days: [
    {
      dayNumber: 1,
      labelKey: "training_science.split.push",
      muscles: [
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.TRICEPS,
      ],
    },
    {
      dayNumber: 2,
      labelKey: "training_science.split.pull",
      muscles: [
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.LATS,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.TRAPS,
        ExerciseAttributeValueEnum.FOREARMS,
      ],
    },
    {
      dayNumber: 3,
      labelKey: "training_science.split.legs",
      muscles: [
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.CALVES,
        ExerciseAttributeValueEnum.ABDOMINALS,
      ],
    },
  ],
};

const UPPER_LOWER_SPLIT: TrainingSplit = {
  daysPerWeek: 4,
  type: "upperlower",
  days: [
    {
      dayNumber: 1,
      labelKey: "training_science.split.upper_a",
      muscles: [
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.TRICEPS,
      ],
    },
    {
      dayNumber: 2,
      labelKey: "training_science.split.lower_a",
      muscles: [
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.CALVES,
        ExerciseAttributeValueEnum.ABDOMINALS,
      ],
    },
    {
      dayNumber: 3,
      labelKey: "training_science.split.upper_b",
      muscles: [
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.LATS,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.TRICEPS,
      ],
    },
    {
      dayNumber: 4,
      labelKey: "training_science.split.lower_b",
      muscles: [
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.CALVES,
      ],
    },
  ],
};

const PPL_UL_SPLIT: TrainingSplit = {
  daysPerWeek: 5,
  type: "ppl-ul",
  days: [
    {
      dayNumber: 1,
      labelKey: "training_science.split.push",
      muscles: [
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.TRICEPS,
      ],
    },
    {
      dayNumber: 2,
      labelKey: "training_science.split.pull",
      muscles: [
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.LATS,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.TRAPS,
      ],
    },
    {
      dayNumber: 3,
      labelKey: "training_science.split.legs",
      muscles: [
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.CALVES,
      ],
    },
    {
      dayNumber: 4,
      labelKey: "training_science.split.upper",
      muscles: [
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.BICEPS,
        ExerciseAttributeValueEnum.TRICEPS,
      ],
    },
    {
      dayNumber: 5,
      labelKey: "training_science.split.lower_core",
      muscles: [
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.ABDOMINALS,
        ExerciseAttributeValueEnum.OBLIQUES,
      ],
    },
  ],
};

/** Count how many times each muscle appears across the entire split. */
export function muscleFrequencyInSplit(split: TrainingSplit): Map<ExerciseAttributeValueEnum, number> {
  const freq = new Map<ExerciseAttributeValueEnum, number>();
  for (const day of split.days) {
    for (const muscle of day.muscles) {
      freq.set(muscle, (freq.get(muscle) ?? 0) + 1);
    }
  }
  return freq;
}

/** Sets per exercise per goal (used to convert set targets into exercise counts). */
function setsPerExercise(goal: TrainingGoal): number {
  return goal === "strength" ? 5 : goal === "hypertrophy" ? 4 : 3;
}

/**
 * Distribute weekly volume targets across a single training day.
 * Returns per-muscle: how many sets today, and how many exercises that implies.
 *
 * setsThisDay = round(weeklyTarget / frequency)
 * exerciseCount = ceil(setsThisDay / setsPerExercise)
 */
export function distributeVolumeForDay(
  day: SplitDay,
  goal: TrainingGoal,
  frequencyMap: Map<ExerciseAttributeValueEnum, number>,
): DayVolumeAllocation[] {
  const spe = setsPerExercise(goal);

  return day.muscles.map((muscle) => {
    const weeklyTarget = getWeeklySetsForMuscle(muscle, goal);
    const freq = frequencyMap.get(muscle) ?? 1;
    const setsThisDay = Math.max(1, Math.round(weeklyTarget / freq));
    const exerciseCount = Math.max(1, Math.ceil(setsThisDay / spe));
    return { muscle, setsThisDay, exerciseCount };
  });
}

/** Convenience: get the full day-by-day volume plan for an entire split. */
export function distributeVolumeForSplit(split: TrainingSplit, goal: TrainingGoal): DayVolumeAllocation[][] {
  const freqMap = muscleFrequencyInSplit(split);
  return split.days.map((day) => distributeVolumeForDay(day, goal, freqMap));
}
