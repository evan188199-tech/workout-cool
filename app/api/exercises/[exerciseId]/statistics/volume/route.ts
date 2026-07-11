import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { VolumeResponse, StatisticsErrorResponse } from "@/shared/types/statistics.types";
import { prisma } from "@/shared/lib/prisma";
import { PremiumService } from "@/shared/lib/premium/premium.service";
import { STATISTICS_TIMEFRAMES, DEFAULT_TIMEFRAME, TIMEFRAME_DAYS } from "@/shared/constants/statistics";
import { getMobileCompatibleSession } from "@/shared/api/mobile-auth";

const timeframeSchema = z.enum([
  STATISTICS_TIMEFRAMES.FOUR_WEEKS,
  STATISTICS_TIMEFRAMES.EIGHT_WEEKS,
  STATISTICS_TIMEFRAMES.TWELVE_WEEKS,
  STATISTICS_TIMEFRAMES.ONE_YEAR,
]);

// Get week number from date
function getWeekNumber(date: Date): string {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tempDate.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
}

// Get week start date (Monday)
function getWeekStartDate(date: Date): Date {
  const tempDate = new Date(date);
  const day = tempDate.getDay();
  const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(tempDate.setDate(diff));
}

function getSetVolume(set: {
  types: string[]
  valuesInt: number[]
  valuesSec: number[]
}): number {
  const repsIndex = set.types.indexOf("REPS");
  const reps = repsIndex !== -1 ? set.valuesInt[repsIndex] || 0 : 0;
  const weightIndex = set.types.indexOf("WEIGHT") !== -1 ? set.types.indexOf("WEIGHT") : set.types.indexOf("BODYWEIGHT");
  const timeIndex = set.types.indexOf("TIME");
  const time = timeIndex !== -1 ? set.valuesSec[timeIndex] || 0 : 0;

  if (reps > 0 && weightIndex !== -1) {
    return reps * (set.valuesInt[weightIndex] || 0);
  }

  if (reps > 0) {
    return reps;
  }

  if (time > 0) {
    return time;
  }

  return 0;
}

function buildWeekBuckets(
  startDate: Date,
  endDate: Date,
): Map<string, { weekStart: Date; totalVolume: number; setCount: number }> {
  const buckets = new Map<string, { weekStart: Date; totalVolume: number; setCount: number }>();
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= endDate.getTime()) {
    const weekKey = getWeekNumber(cursor);
    if (!buckets.has(weekKey)) {
      buckets.set(weekKey, { weekStart: getWeekStartDate(cursor), totalVolume: 0, setCount: 0 });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  return buckets;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ exerciseId: string }> }) {
  try {
    // Get user session
    const session = await getMobileCompatibleSession(request);
    const user = session?.user;

    if (!user) {
      const errorResponse: StatisticsErrorResponse = {
        error: "UNAUTHORIZED",
        message: "Authentication required",
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Check premium status
    const premiumStatus = await PremiumService.checkUserPremiumStatus(user.id);

    if (!premiumStatus.isPremium) {
      const errorResponse: StatisticsErrorResponse = {
        error: "PREMIUM_REQUIRED",
        message: "Exercise statistics is a premium feature",
        isPremium: false,
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // Parse timeframe
    const { searchParams } = new URL(request.url);
    const timeframeRaw = searchParams.get("timeframe") || DEFAULT_TIMEFRAME;

    const timeframeParsed = timeframeSchema.safeParse(timeframeRaw);
    if (!timeframeParsed.success) {
      const errorResponse: StatisticsErrorResponse = {
        error: "INVALID_PARAMETERS",
        message: "Invalid timeframe parameter",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const timeframe = timeframeParsed.data;

    // Calculate date range (ensuring we're working with UTC dates to avoid timezone issues)
    const endDate = new Date();
    const startDate = new Date();

    const daysToSubtract = TIMEFRAME_DAYS[timeframe];
    if (timeframe === STATISTICS_TIMEFRAMES.ONE_YEAR) {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      startDate.setDate(startDate.getDate() - daysToSubtract);
    }

    // Set time to start and end of day in UTC
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    const { exerciseId } = await params;

    // Fetch all sets for volume calculation
    const workoutSessionExercises = await prisma.workoutSessionExercise.findMany({
      where: {
        exerciseId,
        workoutSession: {
          userId: user.id,
          startedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        workoutSession: {
          select: {
            startedAt: true,
          },
        },
        sets: {
          where: {
            completed: true,
          },
          orderBy: {
            setIndex: "asc",
          },
        },
      },
      orderBy: {
        workoutSession: {
          startedAt: "asc",
        },
      },
    });

    // Calculate weekly volume
    const weeklyVolume = buildWeekBuckets(startDate, endDate);

    workoutSessionExercises.forEach((sessionExercise) => {
      const weekKey = getWeekNumber(sessionExercise.workoutSession.startedAt);
      const weekStart = getWeekStartDate(sessionExercise.workoutSession.startedAt);

      sessionExercise.sets.forEach((set) => {
        const repsIndex = set.types.indexOf("REPS");
        const timeIndex = set.types.indexOf("TIME");
        const reps = repsIndex !== -1 ? set.valuesInt[repsIndex] || 0 : 0;
        const time = timeIndex !== -1 ? set.valuesSec[timeIndex] || 0 : 0;

        if (reps <= 0 && time <= 0) {
          return;
        }

        const volume = getSetVolume({
          types: set.types,
          valuesInt: set.valuesInt,
          valuesSec: set.valuesSec,
        });

        const currentWeek = weeklyVolume.get(weekKey) || { weekStart, totalVolume: 0, setCount: 0 };
        weeklyVolume.set(weekKey, {
          weekStart,
          totalVolume: currentWeek.totalVolume + volume,
          setCount: currentWeek.setCount + 1,
        });
      });
    });

    // Convert to array format
    const volumeProgression = Array.from(weeklyVolume.entries())
      .sort(([, a], [, b]) => a.weekStart.getTime() - b.weekStart.getTime())
      .map(([week, data]) => ({
        week,
        weekStart: data.weekStart.toISOString(),
        totalVolume: Math.round(data.totalVolume),
        setCount: data.setCount,
      }));

    const response: VolumeResponse = {
      exerciseId,
      timeframe,
      data: volumeProgression,
      count: volumeProgression.length,
      calculationNote: "Volume = sets × reps × weight (or reps for bodyweight, or seconds for time-based)",
    };

    // Add cache headers - 1 hour cache (disabled for debugging)
    const headers = new Headers();
    // Temporarily disable cache for debugging
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    // Original: headers.set("Cache-Control", "private, max-age=3600, stale-while-revalidate=86400");

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Error fetching volume data:", error);
    const errorResponse: StatisticsErrorResponse = {
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch volume data",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
