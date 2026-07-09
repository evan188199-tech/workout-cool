"use server";

import { z } from "zod";

import { authenticatedActionClient } from "@/shared/api/safe-actions";

import { loadUserSetEntries } from "./load-set-entries";
import { calculateACWR } from "../model/calculate-acwr";

const schema = z.object({
  model: z.enum(["rolling", "ewma"]).optional(),
  tzOffsetMinutes: z.number().int().default(0), // FIX #2: client passes -getTimezoneOffset()
});

// IMPORTANT: use authenticatedActionClient (not actionClient) — only it injects
// ctx.user. The base actionClient passes no ctx.
export const getACWRDataAction = authenticatedActionClient
  .schema(schema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.user.id;

    // 60d window gives headroom over the 28d chronic baseline.
    const sets = await loadUserSetEntries(userId, 60);

    return calculateACWR({
      sets,
      asOf: new Date(),
      model: parsedInput.model,
      tzOffsetMinutes: parsedInput.tzOffsetMinutes,
    });
  });
