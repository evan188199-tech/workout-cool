import { ExerciseAttributeValueEnum } from "@prisma/client";

import { MuscleVolumeInput, WeeklyMuscleVolume } from "./types";
import { toLocalInstant, localWeekStart, addDays } from "./date-utils";

// Note: muscle volume counts COMPLETED SETS, not tonnage. A bodyweight set and a
// weighted set both count as "1 hard set" — this is the Schoenfeld unit and is
// dimensionally consistent across exercise types (unlike ACWR tonnage).

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: "胸",
  BACK: "背",
  LATS: "背阔",
  SHOULDERS: "肩",
  BICEPS: "二头",
  TRICEPS: "三头",
  QUADRICEPS: "股四头",
  HAMSTRINGS: "腘绳肌",
  GLUTES: "臀",
  CALVES: "小腿",
  ABDOMINALS: "腹",
  FOREARMS: "前臂",
  TRAPS: "斜方肌",
};

// Schoenfeld-derived heuristic: 10-20 hard sets per muscle per week.
const OPTIMAL_MIN = 10;
const OPTIMAL_MAX = 20;
const OVERREACH = 25;

export function getWeeklyMuscleVolume(input: MuscleVolumeInput): WeeklyMuscleVolume[] {
  const { sets, asOf = new Date(), tzOffsetMinutes = 0 } = input;

  // FIX #2: compute week boundaries in the user's local timezone.
  const localAsOf = toLocalInstant(asOf, tzOffsetMinutes);
  const thisWeekStart = localWeekStart(localAsOf);
  const fourWeeksAgo = addDays(thisWeekStart, -28);

  const localSets = sets.map((s) => ({ ...s, date: toLocalInstant(s.date, tzOffsetMinutes) }));

  const byMuscle = new Map<string, { thisWeek: number; last4w: number; weeks: Set<string> }>();

  for (const s of localSets) {
    const key = String(s.muscle);
    if (!byMuscle.has(key)) byMuscle.set(key, { thisWeek: 0, last4w: 0, weeks: new Set() });
    const m = byMuscle.get(key)!;

    const t = s.date.getTime();
    if (t >= thisWeekStart.getTime()) m.thisWeek += 1;

    if (t >= fourWeeksAgo.getTime()) {
      m.last4w += 1;
      m.weeks.add(String(localWeekStart(s.date).getTime()));
    }
  }

  const results: WeeklyMuscleVolume[] = [];
  for (const [muscleKey, m] of byMuscle) {
    const weeksActive = m.weeks.size || 1;
    const fourWeekAvgSets = m.last4w / weeksActive;

    let status: WeeklyMuscleVolume["status"];
    if (m.thisWeek < OPTIMAL_MIN) status = "undertrained";
    else if (m.thisWeek <= OPTIMAL_MAX) status = "optimal";
    else if (m.thisWeek <= OVERREACH) status = "high";
    else status = "overreach";

    results.push({
      muscle: muscleKey as ExerciseAttributeValueEnum,
      muscleLabel: MUSCLE_LABELS[muscleKey] ?? muscleKey,
      weeklySets: m.thisWeek,
      fourWeekAvgSets: Math.round(fourWeekAvgSets * 10) / 10,
      status,
    });
  }

  // Highest weekly volume first.
  return results.sort((a, b) => b.weeklySets - a.weeklySets);
}
