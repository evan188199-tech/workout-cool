import type { ExerciseAttributeValueEnum } from "@prisma/client";

/**
 * Stretch-routine recommendation engine (pure functions).
 *
 * Mirrors the style of `quick-session.ts` / `session-finisher.ts`: no I/O,
 * deterministic, easy to unit-test. The server action (`get-stretches.action.ts`)
 * wires in DB queries; the logic that decides *which* stretches to show lives
 * here.
 *
 * Design rationale:
 *  - Warm-up phase uses DYNAMIC stretches (joint circles, controlled swings,
 *    movement-based) to raise muscle temperature and joint mobility BEFORE
 *    loading.
 *  - Cool-down phase uses STATIC stretches (hold-based) to relax the muscles
 *    just trained and improve recovery.
 */

export type StretchPhase = "warmup" | "cooldown";

/** Muscles the app's training flow supports (subset of ExerciseAttributeValueEnum). */
type TrainableMuscle = ExerciseAttributeValueEnum;

/**
 * Curated dynamic-stretch slug pool for the warm-up phase, keyed by the muscle
 * the user is about to train. Dynamic stretches involve movement rather than a
 * held position — they prime the joint and raise tissue temperature.
 */
const WARMUP_SLUGS: Record<string, string[]> = {
  _general: [
    "world-greatest-stretch",
    "spine-twist",
    "lunge-with-twist",
    "ankle-circles",
    "wrist-circles",
  ],
  shoulders: [
    "dynamic-chest-stretch-male",
    "arm-circles",
    "swing-360",
  ],
  chest: [
    "dynamic-chest-stretch-male",
    "chest-and-front-of-shoulder-stretch",
  ],
  back: [
    "spine-twist",
    "cat-cow",
  ],
  lats: [
    "spine-twist",
    "walking-lunge",
  ],
  quadriceps: [
    "walking-lunge",
    "lunge-with-twist",
    "walking-high-knees-lunge",
  ],
  hamstrings: [
    "circles-knee-stretch",
    "world-greatest-stretch",
    "leg-swings",
  ],
  glutes: [
    "world-greatest-stretch",
    "lunge-with-twist",
  ],
  calves: [
    "ankle-circles",
    "circles-knee-stretch",
  ],
  triceps: [
    "arm-circles",
    "shoulder-circles",
  ],
  biceps: [
    "arm-circles",
    "wrist-circles",
  ],
  forearms: [
    "wrist-circles",
  ],
  abdominals: [
    "spine-twist",
    "torso-twist",
  ],
  obliques: [
    "spine-twist",
    "standing-lateral-stretch",
  ],
  traps: [
    "neck-side-stretch",
    "shoulder-circles",
  ],
};

/**
 * Curated static-stretch slug pool for the cool-down phase, keyed by the muscle
 * just trained. Static stretches are held positions that lengthen the muscle
 * fascicle and aid post-exercise recovery.
 */
const COOLDOWN_SLUGS: Record<string, string[]> = {
  _general: [
    "hamstring-stretch",
    "overhead-triceps-stretch",
    "upper-back-stretch",
    "standing-lateral-stretch",
  ],
  shoulders: [
    "rear-deltoid-stretch",
    "overhead-triceps-stretch",
    "upper-back-stretch",
  ],
  chest: [
    "chest-and-front-of-shoulder-stretch",
    "back-pec-stretch",
    "behind-head-chest-stretch",
  ],
  back: [
    "seated-lower-back-stretch",
    "upper-back-stretch",
    "spine-stretch",
  ],
  lats: [
    "upper-back-stretch",
    "back-pec-stretch",
    "spine-stretch",
  ],
  quadriceps: [
    "lying-side-quads-stretch",
    "intermediate-hip-flexor-and-quad-stretch",
  ],
  hamstrings: [
    "hamstring-stretch",
    "seated-glute-stretch",
    "chair-leg-extended-stretch",
  ],
  glutes: [
    "seated-glute-stretch",
    "seated-piriformis-stretch",
    "seated-lower-back-stretch",
  ],
  calves: [
    "standing-calves-calf-stretch",
    "seated-calf-stretch-male",
    "runners-stretch",
  ],
  triceps: [
    "overhead-triceps-stretch",
    "triceps-stretch",
  ],
  biceps: [
    "side-wrist-pull-stretch",
    "biceps-stretch",
  ],
  forearms: [
    "side-wrist-pull-stretch",
    "wrist-circles",
  ],
  abdominals: [
    "spine-stretch",
    "cobra-stretch",
  ],
  obliques: [
    "standing-lateral-stretch",
    "spine-twist",
  ],
  traps: [
    "neck-side-stretch",
    "side-push-neck-stretch",
    "upper-back-stretch",
  ],
};

/** How many stretches to show per phase. */
const STRETCH_COUNT = 3;
/** Default dynamic warm-up reps. */
export const WARMUP_REPS = 10;
/** Default static stretch hold seconds. */
export const STRETCH_HOLD_SECONDS = 30;

export interface StretchRecommendationInput {
  count?: number;
  warmupReps?: number;
  cooldownHoldSeconds?: number;
}

/**
 * Recommend stretch slugs for a given phase and target muscles.
 *
 * De-duplicates across muscles so the user never sees the same stretch twice
 * in one routine. Falls back to a general pool when a muscle has no curated
 * stretches or when the selected muscles don't map.
 */
export function recommendStretchSlugs(
  muscles: TrainableMuscle[],
  phase: StretchPhase,
  options?: StretchRecommendationInput,
): string[] {
  const count = options?.count ?? STRETCH_COUNT;
  const target = Math.max(1, Math.min(4, count));
  const pool = phase === "warmup" ? WARMUP_SLUGS : COOLDOWN_SLUGS;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const muscle of muscles) {
    const slugs = pool[muscle];
    if (!slugs) continue;
    for (const slug of slugs) {
      if (!seen.has(slug)) {
        seen.add(slug);
        result.push(slug);
      }
      if (result.length >= target) return result;
    }
  }

  if (result.length < target) {
    for (const slug of pool._general) {
      if (!seen.has(slug)) {
        seen.add(slug);
        result.push(slug);
      }
      if (result.length >= target) break;
    }
  }

  return result;
}
