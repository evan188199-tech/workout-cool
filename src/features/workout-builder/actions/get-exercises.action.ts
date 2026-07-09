"use server";

import { ExerciseAttributeNameEnum } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { actionClient } from "@/shared/api/safe-actions";
import { selectExercises } from "@/features/training-science/model/exercise-selection";
import { serverAuth } from "@/entities/user/model/get-server-session-user";
import {
  normalizeWorkoutPreferences,
  resolveAllowedEquipment,
} from "@/shared/lib/user-preferences";
import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";

import { getExercisesSchema } from "../schema/get-exercises.schema";

export const getExercisesAction = actionClient.schema(getExercisesSchema).action(async ({ parsedInput }) => {
  const { equipment, muscles, limit } = parsedInput;

  try {
    const sessionUser = await serverAuth();
    const [primaryMuscleAttributeName, secondaryMuscleAttributeName, equipmentAttributeName] = await Promise.all([
      prisma.exerciseAttributeName.findUnique({
        where: { name: ExerciseAttributeNameEnum.PRIMARY_MUSCLE },
      }),
      prisma.exerciseAttributeName.findUnique({
        where: { name: ExerciseAttributeNameEnum.SECONDARY_MUSCLE },
      }),
      prisma.exerciseAttributeName.findUnique({
        where: { name: ExerciseAttributeNameEnum.EQUIPMENT },
      }),
    ]);

    if (!primaryMuscleAttributeName || !secondaryMuscleAttributeName || !equipmentAttributeName) {
      throw new Error("Missing attributes in database");
    }

    let allowedEquipment = equipment;
    if (sessionUser?.id) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { onboardingPreferences: true },
      });
      const preferences = normalizeWorkoutPreferences(user?.onboardingPreferences ?? null);
      allowedEquipment = resolveAllowedEquipment(equipment, preferences);
    }

    const exercisesByMuscle = await Promise.all(
      muscles.map(async (muscle) => {
        const MINIMUM_THRESHOLD = 20;
        const TARGET_POOL_SIZE = Math.max(limit * 4, 30);
        const equipmentFilter = allowedEquipment.length > 0
          ? [
              {
                attributes: {
                  some: {
                    attributeNameId: equipmentAttributeName.id,
                    attributeValue: { value: { in: allowedEquipment } },
                  },
                },
              },
            ]
          : [];

        // Step 1: Get exercises where muscle is PRIMARY
        const primaryExercises = await prisma.exercise.findMany({
          where: {
            AND: [
              {
                attributes: {
                  some: {
                    attributeNameId: primaryMuscleAttributeName.id,
                    attributeValue: { value: muscle },
                  },
                },
              },
              ...equipmentFilter,
              {
                NOT: {
                  attributes: {
                    some: { attributeValue: { value: "STRETCHING" } },
                  },
                },
              },
            ],
          },
          include: {
            attributes: { include: { attributeName: true, attributeValue: true } },
          },
          take: TARGET_POOL_SIZE,
        });

        let allExercises = [...primaryExercises];

        // Step 2: If not enough primary, supplement with SECONDARY muscle exercises
        if (allExercises.length < MINIMUM_THRESHOLD) {
          const secondaryExercises = await prisma.exercise.findMany({
            where: {
              AND: [
                {
                  attributes: {
                    some: {
                      attributeNameId: secondaryMuscleAttributeName.id,
                      attributeValue: { value: muscle },
                    },
                  },
                },
                ...equipmentFilter,
                { id: { notIn: primaryExercises.map((ex) => ex.id) } },
                {
                  NOT: {
                    attributes: {
                      some: { attributeValue: { value: "STRETCHING" } },
                    },
                  },
                },
              ],
            },
            include: {
              attributes: { include: { attributeName: true, attributeValue: true } },
            },
            take: TARGET_POOL_SIZE - primaryExercises.length,
          });

          allExercises = [...allExercises, ...secondaryExercises];
        }

       // Step 3: Structured selection (compound-first) replaces the old pure-random shuffle.
        const finalExercises = selectExercises(allExercises as ExerciseWithAttributes[], limit);

        return { muscle, exercises: finalExercises };
      }),
    );

    const filteredResults = exercisesByMuscle.filter((group) => group.exercises.length > 0);
    return filteredResults;
  } catch (error) {
    console.error("Error fetching exercises:", error);
    throw new Error("Error fetching exercises");
  }
});
