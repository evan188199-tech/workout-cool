import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum } from "@prisma/client";

import { ExerciseAttribute, ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";
import { getAttributeName, getAttributeValue } from "@/entities/exercise/shared/muscles";

/** Equipment values that make an exercise non-pure-bodyweight. */
export const NON_BODYWEIGHT_EQUIPMENT_VALUES = [
  ExerciseAttributeValueEnum.DUMBBELL,
  ExerciseAttributeValueEnum.KETTLEBELLS,
  ExerciseAttributeValueEnum.BARBELL,
  ExerciseAttributeValueEnum.SMITH_MACHINE,
  ExerciseAttributeValueEnum.BANDS,
  ExerciseAttributeValueEnum.EZ_BAR,
  ExerciseAttributeValueEnum.PULLUP_BAR,
  ExerciseAttributeValueEnum.CABLE,
  ExerciseAttributeValueEnum.MEDICINE_BALL,
  ExerciseAttributeValueEnum.SWISS_BALL,
  ExerciseAttributeValueEnum.TRX,
  ExerciseAttributeValueEnum.BENCH,
  ExerciseAttributeValueEnum.BAR,
  ExerciseAttributeValueEnum.RACK,
  ExerciseAttributeValueEnum.WEIGHT_PLATE,
  ExerciseAttributeValueEnum.MACHINE,
  ExerciseAttributeValueEnum.OTHER,
  ExerciseAttributeValueEnum.DESK,
  ExerciseAttributeValueEnum.BOX,
  ExerciseAttributeValueEnum.ROPES,
  ExerciseAttributeValueEnum.SPIN_BIKE,
  ExerciseAttributeValueEnum.STEP,
  ExerciseAttributeValueEnum.BOSU,
  ExerciseAttributeValueEnum.TYRE,
  ExerciseAttributeValueEnum.SANDBAG,
  ExerciseAttributeValueEnum.POLE,
  ExerciseAttributeValueEnum.WALL,
  ExerciseAttributeValueEnum.CAR,
  ExerciseAttributeValueEnum.SLED,
  ExerciseAttributeValueEnum.CHAIN,
  ExerciseAttributeValueEnum.SKIERG,
  ExerciseAttributeValueEnum.ROPE,
] as const;

/**
 * Returns true if the exercise is a bodyweight exercise.
 * Accepts legacy TYPE === BODYWEIGHT records only when they do not also carry
 * an equipment requirement. This prevents bar dips and similar records with
 * stale bodyweight tags from being treated as pure bodyweight.
 */
export function isBodyweightExercise(exercise: Pick<ExerciseWithAttributes, "attributes">): boolean {
  const equipmentValues = exercise.attributes
    .filter((attr) => getAttributeName(attr) === ExerciseAttributeNameEnum.EQUIPMENT)
    .map((attr) => getAttributeValue(attr));

  if (equipmentValues.some((value) => (NON_BODYWEIGHT_EQUIPMENT_VALUES as readonly string[]).includes(value))) {
    return false;
  }

  return exercise.attributes.some((attr: ExerciseAttribute) => {
    const name = getAttributeName(attr);
    const value = getAttributeValue(attr);
    return (
      (name === ExerciseAttributeNameEnum.TYPE && value === ExerciseAttributeValueEnum.BODYWEIGHT) ||
      (name === ExerciseAttributeNameEnum.EQUIPMENT && value === ExerciseAttributeValueEnum.BODY_ONLY)
    );
  });
}
