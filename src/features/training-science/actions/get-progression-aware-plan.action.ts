"use server";

import { headers } from "next/headers";

import { auth } from "@/features/auth/lib/better-auth";
import { loadUserSetEntries } from "@/features/workout-analytics/actions/load-set-entries";
import {
  applyProgressionOverlay,
  type OverlayExerciseInput,
  type OverlayResult,
} from "../model/progression-overlay";

/**
 * Apply the progression overlay to a generated session plan using the logged-in
 * user's real training history. Returns the plan unchanged (with default values)
 * if the user is not logged in or has insufficient history.
 */
export async function getProgressionAwarePlan(
  exercises: OverlayExerciseInput[],
): Promise<OverlayResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      // Anonymous user: no history to overlay, return plan as-is.
      return {
        exercises: exercises.map((ex) => ({
          ...ex,
          adjustedWeightKg: ex.suggestedWeightKg,
          adjustedSets: ex.suggestedSets,
          notes: [],
        })),
        deloadTriggered: false,
        reason: null,
      };
    }

    const history = await loadUserSetEntries(userId, 120);

    return applyProgressionOverlay(exercises, history);
  } catch (error) {
    console.error("Error applying progression overlay:", error);
    // Fail safe: return the plan without adjustments.
    return {
      exercises: exercises.map((ex) => ({
        ...ex,
        adjustedWeightKg: ex.suggestedWeightKg,
        adjustedSets: ex.suggestedSets,
        notes: [],
      })),
      deloadTriggered: false,
      reason: null,
    };
  }
}
