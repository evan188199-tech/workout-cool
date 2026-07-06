import { ExerciseAttributeValueEnum } from "@prisma/client";

// A single completed set, flattened from WorkoutSet + its session date.
// This is the ONLY shape the model functions accept (keeps the math pure & testable).
export interface SetEntry {
  date: Date; // absolute UTC instant (session.startedAt); tz handled inside model
  muscle: ExerciseAttributeValueEnum; // exercise PRIMARY_MUSCLE
  exerciseId: string;
  setIndex: number;
  weightKg: number; // already converted to kg
  reps: number;
  durationSec: number; // 0 if not time-based
}

// ---- ACWR (strength-only) ----
export type LoadModel = "rolling" | "ewma";

export interface ACWRInput {
  sets: SetEntry[];
  asOf?: Date; // default now
  acuteDays?: number; // default 7
  chronicDays?: number; // default 28
  model?: LoadModel; // default "rolling"
  ewmaLambda?: number; // default 2/(chronicDays+1)
  tzOffsetMinutes?: number; // FIX #2: user UTC offset in minutes; 0 = treat as UTC
}

export type RiskZone = "green" | "yellow" | "red" | "undertrained" | "insufficient-data";

export interface ACWRResult {
  ratio: number | null; // null when insufficient data
  acuteLoad: number; // last 7d STRENGTH volume (kg*reps); cardio excluded (FIX #1)
  chronicLoad: number;
  zone: RiskZone;
  message: string;
  note: string; // documents what was counted
}

// ---- Muscle volume (set counts; all exercise types valid) ----
export interface WeeklyMuscleVolume {
  muscle: ExerciseAttributeValueEnum;
  muscleLabel: string;
  weeklySets: number; // completed sets this week (Mon-Sun, user local tz)
  fourWeekAvgSets: number;
  status: "undertrained" | "optimal" | "high" | "overreach";
}

export interface MuscleVolumeInput {
  sets: SetEntry[];
  asOf?: Date;
  tzOffsetMinutes?: number;
}

// ---- Progressive overload ----
export interface ProgressionInput {
  sets: SetEntry[]; // for a SINGLE exercise
  exerciseId: string;
  tzOffsetMinutes?: number;
}

export interface ProgressionResult {
  exerciseId: string;
  lastMaxWeight: number;
  previousMaxWeight: number;
  trend: "increasing" | "plateau" | "decreasing" | "insufficient-data";
  suggestedIncrementKg: number | null;
  message: string;
}
