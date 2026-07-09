"use server";

import { z } from "zod";
import { ExerciseAttributeNameEnum, ExerciseAttributeValueEnum } from "@prisma/client";

import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";

import { prisma } from "@/shared/lib/prisma";
import { authenticatedActionClient } from "@/shared/api/safe-actions";
import {
  OFFICE_WHITELIST_SLUGS,
  recommendQuickSession,
} from "@/features/training-science/model/quick-session";
import { selectExercises } from "@/features/training-science/model/exercise-selection";
import { getRecommendedDay } from "@/features/training-science/actions/training-plan.action";

const getQuickSessionSchema = z.object({
  timeBudgetMin: z.union([z.literal(5), z.literal(10), z.literal(15)]),
});

export const getQuickSessionAction = authenticatedActionClient
  .schema(getQuickSessionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { timeBudgetMin } = parsedInput;
    const userId = ctx.user.id;

    // 1. Load today's planned muscles from the active training plan (empty if none).
    const recommendation = await getRecommendedDay();
    const plannedMusclesToday = recommendation?.muscles ?? [];

    // 2. Load muscles already trained by quick sessions today (splitDay = null, today).
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const recentSessions = await prisma.workoutSession.findMany({
      where: {
        userId,
        splitDay: null,
        startedAt: { gte: todayStart, lte: todayEnd },
      },
      select: { muscles: true },
    });
    const recentQuickMusclesToday = Array.from(
      new Set(recentSessions.flatMap((s) => s.muscles)),
    );

    // 3. Run the pure engine to get the recommended muscle allocation.
    const quickPlan = recommendQuickSession({
      timeBudgetMin,
      plannedMusclesToday,
      recentQuickMusclesToday: recentQuickMusclesToday as ExerciseAttributeValueEnum[],
    });

    // 4. Fetch office-friendly exercises for the allocated muscles.
    //    Query by slugEn IN the curated whitelist at the DB level — the BODY_ONLY
    //    equipment tag is too noisy (includes pull-ups, dips, levers, handstands,
    //    and other moves that need a bar / floor / wall). Doing it in the query
    //    (not a post-filter) guarantees no banned exercise can ever leak through.
    const primaryMuscleAttributeName = await prisma.exerciseAttributeName.findUnique({
      where: { name: ExerciseAttributeNameEnum.PRIMARY_MUSCLE },
    });
    const secondaryMuscleAttributeName = await prisma.exerciseAttributeName.findUnique({
      where: { name: ExerciseAttributeNameEnum.SECONDARY_MUSCLE },
    });

    if (!primaryMuscleAttributeName || !secondaryMuscleAttributeName) {
      throw new Error("Missing exercise attributes in database");
    }

    const exercisesByMuscle: { muscle: ExerciseAttributeValueEnum; exercises: ExerciseWithAttributes[] }[] = [];
    const selectedMuscles: ExerciseAttributeValueEnum[] = [];

    for (const allocation of quickPlan.muscles) {
      const { muscle, exerciseCount } = allocation;

      // Primary muscle exercises — whitelist slugs only.
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
            { slugEn: { in: OFFICE_WHITELIST_SLUGS } },
          ],
        },
        include: { attributes: { include: { attributeName: true, attributeValue: true } } },
      });
      const pool: ExerciseWithAttributes[] = [...(primaryExercises as ExerciseWithAttributes[])];

      // Fallback to secondary muscle if primary pool is too thin.
      if (pool.length < exerciseCount) {
        const existingIds = new Set(pool.map((ex) => ex.id));
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
              { slugEn: { in: OFFICE_WHITELIST_SLUGS } },
              { id: { notIn: Array.from(existingIds) } },
            ],
          },
          include: { attributes: { include: { attributeName: true, attributeValue: true } } },
        });
        pool.push(...(secondaryExercises as ExerciseWithAttributes[]));
      }

      if (pool.length === 0) {
        // Skip muscles that have no office-friendly exercises in this dataset.
        continue;
      }

      selectedMuscles.push(muscle);
      const finalExercises = selectExercises(pool, exerciseCount);
      exercisesByMuscle.push({ muscle, exercises: finalExercises });
    }

    return {
      exercisesByMuscle,
      selectedMuscles,
      selectedEquipment: [ExerciseAttributeValueEnum.BODY_ONLY],
      selectedSplitDay: null as number | null,
      reason: quickPlan.reason,
      setScheme: quickPlan.setScheme,
    };
  });
