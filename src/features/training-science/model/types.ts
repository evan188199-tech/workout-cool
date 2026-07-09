import type { ExerciseAttributeValueEnum } from "@prisma/client";

/**
 * User's primary training objective. Drives set/rep schemes, weekly volume
 * targets, and exercise selection weighting.
 */
export type TrainingGoal = "strength" | "hypertrophy" | "endurance" | "general";

/** Number of training days per week the user commits to. */
export type DaysPerWeek = 2 | 3 | 4 | 5;

/** Muscle size classification — determines weekly volume tier. */
export type MuscleSize = "large" | "medium" | "small";

/** How resistance is applied in an exercise. */
export type ExerciseModality = "weighted" | "bodyweight" | "timed";

/** Compound vs isolation movement pattern. */
export type MechanicsType = "compound" | "isolation" | "unknown";

/** Structured summary of an exercise's relevant attributes for scheme selection. */
export interface ExerciseProfile {
  mechanics: MechanicsType;
  modality: ExerciseModality;
}

/** A single training day within a split. */
export interface SplitDay {
  dayNumber: number;
  /** i18n key, e.g. "training_science.split.push" */
  labelKey: string;
  muscles: ExerciseAttributeValueEnum[];
}

/** A complete weekly training split. */
export interface TrainingSplit {
  daysPerWeek: DaysPerWeek;
  type: "fullbody" | "ppl" | "upperlower" | "ppl-ul";
  days: SplitDay[];
}

/** Per-muscle weekly volume target derived from goal × muscle size. */
export interface MuscleVolumeTarget {
  muscle: ExerciseAttributeValueEnum;
  size: MuscleSize;
  weeklySets: number;
}

/** How many sets and exercises a single muscle should get on a given day. */
export interface DayVolumeAllocation {
  muscle: ExerciseAttributeValueEnum;
  setsThisDay: number;
  exerciseCount: number;
}
