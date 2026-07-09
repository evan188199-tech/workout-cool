import type { RiskZone } from "@/features/workout-analytics/model/types";

/**
 * Weekly plan adjustment engine (pure functions).
 *
 * Answers the two questions the user cares about:
 *  - "This week I trained extra (quick/office sessions) — how should next week change?"
 *  - "This week I didn't finish my planned days — how should next week change?"
 *
 * It does NOT replace ACWR (fatigue math) or progression-overlay (per-session
 * deload). It sits one level up: it decides *frequency* (daysPerWeek) and
 * *volume direction* for the coming week, then the existing overlay handles the
 * per-session execution. See DESIGN-DECISIONS for the full rationale.
 *
 * Safety hierarchy (highest priority wins):
 *   insufficient data → no recommendation
 *   red ACWR         → forced deload (volumeFactor 0.7, no frequency increase)
 *   yellow ACWR      → soft deload (volumeFactor 0.85, no frequency increase)
 *   green + full adherence + stable 2w → bump frequency +1 (cap 5)
 *   green + missed days → maintain frequency, encourage adherence
 *   undertrained + chronic miss → reduce frequency to match reality (min 2)
 */

export type AdjustmentAction =
  | "increase_frequency"
  | "maintain"
  | "reduce_volume"
  | "deload"
  | "reduce_frequency"
  | "no_data";

/** How many weeks the user must hit all planned days before a frequency bump. */
const FULL_ADHERENCE_WEEKS = 2;
/** Volume multiplier when ACWR hits the red zone. */
const DELOAD_FACTOR = 0.7;
/** Volume multiplier when ACWR hits the yellow zone. */
const SOFT_DELOAD_FACTOR = 0.85;
/** How many consecutive miss-weeks before we shrink the plan to fit reality. */
const CHRONIC_MISS_WEEKS = 2;

export interface WeeklyAdjustmentInput {
  /** Current daysPerWeek from the user's training plan (2-5). */
  currentDaysPerWeek: number;
  /** ACWR risk zone (the fatigue signal). */
  acwrZone: RiskZone;
  /** Raw ACWR ratio, null when insufficient data. */
  acwrRatio: number | null;
  /** Split sessions actually completed this week (splitDay != null). */
  plannedSessionsThisWeek: number;
  /** Quick / free-mode sessions done this week (splitDay == null). */
  extraSessionsThisWeek: number;
  /** Whether the user has enough history for ACWR to be trustworthy. */
  dataConfident: boolean;
  /** Consecutive weeks the user has been at currentDaysPerWeek. */
  weeksAtCurrentFrequency: number;
  /** Consecutive weeks the user has missed >= 1 planned day. */
  consecutiveMissWeeks: number;
}

export interface WeeklyAdjustmentResult {
  action: AdjustmentAction;
  /** Recommended daysPerWeek for next week (may equal current). */
  newDaysPerWeek: number;
  /** Multiplier applied to all set/rep targets (1.0 = normal). */
  volumeFactor: number;
  /** Human-readable explanation for the UI. */
  reason: string;
  /** False when there is not enough data to act; the UI hides the card. */
  applyable: boolean;
}

/** Minimum / maximum frequency the engine will ever recommend. */
export const MIN_DAYS = 2;
export const MAX_DAYS = 5;

/**
 * Recommend how the user's training plan should adapt for the coming week.
 *
 * The function is deterministic and side-effect free. The server action is
 * responsible for gathering real session data and calling this.
 */
export function recommendWeeklyAdjustment(input: WeeklyAdjustmentInput): WeeklyAdjustmentResult {
  const {
    currentDaysPerWeek,
    acwrZone,
    acwrRatio,
    plannedSessionsThisWeek,
    extraSessionsThisWeek,
    dataConfident,
    weeksAtCurrentFrequency,
    consecutiveMissWeeks,
  } = input;

  const completedAllPlanned = plannedSessionsThisWeek >= currentDaysPerWeek;

  // --- 0. No data to reason about ---
  if (!dataConfident || acwrZone === "insufficient-data") {
    return maintain(currentDaysPerWeek, "Not enough training history yet. Keep following your plan — adjustments will appear after ~2 consistent weeks.");
  }

  // --- 1. Safety brake: ACWR red (acute load >> chronic) ---
  // The user accumulated fatigue too fast — this week's quick sessions likely
  // contributed. Force a deload regardless of adherence.
  if (acwrZone === "red") {
    return deload(currentDaysPerWeek, `Your training load spiked (ACWR ${acwrRatio?.toFixed(2)}). Next week: deload at 70% volume to let your body recover. Frequency stays the same.`);
  }

  // --- 2. Caution: ACWR yellow ---
  if (acwrZone === "yellow") {
    return reduceVolume(currentDaysPerWeek, `Your load is climbing fast (ACWR ${acwrRatio?.toFixed(2)}). Next week: keep the same frequency but dial volume back ~15%.`);
  }

  // --- 3. Undertrained: chronic load below baseline ---
  // Distinguish "rested and ready" (missed a week, fresh) from "chronic
  // non-adherence" (the plan is too ambitious for the user's lifestyle).
  if (acwrZone === "undertrained") {
    if (consecutiveMissWeeks >= CHRONIC_MISS_WEEKS) {
      const newDays = Math.max(MIN_DAYS, currentDaysPerWeek - 1);
      if (newDays < currentDaysPerWeek) {
        return reduceFrequency(newDays, `You've missed planned days for ${consecutiveMissWeeks} weeks. A ${newDays}-day split may fit your schedule better — consistency beats ambition.`);
      }
    }
    // Fresh but undertrained: just ramp back to normal.
    return maintain(currentDaysPerWeek, "You're well-rested. Resume your normal plan this week — you're primed to hit it hard.");
  }

  // --- 4. Green zone: the decision tree splits on adherence ---
  if (acwrZone === "green") {
    const hadExtraSessions = extraSessionsThisWeek > 0;

    // 4a. Hit every planned day AND has been consistent for >= 2 weeks.
    if (completedAllPlanned && weeksAtCurrentFrequency >= FULL_ADHERENCE_WEEKS) {
      if (currentDaysPerWeek < MAX_DAYS) {
        const newDays = currentDaysPerWeek + 1;
        return increaseFrequency(newDays, `Two weeks of perfect adherence at ${currentDaysPerWeek} days. Your body is ready for ${newDays} days/week if you want it.`);
      }
      // Already at max frequency.
      return maintain(currentDaysPerWeek, `Perfect adherence at the maximum frequency (${MAX_DAYS} days). Keep crushing it — consider progressive overload instead of more days.`);
    }

    // 4b. Hit all planned days but only recently (consistency not proven yet).
    if (completedAllPlanned && weeksAtCurrentFrequency < FULL_ADHERENCE_WEEKS) {
      return maintain(currentDaysPerWeek, `Great — you hit all ${currentDaysPerWeek} days this week. String together ${FULL_ADHERENCE_WEEKS} consistent weeks and we'll suggest bumping frequency.`);
    }

    // 4c. Missed some planned days.
    const missedDays = currentDaysPerWeek - plannedSessionsThisWeek;
    if (hadExtraSessions) {
      // User missed planned days but did extra sessions — likely a scheduling
      // mismatch, not a capacity issue. Hold frequency.
      return maintain(currentDaysPerWeek, `You missed ${missedDays} planned day${missedDays > 1 ? "s" : ""} but squeezed in ${extraSessionsThisWeek} quick session${extraSessionsThisWeek > 1 ? "s" : ""}. Try to align quick sessions with your split next week.`);
    }
    return maintain(currentDaysPerWeek, `You completed ${plannedSessionsThisWeek}/${currentDaysPerWeek} planned days. Aim for full adherence next week before increasing frequency.`);
  }

  // Fallback (should never reach here given the zone union).
  return maintain(currentDaysPerWeek, "Your plan is on track. Keep it up.");
}

// --- Factory helpers for readability ---

function maintain(days: number, reason: string): WeeklyAdjustmentResult {
  return { action: "maintain", newDaysPerWeek: days, volumeFactor: 1.0, reason, applyable: true };
}

function deload(days: number, reason: string): WeeklyAdjustmentResult {
  return { action: "deload", newDaysPerWeek: days, volumeFactor: DELOAD_FACTOR, reason, applyable: true };
}

function reduceVolume(days: number, reason: string): WeeklyAdjustmentResult {
  return { action: "reduce_volume", newDaysPerWeek: days, volumeFactor: SOFT_DELOAD_FACTOR, reason, applyable: true };
}

function increaseFrequency(newDays: number, reason: string): WeeklyAdjustmentResult {
  return { action: "increase_frequency", newDaysPerWeek: newDays, volumeFactor: 1.0, reason, applyable: true };
}

function reduceFrequency(newDays: number, reason: string): WeeklyAdjustmentResult {
  return { action: "reduce_frequency", newDaysPerWeek: newDays, volumeFactor: 1.0, reason, applyable: true };
}
// no_data uses maintain with applyable=false.

/** Build a no-data result (used by the action when history is too sparse). */
export function noDataResult(daysPerWeek: number): WeeklyAdjustmentResult {
  return {
    action: "no_data",
    newDaysPerWeek: daysPerWeek,
    volumeFactor: 1.0,
    reason: "Not enough training history to recommend adjustments yet.",
    applyable: false,
  };
}
