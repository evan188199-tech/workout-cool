import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum } from "@prisma/client";

import { ExerciseAttribute, ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";
import { getAttributeName, getAttributeValue } from "@/entities/exercise/shared/muscles";

/**
 * Returns true if the exercise is a bodyweight exercise.
 * Checks both TYPE === BODYWEIGHT and EQUIPMENT === BODY_ONLY.
 */
export function isBodyweightExercise(exercise: Pick<ExerciseWithAttributes, "attributes">): boolean {
  return exercise.attributes.some((attr: ExerciseAttribute) => {
    const name = getAttributeName(attr);
    const value = getAttributeValue(attr);
    return (
      (name === ExerciseAttributeNameEnum.TYPE && value === ExerciseAttributeValueEnum.BODYWEIGHT) ||
      (name === ExerciseAttributeNameEnum.EQUIPMENT && value === ExerciseAttributeValueEnum.BODY_ONLY)
    );
  });
}
