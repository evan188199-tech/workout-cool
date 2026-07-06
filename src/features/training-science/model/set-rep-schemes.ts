import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum, WorkoutSetType, WorkoutSetUnit } from "@prisma/client";

import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";
import { getExerciseAttributesValueOf } from "@/entities/exercise/shared/muscles";

import type { ExerciseProfile, MechanicsType, ExerciseModality, TrainingGoal } from "./types";

import type { CreateSuggestedSetData } from "@/features/programs/lib/suggested-sets-helpers";

/**
 * Derive the ExerciseProfile (mechanics + modality) from raw exercise attributes.
 * Exercises missing a MECHANICS_TYPE default to compound (safe default).
 */
export function deriveExerciseProfile(exercise: ExerciseWithAttributes): ExerciseProfile {
  const mechanicsValues = getExerciseAttributesValueOf(exercise, ExerciseAttributeNameEnum.MECHANICS_TYPE);
  const typeValues = getExerciseAttributesValueOf(exercise, ExerciseAttributeNameEnum.TYPE);
  const equipmentValues = getExerciseAttributesValueOf(exercise, ExerciseAttributeNameEnum.EQUIPMENT);

  let mechanics: MechanicsType = "unknown";
  if (mechanicsValues.includes(ExerciseAttributeValueEnum.COMPOUND)) mechanics = "compound";
  else if (mechanicsValues.includes(ExerciseAttributeValueEnum.ISOLATION)) mechanics = "isolation";

  const isTimed =
    typeValues.includes(ExerciseAttributeValueEnum.STRETCHING) ||
    typeValues.includes(ExerciseAttributeValueEnum.CARDIO);
  const isBodyweight =
    equipmentValues.includes(ExerciseAttributeValueEnum.BODY_ONLY) ||
    typeValues.includes(ExerciseAttributeValueEnum.BODYWEIGHT) ||
    typeValues.includes(ExerciseAttributeValueEnum.CALISTHENIC);

  const modality: ExerciseModality = isTimed ? "timed" : isBodyweight ? "bodyweight" : "weighted";

  return { mechanics, modality };
}

interface RepScheme {
  sets: number;
  reps: number;
}

/**
 * Goal x mechanics lookup table for set/rep targets.
 * Returns a representative value for the rep range; the user fine-tunes.
 */
function getRepScheme(goal: TrainingGoal, mechanics: MechanicsType): RepScheme {
  if (goal === "strength") {
    return mechanics === "isolation" ? { sets: 3, reps: 8 } : { sets: 4, reps: 6 };
  }
  if (goal === "hypertrophy") {
    return mechanics === "isolation" ? { sets: 3, reps: 12 } : { sets: 4, reps: 10 };
  }
  if (goal === "endurance") {
    return { sets: 3, reps: 18 };
  }
  // general
  return mechanics === "isolation" ? { sets: 3, reps: 12 } : { sets: 3, reps: 10 };
}

const TIMED_SECONDS = 40;
const DEFAULT_KG = 0;

/** Build CreateSuggestedSetData[] for a single exercise given its profile and the training goal. */
export function generateSetRepScheme(profile: ExerciseProfile, goal: TrainingGoal): CreateSuggestedSetData[] {
  if (profile.modality === "timed") {
    return Array.from({ length: 3 }, (_, i) => ({
      setIndex: i,
      types: [WorkoutSetType.TIME],
      valuesSec: [TIMED_SECONDS],
    }));
  }

  const { sets, reps } = getRepScheme(goal, profile.mechanics);

  if (profile.modality === "bodyweight") {
    return Array.from({ length: sets }, (_, i) => ({
      setIndex: i,
      types: [WorkoutSetType.BODYWEIGHT, WorkoutSetType.REPS],
      valuesInt: [0, reps],
    }));
  }

  // weighted
  return Array.from({ length: sets }, (_, i) => ({
    setIndex: i,
    types: [WorkoutSetType.WEIGHT, WorkoutSetType.REPS],
    valuesInt: [DEFAULT_KG, reps],
    units: [WorkoutSetUnit.kg],
  }));
}

/** Convenience wrapper: exercise + goal -> suggested sets, auto-deriving the profile. */
export function suggestSetsForExercise(exercise: ExerciseWithAttributes, goal: TrainingGoal): CreateSuggestedSetData[] {
  return generateSetRepScheme(deriveExerciseProfile(exercise), goal);
}
