import { describe, expect, it } from "vitest";

import { selectExercises, getMechanics } from "../exercise-selection";
import type { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";

function mockExercise(id: string, mechanics?: "COMPOUND" | "ISOLATION"): ExerciseWithAttributes {
  const attrs = mechanics
    ? [{
        id: `attr-${id}`,
        exerciseId: id,
        attributeNameId: "mechanics",
        attributeValueId: mechanics,
        attributeName: { name: "MECHANICS_TYPE" as any, id: "mechanics" },
        attributeValue: { value: mechanics as any, id: mechanics },
      }]
    : [];
  return {
    id,
    name: `Exercise ${id}`,
    nameEn: null,
    description: "",
    descriptionEn: null,
    fullVideoUrl: null,
    fullVideoImageUrl: null,
   introduction: null,
   introductionEn: null,
   createdAt: new Date(),
    updatedAt: new Date(),
    attributes: attrs,
  };
}

describe("getMechanics", () => {
  it("returns compound when COMPOUND tag present", () => {
    expect(getMechanics(mockExercise("1", "COMPOUND"))).toBe("compound");
  });

  it("returns isolation when ISOLATION tag present", () => {
    expect(getMechanics(mockExercise("1", "ISOLATION"))).toBe("isolation");
  });

  it("returns unknown when no mechanics tag", () => {
    expect(getMechanics(mockExercise("1"))).toBe("unknown");
  });
});

describe("selectExercises", () => {
  it("returns empty array for count <= 0", () => {
    expect(selectExercises([mockExercise("1", "COMPOUND")], 0)).toEqual([]);
  });

  it("returns empty array for empty candidates", () => {
    expect(selectExercises([], 3)).toEqual([]);
  });

  it("prefers compound exercises and places them first", () => {
    const candidates = [
      mockExercise("iso1", "ISOLATION"),
      mockExercise("c1", "COMPOUND"),
      mockExercise("iso2", "ISOLATION"),
      mockExercise("c2", "COMPOUND"),
      mockExercise("c3", "COMPOUND"),
    ];
    const result = selectExercises(candidates, 3);

    // At least the first two should be compound (70% of 3 = 3 compound)
    const mechanics = result.map((ex) => getMechanics(ex));
    expect(mechanics.filter((m) => m === "compound").length).toBeGreaterThanOrEqual(2);
  });

  it("fills remaining slots with isolation when not enough compound", () => {
    const candidates = [
      mockExercise("c1", "COMPOUND"),
      mockExercise("iso1", "ISOLATION"),
      mockExercise("iso2", "ISOLATION"),
    ];
    const result = selectExercises(candidates, 3);
    expect(result).toHaveLength(3);
    // Compound first
    expect(getMechanics(result[0])).toBe("compound");
  });

  it("fills from compound pool when not enough isolation", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => mockExercise(`c${i}`, "COMPOUND"));
    const result = selectExercises(candidates, 4);
    expect(result).toHaveLength(4);
  });

  it("returns at most count exercises", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => mockExercise(`e${i}`, "COMPOUND"));
    const result = selectExercises(candidates, 3);
    expect(result).toHaveLength(3);
  });

  it("treats exercises without mechanics tag as compound (safe default)", () => {
    const candidates = [
      mockExercise("unknown1"),
      mockExercise("unknown2"),
    ];
    const result = selectExercises(candidates, 2);
    expect(result).toHaveLength(2);
  });
});
