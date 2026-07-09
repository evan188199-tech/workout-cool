import { z } from "zod";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/shared/lib/prisma";
import { getMobileCompatibleSession } from "@/shared/api/mobile-auth";
import {
  normalizeWorkoutPreferences,
  type EquipmentMode,
  type WorkoutEnvironment,
} from "@/shared/lib/user-preferences";

const preferencesSchema = z.object({
  goals: z.array(z.string()),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  equipment: z.array(z.string()),
  muscles: z.array(z.string()),
  duration: z.number().nullable(),
  weeklyFrequency: z.number().min(1).max(7),
  notificationDays: z.array(z.number()).optional(),
  notificationTime: z.string().optional(),
});

// bodyWeight is optional and can be set independently of the rest.
const bodyWeightSchema = z.object({
  bodyWeight: z.number().min(1).max(500).optional(),
  bodyWeightUnit: z.enum(["kg", "lbs"]).optional(),
});

const preferenceShape = preferencesSchema.merge(
  z.object({
    equipmentMode: z.enum(["all", "bodyweight_only", "custom"]).optional(),
    availableEquipment: z.array(z.string()).optional(),
    workoutEnvironment: z.enum(["office", "unrestricted"]).optional(),
    quickTimeBudget: z.number().min(5).max(25).optional(),
    planSessionMinutes: z.number().min(20).max(50).optional(),
    restIntervalSeconds: z.number().min(15).max(60).optional(),
    warmupRoutineEnabled: z.boolean().optional(),
    warmupExerciseCount: z.number().min(1).max(4).optional(),
    warmupReps: z.number().min(6).max(15).optional(),
    cooldownRoutineEnabled: z.boolean().optional(),
    cooldownExerciseCount: z.number().min(1).max(4).optional(),
    cooldownHoldSeconds: z.number().min(20).max(40).optional(),
  }).merge(bodyWeightSchema),
);
const patchSchema = preferenceShape.partial();

export async function GET(req: NextRequest) {
  try {
    const session = await getMobileCompatibleSession(req);

    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingPreferences: true },
    });

    const rawPreferences = asRecord(user?.onboardingPreferences);
    const normalized = normalizeWorkoutPreferences(rawPreferences);
    const preferences = {
      ...rawPreferences,
      ...normalized,
    };
    return NextResponse.json({
      preferences,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getMobileCompatibleSession(req);

    if (!session?.user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.format() }, { status: 400 });
    }

    // bodyWeight is merged into onboardingPreferences without clobbering the rest.
    const { bodyWeight: _bw, bodyWeightUnit: _bwu, ...rest } = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingPreferences: true },
    });
    const prev = (existing?.onboardingPreferences as Record<string, unknown>) ?? {};
    const next: Record<string, unknown> = { ...prev, ...rest };
    if (parsed.data.bodyWeight !== undefined) next.bodyWeight = parsed.data.bodyWeight;
    if (parsed.data.bodyWeightUnit !== undefined) next.bodyWeightUnit = parsed.data.bodyWeightUnit;
    const normalized = normalizeWorkoutPreferences(next as Record<string, unknown>);
    const payload: Prisma.InputJsonValue = JSON.parse(
      JSON.stringify({
      ...next,
      equipmentMode: normalized.equipmentMode as EquipmentMode,
      availableEquipment: normalized.availableEquipment,
      workoutEnvironment: normalized.workoutEnvironment as WorkoutEnvironment,
      quickTimeBudget: normalized.prescription.quickTimeBudget,
      planSessionMinutes: normalized.prescription.planSessionMinutes,
      restIntervalSeconds: normalized.prescription.restIntervalSeconds,
      warmupRoutineEnabled: normalized.prescription.warmupRoutineEnabled,
      warmupExerciseCount: normalized.prescription.warmupExerciseCount,
      warmupReps: normalized.prescription.warmupReps,
      cooldownRoutineEnabled: normalized.prescription.cooldownRoutineEnabled,
      cooldownExerciseCount: normalized.prescription.cooldownExerciseCount,
      cooldownHoldSeconds: normalized.prescription.cooldownHoldSeconds,
    }),
    );

    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingPreferences: payload },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
