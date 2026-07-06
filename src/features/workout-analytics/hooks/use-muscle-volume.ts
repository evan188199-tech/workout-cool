"use client";

import { useQuery } from "@tanstack/react-query";

import { getMuscleVolumeAction } from "../actions/get-muscle-volume.action";
import type { WeeklyMuscleVolume } from "../model/types";

export function useMuscleVolume(tzOffsetMinutes = 0) {
  return useQuery<WeeklyMuscleVolume[]>({
    queryKey: ["workout-analytics", "muscle-volume", tzOffsetMinutes],
    queryFn: async () => {
      const res = await getMuscleVolumeAction({ tzOffsetMinutes });
      if (res?.serverError) throw new Error(res.serverError);
      return res?.data ?? [];
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}
