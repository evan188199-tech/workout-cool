"use server";

import { z } from "zod";
import { headers } from "next/headers";

import type { DaysPerWeek } from "@/features/training-science/model/types";

import { prisma } from "@/shared/lib/prisma";
import { generateSplit } from "@/features/training-science/model/split-generator";
import { auth } from "@/features/auth/lib/better-auth";

const schema = z.object({
  newDaysPerWeek: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

/**
 * Apply a weekly frequency adjustment WITHOUT resetting progress.
 *
 * Unlike `saveTrainingPlan` (which resets currentDay/completedSessions because
 * it is meant for a fresh plan choice), this only updates daysPerWeek + splitType
 * so the user keeps their streak and day sequencing.
 */
export async function applyWeeklyAdjustment(newDaysPerWeek: DaysPerWeek): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { success: false };

  const split = generateSplit(newDaysPerWeek);

  await prisma.userTrainingPlan.update({
    where: { userId },
    data: {
      daysPerWeek: newDaysPerWeek,
      splitType: split.type,
      // currentDay wraps to fit the new split length (e.g. 3->2 days, was on Day 3 -> Day 1)
      currentDay: 1,
      // completedSessions stays untouched — it's a lifetime counter.
    },
  });

  return { success: true };
}
