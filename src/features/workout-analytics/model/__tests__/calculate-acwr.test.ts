import { describe, expect, it } from "vitest";

import { calculateACWR } from "../calculate-acwr";
import { SetEntry } from "../types";
import { ExerciseAttributeValueEnum } from "@prisma/client";

const DAY = 86_400_000;

// Build N weeks of flat strength training: 1 session/day, 3 sets of 100kg x 10.
function flatStrength(weeks: number, asOf: Date): SetEntry[] {
  const sets: SetEntry[] = [];
  const base = asOf.getTime();
  for (let d = 0; d < weeks * 7; d++) {
    for (let i = 0; i < 3; i++) {
      sets.push({
        date: new Date(base - d * DAY),
        muscle: ExerciseAttributeValueEnum.CHEST,
        exerciseId: "x",
        setIndex: i,
        weightKg: 100,
        reps: 10,
        durationSec: 0,
      });
    }
  }
  return sets;
}

describe("calculateACWR", () => {
  it("flat load -> ratio ~1.0 green", () => {
    const asOf = new Date("2025-01-30T00:00:00Z");
    const res = calculateACWR({ sets: flatStrength(5, asOf), asOf });
    expect(res.ratio).not.toBeNull();
 expect(res.ratio).toBeGreaterThan(0.9);
    expect(res.ratio).toBeLessThan(1.1);
    expect(res.zone).toBe("green");
  });

  it("FIX #1: cardio spike must NOT trigger red (strength-only volume)", () => {
    const asOf = new Date("2025-01-30T00:00:00Z");
    const sets = flatStrength(5, asOf);
    // Add a huge cardio day this week: 3600s of running would have spiked old formula.
    sets.push({
      date: new Date(asOf.getTime() - 1 * DAY),
      muscle: ExerciseAttributeValueEnum.FULL_BODY,
      exerciseId: "run",
      setIndex: 0,
      weightKg: 0, // no weight => excluded from ACWR
      reps: 0,
      durationSec: 3600,
    });
   const res = calculateACWR({ sets, asOf });
   // Ratio stays ~1.0 green, NOT red. Cardio is ignored.
   expect(res.zone).not.toBe("red");
    // Cardio (3600s) excluded from strength volume: acuteLoad unchanged from
    // the pure-strength baseline. Strength-only acute = 7d * 3 sets * 100kg * 10.
    expect(res.acuteLoad).toBe(21000);
  });

  it("FIX #3: EWMA cold start handles a rest day at window start", () => {
    const asOf = new Date("2025-01-30T00:00:00Z");
    const sets = flatStrength(5, asOf);
    // Remove all training on the very first day of the chronic window (28d ago).
    const chronicStart = new Date(asOf.getTime() - 28 * DAY);
    const filtered = sets.filter(
      (s) => Math.abs(s.date.getTime() - chronicStart.getTime()) > DAY / 2,
    );
    // Should still compute (not NaN / not wildly negative); rolling baseline stable.
    const res = calculateACWR({ sets: filtered, asOf, model: "ewma" });
    expect(Number.isFinite(res.chronicLoad)).toBe(true);
    expect(res.chronicLoad).toBeGreaterThan(0);
  });

  it("insufficient history -> insufficient-data", () => {
    const asOf = new Date("2025-01-30T00:00:00Z");
    const res = calculateACWR({ sets: flatStrength(1, asOf), asOf }); // only 7d
    expect(res.zone).toBe("insufficient-data");
    expect(res.ratio).toBeNull();
  });
});
