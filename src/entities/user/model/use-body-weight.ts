"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchBodyWeight(): Promise<{ weight: number; unit: "kg" | "lbs" }> {
  const res = await fetch("/api/user/preferences", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch preferences");
  const data = await res.json();
  const prefs = data?.preferences ?? {};
  const weight = typeof prefs.bodyWeight === "number" ? prefs.bodyWeight : 0;
  const unit = prefs.bodyWeightUnit === "lbs" ? "lbs" : "kg";
  return { weight, unit };
}

/** Reads the user's body weight from onboardingPreferences. Defaults to 0 / kg. */
export function useBodyWeight() {
  return useQuery({
    queryKey: ["user-body-weight"],
    queryFn: fetchBodyWeight,
    staleTime: 5 * 60 * 1000,
  });
}
