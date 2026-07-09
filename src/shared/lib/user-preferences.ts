import { ExerciseAttributeValueEnum } from "@prisma/client";

export type EquipmentMode = "all" | "bodyweight_only" | "custom";
export type WorkoutEnvironment = "office" | "unrestricted";
export type QuickTimeBudget = 5 | 10 | 15 | 20 | 25;
export type PlanTimeBudget = 20 | 30 | 40 | 50;
export type RestIntervalPreset = 5 | 10 | 15 | 20 | 25 | 30 | 40 | 45 | 50 | 60;

export interface WorkoutPrescriptionPreferences {
  quickTimeBudget: QuickTimeBudget;
  planSessionMinutes: PlanTimeBudget;
  restIntervalSeconds: RestIntervalPreset;
  warmupRoutineEnabled: boolean;
  warmupExerciseCount: number;
  warmupReps: number;
  cooldownRoutineEnabled: boolean;
  cooldownExerciseCount: number;
  cooldownHoldSeconds: number;
}

export interface ResolvedWorkoutPreferences {
  equipmentMode: EquipmentMode;
  availableEquipment: ExerciseAttributeValueEnum[];
  workoutEnvironment: WorkoutEnvironment;
  prescription: WorkoutPrescriptionPreferences;
}

const DEFAULT_WORKOUT_PREFERENCES: ResolvedWorkoutPreferences = {
  equipmentMode: "all",
  availableEquipment: [],
  workoutEnvironment: "office",
  prescription: {
    quickTimeBudget: 10,
    planSessionMinutes: 30,
    restIntervalSeconds: 30,
    warmupRoutineEnabled: true,
    warmupExerciseCount: 3,
    warmupReps: 10,
    cooldownRoutineEnabled: true,
    cooldownExerciseCount: 2,
    cooldownHoldSeconds: 30,
  },
};

const BODYWEIGHT_ONLY_VALUES: ReadonlySet<ExerciseAttributeValueEnum> = new Set([
  ExerciseAttributeValueEnum.BODY_ONLY,
]);
const QUICK_TIME_BUDGETS: ReadonlySet<number> = new Set([5, 10, 15, 20, 25]);
const PLAN_TIME_BUDGETS: ReadonlySet<number> = new Set([20, 30, 40, 50]);
const REST_PRESETS: ReadonlySet<number> = new Set([5, 10, 15, 20, 25, 30, 40, 45, 50, 60]);
const WARMUP_EXERCISE_COUNTS: ReadonlySet<number> = new Set([1, 2, 3, 4]);
const COOLDOWN_EXERCISE_COUNTS: ReadonlySet<number> = new Set([1, 2, 3, 4]);
const WARMUP_REPS: ReadonlySet<number> = new Set([6, 8, 10, 12, 14, 15]);
const COOLDOWN_HOLDS: ReadonlySet<number> = new Set([20, 25, 30, 35, 40]);

function asUnknownRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normalizeNumber(
  value: unknown,
  allowed: ReadonlySet<number>,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return allowed.has(value) ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parseEquipmentMode(value: unknown): EquipmentMode | null {
  if (value === "bodyweight_only") return "bodyweight_only";
  if (value === "custom") return "custom";
  if (value === "all") return "all";
  return null;
}

function parseWorkoutEnvironment(value: unknown): WorkoutEnvironment | null {
  if (value === "office") return "office";
  if (value === "unrestricted" || value === "home" || value === "gym") return "unrestricted";
  return null;
}

function toValidEquipmentValues(values: unknown): ExerciseAttributeValueEnum[] {
  const allValues = new Set<string>(Object.values(ExerciseAttributeValueEnum) as string[]);
  return asStringArray(values).filter((value) => allValues.has(value)) as ExerciseAttributeValueEnum[];
}

function dedupe(values: ExerciseAttributeValueEnum[]): ExerciseAttributeValueEnum[] {
  const unique = new Set(values);
  return Array.from(unique);
}

export function normalizeWorkoutPreferences(raw: unknown): ResolvedWorkoutPreferences {
  const prefs = asUnknownRecord(raw);
  const legacyEquipment = toValidEquipmentValues(prefs.equipment);
  const configuredEquipment = toValidEquipmentValues(prefs.availableEquipment);
  const resolvedMode = parseEquipmentMode(prefs.equipmentMode) ?? inferEquipmentMode(legacyEquipment, configuredEquipment);

  const environment =
    parseWorkoutEnvironment(prefs.workoutEnvironment) ??
    (asStringArray(prefs.environment).includes("unrestricted")
      ? "unrestricted"
      : DEFAULT_WORKOUT_PREFERENCES.workoutEnvironment);

  const available = configuredEquipment.length > 0 ? configuredEquipment : legacyEquipment;
  const prescription: WorkoutPrescriptionPreferences = {
    quickTimeBudget: normalizeNumber(
      prefs.quickTimeBudget,
      QUICK_TIME_BUDGETS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.quickTimeBudget,
    ) as QuickTimeBudget,
    planSessionMinutes: normalizeNumber(
      prefs.planSessionMinutes,
      PLAN_TIME_BUDGETS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.planSessionMinutes,
    ) as PlanTimeBudget,
    restIntervalSeconds: normalizeNumber(
      prefs.restIntervalSeconds,
      REST_PRESETS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.restIntervalSeconds,
    ) as RestIntervalPreset,
    warmupRoutineEnabled: normalizeBoolean(prefs.warmupRoutineEnabled, true),
    warmupExerciseCount: normalizeNumber(
      prefs.warmupExerciseCount,
      WARMUP_EXERCISE_COUNTS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.warmupExerciseCount,
    ),
    warmupReps: normalizeNumber(
      prefs.warmupReps,
      WARMUP_REPS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.warmupReps,
    ),
    cooldownRoutineEnabled: normalizeBoolean(prefs.cooldownRoutineEnabled, true),
    cooldownExerciseCount: normalizeNumber(
      prefs.cooldownExerciseCount,
      COOLDOWN_EXERCISE_COUNTS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.cooldownExerciseCount,
    ),
    cooldownHoldSeconds: normalizeNumber(
      prefs.cooldownHoldSeconds,
      COOLDOWN_HOLDS,
      DEFAULT_WORKOUT_PREFERENCES.prescription.cooldownHoldSeconds,
    ),
  };

  return {
    equipmentMode: resolvedMode,
    availableEquipment: dedupe(available),
    workoutEnvironment: environment,
    prescription,
  };
}

function inferEquipmentMode(
  legacyEquipment: ExerciseAttributeValueEnum[],
  configuredEquipment: ExerciseAttributeValueEnum[],
): EquipmentMode {
  if (configuredEquipment.length > 0) return "custom";
  if (legacyEquipment.length === 0) return DEFAULT_WORKOUT_PREFERENCES.equipmentMode;
  if (legacyEquipment.every((item) => BODYWEIGHT_ONLY_VALUES.has(item))) return "bodyweight_only";
  return "custom";
}

export function resolveAllowedEquipment(
  selectedEquipment: ExerciseAttributeValueEnum[],
  preferences: ResolvedWorkoutPreferences,
): ExerciseAttributeValueEnum[] {
  const requested = selectedEquipment.length > 0
    ? selectedEquipment
    : preferences.availableEquipment;

  const normalized = dedupe(requested);

  if (preferences.equipmentMode === "bodyweight_only") {
    return [ExerciseAttributeValueEnum.BODY_ONLY];
  }

  if (preferences.equipmentMode === "custom") {
    if (normalized.length > 0) return normalized;
    return normalized;
  }

  return normalized;
}

export function shouldUseOfficeFilters(preferences: ResolvedWorkoutPreferences): boolean {
  return preferences.workoutEnvironment === "office";
}
