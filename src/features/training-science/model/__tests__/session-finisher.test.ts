import { describe, expect, it } from "vitest";

import { getFinishersForIntent } from "../session-finisher";

describe("getFinishersForIntent", () => {
  it("returns a cardio finisher for lose_fat", () => {
    const finishers = getFinishersForIntent("lose_fat", 0);
    expect(finishers.length).toBeGreaterThan(0);

    const cardio = finishers.find((f) => f.type === "cardio");
    expect(cardio).toBeDefined();
    expect(cardio!.durationMin).toBeGreaterThan(0);
    expect(cardio!.title.length).toBeGreaterThan(0);
    expect(cardio!.rationale.length).toBeGreaterThan(0);
  });

  it("returns empty array for non-fat-loss intents", () => {
    expect(getFinishersForIntent("build_strength")).toEqual([]);
    expect(getFinishersForIntent("build_muscle")).toEqual([]);
    expect(getFinishersForIntent("general_fitness")).toEqual([]);
  });

  it("returns an array (extensible for future finishers)", () => {
    const finishers = getFinishersForIntent("lose_fat", 0);
    expect(Array.isArray(finishers)).toBe(true);
  });
});

describe("getFinishersForIntent — fat-loss finishers", () => {
  it("always includes both a cardio and a nutrition finisher", () => {
    const finishers = getFinishersForIntent("lose_fat", 0);
    expect(finishers.some((f) => f.type === "cardio")).toBe(true);
    expect(finishers.some((f) => f.type === "nutrition")).toBe(true);
  });

  it("rotates the cardio option across session indices", () => {
    const first = getFinishersForIntent("lose_fat", 0).find((f) => f.type === "cardio")!;
    const second = getFinishersForIntent("lose_fat", 1).find((f) => f.type === "cardio")!;

    expect(first.title).not.toBe(second.title);
  });

  it("wraps back to the first option after exhausting the rotation", () => {
    const first = getFinishersForIntent("lose_fat", 0).find((f) => f.type === "cardio")!.title;
    // The pool is small (4), so index 4 should equal index 0.
    const wrapped = getFinishersForIntent("lose_fat", 4).find((f) => f.type === "cardio")!.title;
    expect(wrapped).toBe(first);
  });

  it("defaults sessionIndex to 0", () => {
    const explicit = getFinishersForIntent("lose_fat", 0);
    const defaulted = getFinishersForIntent("lose_fat");
    expect(defaulted).toEqual(explicit);
  });
});
