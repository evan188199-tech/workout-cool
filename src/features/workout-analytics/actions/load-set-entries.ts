"use server";

import { ExerciseAttributeNameEnum } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { convertWeight } from "@/shared/lib/weight-conversion";

import { SetEntry } from "../model/types";

// Shared query: flatten the user's completed sets into the SetEntry[] the pure
// model functions expect. Used by all three analytics actions to avoid duplication.
export async function loadUserSetEntries(
  userId: string,
  sinceDays = 120,
  exerciseId?: string,
): Promise<SetEntry[]> {
  const primaryMuscleAttr = await prisma.exerciseAttributeName.findUnique({
    where: { name: ExerciseAttributeNameEnum.PRIMARY_MUSCLE },
  });
  if (!primaryMuscleAttr) throw new Error("PRIMARY_MUSCLE attribute not seeded");

  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const rows = await prisma.workoutSessionExercise.findMany({
    where: {
      // exerciseId undefined => Prisma treats it as "no filter" (all exercises)
      exerciseId,
      workoutSession: { userId, startedAt: { gte: since } },
      sets: { some: { completed: true } },
    },
    include: {
      workoutSession: { select: { startedAt: true } },
      exercise: {
        select: {
          attributes: {
            where: { attributeNameId: primaryMuscleAttr.id },
            select: { attributeValue: { select: { value: true } } },
          },
        },
      },
      sets: { where: { completed: true } },
    },
    orderBy: { workoutSession: { startedAt: "asc" } },
  });

  const entries: SetEntry[] = [];
  for (const r of rows) {
    const muscle = r.exercise.attributes[0]?.attributeValue.value as SetEntry["muscle"] | undefined;
    if (!muscle) continue; // skip exercises without a primary muscle tag

    for (const set of r.sets) {
      const weightIdx = set.types.indexOf("WEIGHT");
      const repsIdx = set.types.indexOf("REPS");
      const timeIdx = set.types.indexOf("TIME");

      const weightRaw = weightIdx !== -1 ? set.valuesInt[weightIdx] ?? 0 : 0;
      const unit = set.units?.[weightIdx] === "lbs" ? "lbs" : "kg";
      const weightKg = weightRaw ? convertWeight(weightRaw, unit, "kg") : 0;

      entries.push({
        date: r.workoutSession.startedAt,
        muscle,
        exerciseId: r.exerciseId,
        setIndex: set.setIndex,
        weightKg,
        reps: repsIdx !== -1 ? set.valuesInt[repsIdx] ?? 0 : 0,
        durationSec: timeIdx !== -1 ? set.valuesSec[timeIdx] ?? 0 : 0,
      });
    }
  }

  return entries;
}
