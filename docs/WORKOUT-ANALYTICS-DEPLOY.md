## Workout Analytics Module - Self-Hosting + Implementation Spec

Goal: Self-host workout-cool, unlock premium for personal use, and add a science-backed
ACWR + muscle-volume analytics layer on top of the existing WorkoutSet data.

This document is decision-complete. An implementing agent can follow it top-to-bottom
without making design choices.

---

## Part A: Deploy + Unlock Premium

### A1. Environment

Copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgresql://username:password@localhost:5432/workout-cool
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
NODE_ENV=development
SEED_SAMPLE_DATA=true
DEFAULT_BILLING_MODE="DISABLED"
GOOGLE_CLIENT_ID=""        # leave blank to disable Google OAuth
GOOGLE_CLIENT_SECRET=""
```

### A2. Start with Docker

```bash
cp .env.example .env
make dev          # starts postgres in docker, runs migrations, seeds, starts Next.js
```

Open http://localhost:3000. Register an account (email/password works with no OAuth setup).

### A3. Unlock Premium (personal use)

The premium check is a single boolean: `User.isPremium` (see
`src/shared/lib/premium/premium.service.ts`). Two options:

**Option 1 - SQL (recommended, no code change):**
```sql
UPDATE "user" SET "isPremium" = true;
-- and set the default for future signups:
ALTER TABLE "user" ALTER COLUMN "isPremium" SET DEFAULT true;
```

**Option 2 - Code: delete the premium gate in these 4 routes:**
- `app/api/exercises/[exerciseId]/statistics/volume/route.ts`
- `app/api/exercises/[exerciseId]/statistics/weight-progression/route.ts`
- `app/api/exercises/[exerciseId]/statistics/one-rep-max/route.ts`
- `app/api/exercises/[exerciseId]/statistics/route.ts`

In each, remove the `PremiumService.checkUserPremiumStatus` block that returns 403.
Keep the auth check (session).

The `DEFAULT_BILLING_MODE` env var is dead code (no runtime reads it). Do not rely on it.

---

## Part B: Workout Analytics Module

### Architecture decision

Create a NEW feature module at `src/features/workout-analytics/` following the
existing FSD conventions. Do NOT modify the existing `src/features/statistics/`
feature (it is single-exercise and premium-gated; leave it alone).

The module has a strict three-layer separation:

1. `model/` - pure math functions. Zero Prisma imports. Zero framework imports.
   Input = plain arrays. Output = numbers + enums. Unit-testable.
2. `actions/` - server actions that query Prisma, transform rows into the plain
   arrays the model expects, then call model functions.
3. `ui/` - React components that call the actions and render charts/gauges.

This separation is non-negotiable. It is what makes the module testable and reusable.

### Module layout

```
src/features/workout-analytics/
├── model/
│   ├── types.ts                 # shared input/output types
│   ├── calculate-acwr.ts        # ACWR math (rolling + EWMA)
│   ├── get-weekly-volume.ts     # per-muscle weekly set aggregation
│   └── progressive-overload.ts  # weight trend -> increase suggestion
├── actions/
│   ├── get-acwr-data.action.ts  # queries sessions, returns ACWR result
│   ├── get-muscle-volume.action.ts
│   └── get-progressive-overload.action.ts
├── hooks/
│   ├── use-acwr.ts
│   ├── use-muscle-volume.ts
│   └── use-progressive-overload.ts
├── components/
│   ├── ACWRGauge.tsx
│   ├── MuscleVolumeBars.tsx
│   ├── ProgressiveOverloadCard.tsx
│   └── index.ts
└── index.ts
```

### Data sources (all confirmed present in prisma/schema.prisma)

- `WorkoutSession` - `userId`, `startedAt` (timestamp), `muscles` (muscle enum array)
- `WorkoutSessionExercise` - links session to exercise, has `sets`
- `WorkoutSet` - `types` (WorkoutSetType[]: TIME|WEIGHT|REPS|BODYWEIGHT|NA),
  `valuesInt` (number[]), `valuesSec` (number[]), `units` (kg|lbs), `completed` (bool)
- `ExerciseAttribute` - links exercise to (PRIMARY_MUSCLE|SECONDARY_MUSCLE|EQUIPMENT|...) values

The per-muscle grouping reads `ExerciseAttribute` where name = PRIMARY_MUSCLE,
exactly as `get-exercises-by-muscle.action.ts` already does (copy that query pattern).

Weight unit conversion uses the existing `src/shared/lib/weight-conversion.ts`
(`convertWeight`, `WEIGHT_CONVERSION.LBS_TO_KG`). Import it, do not reimplement.

---

## Part B-1: model/types.ts

```ts
import { ExerciseAttributeValueEnum } from "@prisma/client";

// A single completed set, flattened from WorkoutSet + its session date.
// This is the ONLY shape the model functions accept.
export interface SetEntry {
  date: Date;                  // session.startedAt
  muscle: ExerciseAttributeValueEnum;  // exercise PRIMARY_MUSCLE
  exerciseId: string;
  setIndex: number;
  weightKg: number;            // already converted to kg
  reps: number;
  durationSec: number;         // 0 if not time-based
}

// ACWR
export type LoadModel = "rolling" | "ewma";

export interface ACWRInput {
  sets: SetEntry[];
  asOf: Date;                  // "today", default new Date()
  acuteDays?: number;          // default 7
  chronicDays?: number;        // default 28
  model?: LoadModel;           // default "rolling"
  ewmaLambda?: number;         // default 2/(28+1) ~ 0.069
}

export type RiskZone = "green" | "yellow" | "red" | "undertrained" | "insufficient-data";

export interface ACWRResult {
  ratio: number | null;        // null if insufficient data
  acuteLoad: number;           // last 7d total volume (kg)
  chronicLoad: number;         // 28d average weekly volume (rolling) or EWMA
  zone: RiskZone;
  message: string;
}

// Muscle volume
export interface WeeklyMuscleVolume {
  muscle: ExerciseAttributeValueEnum;
  muscleLabel: string;
  weeklySets: number;          // sets completed this week (Mon-Sun)
  fourWeekAvgSets: number;     // avg weekly sets over last 4 weeks
  status: "undertrained" | "optimal" | "high" | "overreach";
}

export interface MuscleVolumeInput {
  sets: SetEntry[];
  asOf?: Date;
}

// Progressive overload
export interface ProgressionInput {
  sets: SetEntry[];            // for a SINGLE exercise
  exerciseId: string;
}

export interface ProgressionResult {
  exerciseId: string;
  lastMaxWeight: number;
  previousMaxWeight: number;
  trend: "increasing" | "plateau" | "decreasing" | "insufficient-data";
  suggestedIncrementKg: number | null;  // null when not applicable
  message: string;
}
```

## Part B-2: model/calculate-acwr.ts

```ts
import {
  ACWRInput,
  ACWRResult,
  RiskZone,
  SetEntry,
} from "./types";

const DAY_MS = 86_400_000;

// Volume of one set. Weight*reps if weighted, else reps, else durationSec.
function setVolume(s: SetEntry): number {
  if (s.weightKg > 0 && s.reps > 0) return s.weightKg * s.reps;
  if (s.reps > 0) return s.reps;
  return s.durationSec;
}

// Sum volume for sets whose date falls in [start, end).
function volumeBetween(sets: SetEntry[], start: Date, end: Date): number {
  return sets.reduce((sum, s) => {
    const t = s.date.getTime();
    return t >= start.getTime() && t < end.getTime()
      ? sum + setVolume(s)
      : sum;
  }, 0);
}

function classifyZone(ratio: number | null): RiskZone {
  if (ratio === null) return "insufficient-data";
  if (ratio < 0.8) return "undertrained";
  if (ratio <= 1.3) return "green";
  if (ratio <= 1.5) return "yellow";
  return "red";
}

function zoneMessage(zone: RiskZone): string {
  switch (zone) {
    case "green":
      return "Sweet spot. Load is increasing safely relative to your recent average.";
    case "yellow":
      return "Caution. This week's volume rose faster than your 4-week average. Watch joint feel.";
    case "red":
      return "Danger. Acute load spiked >1.5x chronic load. Injury risk roughly doubles. Take a rest or deload day.";
    case "undertrained":
      return "Volume well below your baseline. Safe, but you are detraining.";
    default:
      return "Not enough history yet (need ~28 days of data).";
  }
}

export function calculateACWR(input: ACWRInput): ACWRResult {
  const {
    sets,
    asOf = new Date(),
    acuteDays = 7,
    chronicDays = 28,
    model = "rolling",
    ewmaLambda = 2 / (chronicDays + 1),
  } = input;

  // Need at least ~14 days of history for a meaningful chronic baseline.
  const minHistoryMs = 14 * DAY_MS;
  const earliest = sets.length
    ? Math.min(...sets.map((s) => s.date.getTime()))
    : asOf.getTime();
  if (asOf.getTime() - earliest < minHistoryMs) {
    return {
      ratio: null,
      acuteLoad: 0,
      chronicLoad: 0,
      zone: "insufficient-data",
      message: zoneMessage("insufficient-data"),
    };
  }

  const acuteStart = new Date(asOf.getTime() - acuteDays * DAY_MS);
  const acuteLoad = volumeBetween(sets, acuteStart, asOf);

  let chronicLoad: number;
  if (model === "ewma") {
    // Build a daily series over [asOf - chronicDays, asOf), apply EWMA, take last value.
    const chronicStart = new Date(asOf.getTime() - chronicDays * DAY_MS);
    let prev = volumeBetween(sets, chronicStart, new Date(chronicStart.getTime() + DAY_MS));
    for (let d = 1; d < chronicDays; d++) {
      const dayStart = new Date(chronicStart.getTime() + d * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const dayVol = volumeBetween(sets, dayStart, dayEnd);
      prev = dayVol * ewmaLambda + prev * (1 - ewmaLambda);
    }
    chronicLoad = prev;
  } else {
    // Rolling: total volume over chronic window, divided by number of weeks.
    const chronicStart = new Date(asOf.getTime() - chronicDays * DAY_MS);
    const chronicTotal = volumeBetween(sets, chronicStart, asOf);
    chronicLoad = chronicTotal / (chronicDays / 7);
  }

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : null;
  const zone = classifyZone(ratio);

  return {
    ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    zone,
    message: zoneMessage(zone),
  };
}
```

## Part B-3: model/get-weekly-volume.ts

```ts
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { MuscleVolumeInput, WeeklyMuscleVolume } from "./types";

const DAY_MS = 86_400_000;

// ISO week start (Monday) of a given date.
function weekStart(d: Date): Date {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  const day = t.getDay();
  const diff = t.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(t.setDate(diff));
}

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: "Chest",
  BACK: "Back",
  LATS: "Lats",
  SHOULDERS: "Shoulders",
  BICEPS: "Biceps",
  TRICEPS: "Triceps",
  QUADRICEPS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  ABDOMINALS: "Abs",
  FOREARMS: "Forearms",
  TRAPS: "Traps",
};

// Schoenfeld-derived heuristic: 10-20 hard sets per muscle per week.
const OPTIMAL_MIN = 10;
const OPTIMAL_MAX = 20;
const OVERREACH = 25;

export function getWeeklyMuscleVolume(input: MuscleVolumeInput): WeeklyMuscleVolume[] {
  const { sets, asOf = new Date() } = input;

  const thisWeekStart = weekStart(asOf);
  const fourWeeksAgo = new Date(thisWeekStart.getTime() - 28 * DAY_MS);

  // Group completed sets by muscle.
  const byMuscle = new Map<string, { thisWeek: number; last4w: number; weeks: Set<string> }>();

  for (const s of sets) {
    const key = s.muscle;
    if (!byMuscle.has(key)) byMuscle.set(key, { thisWeek: 0, last4w: 0, weeks: new Set() });
    const m = byMuscle.get(key)!;

    if (s.date >= thisWeekStart) m.thisWeek += 1;

    if (s.date >= fourWeeksAgo) {
      m.last4w += 1;
      // Track distinct weeks this muscle was trained in the 4w window.
      const ws = weekStart(s.date).getTime();
      m.weeks.add(String(ws));
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

  // Sort: highest weekly volume first.
  return results.sort((a, b) => b.weeklySets - a.weeklySets);
}
```

## Part B-4: model/progressive-overload.ts

```ts
import { ProgressionInput, ProgressionResult } from "./types";

const SUGGESTED_STEP_KG = 2.5;        // conservative increment for upper-body heuristic
const PLATEAU_LOOKBACK = 3;           // compare last session vs N sessions ago
const MIN_SESSIONS = 4;               // need this many sessions to judge trend

export function getProgression(input: ProgressionInput): ProgressionResult {
  const { sets, exerciseId } = input;

  // Group sets by session date -> max weight that day.
  const bySession = new Map<string, { date: Date; maxWeight: number }>();
  for (const s of sets) {
    const key = s.date.toISOString().slice(0, 10);
    const existing = bySession.get(key);
    if (!existing || s.weightKg > existing.maxWeight) {
      bySession.set(key, { date: s.date, maxWeight: s.weightKg });
    }
  }

  const sessions = Array.from(bySession.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  if (sessions.length < MIN_SESSIONS) {
    return {
      exerciseId,
      lastMaxWeight: sessions.at(-1)?.maxWeight ?? 0,
      previousMaxWeight: 0,
      trend: "insufficient-data",
      suggestedIncrementKg: null,
      message: "Need at least 4 sessions to evaluate progression.",
    };
  }

  const last = sessions.at(-1)!;
  const prev = sessions.at(-1 - PLATEAU_LOOKBACK)!;
  const lastMax = last.maxWeight;
  const prevMax = prev.maxWeight;

  let trend: ProgressionResult["trend"];
  let suggestedIncrementKg: number | null = null;
  let message: string;

  if (lastMax > prevMax + 0.5) {
    trend = "increasing";
    message = "Weight is trending up. Good progressive overload.";
  } else if (lastMax < prevMax - 0.5) {
    trend = "decreasing";
    message = "Weight dropped across recent sessions. Check recovery or technique.";
  } else {
    trend = "plateau";
    suggestedIncrementKg = SUGGESTED_STEP_KG;
    message = `Plateau detected over last ${PLATEAU_LOOKBACK + 1} sessions. Try +${SUGGESTED_STEP_KG}kg next time to break through.`;
  }

  return {
    exerciseId,
    lastMaxWeight: lastMax,
    previousMaxWeight: prevMax,
    trend,
    suggestedIncrementKg,
    message,
  };
}
```

## Part B-5: actions/get-acwr-data.action.ts

Server action: query user's sets, flatten to SetEntry[], call calculateACWR.

```ts
"use server";

import { ExerciseAttributeNameEnum } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { convertWeight } from "@/shared/lib/weight-conversion";
import { actionClient } from "@/shared/api/safe-actions";
import { z } from "zod";

import { calculateACWR } from "../model/calculate-acwr";
import { SetEntry } from "../model/types";

const schema = z.object({
  model: z.enum(["rolling", "ewma"]).optional(),
});

export const getACWRDataAction = actionClient.schema(schema).action(async ({ parsedInput, ctx }) => {
  // ctx.user is provided by the safe-actions middleware; if not, read session here.
  const userId = ctx?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const [primaryMuscleAttr] = await Promise.all([
    prisma.exerciseAttributeName.findUnique({
      where: { name: ExerciseAttributeNameEnum.PRIMARY_MUSCLE },
    }),
  ]);
  if (!primaryMuscleAttr) throw new Error("PRIMARY_MUSCLE attribute not seeded");

  // Pull all the user's completed sets in the last ~60 days (enough for 28d chronic + headroom).
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const rows = await prisma.workoutSessionExercise.findMany({
    where: {
      workoutSession: { userId, startedAt: { gte: since } },
      sets: { some: { completed: true } },
    },
    include: {
      workoutSession: { select: { startedAt: true } },
      exercise: {
        select: {
          attributes: {
            where: { attributeNameId: primaryMuscleAttr.id },
            select: { attributeValue: { select: { value: true } } },
          },
        },
      },
      sets: { where: { completed: true } },
    },
  });

  // Flatten to SetEntry[].
  const sets: SetEntry[] = [];
  for (const r of rows) {
    const muscle = r.exercise.attributes[0]?.attributeValue.value as SetEntry["muscle"];
    if (!muscle) continue;
    for (const set of r.sets) {
      const weightIdx = set.types.indexOf("WEIGHT");
      const repsIdx = set.types.indexOf("REPS");
      const timeIdx = set.types.indexOf("TIME");
      const weightRaw = weightIdx !== -1 ? set.valuesInt[weightIdx] ?? 0 : 0;
      const unit = set.units?.[weightIdx] === "lbs" ? "lbs" : "kg";
      const weightKg = weightRaw ? convertWeight(weightRaw, unit, "kg") : 0;
      const reps = repsIdx !== -1 ? set.valuesInt[repsIdx] ?? 0 : 0;
      const durationSec = timeIdx !== -1 ? set.valuesSec[timeIdx] ?? 0 : 0;
      sets.push({
        date: r.workoutSession.startedAt,
        muscle,
        exerciseId: r.exerciseId,
        setIndex: set.setIndex,
        weightKg,
        reps,
        durationSec,
      });
    }
  }

  return calculateACWR({ sets, asOf: new Date(), model: parsedInput.model });
});
```

Note: `get-muscle-volume.action.ts` and `get-progressive-overload.action.ts`
follow the same pattern (same query, different model function). For muscle volume
omit the 60-day cutoff's lower bound issues by keeping the same query; for
progression, add an `exerciseId` to the schema and the where clause.

## Part B-6: components

`ACWRGauge.tsx` - a colored ring/bar showing the ratio 0.0-1.8+ with zones:
green (0.8-1.3), yellow (1.3-1.5), red (>1.5), and the current value marked.
Use the existing chart library already in the project (check
`src/features/statistics/components/VolumeChart.tsx` for the lib in use;
it imports recharts).

`MuscleVolumeBars.tsx` - horizontal bars per muscle, each bar shows weekly sets,
with shaded background bands for 10 (min) and 20 (max). Color: blue <10, green
10-20, orange 21-25, red >25.

`ProgressiveOverloadCard.tsx` - shows last vs previous max weight, trend arrow,
and the "+2.5kg" suggestion when plateau detected.

Wire these into the existing dashboard / profile page:
`app/[locale]/(app)/profile/page.tsx` or create a new route
`app/[locale]/(app)/analytics/page.tsx`.

## Part B-7: tests

Add unit tests for the three model functions using vitest (project uses vitest;
confirm in package.json devDependencies). Place in:
`src/features/workout-analytics/model/__tests__/`.

Test cases:
- calculateACWR: flat load -> ratio ~1.0 green; spike to 2x -> red; <14 days data
  -> insufficient-data; lbs input handled.
- getWeeklyMuscleVolume: 12 chest sets this week -> optimal; 26 -> overreach;
  muscle trained once 4 weeks ago but not this week -> undertrained + 0 this week.
- getProgression: weights [50,50,50,50] -> plateau + +2.5kg; [40,45,50,55] ->
  increasing; only 2 sessions -> insufficient-data.

---

## Part C: Acceptance checklist

1. `make dev` starts the app; registering a user works.
2. `UPDATE "user" SET "isPremium" = true;` makes all stats pages load.
3. Recording a few workouts (with weight + reps) populates WorkoutSet.
4. `GET /api/statistics/acwr` (or the action) returns a ratio after ~14 days of data.
5. ACWRGauge renders the correct color for a known ratio.
6. MuscleVolumeBars shows "Chest: 12 sets (optimal)" for seeded data.
7. ProgressiveOverloadCard suggests +2.5kg after 4 identical-weight sessions.
8. All model unit tests pass: `pnpm test src/features/workout-analytics`.

---

## Part D: Assumptions & defaults chosen

- **Volume definition**: weight*reps for weighted, reps for bodyweight, seconds for time.
  Matches the existing `volume/route.ts` convention exactly.
- **Weight unit**: convert all to kg internally before math. Display can convert back.
- **RIR**: not recorded. Assume completed sets are in the RIR 1-3 range (valid for
  most recreational lifters). No RIR input UI.
- **Optimal volume band**: 10-20 sets/muscle/week (Schoenfeld). Hardcoded as constants.
- **ACWR thresholds**: 0.8-1.3 green, 1.3-1.5 yellow, >1.5 red (Gabbett).
- **Progressive overload step**: 2.5kg suggestion (conservative; user overrides).
- **No new Prisma migration**: all queries read existing tables. No schema changes.
- **No changes to existing statistics feature**: new module is additive.
- **Premium gate**: removed via SQL for personal use, not via code edits (keeps
  upgrade-merge path clean if you ever pull upstream).
