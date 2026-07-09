import { ExerciseAttributeValueEnum } from "@prisma/client";

import type { MuscleSize, TrainingGoal, MuscleVolumeTarget } from "./types";

/** Muscles classified by size. Larger muscles can handle (and need) more volume. */
const LARGE_MUSCLES: ExerciseAttributeValueEnum[] = [
  ExerciseAttributeValueEnum.QUADRICEPS,
  ExerciseAttributeValueEnum.HAMSTRINGS,
  ExerciseAttributeValueEnum.GLUTES,
  ExerciseAttributeValueEnum.BACK,
  ExerciseAttributeValueEnum.LATS,
  ExerciseAttributeValueEnum.CHEST,
];

const MEDIUM_MUSCLES: ExerciseAttributeValueEnum[] = [
  ExerciseAttributeValueEnum.SHOULDERS,
  ExerciseAttributeValueEnum.TRAPS,
  ExerciseAttributeValueEnum.ABDOMINALS,
];

const SMALL_MUSCLES: ExerciseAttributeValueEnum[] = [
  ExerciseAttributeValueEnum.BICEPS,
  ExerciseAttributeValueEnum.TRICEPS,
  ExerciseAttributeValueEnum.CALVES,
  ExerciseAttributeValueEnum.FOREARMS,
  ExerciseAttributeValueEnum.OBLIQUES,
];

/** Classify a muscle as large / medium / small for volume tiering. */
export function getMuscleSize(muscle: ExerciseAttributeValueEnum): MuscleSize {
  if (LARGE_MUSCLES.includes(muscle)) return "large";
  if (MEDIUM_MUSCLES.includes(muscle)) return "medium";
  return "small";
}

/**
 * Weekly set targets per muscle size, per training goal.
 * Values are weekly sets (Schoenfeld-aligned: 10-20 hard sets for hypertrophy).
 */
const VOLUME_TABLE: Record<TrainingGoal, Record<MuscleSize, number>> = {
  strength: { large: 14, medium: 10, small: 8 },
  hypertrophy: { large: 16, medium: 12, small: 10 },
  endurance: { large: 12, medium: 9, small: 7 },
  general: { large: 12, medium: 9, small: 7 },
};

/** Compute weekly volume targets for a list of muscles given a training goal. */
export function getWeeklyVolumeTargets(
  muscles: ExerciseAttributeValueEnum[],
  goal: TrainingGoal,
): MuscleVolumeTarget[] {
  return muscles.map((muscle) => {
    const size = getMuscleSize(muscle);
    return { muscle, size, weeklySets: VOLUME_TABLE[goal][size] };
  });
}

/** Get the weekly set target for a single muscle + goal. */
export function getWeeklySetsForMuscle(muscle: ExerciseAttributeValueEnum, goal: TrainingGoal): number {
  const size = getMuscleSize(muscle);
  return VOLUME_TABLE[goal][size];
}
