"use server";

import { z } from "zod";
import { headers } from "next/headers";

import type { RiskZone } from "@/features/workout-analytics/model/types";

import { prisma } from "@/shared/lib/prisma";
import { localWeekStart, toLocalInstant, MS_PER_DAY } from "@/features/workout-analytics/model/date-utils";
import { calculateACWR } from "@/features/workout-analytics/model/calculate-acwr";
import { loadUserSetEntries } from "@/features/workout-analytics/actions/load-set-entries";
import {
  recommendWeeklyAdjustment,
  noDataResult,
  type WeeklyAdjustmentResult,
} from "@/features/training-science/model/weekly-adjustment";
import { assessDataConfidence } from "@/features/training-science/model/data-confidence";
import { getTrainingPlan } from "@/features/training-science/actions/training-plan.action";
import { auth } from "@/features/auth/lib/better-auth";

const schema = z.object({
  tzOffsetMinutes: z.number().int().default(0),
});

export async function getWeeklyAdjustment(
  tzOffsetMinutes = 0,
): Promise<WeeklyAdjustmentResult | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const plan = await getTrainingPlan();
  if (!plan) return null;

  const now = new Date();
  const localNow = toLocalInstant(now, tzOffsetMinutes);
  const weekStart = localWeekStart(localNow);
  const weekStartUTC = new Date(weekStart.getTime() - tzOffsetMinutes * 60_000);

  // --- Count this week's sessions ---
  const weekSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      startedAt: { gte: weekStartUTC },
    },
    select: { startedAt: true, splitDay: true, endedAt: true },
  });

  // A session "counts" as completed if it has an endedAt (was finished).
  const completed = weekSessions.filter((s) => s.endedAt !== null);
  const plannedSessionsThisWeek = completed.filter((s) => s.splitDay !== null).length;
  const extraSessionsThisWeek = completed.filter((s) => s.splitDay === null).length;

  // --- Load training history for ACWR + confidence ---
  const sets = await loadUserSetEntries(userId, 60);
  const confidence = assessDataConfidence(sets, now, tzOffsetMinutes);

  // --- Estimate weeks at current frequency (from plan.updatedAt) ---
  // This is a rough proxy: if the user hasn't changed daysPerWeek, updatedAt
  // reflects the last time any field was saved. Good enough for "have they
  // been stable for >= 2 weeks".
  const weeksAtCurrentFrequency = Math.max(
    1,
    Math.floor((now.getTime() - plan.updatedAt.getTime()) / (7 * MS_PER_DAY)),
  );

  // --- Count consecutive miss-weeks ---
  // Look back up to 4 weeks; count how many in a row had fewer planned sessions
  // than daysPerWeek, ending at the current week.
  const consecutiveMissWeeks = await countConsecutiveMissWeeks(userId, plan.daysPerWeek, weekStartUTC, tzOffsetMinutes);

  // --- Compute ACWR ---
  let acwrZone: RiskZone = "insufficient-data";
  let acwrRatio: number | null = null;
  if (confidence.confident) {
    const acwr = calculateACWR({ sets, asOf: now, tzOffsetMinutes });
    acwrZone = acwr.zone;
    acwrRatio = acwr.ratio;
  }

  if (!confidence.confident) {
    return noDataResult(plan.daysPerWeek);
  }

  const result = recommendWeeklyAdjustment({
    currentDaysPerWeek: plan.daysPerWeek,
    acwrZone,
    acwrRatio,
    plannedSessionsThisWeek,
    extraSessionsThisWeek,
    dataConfident: confidence.confident,
    weeksAtCurrentFrequency,
    consecutiveMissWeeks,
  });

  return result;
}

/**
 * Count how many consecutive weeks (ending at the current week) the user missed
 * at least one planned training day. Stops at the first non-miss week.
 */
async function countConsecutiveMissWeeks(
  userId: string,
  daysPerWeek: number,
  currentWeekStartUTC: Date,
  _tzOffsetMinutes: number,
): Promise<number> {
  let missWeeks = 0;

  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(currentWeekStartUTC.getTime() - w * 7 * MS_PER_DAY);
    const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

    const sessions = await prisma.workoutSession.count({
      where: {
        userId,
        splitDay: { not: null },
        endedAt: { not: null },
        startedAt: { gte: weekStart, lt: weekEnd },
      },
    });

    if (sessions < daysPerWeek) {
      missWeeks++;
    } else {
      break;
    }
  }

  return missWeeks;
}
