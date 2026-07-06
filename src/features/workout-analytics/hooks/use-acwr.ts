"use client";

import { useQuery } from "@tanstack/react-query";

import { getACWRDataAction } from "../actions/get-acwr-data.action";
import type { ACWRResult } from "../model/types";

// tzOffsetMinutes: the user's UTC offset in minutes. Pass -new Date().getTimezoneOffset().
export function useACWR(tzOffsetMinutes = 0) {
  return useQuery<ACWRResult>({
    queryKey: ["workout-analytics", "acwr", tzOffsetMinutes],
    queryFn: async () => {
      const res = await getACWRDataAction({ tzOffsetMinutes });
      if (res?.serverError) throw new Error(res.serverError);
      if (!res?.data) throw new Error("No ACWR data returned");
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 2 * 60 * 60 * 1000,
  });
}
