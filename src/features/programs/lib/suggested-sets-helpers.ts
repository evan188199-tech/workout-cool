import { WorkoutSetType, WorkoutSetUnit } from "@prisma/client";

import { generateSetRepScheme } from "@/features/training-science/model/set-rep-schemes";
import type { ExerciseProfile, TrainingGoal } from "@/features/training-science/model/types";

export interface CreateSuggestedSetData {
  setIndex: number;
  types: WorkoutSetType[];
  valuesInt?: number[];
  valuesSec?: number[];
  units?: WorkoutSetUnit[];
}

// Helpers to create suggested sets.
// These now delegate to the goal-aware set-rep-schemes module so that admin-created
// programs get the same science-based schemes as the Workout Builder. The public
// API (three template functions) is preserved for backward compatibility.
export const SUGGESTED_SET_TEMPLATES = {
  // Strength compound default (4x6) -- matches the old "3x10-12 @ 20kg" call site
  // but is now driven by set-rep-schemes rather than hardcoded values.
  strengthTraining: (weight: number = 0): CreateSuggestedSetData[] => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "weighted" };
    return generateSetRepScheme(profile, "strength").map((s) => ({
      ...s,
      valuesInt: s.valuesInt ? [weight || s.valuesInt[0] || 0, s.valuesInt[1] ?? 6] : s.valuesInt,
    }));
  },

  // Bodyweight: 3 sets of bodyweight reps
  bodyweight: (reps: number = 10): CreateSuggestedSetData[] => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "bodyweight" };
    const scheme = generateSetRepScheme(profile, "general");
    return scheme.map((s) => ({
      ...s,
      valuesInt: s.valuesInt ? [0, reps] : s.valuesInt,
    }));
  },

  // Timed: 3 sets of timed holds
  timed: (seconds: number = 30): CreateSuggestedSetData[] => {
    const profile: ExerciseProfile = { mechanics: "compound", modality: "timed" };
    const scheme = generateSetRepScheme(profile, "general");
    return scheme.map((s) => ({
      ...s,
      valuesSec: [seconds],
    }));
  },
};

/**
 * Build suggested sets for any exercise given its profile and training goal.
 * Use this for fully goal-aware set generation (admin programs, Builder).
 */
export function createGoalAwareSets(profile: ExerciseProfile, goal: TrainingGoal): CreateSuggestedSetData[] {
  return generateSetRepScheme(profile, goal);
}
