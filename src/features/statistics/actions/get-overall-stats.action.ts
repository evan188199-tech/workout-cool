"use server";

import { z } from "zod";

import { prisma } from "@/shared/lib/prisma";
import { actionClient } from "@/shared/api/safe-actions";

const getOverallStatsSchema = z.object({
  userId: z.string(),
});

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day2 = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day2}`;
}

export const getOverallStatsAction = actionClient.schema(getOverallStatsSchema).action(async ({ parsedInput }) => {
  try {
    const { userId } = parsedInput;

    const sessions = await prisma.workoutSession.findMany({
      where: { userId },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    let totalWorkoutTime = 0;

    const exerciseVolumeMap = new Map<string, { name: string; volume: number; sets: number }>();

    for (const session of sessions) {
      if (session.endedAt && session.startedAt) {
        totalWorkoutTime += Math.round(
          (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
        );
      }

      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          if (!set.completed) continue;
          totalSets++;

          const types = set.types as string[];
          const valuesInt = set.valuesInt ?? [];
          const repsIndex = types.indexOf("REPS");
          const weightIndex = types.indexOf("WEIGHT") !== -1 ? types.indexOf("WEIGHT") : types.indexOf("BODYWEIGHT");

          const reps = repsIndex !== -1 ? valuesInt[repsIndex] || 0 : 0;
          totalReps += reps;

          if (reps > 0 && weightIndex !== -1) {
            const weight = valuesInt[weightIndex] || 0;
            const volume = reps * weight;
            totalVolume += volume;

            const existing = exerciseVolumeMap.get(ex.exerciseId);
            if (!existing) {
              exerciseVolumeMap.set(ex.exerciseId, { name: "", volume, sets: 1 });
            } else {
              existing.volume += volume;
              existing.sets++;
            }
          } else if (reps > 0) {
            const existing = exerciseVolumeMap.get(ex.exerciseId);
            if (!existing) {
              exerciseVolumeMap.set(ex.exerciseId, { name: "", volume: reps, sets: 1 });
            } else {
              existing.volume += reps;
              existing.sets++;
            }
          }
        }
      }
    }

    // Fetch exercise names for the volume map
    const exerciseIds = [...exerciseVolumeMap.keys()];
    if (exerciseIds.length > 0) {
      const exercises = await prisma.exercise.findMany({
        where: { id: { in: exerciseIds } },
        select: { id: true, name: true, nameEn: true },
      });
      for (const ex of exercises) {
        const entry = exerciseVolumeMap.get(ex.id);
        if (entry) entry.name = ex.nameEn || ex.name;
      }
    }

    // Calculate weekly volume across all exercises for the trend chart
    const weeklyVolume = new Map<string, { weekStart: string; totalVolume: number; setCount: number; workoutCount: Set<string> }>();

    for (const session of sessions) {
      const sessionDate = new Date(session.startedAt);
      const weekStart = getWeekStart(sessionDate);
      const weekKey = weekStart;

      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const types = set.types as string[];
          const valuesInt = set.valuesInt ?? [];
          const repsIndex = types.indexOf("REPS");
          const weightIndex = types.indexOf("WEIGHT") !== -1 ? types.indexOf("WEIGHT") : types.indexOf("BODYWEIGHT");
          const reps = repsIndex !== -1 ? valuesInt[repsIndex] || 0 : 0;

          let volume = 0;
          if (reps > 0 && weightIndex !== -1) {
            volume = reps * (valuesInt[weightIndex] || 0);
          } else if (reps > 0) {
            volume = reps;
          }

          if (volume > 0) {
            const entry = weeklyVolume.get(weekKey) || { weekStart: weekKey, totalVolume: 0, setCount: 0, workoutCount: new Set<string>() };
            entry.totalVolume += volume;
            entry.setCount++;
            entry.workoutCount.add(session.id);
            weeklyVolume.set(weekKey, entry);
          }
        }
      }
    }

    const volumeTrend = [...weeklyVolume.values()]
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w) => ({ week: w.weekStart, weekStart: w.weekStart, totalVolume: Math.round(w.totalVolume), setCount: w.setCount }));

    const topExercises = [...exerciseVolumeMap.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return {
      totalWorkouts: sessions.length,
      totalVolume: Math.round(totalVolume),
      totalSets,
      totalReps,
      totalWorkoutTime,
      topExercises,
      volumeTrend,
      lastWorkoutDate: sessions[0]?.endedAt?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Error fetching overall stats:", error);
    return { serverError: "Failed to fetch overall stats" };
  }
});
