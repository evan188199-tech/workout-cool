import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum } from "@prisma/client";

import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";
import { getExerciseAttributesValueOf } from "@/entities/exercise/shared/muscles";

/** Determine whether an exercise is compound or isolation from its MECHANICS_TYPE attribute. */
export function getMechanics(exercise: ExerciseWithAttributes): "compound" | "isolation" | "unknown" {
  const values = getExerciseAttributesValueOf(exercise, ExerciseAttributeNameEnum.MECHANICS_TYPE);
  if (values.includes(ExerciseAttributeValueEnum.COMPOUND)) return "compound";
  if (values.includes(ExerciseAttributeValueEnum.ISOLATION)) return "isolation";
  return "unknown";
}

/** Fisher-Yates shuffle (pure, does not mutate input). */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Roughly 70% compound, 30% isolation. */
const COMPOUND_RATIO = 0.7;

/**
 * Select `count` exercises from `candidates`, preferring compound movements and
 * returning them in compound-first order. Falls back gracefully when one pool
 * is too small.
 *
 * Exercises lacking a MECHANICS_TYPE tag are treated as compound (the safe,
 * higher-utility default) so incomplete data does not penalise them.
 */
export function selectExercises(candidates: ExerciseWithAttributes[], count: number): ExerciseWithAttributes[] {
  if (count <= 0 || candidates.length === 0) return [];

  const compound: ExerciseWithAttributes[] = [];
  const isolation: ExerciseWithAttributes[] = [];

  for (const ex of candidates) {
    const m = getMechanics(ex);
    if (m === "isolation") isolation.push(ex);
    else compound.push(ex);
  }

  const targetCompound = Math.min(Math.ceil(count * COMPOUND_RATIO), compound.length);
  const shuffledCompound = shuffle(compound);
  const shuffledIsolation = shuffle(isolation);

  const picked = shuffledCompound.slice(0, targetCompound);

  const remaining = count - picked.length;
  if (remaining > 0) {
    picked.push(...shuffledIsolation.slice(0, remaining));
    const stillNeed = count - picked.length;
    if (stillNeed > 0) {
      picked.push(...shuffledCompound.slice(targetCompound, targetCompound + stillNeed));
    }
  }

  return picked;
}
