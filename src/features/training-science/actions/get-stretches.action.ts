"use server";

import { z } from "zod";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";

import { prisma } from "@/shared/lib/prisma";
import { actionClient } from "@/shared/api/safe-actions";
import { recommendStretchSlugs, type StretchPhase } from "@/features/training-science/model/stretch-routine";

const getStretchesSchema = z.object({
  muscles: z.array(z.nativeEnum(ExerciseAttributeValueEnum)).min(1),
  phase: z.enum(["warmup", "cooldown"]),
  count: z.number().int().min(1).max(4).optional(),
  warmupReps: z.number().int().min(6).max(15).optional(),
  cooldownHoldSeconds: z.number().int().min(20).max(40).optional(),
});

/**
 * Fetch stretch exercises for a warm-up or cool-down routine.
 *
 * Uses the curated slug pool from `stretch-routine.ts` to decide *which*
 * stretches to show, then loads their full details (video, image, instructions)
 * from the database. Falls back gracefully when a slug is not found.
 */
export const getStretchesAction = actionClient.schema(getStretchesSchema).action(async ({ parsedInput }) => {
  const { muscles, phase } = parsedInput;

    const slugs = recommendStretchSlugs(muscles, phase as StretchPhase, {
      count: parsedInput.count,
      warmupReps: parsedInput.warmupReps,
      cooldownHoldSeconds: parsedInput.cooldownHoldSeconds,
    });
  if (slugs.length === 0) return [];

  try {
    const exercises = await prisma.exercise.findMany({
      where: {
        slug: { in: slugs },
      },
      include: {
        attributes: {
          include: {
            attributeName: true,
            attributeValue: true,
          },
        },
      },
    });

    // Preserve the recommendation order (slugs array defines priority).
    const bySlug = new Map(exercises.map((e) => [e.slug, e]));
    const ordered = slugs
      .map((slug) => bySlug.get(slug))
      .filter((e) => e !== undefined);

    return ordered as ExerciseWithAttributes[];
  } catch (error) {
    console.error("Error fetching stretches:", error);
    return [];
  }
});
