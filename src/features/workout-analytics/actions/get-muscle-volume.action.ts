"use server";

import { z } from "zod";

import { authenticatedActionClient } from "@/shared/api/safe-actions";

import { loadUserSetEntries } from "./load-set-entries";
import { getWeeklyMuscleVolume } from "../model/get-weekly-volume";

const schema = z.object({
  tzOffsetMinutes: z.number().int().default(0),
});

export const getMuscleVolumeAction = authenticatedActionClient
  .schema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;

    // 35d covers this week + a full 4-week rolling window.
    const sets = await loadUserSetEntries(userId, 35);

    return getWeeklyMuscleVolume({
      sets,
      asOf: new Date(),
      tzOffsetMinutes: parsedInput.tzOffsetMinutes,
    });
  });
