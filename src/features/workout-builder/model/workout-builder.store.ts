import { create } from "zustand";
import { ExerciseAttributeValueEnum, WorkoutSessionExercise } from "@prisma/client";

import { WorkoutBuilderStep } from "../types";
import { shuffleExerciseAction } from "../actions/shuffle-exercise.action";
import { pickExerciseAction } from "../actions/pick-exercise.action";
import { getExercisesAction } from "../actions/get-exercises.action";

import type { UserIntent } from "@/features/training-science/model/user-intent";
import type { DaysPerWeek } from "@/features/training-science/model/types";
import type { QuickTimeBudget } from "@/features/training-science/model/quick-session";
import type { QuickSetScheme } from "@/features/training-science/model/quick-session";

import { quickTrainingLocal } from "@/shared/lib/workout-session/quick-training.local";
import { intentToTrainingGoal } from "@/features/training-science/model/user-intent";
import { getQuickSessionAction } from "@/features/training-science/actions/get-quick-session.action";
import { normalizeWorkoutPreferences } from "@/shared/lib/user-preferences";

interface WorkoutBuilderState {
  currentStep: WorkoutBuilderStep;
  selectedEquipment: ExerciseAttributeValueEnum[];
  selectedMuscles: ExerciseAttributeValueEnum[];

  // Training science: intent (user-facing) + split
  selectedIntent: UserIntent;
  selectedDaysPerWeek: DaysPerWeek | null;
  // Derived from intent -- read-only, do not set directly
  selectedGoal: () => ReturnType<typeof intentToTrainingGoal>;
  // Which training day the user selected from the split (null in free mode)
  selectedSplitDay: number | null;

  // Quick (office / snack) training mode
  quickMode: boolean;
  quickTimeBudget: QuickTimeBudget;
  recommendedPlanMinutes: number;
  restIntervalSeconds: number;
  warmupRoutineEnabled: boolean;
  warmupExerciseCount: number;
  warmupReps: number;
  cooldownRoutineEnabled: boolean;
  cooldownExerciseCount: number;
  cooldownHoldSeconds: number;
  isGeneratingQuick: boolean;
  quickError: string | null;
  quickSetScheme: QuickSetScheme | null;
  isUsingBodyweightOnlyMode: boolean;
  isLoadingWorkoutPreferences: boolean;

  // Quick plan session (advances the split, one-click full workout)
  isGeneratingPlanSession: boolean;
  planSessionError: string | null;

  exercisesByMuscle: any[]; //TODO: type this
  isLoadingExercises: boolean;
  exercisesError: any; //TODO: type this
  exercisesOrder: string[];
  shufflingExerciseId: string | null;

  setStep: (step: WorkoutBuilderStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  toggleEquipment: (equipment: ExerciseAttributeValueEnum) => void;
  clearEquipment: () => void;
  toggleMuscle: (muscle: ExerciseAttributeValueEnum) => void;
  clearMuscles: () => void;
  setMuscles: (muscles: ExerciseAttributeValueEnum[]) => void;
  setIntent: (intent: UserIntent) => void;
  setDaysPerWeek: (days: DaysPerWeek | null) => void;
  selectSplitDay: (dayNumber: number, muscles: ExerciseAttributeValueEnum[]) => void;
  setQuickTimeBudget: (budget: QuickTimeBudget) => void;
  setRecommendedPlanMinutes: (minutes: number) => void;
  setRestIntervalSeconds: (seconds: number) => void;
  setWarmupRoutineEnabled: (enabled: boolean) => void;
  setWarmupExerciseCount: (count: number) => void;
  setWarmupReps: (reps: number) => void;
  setCooldownRoutineEnabled: (enabled: boolean) => void;
  setCooldownExerciseCount: (count: number) => void;
  setCooldownHoldSeconds: (seconds: number) => void;
  generateQuickSession: () => Promise<void>;
  generatePlanSession: (recommendedDay: number, muscles: ExerciseAttributeValueEnum[], recommendedDurationMinutes?: number) => Promise<void>;
  fetchExercises: () => Promise<void>;
  setExercisesOrder: (order: string[]) => void;
  setExercisesByMuscle: (exercisesByMuscle: any[]) => void;
  shuffleExercise: (exerciseId: string, muscle: ExerciseAttributeValueEnum) => Promise<void>;
  pickExercise: (exerciseId: string) => Promise<void>;
  deleteExercise: (exerciseId: string) => void;
  loadFromSession: (params: {
    equipment: ExerciseAttributeValueEnum[];
    muscles: ExerciseAttributeValueEnum[];
    exercisesByMuscle: {
      muscle: ExerciseAttributeValueEnum;
      exercises: WorkoutSessionExercise[];
    }[];
    exercisesOrder: string[];
  }) => void;
  refreshWorkoutPreferences: () => Promise<void>;
}

export const useWorkoutBuilderStore = create<WorkoutBuilderState>((set, get) => ({
  currentStep: 1 as WorkoutBuilderStep,
  selectedEquipment: [],
  selectedMuscles: [],
  selectedIntent: "general_fitness" as UserIntent,
  selectedDaysPerWeek: null,
  selectedSplitDay: null,
  selectedGoal: () => intentToTrainingGoal(get().selectedIntent),

  quickMode: false,
  quickTimeBudget: 10,
  recommendedPlanMinutes: 30,
  restIntervalSeconds: 30,
  warmupRoutineEnabled: true,
  warmupExerciseCount: 3,
  warmupReps: 10,
  cooldownRoutineEnabled: true,
  cooldownExerciseCount: 2,
  cooldownHoldSeconds: 30,
  isGeneratingQuick: false,
  quickError: null,
  quickSetScheme: null,
  isUsingBodyweightOnlyMode: false,
  isLoadingWorkoutPreferences: false,

  isGeneratingPlanSession: false,
  planSessionError: null,

  exercisesByMuscle: [],
  isLoadingExercises: false,
  exercisesError: null,
  exercisesOrder: [],
  shufflingExerciseId: null,

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 3) as WorkoutBuilderStep })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) as WorkoutBuilderStep })),

  toggleEquipment: (equipment) =>
    set((state) => ({
      selectedEquipment: state.selectedEquipment.includes(equipment)
        ? state.selectedEquipment.filter((e) => e !== equipment)
        : [...state.selectedEquipment, equipment],
    })),
  clearEquipment: () => set({ selectedEquipment: [] }),

  toggleMuscle: (muscle) =>
    set((state) => ({
      selectedMuscles: state.selectedMuscles.includes(muscle)
        ? state.selectedMuscles.filter((m) => m !== muscle)
        : [...state.selectedMuscles, muscle],
    })),
  clearMuscles: () => set({ selectedMuscles: [] }),

  // Bulk-set muscles (used when auto-filling from a split day selection)
  setMuscles: (muscles) => set({ selectedMuscles: muscles }),

  setIntent: (intent) => set({ selectedIntent: intent }),
  setDaysPerWeek: (days) => set({ selectedDaysPerWeek: days }),

  // Select a training day from the split: auto-fills muscles for that day
  selectSplitDay: (dayNumber, muscles) =>
    set({ selectedSplitDay: dayNumber, selectedMuscles: muscles }),

  setQuickTimeBudget: (budget) => {
    quickTrainingLocal.setTimeBudget(budget);
    set({ quickTimeBudget: budget });
  },
  setRecommendedPlanMinutes: (minutes) => set({ recommendedPlanMinutes: Math.max(20, Math.min(Math.round(minutes), 60)) }),
  setRestIntervalSeconds: (seconds) => set({ restIntervalSeconds: Math.max(5, Math.min(Math.round(seconds), 180)) }),
  setWarmupRoutineEnabled: (enabled) => set({ warmupRoutineEnabled: enabled }),
  setWarmupExerciseCount: (count) => set({ warmupExerciseCount: Math.max(1, Math.min(Math.round(count), 4)) }),
  setWarmupReps: (reps) => set({ warmupReps: Math.max(6, Math.min(Math.round(reps), 15)) }),
  setCooldownRoutineEnabled: (enabled) => set({ cooldownRoutineEnabled: enabled }),
  setCooldownExerciseCount: (count) => set({ cooldownExerciseCount: Math.max(1, Math.min(Math.round(count), 4)) }),
  setCooldownHoldSeconds: (seconds) => set({ cooldownHoldSeconds: Math.max(20, Math.min(Math.round(seconds), 40)) }),

  refreshWorkoutPreferences: async () => {
    set({ isLoadingWorkoutPreferences: true });
    try {
      const res = await fetch("/api/user/preferences", { credentials: "include" });
      if (!res.ok) {
        throw new Error("failed_to_fetch_preferences");
      }
      const data = await res.json();
      const preferences = normalizeWorkoutPreferences(data?.preferences ?? {});
      const usesBodyweightOnly = preferences.equipmentMode === "bodyweight_only";

      set((state) => ({
        isUsingBodyweightOnlyMode: usesBodyweightOnly,
        recommendedPlanMinutes: preferences.prescription.planSessionMinutes,
        restIntervalSeconds: preferences.prescription.restIntervalSeconds,
        warmupRoutineEnabled: preferences.prescription.warmupRoutineEnabled,
        warmupExerciseCount: preferences.prescription.warmupExerciseCount,
        warmupReps: preferences.prescription.warmupReps,
        cooldownRoutineEnabled: preferences.prescription.cooldownRoutineEnabled,
        cooldownExerciseCount: preferences.prescription.cooldownExerciseCount,
        cooldownHoldSeconds: preferences.prescription.cooldownHoldSeconds,
        quickTimeBudget: quickTrainingLocal.getTimeBudget(),
        selectedEquipment:
          state.selectedEquipment.length > 0
            ? state.selectedEquipment
            : usesBodyweightOnly
              ? [ExerciseAttributeValueEnum.BODY_ONLY]
              : state.selectedEquipment,
      }));
    } catch {
      set({ isUsingBodyweightOnlyMode: false });
    } finally {
      set({ isLoadingWorkoutPreferences: false });
    }
  },

 generateQuickSession: async () => {
    set({ isGeneratingQuick: true, quickError: null });
    try {
      const { quickTimeBudget } = get();
      const result = await getQuickSessionAction({ timeBudgetMin: quickTimeBudget });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data || data.exercisesByMuscle.length === 0) {
        throw new Error("No exercises found for the recommended muscles.");
      }
      set({
        selectedEquipment: data.selectedEquipment,
        selectedMuscles: data.selectedMuscles,
        exercisesByMuscle: data.exercisesByMuscle,
        selectedSplitDay: null,
       quickMode: true,
       isGeneratingQuick: false,
       quickSetScheme: data.setScheme ?? null,
       currentStep: 3 as WorkoutBuilderStep,
      });
    } catch (error) {
      set({ isGeneratingQuick: false, quickError: error instanceof Error ? error.message : String(error) });
    }
 },

  generatePlanSession: async (recommendedDay, muscles, recommendedDurationMinutes) => {
    const { selectedEquipment } = get();
      if (selectedEquipment.length === 0 && !get().isUsingBodyweightOnlyMode) {
        set({ planSessionError: "Select at least one equipment first." });
        return;
      }
    const requestedMinutes = recommendedDurationMinutes
      ? Math.max(20, Math.min(recommendedDurationMinutes, 50))
      : get().recommendedPlanMinutes;
    const baseTarget = Math.max(1, Math.round(requestedMinutes / 5));
    const perMuscleLimit = Math.max(1, Math.min(4, Math.ceil(baseTarget / Math.max(muscles.length, 1))));
    set({ isGeneratingPlanSession: true, planSessionError: null });
    try {
      const equipmentFilter = selectedEquipment.length > 0
        ? selectedEquipment
        : get().isUsingBodyweightOnlyMode
          ? [ExerciseAttributeValueEnum.BODY_ONLY]
          : [];

      const result = await getExercisesAction({
        equipment: equipmentFilter,
        muscles,
        limit: perMuscleLimit,
        goal: get().selectedGoal(),
      });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data || data.length === 0) {
        throw new Error("No exercises found for today's muscles with your equipment.");
      }
      set({
        selectedMuscles: muscles,
        exercisesByMuscle: data,
        selectedSplitDay: recommendedDay,
        quickMode: false,
        isGeneratingPlanSession: false,
        currentStep: 3 as WorkoutBuilderStep,
      });
    } catch (error) {
      set({
        isGeneratingPlanSession: false,
        planSessionError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  fetchExercises: async () => {
    set({ isLoadingExercises: true, exercisesError: null });
    try {
      const { selectedEquipment, selectedMuscles, selectedIntent } = get();
      const result = await getExercisesAction({
        equipment: selectedEquipment,
        muscles: selectedMuscles,
        limit: 3,
        goal: intentToTrainingGoal(selectedIntent),
      });
      if (result?.serverError) {
        throw new Error(result.serverError);
      }
      set({ exercisesByMuscle: result?.data || [], isLoadingExercises: false });
    } catch (error) {
      set({ exercisesError: error, isLoadingExercises: false });
    }
  },

  setExercisesOrder: (order) => set({ exercisesOrder: order }),

  setExercisesByMuscle: (exercisesByMuscle) => set({ exercisesByMuscle }),

  deleteExercise: (exerciseId) =>
    set((state) => ({
      exercisesByMuscle: state.exercisesByMuscle
        .map((group) => {
          const filteredExercises = group.exercises.filter((ex: any) => ex.id !== exerciseId);
          if (filteredExercises.length === group.exercises.length) return group;
          return { ...group, exercises: filteredExercises };
        })
        .filter((group) => group.exercises.length > 0),
      exercisesOrder: state.exercisesOrder.filter((id) => id !== exerciseId),
    })),

  shuffleExercise: async (exerciseId, muscle) => {
    set({ shufflingExerciseId: exerciseId });
    try {
      const { selectedEquipment, exercisesByMuscle } = get();
      const allExerciseIds = exercisesByMuscle.flatMap((group) => group.exercises.map((ex: any) => ex.id));
      const result = await shuffleExerciseAction({
        muscle,
        equipment: selectedEquipment,
        excludeExerciseIds: allExerciseIds,
      });
      if (result?.serverError) throw new Error(result.serverError);
      if (result?.data?.exercise) {
        const newExercise = result.data.exercise;
        set((state) => ({
          exercisesByMuscle: state.exercisesByMuscle.map((group) => {
            if (group.muscle === muscle) {
              return {
                ...group,
                exercises: group.exercises.map((ex: any) => (ex.id === exerciseId ? { ...newExercise, order: ex.order } : ex)),
              };
            }
            return group;
          }),
          exercisesOrder: state.exercisesOrder.map((id) => (id === exerciseId ? newExercise.id : id)),
        }));
      }
    } catch (error) {
      console.error("Error shuffling exercise:", error);
      throw error;
    } finally {
      set({ shufflingExerciseId: null });
    }
  },

  pickExercise: async (exerciseId) => {
    try {
      const result = await pickExerciseAction({ exerciseId });
      if (result?.serverError) throw new Error(result.serverError);
      if (result?.data?.success) {
        console.log("Exercise picked successfully:", exerciseId);
      }
    } catch (error) {
      console.error("Error picking exercise:", error);
      throw error;
    }
  },

  loadFromSession: ({ equipment, muscles, exercisesByMuscle, exercisesOrder }) => {
    set({
      selectedEquipment: equipment,
      selectedMuscles: muscles,
      exercisesByMuscle,
      exercisesOrder,
      currentStep: 3,
      isLoadingExercises: false,
      exercisesError: null,
    });
  },
}));
