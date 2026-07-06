import { z } from "zod";
import { ExerciseAttributeValueEnum } from "@prisma/client";

export const getExercisesSchema = z.object({
  equipment: z.array(z.nativeEnum(ExerciseAttributeValueEnum)).min(1, "Au moins un équipement est requis"),
  muscles: z.array(z.nativeEnum(ExerciseAttributeValueEnum)).min(1, "Au moins un muscle est requis"),
  limit: z.number().int().min(1).max(10).default(3),
  goal: z.enum(["strength", "hypertrophy", "endurance", "general"]).optional(),
  musclesWithVolume: z.array(z.object({
    muscle: z.nativeEnum(ExerciseAttributeValueEnum),
    targetSets: z.number().int().min(1),
  })).optional(),
});

export type GetExercisesInput = z.infer<typeof getExercisesSchema>;
