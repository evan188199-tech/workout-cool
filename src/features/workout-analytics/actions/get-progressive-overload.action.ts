"use server";

import { z } from "zod";

import { authenticatedActionClient } from "@/shared/api/safe-actions";

import { loadUserSetEntries } from "./load-set-entries";
import { getProgression } from "../model/progressive-overload";

const schema = z.object({
  exerciseId: z.string(),
  tzOffsetMinutes: z.number().int().default(0),
});

export const getProgressiveOverloadAction = authenticatedActionClient
  .schema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;

    // Single-exercise history over a wide window for trend detection.
    const sets = await loadUserSetEntries(userId, 180, parsedInput.exerciseId);

    return getProgression({
      sets,
      exerciseId: parsedInput.exerciseId,
      tzOffsetMinutes: parsedInput.tzOffsetMinutes,
    });
  });
