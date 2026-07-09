import type { SetEntry } from "@/features/workout-analytics/model/types";
import { getProgression } from "@/features/workout-analytics/model/progressive-overload";
import { calculateACWR } from "@/features/workout-analytics/model/calculate-acwr";

import { assessDataConfidence } from "./data-confidence";

/** A single exercise slot in a generated session, before overlay adjustments. */
export interface OverlayExerciseInput {
  exerciseId: string;
  suggestedSets: number;
  suggestedWeightKg: number;
}

/** The same slot after overlay adjustments have been applied. */
export interface OverlayExerciseOutput extends OverlayExerciseInput {
  adjustedWeightKg: number;
  adjustedSets: number;
  notes: string[];
}

export interface OverlayResult {
  exercises: OverlayExerciseOutput[];
  /** True if ACWR triggered a session-wide deload (all sets reduced ~30%). */
  deloadTriggered: boolean;
  /** Explanation for UI display. */
  reason: string | null;
}

const DELOAD_FACTOR = 0.7; // reduce sets by 30% when ACWR is in the red zone
const PLATEAU_INCREMENT_KG = 2.5;

/**
 * Apply progression overlay to a generated session plan.
 *
 * DUAL-TRACK design (the core scientific insight):
 *
 * 1. Progressive overload (weight increase) -- NOT gated by data confidence.
 *    Plateau detection looks at a single exercise's last N sessions (needs 4).
 *    This is exercise-level data, not global density, so sparse overall history
 *    doesn't invalidate the per-exercise trend.
 *
 * 2. ACWR deload (session-wide volume reduction) -- GATED by data confidence.
 *    ACWR is a 28-day volume statistic that is extremely sensitive to sparse
 *    data (one session 4 weeks ago makes chronic load tiny, inflating the ratio).
 *    We only act on it when the user has >= 6 training days in 28 days.
 *
 * This separation prevents the absurd scenario where a user returning after a
 * break gets a 30% deload from a mathematically correct but practically
 * meaningless ratio spike.
 */
export function applyProgressionOverlay(
  exercises: OverlayExerciseInput[],
 history: SetEntry[],
 options?: {
    asOf?: Date;
    tzOffsetMinutes?: number;
  },
): OverlayResult {
  const { asOf, tzOffsetMinutes = 0 } = options ?? {};

  // --- Track 1: Progressive overload (per-exercise, ungated) ---
  const overlayExercises: OverlayExerciseOutput[] = exercises.map((ex) => {
    const exHistory = history.filter((s) => s.exerciseId === ex.exerciseId);
    const notes: string[] = [];

    if (exHistory.length > 0) {
      const progression = getProgression({
        sets: exHistory,
        exerciseId: ex.exerciseId,
        tzOffsetMinutes,
      });

      if (progression.trend === "plateau" && progression.lastMaxWeight > 0) {
        notes.push(`Plateau detected: suggest +${PLATEAU_INCREMENT_KG}kg (last max ${progression.lastMaxWeight}kg).`);
        return {
          ...ex,
          adjustedWeightKg: progression.lastMaxWeight + PLATEAU_INCREMENT_KG,
          adjustedSets: ex.suggestedSets,
          notes,
        };
      }
    }

    return {
      ...ex,
      adjustedWeightKg: ex.suggestedWeightKg,
      adjustedSets: ex.suggestedSets,
      notes,
    };
  });

  // --- Track 2: ACWR deload (session-wide, gated by confidence) ---
  const confidence = assessDataConfidence(history, asOf, tzOffsetMinutes);

  if (confidence.confident) {
    const acwr = calculateACWR({
      sets: history,
      asOf,
      tzOffsetMinutes,
    });

    if (acwr.zone === "red") {
      const deloaded = overlayExercises.map((ex) => ({
        ...ex,
        adjustedSets: Math.max(1, Math.round(ex.adjustedSets * DELOAD_FACTOR)),
        notes: [...ex.notes, `Sets reduced ${(1 - DELOAD_FACTOR) * 100 | 0}% (ACWR ${acwr.ratio}, red zone).`],
      }));

      return {
        exercises: deloaded,
        deloadTriggered: true,
        reason: `Deload triggered: ACWR ratio ${acwr.ratio} exceeds 1.5 (red zone).`,
      };
    }
  }

  return {
    exercises: overlayExercises,
    deloadTriggered: false,
    reason: confidence.confident ? null : "Insufficient training history for ACWR-based adjustments.",
  };
}
