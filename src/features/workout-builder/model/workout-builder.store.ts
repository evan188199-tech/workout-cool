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
  isGeneratingQuick: boolean;
  quickError: string | null;
  quickSetScheme: QuickSetScheme | null;

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
  generateQuickSession: () => Promise<void>;
  generatePlanSession: (recommendedDay: number, muscles: ExerciseAttributeValueEnum[]) => Promise<void>;
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
  isGeneratingQuick: false,
  quickError: null,
  quickSetScheme: null,

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

 generateQuickSession: async () => {
    set({ isGeneratingQuick: true, quickError: null });
    try {
      const { quickTimeBudget } = get();
      const result = await getQuickSessionAction({ timeBudgetMin: quickTimeBudget });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data || data.exercisesByMuscle.length === 0) {
        throw new Error("No bodyweight exercises found for the recommended muscles.");
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

  generatePlanSession: async (recommendedDay, muscles) => {
    const { selectedEquipment } = get();
    if (selectedEquipment.length === 0) {
      set({ planSessionError: "Select at least one equipment first." });
      return;
    }
    set({ isGeneratingPlanSession: true, planSessionError: null });
    try {
      const result = await getExercisesAction({
        equipment: selectedEquipment,
        muscles,
        limit: 3,
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
