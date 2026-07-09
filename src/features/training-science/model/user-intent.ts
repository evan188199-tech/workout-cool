import type { TrainingGoal } from "./types";

/**
 * User-facing training intent. This is the language users understand ("I want
 * to lose fat"), as opposed to TrainingGoal which is the internal engine term
 * ("general"). One intent maps to exactly one goal, but multiple intents can
 * share a goal (e.g. lose_fat and general_fitness both map to general).
 */
export type UserIntent =
  | "build_strength"
  | "build_muscle"
  | "lose_fat"
  | "improve_endurance"
  | "general_fitness";

/** Map a user-facing intent to the internal TrainingGoal that drives the engine. */
export function intentToTrainingGoal(intent: UserIntent): TrainingGoal {
  switch (intent) {
    case "build_strength":
      return "strength";
    case "build_muscle":
      return "hypertrophy";
    case "improve_endurance":
      return "endurance";
    case "lose_fat":
    case "general_fitness":
      return "general";
  }
}

/**
 * Backward-compatibility: older versions stored a raw TrainingGoal string
 * ("strength" | "hypertrophy" | "endurance" | "general") directly in the Zustand
 * store and User.onboardingPreferences. This maps those legacy values to the new
 * UserIntent so persisted state never crashes.
 */
export function migrateLegacyGoal(value: unknown): UserIntent {
  if (typeof value !== "string") return "general_fitness";

  const intents: UserIntent[] = [
    "build_strength",
    "build_muscle",
    "lose_fat",
    "improve_endurance",
    "general_fitness",
  ];
  if (intents.includes(value as UserIntent)) return value as UserIntent;

  switch (value) {
    case "strength":
      return "build_strength";
    case "hypertrophy":
      return "build_muscle";
    case "endurance":
      return "improve_endurance";
    case "general":
      return "general_fitness";
    default:
      return "general_fitness";
  }
}

/** Whether a given intent should produce a session finisher (e.g. cardio). */
export function intentHasFinisher(intent: UserIntent): boolean {
  return intent === "lose_fat";
}
