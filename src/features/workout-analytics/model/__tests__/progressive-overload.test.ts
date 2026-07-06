import { describe, expect, it } from "vitest";

import { getProgression } from "../progressive-overload";
import { SetEntry } from "../types";

const DAY = 86_400_000;

function sessions(weights: number[]): SetEntry[] {
  const now = Date.now();
  return weights.map((w, i) => ({
    date: new Date(now - (weights.length - 1 - i) * 7 * DAY),
    muscle: "CHEST" as any,
    exerciseId: "bench",
    setIndex: 0,
    weightKg: w,
    reps: 5,
    durationSec: 0,
  }));
}

describe("getProgression", () => {
  it("plateau over 4 identical sessions -> suggests +2.5kg", () => {
    const res = getProgression({ sets: sessions([50, 50, 50, 50]), exerciseId: "bench" });
    expect(res.trend).toBe("plateau");
    expect(res.suggestedIncrementKg).toBe(2.5);
  });

  it("increasing weights -> increasing", () => {
    const res = getProgression({ sets: sessions([40, 45, 50, 55]), exerciseId: "bench" });
    expect(res.trend).toBe("increasing");
    expect(res.suggestedIncrementKg).toBeNull();
  });

  it("only 2 sessions -> insufficient-data", () => {
    const res = getProgression({ sets: sessions([40, 45]), exerciseId: "bench" });
    expect(res.trend).toBe("insufficient-data");
  });
});
