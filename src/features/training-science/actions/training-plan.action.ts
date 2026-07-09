"use server";

import { headers } from "next/headers";

import { prisma } from "@/shared/lib/prisma";
import { auth } from "@/features/auth/lib/better-auth";
import type { ExerciseAttributeValueEnum } from "@prisma/client";
import type { RiskZone } from "@/features/workout-analytics/model/types";

import type { UserIntent } from "../model/user-intent";
import { migrateLegacyGoal, intentToTrainingGoal } from "../model/user-intent";
import { generateSplit } from "../model/split-generator";
import { recommendNextDay, type SessionRecord } from "../model/day-recommender";
import { assessDataConfidence } from "../model/data-confidence";
import { calculateACWR } from "@/features/workout-analytics/model/calculate-acwr";
import { loadUserSetEntries } from "@/features/workout-analytics/actions/load-set-entries";
import { normalizeWorkoutPreferences } from "@/shared/lib/user-preferences";

export interface TrainingPlanData {
  id: string;
  intent: UserIntent;
  daysPerWeek: 2 | 3 | 4 | 5;
  splitType: string;
  currentDay: number;
  completedSessions: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save (or replace) the user's standalone training plan.
 * Since userId is unique, upsert handles create-or-replace atomically.
 *
 * Pass { preserveProgress: true } when editing an existing plan (e.g. switching
 * from PPL to Upper/Lower). This keeps completedSessions and currentDay intact
 * so the user's streak isn't wiped. Without it, a fresh start resets both.
 */
export async function saveTrainingPlan(
  intent: UserIntent,
  daysPerWeek: 2 | 3 | 4 | 5,
  options?: { preserveProgress?: boolean },
): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { success: false };

  const split = generateSplit(daysPerWeek);
  const preserve = options?.preserveProgress ?? false;

  await prisma.userTrainingPlan.upsert({
    where: { userId },
    create: {
      userId,
      intent,
      daysPerWeek,
      splitType: split.type,
    },
    update: {
      intent,
      daysPerWeek,
      splitType: split.type,
      // Only reset progress when explicitly replacing (not editing).
      // Editing preserves the user's streak and current position.
      ...(preserve
        ? {}
        : { currentDay: 1, completedSessions: 0 }),
      isActive: true,
    },
  });

  return { success: true };
}

/** Load the user's active training plan. Returns null if none or not logged in. */
export async function getTrainingPlan(): Promise<TrainingPlanData | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const plan = await prisma.userTrainingPlan.findUnique({
    where: { userId },
  });

  if (!plan || !plan.isActive) return null;

  const intent = migrateLegacyGoal(plan.intent) as UserIntent;
  const daysPerWeek = plan.daysPerWeek as 2 | 3 | 4 | 5;
  if (![2, 3, 4, 5].includes(daysPerWeek)) return null;

  return {
    id: plan.id,
    intent,
    daysPerWeek,
    splitType: plan.splitType,
    currentDay: plan.currentDay,
    completedSessions: plan.completedSessions,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/** Delete the user's training plan entirely. */
export async function deleteTrainingPlan(): Promise<{ success: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { success: false };

  await prisma.userTrainingPlan.deleteMany({
    where: { userId },
  });

  return { success: true };
}

export interface DayRecommendationResult {
  recommendedDay: number;
  reason: string;
  reasonI18nKey?: PlanSessionReasonI18nKey;
  reasonI18nValues?: {
    day?: number;
    lastDay?: number;
    nextDay?: number;
    restDays?: number;
  };
  lastTrainedDay: number | null;
  restDays: number;
  recommendedDurationMin: number;
  recommendedDurationRange: {
    min: number;
    max: number;
  };
  muscles: ExerciseAttributeValueEnum[];
  splitType: string;
  intent: UserIntent;
  goal: ReturnType<typeof intentToTrainingGoal>;
  plan: TrainingPlanData | null;
  usesBodyweightMode: boolean;
  fatigue: {
    zone: RiskZone;
    ratio: number | null;
    message: string;
    note: string;
    recoveryHint: string | null;
  };
  prescription: {
    quickTimeBudget: number;
    planSessionMinutes: number;
    restIntervalSeconds: number;
    warmupRoutineEnabled: boolean;
    warmupExerciseCount: number;
    warmupReps: number;
    cooldownRoutineEnabled: boolean;
    cooldownExerciseCount: number;
    cooldownHoldSeconds: number;
  };
}

type PlanSessionReasonI18nKey =
  | "workout_builder.plan_session.reason_no_recent_training"
  | "workout_builder.plan_session.reason_cycle_reset"
  | "workout_builder.plan_session.reason_continue";

/** Get today's recommended training day based on the saved plan + recent sessions. */
export async function getRecommendedDay(): Promise<DayRecommendationResult | null> {
  const authSession = await auth.api.getSession({ headers: await headers() });
  const userId = authSession?.user?.id;
  if (!userId) return null;

  const plan = await getTrainingPlan();
  if (!plan) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingPreferences: true },
  });
  const preferences = normalizeWorkoutPreferences(user?.onboardingPreferences);

  const split = generateSplit(plan.daysPerWeek);
  const goal = intentToTrainingGoal(plan.intent);

  const recentSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      startedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
    },
    select: { startedAt: true, splitDay: true, id: true },
    orderBy: { startedAt: "asc" },
  });

  const records: SessionRecord[] = recentSessions.map((s) => ({
    startedAt: s.startedAt,
    splitDay: s.splitDay,
  }));

  const recommendation = recommendNextDay(split, records);
  const dayData = split.days.find((d) => d.dayNumber === recommendation.recommendedDay);
  const asOf = new Date();
  const sets = await loadUserSetEntries(userId, 60);
  const confidence = assessDataConfidence(sets, asOf);

  const fatigueHint = confidence.confident ? calculateACWR({ sets, asOf }) : null;
  const baseDurationByWeek: Record<number, number> = {
    2: 30,
    3: 30,
    4: 35,
    5: 40,
  };
  const baseDuration = Math.round(
    (baseDurationByWeek[plan.daysPerWeek] + preferences.prescription.planSessionMinutes) / 2,
  );
  const fatigueFactor = fatigueHint?.zone === "red"
    ? 0.8
    : fatigueHint?.zone === "yellow"
      ? 0.9
      : 1;
  const recommendedDurationMin = Math.max(20, Math.round(baseDuration * fatigueFactor));
  const recommendedDurationRange = {
    min: Math.max(20, recommendedDurationMin - 5),
    max: Math.min(50, recommendedDurationMin + 5),
  };
  const reasonI18nKey =
    recommendation.lastTrainedDay === null
      ? "workout_builder.plan_session.reason_no_recent_training"
      : recommendation.recommendedDay === 1 && recommendation.lastTrainedDay === split.days.length
        ? "workout_builder.plan_session.reason_cycle_reset"
        : "workout_builder.plan_session.reason_continue";
  const reasonI18nValues =
    recommendation.lastTrainedDay === null
      ? {}
      : {
          day: recommendation.recommendedDay,
          lastDay: recommendation.lastTrainedDay,
          nextDay: recommendation.recommendedDay,
          restDays: recommendation.restDays,
        };
  const fatigue = {
    zone: fatigueHint?.zone ?? "insufficient-data",
    ratio: fatigueHint?.ratio ?? null,
    message: fatigueHint?.message ?? "数据不足:至少需要约14天力量训练记录。",
    note: fatigueHint?.note ?? "",
    recoveryHint: fatigueHint?.zone === "red"
      ? "建议先恢复 1-2 天并降低当日训练量，再重新接入计划。"
      : null,
  };

  return {
    ...recommendation,
    recommendedDurationMin,
    recommendedDurationRange,
    reasonI18nKey,
    reasonI18nValues,
    muscles: dayData?.muscles ?? [],
    splitType: split.type,
    intent: plan.intent,
    goal,
    plan,
    usesBodyweightMode: preferences.equipmentMode === "bodyweight_only",
    fatigue,
    prescription: preferences.prescription,
  };
}

/** Increment completed sessions counter when a workout finishes. */
export async function incrementCompletedSessions(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return;

  await prisma.userTrainingPlan.update({
    where: { userId },
    data: {
      completedSessions: { increment: 1 },
    },
  }).catch(() => {});
}
