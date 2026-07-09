import { describe, expect, it } from "vitest";

import { ExerciseAttributeValueEnum } from "@prisma/client";

import {
  QUICK_CANDIDATE_COUNT,
  recommendQuickSession,
  isOfficeFriendly,
  type QuickTimeBudget,
} from "../quick-session";

const PUSH_MUSCLES = [
  ExerciseAttributeValueEnum.CHEST,
  ExerciseAttributeValueEnum.SHOULDERS,
  ExerciseAttributeValueEnum.TRICEPS,
];

describe("recommendQuickSession", () => {
  describe("time-budget mapping", () => {
    it("targets ~4 exercises for 5 min", () => {
      const r = recommendQuickSession({ timeBudgetMin: 5, plannedMusclesToday: [], recentQuickMusclesToday: [] });
      expect(r.totalExercises).toBe(4);
      expect(r.setScheme.setsPerExercise).toBe(1);
      expect(r.setScheme.holdSeconds).toBe(40);
    });

    it("targets ~7 exercises for 10 min", () => {
      const r = recommendQuickSession({ timeBudgetMin: 10, plannedMusclesToday: [], recentQuickMusclesToday: [] });
      expect(r.totalExercises).toBe(7);
      expect(r.setScheme.setsPerExercise).toBe(2);
      expect(r.setScheme.holdSeconds).toBeNull();
    });

    it("targets ~9 exercises for 15 min", () => {
      const r = recommendQuickSession({ timeBudgetMin: 15, plannedMusclesToday: [], recentQuickMusclesToday: [] });
      expect(r.totalExercises).toBe(9);
      expect(r.setScheme.setsPerExercise).toBe(2);
    });
  });

  describe("avoidance", () => {
    it("avoids muscles scheduled in today's plan (push day)", () => {
      const r = recommendQuickSession({
        timeBudgetMin: 10,
        plannedMusclesToday: PUSH_MUSCLES,
        recentQuickMusclesToday: [],
      });
      const used = r.muscles.map((m) => m.muscle);
      for (const planned of PUSH_MUSCLES) {
        expect(used).not.toContain(planned);
      }
    });

    it("avoids muscles hit by an earlier quick session today", () => {
      const earlier = [ExerciseAttributeValueEnum.ABDOMINALS, ExerciseAttributeValueEnum.OBLIQUES];
      const r = recommendQuickSession({
        timeBudgetMin: 10,
        plannedMusclesToday: [],
        recentQuickMusclesToday: earlier,
      });
      const used = r.muscles.map((m) => m.muscle);
      for (const done of earlier) {
        expect(used).not.toContain(done);
      }
    });
  });

  describe("fallbacks", () => {
    it("generates a full-body recovery loop on a rest day", () => {
      const r = recommendQuickSession({ timeBudgetMin: 10, plannedMusclesToday: [], recentQuickMusclesToday: [] });
      // With 12 candidates and a 7-exercise budget, at most 7 distinct muscles.
      expect(r.muscles.length).toBeLessThanOrEqual(7);
      expect(r.totalExercises).toBe(7);
      expect(r.reason).toContain("Recovery loop");
    });

    it("caps each muscle at one exercise when every candidate is in today's plan", () => {
      // Every candidate muscle is planned -> "all occupied" branch.
      const allPlanned = [
        ExerciseAttributeValueEnum.SHOULDERS,
        ExerciseAttributeValueEnum.CHEST,
        ExerciseAttributeValueEnum.BACK,
        ExerciseAttributeValueEnum.LATS,
        ExerciseAttributeValueEnum.ABDOMINALS,
        ExerciseAttributeValueEnum.OBLIQUES,
        ExerciseAttributeValueEnum.QUADRICEPS,
        ExerciseAttributeValueEnum.GLUTES,
        ExerciseAttributeValueEnum.HAMSTRINGS,
        ExerciseAttributeValueEnum.CALVES,
        ExerciseAttributeValueEnum.TRICEPS,
        ExerciseAttributeValueEnum.BICEPS,
      ];
      const r = recommendQuickSession({
        timeBudgetMin: 15,
        plannedMusclesToday: allPlanned,
        recentQuickMusclesToday: [],
      });
      for (const alloc of r.muscles) {
        expect(alloc.exerciseCount).toBe(1);
      }
      expect(r.muscles.length).toBe(QUICK_CANDIDATE_COUNT);
      expect(r.reason).toContain("movement snack");
    });
  });

  describe("soft-coupling boundary (must never mutate plan)", () => {
    it("returns no split-order / progress fields", () => {
      const r = recommendQuickSession({ timeBudgetMin: 10, plannedMusclesToday: PUSH_MUSCLES, recentQuickMusclesToday: [] });
      // The result carries only advisory data; it has no handle that could move
      // the split forward or bump completed sessions.
      expect(r).not.toHaveProperty("recommendedDay");
      expect(r).not.toHaveProperty("currentDay");
      expect(r).not.toHaveProperty("completedSessions");
    });
  });
});

describe("isOfficeFriendly", () => {
  it("accepts whitelisted desk-friendly exercises", () => {
    expect(isOfficeFriendly("ankle-circles")).toBe(true);
    expect(isOfficeFriendly("seated-leg-raise")).toBe(true);
    expect(isOfficeFriendly("45-side-bend")).toBe(true);
    expect(isOfficeFriendly("dead-bug")).toBe(false);
    expect(isOfficeFriendly("flutter-kicks")).toBe(false);
    expect(isOfficeFriendly("glute-bridge-march")).toBe(false);
  });

  it("rejects everything not in the whitelist", () => {
    expect(isOfficeFriendly("elevator")).toBe(false);
    expect(isOfficeFriendly("chin-up")).toBe(false);
    expect(isOfficeFriendly("front-lever")).toBe(false);
    expect(isOfficeFriendly("push-up")).toBe(false);
    expect(isOfficeFriendly("burpee")).toBe(false);
    expect(isOfficeFriendly("handstand")).toBe(false);
  });
});
