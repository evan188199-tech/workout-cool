import { describe, expect, it } from "vitest";
import { ExerciseAttributeValueEnum } from "@prisma/client";

import { generateSplit, muscleFrequencyInSplit, distributeVolumeForDay, distributeVolumeForSplit } from "../split-generator";

describe("generateSplit", () => {
  it("generates 2-day full-body split", () => {
    const split = generateSplit(2);
    expect(split.daysPerWeek).toBe(2);
    expect(split.type).toBe("fullbody");
    expect(split.days).toHaveLength(2);
  });

  it("generates 3-day PPL split", () => {
    const split = generateSplit(3);
    expect(split.daysPerWeek).toBe(3);
    expect(split.type).toBe("ppl");
    expect(split.days).toHaveLength(3);
  });

  it("generates 4-day upper/lower split", () => {
    const split = generateSplit(4);
    expect(split.daysPerWeek).toBe(4);
    expect(split.type).toBe("upperlower");
    expect(split.days).toHaveLength(4);
  });

  it("generates 5-day PPL+UL split", () => {
 const split = generateSplit(5);
    expect(split.daysPerWeek).toBe(5);
    expect(split.type).toBe("ppl-ul");
    expect(split.days).toHaveLength(5);
  });
});

describe("muscleFrequencyInSplit", () => {
  it("counts muscle appearances across all days", () => {
    const split = generateSplit(3); // PPL
    const freq = muscleFrequencyInSplit(split);

    // PPL: each muscle appears exactly once
    expect(freq.get(ExerciseAttributeValueEnum.CHEST)).toBe(1);
    expect(freq.get(ExerciseAttributeValueEnum.BACK)).toBe(1);
  });

  it("reports 2x frequency for muscles in 4-day and 5-day splits", () => {
    const split4 = generateSplit(4);
    const freq4 = muscleFrequencyInSplit(split4);
    // CHEST appears in Upper A and Upper B
    expect(freq4.get(ExerciseAttributeValueEnum.CHEST)).toBe(2);

    const split5 = generateSplit(5);
    const freq5 = muscleFrequencyInSplit(split5);
    // CHEST appears in Push and Upper
    expect(freq5.get(ExerciseAttributeValueEnum.CHEST)).toBe(2);
  });
});

describe("distributeVolumeForDay", () => {
  it("allocates sets = weeklyTarget / frequency", () => {
    const split = generateSplit(3); // PPL, CHEST freq = 1
    const freqMap = muscleFrequencyInSplit(split);
    const pushDay = split.days[0]; // Push: CHEST, SHOULDERS, TRICEPS

    const allocations = distributeVolumeForDay(pushDay, "hypertrophy", freqMap);

    const chestAlloc = allocations.find((a) => a.muscle === ExerciseAttributeValueEnum.CHEST);
    expect(chestAlloc).toBeDefined();
    // CHEST is large muscle, hypertrophy weekly target = 16, freq = 1
    expect(chestAlloc!.setsThisDay).toBe(16);
    expect(chestAlloc!.exerciseCount).toBeGreaterThanOrEqual(4); // ceil(16/4) = 4
  });

  it("halves volume when muscle appears 2x per week", () => {
    const split5 = generateSplit(5);
    const freqMap = muscleFrequencyInSplit(split5);
    const upperDay = split5.days[3]; // Upper: CHEST appears

    const allocations = distributeVolumeForDay(upperDay, "hypertrophy", freqMap);
    const chestAlloc = allocations.find((a) => a.muscle === ExerciseAttributeValueEnum.CHEST);

    // CHEST: weekly 16, freq 2 => 8 sets per day
    expect(chestAlloc!.setsThisDay).toBe(8);
    expect(chestAlloc!.exerciseCount).toBe(2); // ceil(8/4) = 2
  });

  it("ensures minimum 1 set and 1 exercise", () => {
    const split = generateSplit(2);
    const freqMap = muscleFrequencyInSplit(split);
    const day1 = split.days[0];

    const allocations = distributeVolumeForDay(day1, "general", freqMap);
    expect(allocations.every((a) => a.setsThisDay >= 1)).toBe(true);
    expect(allocations.every((a) => a.exerciseCount >= 1)).toBe(true);
  });
});

describe("distributeVolumeForSplit", () => {
  it("produces allocations for every day in the split", () => {
    const split = generateSplit(4);
    const allAllocs = distributeVolumeForSplit(split, "strength");

    expect(allAllocs).toHaveLength(4);
    expect(allAllocs.every((dayAllocs) => dayAllocs.length > 0)).toBe(true);
  });
});
