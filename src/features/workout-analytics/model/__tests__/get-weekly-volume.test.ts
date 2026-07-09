import { describe, expect, it } from "vitest";

import { ExerciseAttributeValueEnum } from "@prisma/client";

import { getWeeklyMuscleVolume } from "../get-weekly-volume";
import { SetEntry } from "../types";

const DAY = 86_400_000;

function chestSets(count: number, daysAgo: number): SetEntry[] {
  const out: SetEntry[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      date: new Date(Date.now() - daysAgo * DAY),
      muscle: ExerciseAttributeValueEnum.CHEST,
      exerciseId: "bench",
      setIndex: i,
      weightKg: 60,
      reps: 8,
      durationSec: 0,
    });
  }
  return out;
}

describe("getWeeklyMuscleVolume", () => {
 it("12 sets this week -> optimal", () => {
    const res = getWeeklyMuscleVolume({ sets: chestSets(12, 0) });
    const chest = res.find((m) => m.muscleLabel === "胸");
    expect(chest).toBeDefined();
    expect(chest!.weeklySets).toBe(12);
    expect(chest!.status).toBe("optimal");
  });

 it("26 sets this week -> overreach", () => {
    const res = getWeeklyMuscleVolume({ sets: chestSets(26, 0) });
    const chest = res.find((m) => m.muscleLabel === "胸");
    expect(chest!.status).toBe("overreach");
  });

  it("only trained 4 weeks ago -> undertrained this week (0 sets)", () => {
    const res = getWeeklyMuscleVolume({ sets: chestSets(10, 27) });
    const chest = res.find((m) => m.muscleLabel === "胸");
    expect(chest).toBeDefined();
    expect(chest!.weeklySets).toBe(0);
    expect(chest!.status).toBe("undertrained");
  });

  it("FIX #2: timezone offset keeps Monday session in correct week", () => {
    // 2025-01-06 is a Monday. A session at 00:30 UTC+8 = 2025-01-05 16:30 UTC.
    // With offset 0 (UTC) it lands in the previous week; with +480 it's "this week".
    const asOf = new Date("2025-01-06T08:00:00+08:00"); // Monday 8am CST
    const sessionUTC = new Date("2025-01-06T00:30:00+08:00"); // Mon 00:30 CST
    const sets: SetEntry[] = [
      { date: sessionUTC, muscle: ExerciseAttributeValueEnum.CHEST, exerciseId: "x", setIndex: 0, weightKg: 60, reps: 8, durationSec: 0 },
    ];
    const res = getWeeklyMuscleVolume({ sets, asOf, tzOffsetMinutes: 480 });
    expect(res[0].weeklySets).toBe(1); // counted in the CST week
  });
});
