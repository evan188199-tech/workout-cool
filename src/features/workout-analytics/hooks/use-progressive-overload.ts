"use client";

import { useQuery } from "@tanstack/react-query";

import { getProgressiveOverloadAction } from "../actions/get-progressive-overload.action";
import type { ProgressionResult } from "../model/types";

export function useProgressiveOverload(exerciseId: string | null, tzOffsetMinutes = 0) {
  return useQuery<ProgressionResult>({
    queryKey: ["workout-analytics", "progression", exerciseId, tzOffsetMinutes],
    queryFn: async () => {
      if (!exerciseId) throw new Error("exerciseId required");
      const res = await getProgressiveOverloadAction({ exerciseId, tzOffsetMinutes });
      if (res?.serverError) throw new Error(res.serverError);
      if (!res?.data) throw new Error("No progression data returned");
      return res.data;
    },
    enabled: !!exerciseId,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}
