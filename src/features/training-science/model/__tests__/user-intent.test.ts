import { describe, expect, it } from "vitest";

import { intentToTrainingGoal, migrateLegacyGoal, intentHasFinisher } from "../user-intent";

describe("intentToTrainingGoal", () => {
  it("maps build_strength to strength", () => {
    expect(intentToTrainingGoal("build_strength")).toBe("strength");
  });

  it("maps build_muscle to hypertrophy", () => {
    expect(intentToTrainingGoal("build_muscle")).toBe("hypertrophy");
  });

  it("maps improve_endurance to endurance", () => {
    expect(intentToTrainingGoal("improve_endurance")).toBe("endurance");
  });

  it("maps lose_fat to general (not a separate lifting style)", () => {
    expect(intentToTrainingGoal("lose_fat")).toBe("general");
  });

  it("maps general_fitness to general", () => {
    expect(intentToTrainingGoal("general_fitness")).toBe("general");
  });
});

describe("migrateLegacyGoal", () => {
  it("passes through valid UserIntent values unchanged", () => {
    expect(migrateLegacyGoal("build_strength")).toBe("build_strength");
    expect(migrateLegacyGoal("lose_fat")).toBe("lose_fat");
  });

  it("migrates legacy TrainingGoal values to UserIntent", () => {
    expect(migrateLegacyGoal("strength")).toBe("build_strength");
    expect(migrateLegacyGoal("hypertrophy")).toBe("build_muscle");
    expect(migrateLegacyGoal("endurance")).toBe("improve_endurance");
    expect(migrateLegacyGoal("general")).toBe("general_fitness");
  });

  it("defaults to general_fitness for unknown values", () => {
    expect(migrateLegacyGoal("unknown_garbage")).toBe("general_fitness");
  });

  it("defaults to general_fitness for non-string values", () => {
    expect(migrateLegacyGoal(null)).toBe("general_fitness");
    expect(migrateLegacyGoal(undefined)).toBe("general_fitness");
    expect(migrateLegacyGoal(42)).toBe("general_fitness");
    expect(migrateLegacyGoal({})).toBe("general_fitness");
  });
});

describe("intentHasFinisher", () => {
  it("returns true for lose_fat", () => {
    expect(intentHasFinisher("lose_fat")).toBe(true);
  });

  it("returns false for all other intents", () => {
    expect(intentHasFinisher("build_strength")).toBe(false);
    expect(intentHasFinisher("build_muscle")).toBe(false);
    expect(intentHasFinisher("improve_endurance")).toBe(false);
    expect(intentHasFinisher("general_fitness")).toBe(false);
  });
});
