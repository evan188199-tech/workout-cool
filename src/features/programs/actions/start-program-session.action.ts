"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { prisma } from "@/shared/lib/prisma";
import { auth } from "@/features/auth/lib/better-auth";
import { applyProgressionOverlay, type OverlayExerciseInput } from "@/features/training-science/model/progression-overlay";
import { loadUserSetEntries } from "@/features/workout-analytics/actions/load-set-entries";

export async function startProgramSession(enrollmentId: string, sessionId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const userId = session.user?.id;

  if (!userId) {
    throw new Error("User not found");
  }

  // Verify enrollment belongs to user
  const enrollment = await prisma.userProgramEnrollment.findFirst({
    where: {
      id: enrollmentId,
      userId,
    },
    include: {
      program: true,
    },
  });

  if (!enrollment) {
    throw new Error("Enrollment not found");
  }

  // Check if session already started
  const existingProgress = await prisma.userSessionProgress.findUnique({
    where: {
      enrollmentId_sessionId: {
        enrollmentId,
        sessionId,
      },
    },
  });

  if (existingProgress) {
    return { sessionProgress: existingProgress, isNew: false };
  }

  // Get session details to update current week/session
  const programSession = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      week: true,
      exercises: {
        include: {
          exercise: {
            include: {
              attributes: {
                include: {
                  attributeName: true,
                  attributeValue: true,
                },
              },
            },
          },
          suggestedSets: {
            orderBy: { setIndex: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!programSession) {
    throw new Error("Session not found");
  }

  // Create session progress
  const sessionProgress = await prisma.userSessionProgress.create({
    data: {
      enrollmentId,
      sessionId,
    },
  });

  // Update enrollment current position
  await prisma.userProgramEnrollment.update({
    where: { id: enrollmentId },
    data: {
      currentWeek: programSession.week.weekNumber,
      currentSession: programSession.sessionNumber,
    },
  });

  revalidatePath(`/programs/${enrollment.program.slug}`);

  // Apply progression overlay: adjust suggested sets/weights based on the user's
  // real training history (plateau detection + ACWR deload). Falls back to the
  // static program data if the user has no history.
  let overlayResult = null;
  try {
    const history = await loadUserSetEntries(userId, 120);
    const overlayInputs: OverlayExerciseInput[] = programSession.exercises.flatMap((ex) =>
      ex.suggestedSets.map(() => ({
        exerciseId: ex.exerciseId,
        suggestedSets: ex.suggestedSets.length,
        suggestedWeightKg: 0,
      })),
    );
    overlayResult = applyProgressionOverlay(overlayInputs, history);
  } catch (e) {
    // Fail safe: overlay is a bonus, not critical.
  }

  return {
    sessionProgress,
    isNew: true,
    sessionData: programSession,
    overlay: overlayResult,
  };
}
