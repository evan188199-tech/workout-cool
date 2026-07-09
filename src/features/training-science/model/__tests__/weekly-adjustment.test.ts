import { describe, expect, it } from "vitest";

import {
  recommendWeeklyAdjustment,
  noDataResult,
  type WeeklyAdjustmentInput,
} from "../weekly-adjustment";

function baseInput(overrides: Partial<WeeklyAdjustmentInput> = {}): WeeklyAdjustmentInput {
  return {
    currentDaysPerWeek: 3,
    acwrZone: "green",
    acwrRatio: 1.0,
    plannedSessionsThisWeek: 3,
    extraSessionsThisWeek: 0,
    dataConfident: true,
    weeksAtCurrentFrequency: 2,
    consecutiveMissWeeks: 0,
    ...overrides,
  };
}

describe("recommendWeeklyAdjustment", () => {
  describe("insufficient data", () => {
    it("returns no_data when dataConfident is false", () => {
      const r = recommendWeeklyAdjustment(baseInput({ dataConfident: false }));
      expect(r.action).toBe("maintain");
      expect(r.applyable).toBe(true);
    });

    it("returns maintain when ACWR zone is insufficient-data", () => {
      const r = recommendWeeklyAdjustment(baseInput({ acwrZone: "insufficient-data", acwrRatio: null }));
      expect(r.action).toBe("maintain");
    });
  });

  describe("ACWR red zone — extra sessions caused a spike", () => {
    it("forces deload (0.7 volume) and holds frequency", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "red",
          acwrRatio: 1.7,
          extraSessionsThisWeek: 4, // user did a lot of quick sessions
          plannedSessionsThisWeek: 3,
        }),
      );
      expect(r.action).toBe("deload");
      expect(r.volumeFactor).toBe(0.7);
      expect(r.newDaysPerWeek).toBe(3);
    });
  });

  describe("ACWR yellow zone", () => {
    it("triggers soft deload (0.85 volume)", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({ acwrZone: "yellow", acwrRatio: 1.4 }),
      );
      expect(r.action).toBe("reduce_volume");
      expect(r.volumeFactor).toBe(0.85);
    });
  });

  describe("green zone — adherence-based", () => {
    it("suggests frequency increase after 2 full-adherence weeks", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "green",
          acwrRatio: 1.05,
          plannedSessionsThisWeek: 3,
          weeksAtCurrentFrequency: 2,
        }),
      );
      expect(r.action).toBe("increase_frequency");
      expect(r.newDaysPerWeek).toBe(4);
    });

    it("does not exceed max frequency (5)", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          currentDaysPerWeek: 5,
          plannedSessionsThisWeek: 5,
          weeksAtCurrentFrequency: 4,
        }),
      );
      expect(r.action).toBe("maintain");
      expect(r.newDaysPerWeek).toBe(5);
    });

    it("holds frequency when adherence just started (1 week)", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          plannedSessionsThisWeek: 3,
          weeksAtCurrentFrequency: 1,
        }),
      );
      expect(r.action).toBe("maintain");
    });

    it("holds frequency when planned days were missed", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          plannedSessionsThisWeek: 2,
          currentDaysPerWeek: 3,
          weeksAtCurrentFrequency: 3,
        }),
      );
      expect(r.action).toBe("maintain");
      expect(r.newDaysPerWeek).toBe(3);
    });
  });

  describe("undertrained zone — missed days", () => {
    it("reduces frequency after 2 chronic miss-weeks", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "undertrained",
          acwrRatio: 0.6,
          plannedSessionsThisWeek: 1,
          consecutiveMissWeeks: 2,
          currentDaysPerWeek: 4,
        }),
      );
      expect(r.action).toBe("reduce_frequency");
      expect(r.newDaysPerWeek).toBe(3);
    });

    it("does not go below min frequency (2)", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "undertrained",
          acwrRatio: 0.6,
          plannedSessionsThisWeek: 0,
          consecutiveMissWeeks: 4,
          currentDaysPerWeek: 2,
        }),
      );
      expect(r.newDaysPerWeek).toBe(2);
    });

    it("just maintains when undertrained but not chronically missing", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "undertrained",
          acwrRatio: 0.7,
          consecutiveMissWeeks: 1,
        }),
      );
      expect(r.action).toBe("maintain");
    });
  });

  describe("quick-session interaction (the core ask)", () => {
    it("green + extra sessions + full adherence → still eligible for increase", () => {
      // User did all planned days PLUS 3 office sessions, but ACWR is green
      // (body handled the load well). Frequency can still go up.
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "green",
          acwrRatio: 1.1,
          plannedSessionsThisWeek: 3,
          extraSessionsThisWeek: 3,
          weeksAtCurrentFrequency: 2,
        }),
      );
      expect(r.action).toBe("increase_frequency");
    });

    it("green + extra sessions but missed planned days → maintain (scheduling mismatch)", () => {
      const r = recommendWeeklyAdjustment(
        baseInput({
          acwrZone: "green",
          plannedSessionsThisWeek: 2,
          extraSessionsThisWeek: 2,
          currentDaysPerWeek: 3,
        }),
      );
      expect(r.action).toBe("maintain");
    });
  });

  describe("safety: never mutates fields outside the result", () => {
    it("returns only advisory data, no direct plan mutation handle", () => {
      const r = recommendWeeklyAdjustment(baseInput());
      expect(r).not.toHaveProperty("id");
      expect(r).not.toHaveProperty("currentDay");
      expect(r).not.toHaveProperty("completedSessions");
    });
  });
});

describe("noDataResult", () => {
  it("produces a non-applyable maintain", () => {
    const r = noDataResult(3);
    expect(r.action).toBe("no_data");
    expect(r.applyable).toBe(false);
    expect(r.newDaysPerWeek).toBe(3);
  });
});
