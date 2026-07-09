import { ExerciseAttributeValueEnum } from "@prisma/client";

/**
 * Quick-session recommendation engine (pure functions).
 *
 * Mirrors the style of `day-recommender.ts` / `split-generator.ts`: no I/O,
 * deterministic given its inputs, and easy to unit-test. The server action
 * (`get-quick-session.action.ts`) is the only place that wires in DB/auth; the
 * logic that decides *which* muscles to train lives here.
 *
 * Design goals:
 *  - Time-budgeted: the number of exercises is derived from how long the user
 *    has (5 / 10 / 15 min), not from a weekly volume target like the main plan.
 *  - Recovery-aware ("soft coupling"): muscles that are already scheduled for
 *    today's split, or were hit by an earlier quick session today, are
 *    deprioritized so the quick loop complements rather than competes with the
 *    plan. This is intentionally *advisory* — it never mutates split order,
 *    `currentDay`, or `completedSessions` (the `splitDay=null` firewall in
 *    `day-recommender` guarantees that).
 */

/** Supported quick-session durations. */
export type QuickTimeBudget = 5 | 10 | 15 | 20 | 25;

/** Muscles that work well in a low-intensity bodyweight quick loop. */
const QUICK_CANDIDATE_MUSCLES: ExerciseAttributeValueEnum[] = [
  ExerciseAttributeValueEnum.SHOULDERS,
  ExerciseAttributeValueEnum.CHEST,
  ExerciseAttributeValueEnum.BACK,
  ExerciseAttributeValueEnum.LATS,
  ExerciseAttributeValueEnum.ABDOMINALS,
  ExerciseAttributeValueEnum.OBLIQUES,
  ExerciseAttributeValueEnum.QUADRICEPS,
  ExerciseAttributeValueEnum.GLUTES,
  ExerciseAttributeValueEnum.HAMSTRINGS,
  ExerciseAttributeValueEnum.CALVES,
  ExerciseAttributeValueEnum.TRICEPS,
  ExerciseAttributeValueEnum.BICEPS,
];

/** Map a time budget to a target exercise count. */
const BUDGET_TO_EXERCISES: Record<QuickTimeBudget, number> = {
  5: 4,
  10: 7,
  15: 9,
  20: 12,
  25: 14,
};

const BUDGET_TO_REST_SECONDS: Record<QuickTimeBudget, number> = {
  5: 20,
  10: 30,
  15: 45,
  20: 60,
  25: 60,
};

export interface QuickSessionInput {
  timeBudgetMin: QuickTimeBudget;
  /** Muscles scheduled in today's split day (empty on rest days / no plan). */
  plannedMusclesToday: ExerciseAttributeValueEnum[];
  /** Muscles already hit by a quick session earlier today. */
  recentQuickMusclesToday: ExerciseAttributeValueEnum[];
  /** Rest preference can tune the quick-plan set scheme if user wants longer pauses. */
  preferredRestSeconds?: number;
}

export interface QuickMuscleAllocation {
  muscle: ExerciseAttributeValueEnum;
  exerciseCount: number;
}

export interface QuickSetScheme {
  setsPerExercise: number;
  /** Non-null turns the set into a timed hold instead of a rep count. */
  holdSeconds: number | null;
  targetReps: number;
  /** Pause length (seconds) after each set for this quick session. */
  restAfterSetSeconds: number;
}

export interface QuickSessionResult {
  muscles: QuickMuscleAllocation[];
  totalExercises: number;
  setScheme: QuickSetScheme;
  reason: string;
}

/**
 * Recommend a time-boxed quick session.
 *
 * Avoidance strategy:
 *  - "Fresh" muscles (not in today's plan and not already trained quick today)
 *    are preferred and share the exercise budget evenly.
 *  - If fresh muscles can't fill the budget, avoided muscles are added at one
 *    exercise each so the session still hits the target duration.
 *  - If every candidate is already planned for today (the "all occupied"
 *    case), each candidate gets exactly one light exercise — a movement
 *    snack rather than a real session.
 */
export function recommendQuickSession(input: QuickSessionInput): QuickSessionResult {
  const { timeBudgetMin, plannedMusclesToday, recentQuickMusclesToday, preferredRestSeconds } = input;
  const target = BUDGET_TO_EXERCISES[timeBudgetMin];

  const avoidSet = new Set<ExerciseAttributeValueEnum>([...plannedMusclesToday, ...recentQuickMusclesToday]);

  const fresh = QUICK_CANDIDATE_MUSCLES.filter((m) => !avoidSet.has(m));
  const avoided = QUICK_CANDIDATE_MUSCLES.filter((m) => avoidSet.has(m));

  const muscles: QuickMuscleAllocation[] = [];

  if (fresh.length > 0) {
    const perMuscle = Math.max(1, Math.floor(target / fresh.length));
    let remaining = target;

    for (const muscle of fresh) {
      const give = Math.min(perMuscle, remaining);
      if (give > 0) {
        muscles.push({ muscle, exerciseCount: give });
        remaining -= give;
      }
    }

    // Spread any leftover round-robin across the muscles already picked.
    let i = 0;
    while (remaining > 0 && muscles.length > 0) {
      muscles[i % muscles.length].exerciseCount += 1;
      remaining--;
      i++;
    }

    // Still short (few fresh muscles): dip into avoided muscles, one each.
    for (const muscle of avoided) {
      if (remaining <= 0) break;
      muscles.push({ muscle, exerciseCount: 1 });
      remaining--;
    }
  } else {
    // Everything is already in today's plan: cap each candidate at one exercise.
    for (const muscle of avoided) {
      muscles.push({ muscle, exerciseCount: 1 });
    }
  }

  const totalExercises = muscles.reduce((sum, a) => sum + a.exerciseCount, 0);

  // Short sessions use a single timed hold; longer ones use two standard sets.
  const setScheme: QuickSetScheme =
    timeBudgetMin === 5
      ? { setsPerExercise: 1, holdSeconds: 40, targetReps: 12, restAfterSetSeconds: BUDGET_TO_REST_SECONDS[timeBudgetMin] }
      : { setsPerExercise: 2, holdSeconds: null, targetReps: 12, restAfterSetSeconds: BUDGET_TO_REST_SECONDS[timeBudgetMin] };
  const resolvedRestAfterSetSeconds = preferredRestSeconds
    ? Math.max(preferredRestSeconds, setScheme.restAfterSetSeconds)
    : setScheme.restAfterSetSeconds;

  const reason =
    fresh.length > 0
      ? avoided.length === 0
        ? `Recovery loop: ${fresh.length} fresh muscle${fresh.length > 1 ? "s" : ""}, no overlap with today's plan.`
        : `Focused on muscles not in today's plan; ${avoided.length} planned muscle${avoided.length > 1 ? "s were" : " was"} kept light.`
      : "Every target muscle is in today's plan — generated a light movement snack (one exercise each).";

  return {
    muscles,
    totalExercises,
    setScheme: {
      ...setScheme,
      restAfterSetSeconds: resolvedRestAfterSetSeconds,
    },
    reason,
  };
}

/** Convenience for tests / UI: the curated candidate pool size. */
export const QUICK_CANDIDATE_COUNT = QUICK_CANDIDATE_MUSCLES.length;

/**
 * Curated whitelist of exercise slugs that are genuinely doable at an office
 * desk or standing beside it. Each was manually reviewed from the 325 BODY_ONLY
 * exercises in the dataset.
 *
 * Criteria:
 *  - No floor work (push-ups, planks, sit-ups, dead bugs, etc.)
 *  - No equipment (pull-up bar, dip station, wall, bench, etc.)
 *  - No explosive movements (burpees, jumps, sprints)
 *  - No gymnastics skills (levers, planches, flags, handstands)
 *  - Subtle enough to do without drawing stares
 */
const OFFICE_WHITELIST: ReadonlySet<string> = new Set([
  // --- Seated stretches / mobility (invisible at a desk) ---
  "ankle-circles",
  "neck-side-stretch",
  "side-push-neck-stretch",
  "wrist-circles",
  "seated-leg-raise",
  "seated-calf-stretch-male",
  "seated-glute-stretch",
  "seated-lower-back-stretch",
  "seated-piriformis-stretch",
  "seated-wide-angle-pose-sequence",
  "isometric-chest-squeeze",
  "spine-stretch",
  "spine-twist",
  "biceps-leg-concentration-curl",
  // --- Standing stretches (small footprint) ---
  "45-side-bend",
  "standing-lateral-stretch",
  "standing-pelvic-tilt",
  "dynamic-chest-stretch-male",
  "chest-and-front-of-shoulder-stretch",
  "back-pec-stretch",
  "overhead-triceps-stretch",
  "triceps-stretch",
  "rear-deltoid-stretch",
  "upper-back-stretch",
  "side-wrist-pull-stretch",
  "hamstring-stretch",
  "standing-calves-calf-stretch",
  "chair-leg-extended-stretch",
  "circles-knee-stretch",
  // --- Standing micro-strength (subtle) ---
  "bodyweight-standing-calf-raise",
  "standing-calves",
  "half-knee-bends-male",
  "potty-squat",
  "potty-squat-with-support",
  "curtsey-squat",
  "side-hip-abduction",
  "squat-to-overhead-reach",
  "squat-to-overhead-reach-with-twist",
  "world-greatest-stretch",
  "posterior-step-to-overhead-reach",
  "back-and-forth-step",
  "hug-keens-to-chest",
  "forward-lunge-male",
  "lunge-with-twist",
]);

/**
 * Return true if an exercise is in the curated office whitelist.
 * Uses slug matching — the safest approach given the dataset's noisy
 * BODY_ONLY tag. Pure function so it can be unit-tested.
 */
export function isOfficeFriendly(slug: string, _name?: string): boolean {
  return OFFICE_WHITELIST.has(slug);
}

/** Exposed for tests: the full whitelist as an array. */
export const OFFICE_WHITELIST_SLUGS = [...OFFICE_WHITELIST];

/**
 * Human-readable label for the whitelist size (used by the action for a debug log).
 */
export const OFFICE_WHITELIST_COUNT = OFFICE_WHITELIST.size;
