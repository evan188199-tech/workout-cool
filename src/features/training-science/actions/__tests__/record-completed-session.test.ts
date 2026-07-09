import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the prisma singleton so we can assert on the plan update.
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/shared/lib/prisma", () => ({
  prisma: {
    userTrainingPlan: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Avoid loading better-auth (which needs env vars) — the function under test
// does not use `auth`, but the module is imported at the top of the action.
vi.mock("@/features/auth/lib/better-auth", () => ({ auth: {} }));

import { recordCompletedSession } from "../training-plan.action";

const PLAN = (overrides: Partial<{ isActive: boolean; daysPerWeek: number }> = {}) => ({
  id: "plan-1",
  isActive: true,
  daysPerWeek: 2,
  ...overrides,
});

describe("recordCompletedSession", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({});
  });

  it("ignores free-mode sessions (no split day)", async () => {
    await recordCompletedSession("user-1", null);
    await recordCompletedSession("user-1", 0);
    await recordCompletedSession("user-1", undefined);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips when the user has no active training plan", async () => {
    mockFindUnique.mockResolvedValue(null);

    await recordCompletedSession("user-1", 1);

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips an inactive plan", async () => {
    mockFindUnique.mockResolvedValue(PLAN({ isActive: false }));

    await recordCompletedSession("user-1", 1);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("increments the counter and advances to the next split day", async () => {
    mockFindUnique.mockResolvedValue(PLAN({ daysPerWeek: 2 }));

    await recordCompletedSession("user-1", 1); // completed Day 1 of a 2-day split

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { completedSessions: { increment: 1 }, currentDay: 2 },
    });
  });

  it("wraps currentDay back to 1 after the last split day", async () => {
    mockFindUnique.mockResolvedValue(PLAN({ daysPerWeek: 2 }));

    await recordCompletedSession("user-1", 2); // completed Day 2 (last day) -> wrap to 1

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { completedSessions: { increment: 1 }, currentDay: 1 },
    });
  });
});
