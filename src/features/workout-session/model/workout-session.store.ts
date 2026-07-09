import { create } from "zustand";

import type { QuickSetScheme } from "@/features/training-science/model/quick-session";

import { workoutSessionLocal } from "@/shared/lib/workout-session/workout-session.local";
import {
  type WorkoutSession,
  type WorkoutSessionPrescription,
} from "@/shared/lib/workout-session/types/workout-session";
import { convertWeight, type WeightUnit } from "@/shared/lib/weight-conversion";
import { WorkoutSessionExercise, WorkoutSet, WorkoutSetType, WorkoutSetUnit } from "@/features/workout-session/types/workout-set";
import { useWorkoutBuilderStore } from "@/features/workout-builder/model/workout-builder.store";
import { ExerciseWithAttributes } from "@/entities/exercise/types/exercise.types";
import { isBodyweightExercise } from "@/entities/exercise/shared/exercise-type";

interface WorkoutSessionProgress {
  exerciseId: string;
  sets: {
    reps: number;
    weight?: number;
    duration?: number;
  }[];
  completed: boolean;
}

interface WorkoutSessionState {
  sessionPrescription: WorkoutSessionPrescription | null;
  session: WorkoutSession | null;
  progress: Record<string, WorkoutSessionProgress>;
  elapsedTime: number;
  isTimerRunning: boolean;
  isWorkoutActive: boolean;
  currentExerciseIndex: number;
  currentExercise: WorkoutSessionExercise | null;

  // Progression
  exercisesCompleted: number;
  totalExercises: number;
  progressPercent: number;

  // Actions
  startWorkout: (
    exercises: ExerciseWithAttributes[] | WorkoutSessionExercise[],
    equipment: any[],
    muscles: any[],
    splitDay?: number | null,
    targetDurationMinutes?: number,
    setScheme?: QuickSetScheme | null,
    prescription?: WorkoutSessionPrescription,
  ) => void;
  quitWorkout: () => void;
  completeWorkout: () => void;
  setElapsedTime: (seconds: number) => void;
  setTargetDurationSeconds: (seconds: number) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  updateExerciseProgress: (exerciseId: string, progressData: Partial<WorkoutSessionProgress>) => void;
  addSet: () => void;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<WorkoutSet>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  finishSet: (exerciseIndex: number, setIndex: number) => void;
  goToNextExercise: () => void;
  goToPrevExercise: () => void;
  goToExercise: (targetIndex: number) => void;
  formatElapsedTime: () => string;
  getExercisesCompleted: () => number;
  getTotalExercises: () => number;
  getTotalVolume: () => number;
  getTotalVolumeInUnit: (unit: WeightUnit) => number;
  loadSessionFromLocal: () => void;
  addExerciseToSession: (exercise: ExerciseWithAttributes) => void;

  /** Rest countdown between sets (seconds); 0 = inactive. */
  restSeconds: number;
  isRestActive: boolean;
  startRest: (seconds: number) => void;
  stopRest: () => void;
  tickRest: () => void;
  adjustRest: (secondsDelta: number) => void;
}

export const useWorkoutSessionStore = create<WorkoutSessionState>((set, get) => ({
  sessionPrescription: null,
  session: null,
  progress: {},
  elapsedTime: 0,
  isTimerRunning: false,
  isWorkoutActive: false,
  currentExerciseIndex: 0,
  currentExercise: null,
  exercisesCompleted: 0,
  totalExercises: 0,
  progressPercent: 0,

  restSeconds: 0,
  isRestActive: false,
  startRest: (seconds) => set({ restSeconds: seconds, isRestActive: true }),
  stopRest: () => set({ restSeconds: 0, isRestActive: false }),
  adjustRest: (secondsDelta) =>
    set((state) => {
      if (!state.isRestActive || state.restSeconds <= 0) {
        return { restSeconds: state.restSeconds };
      }

      const next = Math.max(0, state.restSeconds + secondsDelta);
      if (next <= 0) {
        return { restSeconds: 0, isRestActive: false };
      }
      return { restSeconds: next };
    }),
  tickRest: () => {
    const { restSeconds, isRestActive } = get();
    if (!isRestActive || restSeconds <= 0) return;
    if (restSeconds <= 1) {
      set({ restSeconds: 0, isRestActive: false });
    } else {
      set({ restSeconds: restSeconds - 1 });
    }
  },

  startWorkout: (
    exercises,
    _equipment,
    muscles,
    splitDay,
    targetDurationMinutes,
    setScheme?,
    prescription,
  ) => {
    const resolvedPrescription: WorkoutSessionPrescription = {
      restIntervalSeconds: prescription?.restIntervalSeconds ?? 30,
      warmupRoutineEnabled: prescription?.warmupRoutineEnabled ?? true,
      warmupExerciseCount: prescription?.warmupExerciseCount ?? 3,
      warmupReps: prescription?.warmupReps ?? 10,
      cooldownRoutineEnabled: prescription?.cooldownRoutineEnabled ?? true,
      cooldownExerciseCount: prescription?.cooldownExerciseCount ?? 2,
      cooldownHoldSeconds: prescription?.cooldownHoldSeconds ?? 30,
      quickSetRestAfterSetSeconds: setScheme?.restAfterSetSeconds,
      targetDurationSeconds: targetDurationMinutes ? targetDurationMinutes * 60 : undefined,
    };
    const sessionExercises: WorkoutSessionExercise[] = exercises.map((ex, idx) => {
      // Check if exercise already has sets (from program)
      if ("sets" in ex && ex.sets && ex.sets.length > 0) {
        return {
          ...ex,
          order: idx,
        } as WorkoutSessionExercise;
      }

      // Default sets: quick mode uses the engine's setScheme; custom workouts get 1 set.
      return {
        ...ex,
        order: idx,
        sets: Array.from({ length: setScheme?.setsPerExercise ?? 1 }, (_, setIdx) => ({
          id: `${ex.id}-set-${setIdx + 1}`,
          setIndex: setIdx,
         types: setScheme?.holdSeconds
           ? ["TIME" as WorkoutSetType]
           : isBodyweightExercise(ex)
             ? ["REPS" as WorkoutSetType, "BODYWEIGHT" as WorkoutSetType]
             : ["REPS" as WorkoutSetType, "WEIGHT" as WorkoutSetType],
          valuesInt: setScheme?.holdSeconds ? [] : [setScheme?.targetReps ?? 12],
          valuesSec: setScheme?.holdSeconds ? [setScheme.holdSeconds] : [],
         units: [],
          completed: false,
        })) satisfies WorkoutSet[],
      } as WorkoutSessionExercise;
    });

    const newSession: WorkoutSession = {
      id: Date.now().toString(),
      userId: "local",
      startedAt: new Date().toISOString(),
      exercises: sessionExercises,
      status: "active",
      muscles,
      splitDay: splitDay ?? null,
      prescription: resolvedPrescription,
    };

    workoutSessionLocal.add(newSession);
    workoutSessionLocal.setCurrent(newSession.id);

    set({
      session: newSession,
      elapsedTime: 0,
      isTimerRunning: false,
      isWorkoutActive: true,
      sessionPrescription: resolvedPrescription,
      currentExercise: sessionExercises[0],
    });
  },

  quitWorkout: () => {
    const { session } = get();
    if (session) {
      workoutSessionLocal.remove(session.id);
    }
    set({
      session: null,
      sessionPrescription: null,
      progress: {},
      elapsedTime: 0,
      isTimerRunning: false,
      isWorkoutActive: false,
      currentExerciseIndex: 0,
      currentExercise: null,
    });
  },

  completeWorkout: () => {
    const { session, elapsedTime } = get();

    if (session) {
      // Mark all incomplete sets as completed so analytics picks them up.
      // Without this, sessions finished via "Finish Session" (without clicking
      // each individual "Finish Set") are invisible to ACWR / volume charts.
      const completedExercises = session.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((set) => ({ ...set, completed: true })),
      }));
      const completedSession = {
        ...session,
        exercises: completedExercises,
        duration: elapsedTime,
      };

      workoutSessionLocal.update(session.id, {
        status: "completed",
        endedAt: new Date().toISOString(),
        duration: elapsedTime,
        exercises: completedExercises,
      });
      set({
        session: {
          ...completedSession,
          status: "completed",
          endedAt: new Date().toISOString(),
        },
        progress: {},
        elapsedTime: 0,
        isTimerRunning: false,
        isWorkoutActive: false,
        sessionPrescription: null,
      });
    }

    useWorkoutBuilderStore.getState().setStep(1);
  },

  toggleTimer: () => {
    set((state) => {
      const newIsRunning = !state.isTimerRunning;
      if (state.session) {
        workoutSessionLocal.update(state.session.id, { isActive: newIsRunning });
      }
      return { isTimerRunning: newIsRunning };
    });
  },

  setElapsedTime: (seconds) => {
    const safeSeconds = Math.max(seconds, 0);
    set((state) => {
      if (!state.session) {
        return { elapsedTime: safeSeconds };
      }

      workoutSessionLocal.update(state.session.id, {
        duration: safeSeconds,
      });

      return { elapsedTime: safeSeconds };
    });
  },
  setTargetDurationSeconds: (seconds) => {
    const safeSeconds = Math.max(Math.floor(seconds), 0);
    set((state) => {
      if (!state.sessionPrescription) return state;

      const updatedPrescription: WorkoutSessionPrescription = {
        ...state.sessionPrescription,
        targetDurationSeconds: safeSeconds,
      };

      if (state.session) {
        workoutSessionLocal.update(state.session.id, {
          prescription: updatedPrescription,
        });
      }

      return {
        sessionPrescription: updatedPrescription,
      };
    });
  },

  resetTimer: () => {
    set((state) => {
      if (state.session) {
        workoutSessionLocal.update(state.session.id, { duration: 0 });
      }
      return { elapsedTime: 0 };
    });
  },

  updateExerciseProgress: (exerciseId, progressData) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [exerciseId]: {
          ...state.progress[exerciseId],
          exerciseId,
          sets: [],
          completed: false,
          ...progressData,
        },
      },
    }));
  },

  addSet: () => {
    const { session, currentExerciseIndex } = get();
    if (!session) return;

    const exIdx = currentExerciseIndex;
    const currentExercise = session.exercises[exIdx];
    const sets = currentExercise.sets;

    let typesToCopy: WorkoutSetType[] = ["REPS"];
    let unitsToCopy: WorkoutSetUnit[] = [];

    if (sets.length > 0) {
      const lastSet = sets[sets.length - 1];

      if (lastSet.types && lastSet.types.length > 0) {
        typesToCopy = [...lastSet.types];
        if (lastSet.units && lastSet.units.length > 0) {
          unitsToCopy = [...lastSet.units];
        }
      }
    }

    const newSet: WorkoutSet = {
      id: `${currentExercise.id}-set-${sets.length + 1}`,
      setIndex: sets.length,
      types: typesToCopy,
      valuesInt: [],
      valuesSec: [],
      units: unitsToCopy,
      completed: false,
    };

    const updatedExercises = session.exercises.map((ex, idx) => (idx === exIdx ? { ...ex, sets: [...ex.sets, newSet] } : ex));

    workoutSessionLocal.update(session.id, { exercises: updatedExercises });

    set({
      session: { ...session, exercises: updatedExercises },
      currentExercise: { ...updatedExercises[exIdx] },
    });
  },

  updateSet: (exerciseIndex, setIndex, data) => {
    const { session } = get();
    if (!session) return;

    const targetExercise = session.exercises[exerciseIndex];
    if (!targetExercise) return;

    const updatedSets = targetExercise.sets.map((set, idx) => (idx === setIndex ? { ...set, ...data } : set));
    const updatedExercises = session.exercises.map((ex, idx) => (idx === exerciseIndex ? { ...ex, sets: updatedSets } : ex));

    workoutSessionLocal.update(session.id, { exercises: updatedExercises });

    set({
      session: { ...session, exercises: updatedExercises },
      currentExercise: { ...updatedExercises[exerciseIndex] },
    });

    // handle exercisesCompleted
  },

  removeSet: (exerciseIndex, setIndex) => {
    const { session } = get();
    if (!session) return;
    const targetExercise = session.exercises[exerciseIndex];
    if (!targetExercise) return;
    const updatedSets = targetExercise.sets.filter((_, idx) => idx !== setIndex);
    const updatedExercises = session.exercises.map((ex, idx) => (idx === exerciseIndex ? { ...ex, sets: updatedSets } : ex));
    workoutSessionLocal.update(session.id, { exercises: updatedExercises });
    set({
      session: { ...session, exercises: updatedExercises },
      currentExercise: { ...updatedExercises[exerciseIndex] },
    });
  },

  finishSet: (exerciseIndex, setIndex) => {
    get().updateSet(exerciseIndex, setIndex, { completed: true });

    // Start rest timer after finishing a set.
    const { sessionPrescription: activePrescription, session } = get();
    const restSeconds =
      activePrescription?.quickSetRestAfterSetSeconds ??
      activePrescription?.restIntervalSeconds ??
      30;
    get().startRest(restSeconds);

    // if has completed all sets, go to next exercise
    if (!session) return;

    const exercise = session.exercises[exerciseIndex];
    if (!exercise) return;

    if (exercise.sets.every((set) => set.completed)) {
      // get().goToNextExercise();
      // update exercisesCompleted
      const exercisesCompleted = get().exercisesCompleted;
      set({ exercisesCompleted: exercisesCompleted + 1 });
    }
  },

  goToNextExercise: () => {
    const { session, currentExerciseIndex } = get();
    if (!session) return;
    const idx = currentExerciseIndex;
    if (idx < session.exercises.length - 1) {
      workoutSessionLocal.update(session.id, { currentExerciseIndex: idx + 1 });
      set({
        currentExerciseIndex: idx + 1,
        currentExercise: session.exercises[idx + 1],
      });
    }
  },

  goToPrevExercise: () => {
    const { session, currentExerciseIndex } = get();
    if (!session) return;
    const idx = currentExerciseIndex;
    if (idx > 0) {
      workoutSessionLocal.update(session.id, { currentExerciseIndex: idx - 1 });
      set({
        currentExerciseIndex: idx - 1,
        currentExercise: session.exercises[idx - 1],
      });
    }
  },

  goToExercise: (targetIndex) => {
    const { session } = get();
    if (!session) return;
    if (targetIndex >= 0 && targetIndex < session.exercises.length) {
      workoutSessionLocal.update(session.id, { currentExerciseIndex: targetIndex });
      set({
        currentExerciseIndex: targetIndex,
        currentExercise: session.exercises[targetIndex],
      });
    }
  },

  getExercisesCompleted: () => {
    const { session } = get();
    if (!session) return 0;

    // only count exercises with at least one set
    return session.exercises
      .filter((exercise) => exercise.sets.length > 0)
      .filter((exercise) => exercise.sets.every((set) => set.completed)).length;
  },

  getTotalExercises: () => {
    const { session } = get();
    if (!session) return 0;
    return session.exercises.length;
  },

  getTotalVolume: () => {
    const { session } = get();
    if (!session) return 0;

    let totalVolume = 0;

    session.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        // Vérifier si le set est complété et contient REPS et WEIGHT
        if (set.completed && set.types.includes("REPS") && (set.types.includes("WEIGHT") || set.types.includes("BODYWEIGHT")) && set.valuesInt) {
          const repsIndex = set.types.indexOf("REPS");
          const weightIndex = set.types.indexOf("WEIGHT") !== -1 ? set.types.indexOf("WEIGHT") : set.types.indexOf("BODYWEIGHT");

          const reps = set.valuesInt[repsIndex] || 0;
          const weight = set.valuesInt[weightIndex] || 0;

          // Convertir les livres en kg si nécessaire
          const weightInKg =
            set.units && set.units[weightIndex] === "lbs"
              ? weight * 0.453592 // 1 lb = 0.453592 kg
              : weight;

          totalVolume += reps * weightInKg;
        }
      });
    });

    return Math.round(totalVolume);
  },

  getTotalVolumeInUnit: (unit: WeightUnit) => {
    const { session } = get();
    if (!session) return 0;

    let totalVolume = 0;

    session.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        // Vérifier si le set est complété et contient REPS et WEIGHT
        if (set.completed && set.types.includes("REPS") && (set.types.includes("WEIGHT") || set.types.includes("BODYWEIGHT")) && set.valuesInt) {
          const repsIndex = set.types.indexOf("REPS");
          const weightIndex = set.types.indexOf("WEIGHT") !== -1 ? set.types.indexOf("WEIGHT") : set.types.indexOf("BODYWEIGHT");

          const reps = set.valuesInt[repsIndex] || 0;
          const weight = set.valuesInt[weightIndex] || 0;

          // Déterminer l'unité de poids originale de la série
          const originalUnit: WeightUnit = set.units && set.units[weightIndex] === "lbs" ? "lbs" : "kg";

          // Convertir vers l'unité demandée
          const convertedWeight = convertWeight(weight, originalUnit, unit);

          totalVolume += reps * convertedWeight;
        }
      });
    });

    return Math.round(totalVolume * 10) / 10; // Arrondir à 1 décimale
  },

  formatElapsedTime: () => {
    const { elapsedTime } = get();
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const secs = elapsedTime % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  },

  loadSessionFromLocal: () => {
    const currentId = workoutSessionLocal.getCurrent();
    if (currentId) {
      const session = workoutSessionLocal.getById(currentId);
      if (session && session.status === "active") {
        set({
          session,
          sessionPrescription: session.prescription ?? null,
          isWorkoutActive: true,
          currentExerciseIndex: session.currentExerciseIndex ?? 0,
          currentExercise: session.exercises[session.currentExerciseIndex ?? 0],
          elapsedTime: session.duration ?? 0,
          isTimerRunning: false,
        });
      }
    }
  },

  addExerciseToSession: (exercise) => {
    const { session } = get();

    if (!session) {
      return;
    }

    // Create new exercise with default sets
    const newExercise: WorkoutSessionExercise = {
      ...exercise,
      order: session.exercises.length,
      sets: [
        {
          id: `${exercise.id}-set-1`,
          setIndex: 0,
          types: isBodyweightExercise(exercise) ? ["REPS", "BODYWEIGHT"] : ["REPS", "WEIGHT"],
          valuesInt: [],
          valuesSec: [],
          units: [],
          completed: false,
        },
      ],
    };

    // Check if exercise already exists to avoid duplicates
    const exerciseExists = session.exercises.some((ex) => ex.id === exercise.id);
    if (exerciseExists) {
      console.log("🟡 [WORKOUT-SESSION] Exercise already exists in session, skipping add");
      return;
    }

    const updatedExercises = [...session.exercises, newExercise];
    const updatedSession = { ...session, exercises: updatedExercises };

    // Update local storage
    workoutSessionLocal.update(session.id, { exercises: updatedExercises });

    // Update state
    set({ session: updatedSession });

    console.log("🟡 [WORKOUT-SESSION] Exercise added successfully to session");
  },
}));
