import type { TrainingSplit } from "./types";

/**
 * A completed session with the metadata the recommender needs.
 * Kept minimal so the pure function is easy to test.
 */
export interface SessionRecord {
  startedAt: Date;
  splitDay: number | null; // 1-based, null = free mode
}

export interface DayRecommendation {
  recommendedDay: number;
  reason: string;
  lastTrainedDay: number | null;
  restDays: number;
}

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 7;

/**
 * Recommend which training day the user should do today.
 *
 * Strategy: find the most recent split-day session within the lookback window,
 * then recommend the next day in the split (cycling back to day 1 after the
 * last). Free-mode sessions (splitDay = null) and sessions outside the window
 * don't affect the sequence.
 *
 * - No recent split sessions -> Day 1 (fresh start).
 * - Last session was Day N -> Day N+1 (wraps to 1 after the last day).
 */
export function recommendNextDay(
  split: TrainingSplit,
  recentSessions: SessionRecord[],
  asOf: Date = new Date(),
): DayRecommendation {
  const windowStart = new Date(asOf.getTime() - LOOKBACK_DAYS * MS_PER_DAY);

  // Only sessions with a splitDay within the window matter for sequencing.
  const relevant = recentSessions
    .filter(
      (s) =>
        s.splitDay !== null &&
        s.startedAt.getTime() >= windowStart.getTime() &&
        s.startedAt.getTime() <= asOf.getTime(),
    )
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

 if (relevant.length === 0) {
    return {
      recommendedDay: 1,
      reason: "No recent training. Start fresh with Day 1.",
      lastTrainedDay: null,
      restDays: 0,
    };
  }

  const lastSession = relevant[relevant.length - 1];
  const lastDay = lastSession.splitDay!;
  const restDays = Math.floor((asOf.getTime() - lastSession.startedAt.getTime()) / MS_PER_DAY);

  const totalDays = split.days.length;
  const nextDay = lastDay >= totalDays ? 1 : lastDay + 1;

  const reason =
    nextDay === 1 && lastDay === totalDays
      ? `Completed a full cycle (last: Day ${totalDays}). Start the next round with Day 1.`
      : `Last session was Day ${lastDay} (${restDays}d ago). Continue with Day ${nextDay}.`;

  return {
    recommendedDay: nextDay,
    reason,
    lastTrainedDay: lastDay,
    restDays,
  };
}
