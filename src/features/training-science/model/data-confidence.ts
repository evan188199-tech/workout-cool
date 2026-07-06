import type { SetEntry } from "@/features/workout-analytics/model/types";
import { toLocalInstant } from "@/features/workout-analytics/model/date-utils";

/**
 * Minimum distinct training days in the past 28 days for ACWR-based decisions
 * to be considered reliable. Below this threshold, sparse data can cause the
 * acute:chronic ratio to spike spuriously (e.g. one session 4 weeks ago makes
 * the chronic load tiny, inflating the ratio for a normal training week).
 *
 * 6 days / 28 days = 1.5 sessions per week on average -- enough to filter out
 * "once a month" noise while remaining lenient for users who occasionally miss
 * a session due to travel or illness.
 */
export const MIN_TRAINING_DAYS = 6;

/** Window length in days for assessing training consistency. */
const LOOKBACK_DAYS = 28;
const MS_PER_DAY = 86_400_000;

export interface ConfidenceResult {
  /** True when the user has enough recent data for ACWR-driven deload decisions. */
  confident: boolean;
  /** Number of distinct training days in the lookback window. */
  sessionDays: number;
  /** The threshold (MIN_TRAINING_DAYS) for reference. */
  threshold: number;
}

/**
 * Assess whether the user's training history is dense enough for ACWR-based
 * load management decisions. Counts DISTINCT calendar days (local timezone)
 * on which at least one completed set was logged.
 *
 * This is intentionally separate from calculateACWR: the pure math function
 * always computes a ratio from whatever data it receives, but business logic
 * must refuse to ACT on that ratio when the underlying data is too sparse.
 */
export function assessDataConfidence(
  sets: SetEntry[],
  asOf: Date = new Date(),
  tzOffsetMinutes = 0,
): ConfidenceResult {
  const localAsOf = toLocalInstant(asOf, tzOffsetMinutes);
  const windowStart = new Date(localAsOf.getTime() - LOOKBACK_DAYS * MS_PER_DAY);

  // Collect distinct local-date keys within the window.
  const days = new Set<string>();
  for (const s of sets) {
    const local = toLocalInstant(s.date, tzOffsetMinutes);
    if (local.getTime() >= windowStart.getTime() && local.getTime() <= localAsOf.getTime()) {
      days.add(local.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
  }

 const sessionDays = days.size;
  return {
    confident: sessionDays >= MIN_TRAINING_DAYS,
    sessionDays,
    threshold: MIN_TRAINING_DAYS,
  };
}
